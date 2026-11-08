-- Original and prepared images remain private until a manager publishes one exact version.
alter table public.ecm_card_artwork_reviews add column original_path text generated always as (user_id::text||'/'||id::text||'/original.png') stored,
 add column preparation text not null default 'legacy' check(preparation in ('legacy','transparent','cutout','original-fallback')),
 add column submitted_layout jsonb not null default '{}'::jsonb;
create table public.ecm_card_publications (
 league text not null check(league in ('lgchl','lg3s')),
 lg_user_id bigint not null,
 player_kind text not null check(player_kind in ('skater','goalie')),
 submission_id uuid not null references public.ecm_card_artwork_reviews(id) on delete cascade,
 object_path text not null,
 layout jsonb not null,
 published_at timestamptz not null default now(),
 primary key(league,lg_user_id,player_kind)
);
alter table public.ecm_card_publications enable row level security;
revoke all on public.ecm_card_publications from public,anon,authenticated;
grant select on public.ecm_card_publications to anon,authenticated;
grant all on public.ecm_card_publications to service_role;
create policy ecm_card_publication_read on public.ecm_card_publications for select to anon,authenticated using(true);
-- Only the selected published image is anonymously readable. Other originals stay private.
create function private.ecm_card_published_object(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ecm_card_publications p join public.ecm_card_artwork_reviews r on r.id=p.submission_id where p.object_path=p_path and r.status='approved');$$;
revoke all on function private.ecm_card_published_object(text) from public;
grant execute on function private.ecm_card_published_object(text) to anon,authenticated;
create policy ecm_card_published_image on storage.objects for select to anon,authenticated using(bucket_id='ecm-card-artwork-review' and private.ecm_card_published_object(name));
create policy ecm_card_original_insert on storage.objects for insert to authenticated with check(bucket_id='ecm-card-artwork-review' and exists(select 1 from public.ecm_card_artwork_reviews r where r.original_path=name and r.user_id=(select auth.uid()) and r.status='draft'));
create policy ecm_card_original_read on storage.objects for select to authenticated using(bucket_id='ecm-card-artwork-review' and exists(select 1 from public.ecm_card_artwork_reviews r where r.original_path=name and (r.user_id=(select auth.uid()) or (select private.wildman_stall_manager()))));

