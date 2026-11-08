-- Private artwork review. Approval does not enable public artwork delivery.
create table public.ecm_card_artwork_reviews (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 league text not null check (league in ('lgchl','lg3s')),
 lg_user_id bigint not null check (lg_user_id>0),
 player_kind text not null check (player_kind in ('skater','goalie')),
 gamertag_snapshot text not null check (length(gamertag_snapshot) between 1 and 100),
 object_path text not null unique,
 status text not null default 'draft' check(status in ('draft','pending','approved','rejected','withdrawn')),
 rights_confirmed_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 submitted_at timestamptz,
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text not null default '' check(length(review_note)<=500)
);
create index ecm_card_artwork_review_queue on public.ecm_card_artwork_reviews(status,created_at);
create index ecm_card_artwork_owner on public.ecm_card_artwork_reviews(user_id,created_at desc);
alter table public.ecm_card_artwork_reviews enable row level security;
revoke all on public.ecm_card_artwork_reviews from public,anon,authenticated;
grant select on public.ecm_card_artwork_reviews to authenticated;
grant all on public.ecm_card_artwork_reviews to service_role;
create policy ecm_card_artwork_read on public.ecm_card_artwork_reviews for select to authenticated
 using(user_id=(select auth.uid()) or (select private.wildman_stall_manager()));