create function private.ecm_card_clean_layout(p_layout jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare s numeric:=coalesce((p_layout->>'imageScale')::numeric,100); x numeric:=coalesce((p_layout->>'imageX')::numeric,0); y numeric:=coalesce((p_layout->>'imageY')::numeric,0); f text:=coalesce(p_layout->>'finish','ice'); b text:=coalesce(p_layout->>'background','arena'); e text:=coalesce(p_layout->>'edition','season');
begin
 if s not between 50 and 200 or x not between -150 and 150 or y not between -150 and 150 or f not in ('ice','gold','crimson') or b not in ('arena','heat','city','locker','playoff','storm','classic') or e not in ('season','base','silver','gold','platinum','signature','playoff') then raise exception 'Invalid card placement.';end if;
 return jsonb_build_object('imageScale',s,'imageX',x,'imageY',y,'finish',f,'background',b,'edition',e);
end;$$;
revoke all on function private.ecm_card_clean_layout(jsonb) from public,anon,authenticated;
create function private.ecm_card_artwork_submit_prepared(p_id uuid,p_layout jsonb,p_preparation text) returns public.ecm_card_artwork_reviews language plpgsql security definer set search_path='' as $$
declare r public.ecm_card_artwork_reviews; clean jsonb:=private.ecm_card_clean_layout(p_layout);
begin
 if auth.uid() is null or p_preparation is null or p_preparation not in ('transparent','cutout','original-fallback') then raise exception 'Invalid prepared image submission.';end if;
 r:=private.ecm_card_artwork_submit(p_id);
 if not exists(select 1 from storage.objects where bucket_id='ecm-card-artwork-review' and name=r.original_path and metadata->>'mimetype'='image/png' and (metadata->>'size')::bigint between 1 and 8388608) then raise exception 'Original image upload is required.';end if;
 update public.ecm_card_artwork_reviews set submitted_layout=clean,preparation=p_preparation where id=p_id returning * into r;return r;
end;$$;

create function private.ecm_card_artwork_publish(p_id uuid,p_expected_status text,p_layout jsonb,p_source text,p_note text) returns public.ecm_card_publications language plpgsql security definer set search_path='' as $$
declare r public.ecm_card_artwork_reviews; result public.ecm_card_publications; clean jsonb:=private.ecm_card_clean_layout(p_layout); image_path text;
begin
 if auth.uid() is null or not private.wildman_stall_manager() then raise exception 'Authorized artwork reviewer required.';end if;
 if p_source is null or p_source not in ('prepared','original') or length(coalesce(p_note,''))>500 then raise exception 'Invalid publication.';end if;
 select * into r from public.ecm_card_artwork_reviews where id=p_id for update;
 if not found or r.status is distinct from p_expected_status or r.status not in ('pending','approved') then raise exception 'Submission changed. Refresh before publishing.';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.league||':'||r.player_kind||':'||r.lg_user_id,682));
 image_path:=case when p_source='original' then r.original_path else r.object_path end;
 if not exists(select 1 from storage.objects where bucket_id='ecm-card-artwork-review' and name=image_path and metadata->>'mimetype'='image/png' and (metadata->>'size')::bigint between 1 and 8388608) then raise exception 'Selected image is missing.';end if;
 if r.status='pending' then r:=private.ecm_card_artwork_review(p_id,'approved','pending',coalesce(p_note,''));end if;
 insert into public.ecm_card_publications(league,lg_user_id,player_kind,submission_id,object_path,layout)
 values(r.league,r.lg_user_id,r.player_kind,r.id,image_path,clean)
 on conflict(league,lg_user_id,player_kind) do update set submission_id=excluded.submission_id,object_path=excluded.object_path,layout=excluded.layout,published_at=now() returning * into result;
 insert into public.ecm_card_artwork_review_events(submission_id,actor_id,previous_status,new_status,note) values(p_id,auth.uid(),'approved','published','Published reviewed placement. '||coalesce(p_note,''));
 return result;
end;$$;
create function private.ecm_card_revoke_publication() returns trigger language plpgsql security definer set search_path='' as $$begin if new.status<>'approved' then delete from public.ecm_card_publications where submission_id=new.id;end if;return new;end;$$;
revoke all on function private.ecm_card_revoke_publication() from public,anon,authenticated;
create trigger ecm_card_revoke_publication after update of status on public.ecm_card_artwork_reviews for each row execute function private.ecm_card_revoke_publication();
create function public.ecm_card_artwork_submit_prepared(p_id uuid,p_layout jsonb,p_preparation text) returns public.ecm_card_artwork_reviews language sql security invoker set search_path='' as $$select private.ecm_card_artwork_submit_prepared(p_id,p_layout,p_preparation);$$;
create function public.ecm_card_artwork_publish(p_id uuid,p_expected_status text,p_layout jsonb,p_source text,p_note text) returns public.ecm_card_publications language sql security invoker set search_path='' as $$select private.ecm_card_artwork_publish(p_id,p_expected_status,p_layout,p_source,p_note);$$;
revoke all on function private.ecm_card_artwork_submit_prepared(uuid,jsonb,text),private.ecm_card_artwork_publish(uuid,text,jsonb,text,text),public.ecm_card_artwork_submit_prepared(uuid,jsonb,text),public.ecm_card_artwork_publish(uuid,text,jsonb,text,text) from public,anon;
grant execute on function private.ecm_card_artwork_submit_prepared(uuid,jsonb,text),private.ecm_card_artwork_publish(uuid,text,jsonb,text,text),public.ecm_card_artwork_submit_prepared(uuid,jsonb,text),public.ecm_card_artwork_publish(uuid,text,jsonb,text,text) to authenticated;