create table public.ecm_card_artwork_review_events (
 id bigint generated always as identity primary key,
 submission_id uuid not null references public.ecm_card_artwork_reviews(id) on delete cascade,
 actor_id uuid not null,
 previous_status text not null,
 new_status text not null,
 note text not null default '',
 created_at timestamptz not null default now()
);
alter table public.ecm_card_artwork_review_events enable row level security;
revoke all on public.ecm_card_artwork_review_events from public,anon,authenticated;
grant select on public.ecm_card_artwork_review_events to authenticated;
grant all on public.ecm_card_artwork_review_events to service_role;
grant usage,select on sequence public.ecm_card_artwork_review_events_id_seq to service_role;
create policy ecm_card_artwork_event_read on public.ecm_card_artwork_review_events for select to authenticated
 using(exists(select 1 from public.ecm_card_artwork_reviews r where r.id=submission_id and (r.user_id=(select auth.uid()) or (select private.wildman_stall_manager()))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ecm-card-artwork-review','ecm-card-artwork-review',false,8388608,array['image/png']);
create policy ecm_card_artwork_object_insert on storage.objects for insert to authenticated
 with check(bucket_id='ecm-card-artwork-review' and exists(select 1 from public.ecm_card_artwork_reviews r where r.object_path=name and r.user_id=(select auth.uid()) and r.status='draft'));
create policy ecm_card_artwork_object_read on storage.objects for select to authenticated
 using(bucket_id='ecm-card-artwork-review' and exists(select 1 from public.ecm_card_artwork_reviews r where r.object_path=name and (r.user_id=(select auth.uid()) or (select private.wildman_stall_manager()))));
-- No object UPDATE/DELETE policy: an approved image cannot be replaced in place.

create function private.ecm_card_artwork_start(p_id uuid,p_league text,p_lg_user_id bigint,p_kind text,p_confirm_rights boolean)
 returns public.ecm_card_artwork_reviews language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); tag text; r public.ecm_card_artwork_reviews;
begin
 if u is null or p_confirm_rights is distinct from true then raise exception 'Sign in and confirm image permission first.';end if;
 if p_id is null or p_lg_user_id is null or p_lg_user_id<=0 or p_kind is null or p_kind not in ('skater','goalie') then raise exception 'Invalid player identity.';end if;
 -- Serialize per-user rate checks so simultaneous requests cannot evade limits.
 perform pg_advisory_xact_lock(hashtextextended(u::text,681));
 if (select count(*) from public.ecm_card_artwork_reviews where user_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'Five review requests per hour maximum. Try again later.';end if;
 if p_league='lgchl' then
  select gamertag into tag from public.wm_lgchl_s55_player_leaders where lg_user_id=p_lg_user_id and player_kind=p_kind order by fetched_at desc limit 1;
 elsif p_league='lg3s' and p_kind='skater' then
  select gamertag into tag from public.lg3s_public_skater_leaders where lg_user_id=p_lg_user_id limit 1;
 elsif p_league='lg3s' and p_kind='goalie' then
  select gamertag into tag from public.lg3s_public_goalie_leaders where lg_user_id=p_lg_user_id limit 1;
 end if;
 if tag is null then raise exception 'Player was not found in the public season feed.';end if;
 insert into public.ecm_card_artwork_reviews(id,user_id,league,lg_user_id,player_kind,gamertag_snapshot,object_path)
 values(p_id,u,p_league,p_lg_user_id,p_kind,tag,u::text||'/'||p_id::text||'/artwork.png') returning * into r;
 return r;
end;$$;
create function private.ecm_card_artwork_submit(p_id uuid)
 returns public.ecm_card_artwork_reviews language plpgsql security definer set search_path='' as $$
declare r public.ecm_card_artwork_reviews;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 select * into r from public.ecm_card_artwork_reviews where id=p_id and user_id=auth.uid() for update;
 if not found or r.status<>'draft' then raise exception 'This request cannot be submitted.';end if;
 if not exists(select 1 from storage.objects where bucket_id='ecm-card-artwork-review' and name=r.object_path and metadata->>'mimetype'='image/png' and (metadata->>'size')::bigint between 1 and 8388608) then raise exception 'Complete the PNG upload before submitting.';end if;
 update public.ecm_card_artwork_reviews set status='pending',submitted_at=now() where id=p_id returning * into r;
 insert into public.ecm_card_artwork_review_events(submission_id,actor_id,previous_status,new_status) values(p_id,auth.uid(),'draft','pending');
 return r;
end;$$;
create function private.ecm_card_artwork_review(p_id uuid,p_decision text,p_expected_status text,p_note text)
 returns public.ecm_card_artwork_reviews language plpgsql security definer set search_path='' as $$
declare r public.ecm_card_artwork_reviews; old_status text; note text:=btrim(coalesce(p_note,''));
begin
 if auth.uid() is null or not private.wildman_stall_manager() then raise exception 'Artwork review requires authorized management.';end if;
 if p_decision is null or p_decision not in ('approved','rejected') or length(note)>500 or (p_decision='rejected' and length(note)<3) then raise exception 'Choose a valid decision. Rejection needs a short reason.';end if;
 select * into r from public.ecm_card_artwork_reviews where id=p_id for update;
 if not found or r.status is distinct from p_expected_status or not (r.status='pending' or (r.status='approved' and p_decision='rejected')) then raise exception 'This request changed. Refresh the queue before reviewing it.';end if;
 old_status:=r.status;
 update public.ecm_card_artwork_reviews set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=note where id=p_id returning * into r;
 insert into public.ecm_card_artwork_review_events(submission_id,actor_id,previous_status,new_status,note) values(p_id,auth.uid(),old_status,p_decision,note);
 return r;
end;$$;
create function private.ecm_card_artwork_withdraw(p_id uuid)
 returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 update public.ecm_card_artwork_reviews set status='withdrawn' where id=p_id and user_id=auth.uid() and status in ('draft','pending');
end;$$;

-- Public RPCs are invoker wrappers; privileged mutations stay in private.
create function public.ecm_card_review_access() returns boolean language sql stable security invoker set search_path='' as $$select auth.uid() is not null and private.wildman_stall_manager();$$;
create function public.ecm_card_artwork_start(p_id uuid,p_league text,p_lg_user_id bigint,p_kind text,p_confirm_rights boolean) returns public.ecm_card_artwork_reviews language sql security invoker set search_path='' as $$select private.ecm_card_artwork_start(p_id,p_league,p_lg_user_id,p_kind,p_confirm_rights);$$;
create function public.ecm_card_artwork_submit(p_id uuid) returns public.ecm_card_artwork_reviews language sql security invoker set search_path='' as $$select private.ecm_card_artwork_submit(p_id);$$;
create function public.ecm_card_artwork_review(p_id uuid,p_decision text,p_expected_status text,p_note text) returns public.ecm_card_artwork_reviews language sql security invoker set search_path='' as $$select private.ecm_card_artwork_review(p_id,p_decision,p_expected_status,p_note);$$;
create function public.ecm_card_artwork_withdraw(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.ecm_card_artwork_withdraw(p_id);$$;
revoke all on function private.ecm_card_artwork_start(uuid,text,bigint,text,boolean),private.ecm_card_artwork_submit(uuid),private.ecm_card_artwork_review(uuid,text,text,text),private.ecm_card_artwork_withdraw(uuid),public.ecm_card_review_access(),public.ecm_card_artwork_start(uuid,text,bigint,text,boolean),public.ecm_card_artwork_submit(uuid),public.ecm_card_artwork_review(uuid,text,text,text),public.ecm_card_artwork_withdraw(uuid) from public,anon;
grant execute on function private.ecm_card_artwork_start(uuid,text,bigint,text,boolean),private.ecm_card_artwork_submit(uuid),private.ecm_card_artwork_review(uuid,text,text,text),private.ecm_card_artwork_withdraw(uuid),public.ecm_card_review_access(),public.ecm_card_artwork_start(uuid,text,bigint,text,boolean),public.ecm_card_artwork_submit(uuid),public.ecm_card_artwork_review(uuid,text,text,text),public.ecm_card_artwork_withdraw(uuid) to authenticated;
