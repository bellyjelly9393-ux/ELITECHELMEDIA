alter table public.ecm_card_artwork_reviews add column publication_consent_at timestamptz;
create or replace function private.ecm_card_artwork_submit_prepared(p_id uuid,p_layout jsonb,p_preparation text) returns public.ecm_card_artwork_reviews language plpgsql security definer set search_path='' as $$
declare r public.ecm_card_artwork_reviews; clean jsonb:=private.ecm_card_clean_layout(p_layout);
begin
 if auth.uid() is null or p_preparation is null or p_preparation not in ('transparent','cutout','original-fallback') then raise exception 'Invalid prepared image submission.';end if;
 r:=private.ecm_card_artwork_submit(p_id);
 if not exists(select 1 from storage.objects where bucket_id='ecm-card-artwork-review' and name=r.original_path and metadata->>'mimetype'='image/png' and (metadata->>'size')::bigint between 1 and 8388608) then raise exception 'Original image upload is required.';end if;
 update public.ecm_card_artwork_reviews set submitted_layout=clean,preparation=p_preparation,publication_consent_at=now() where id=p_id returning * into r;return r;
end;$$;
create or replace function private.ecm_card_artwork_publish(p_id uuid,p_expected_status text,p_layout jsonb,p_source text,p_note text) returns public.ecm_card_publications language plpgsql security definer set search_path='' as $$
declare r public.ecm_card_artwork_reviews; result public.ecm_card_publications; clean jsonb:=private.ecm_card_clean_layout(p_layout); image_path text;
begin
 if auth.uid() is null or not private.wildman_stall_manager() then raise exception 'Authorized artwork reviewer required.';end if;
 if p_source is null or p_source not in ('prepared','original') or length(coalesce(p_note,''))>500 then raise exception 'Invalid publication.';end if;
 select * into r from public.ecm_card_artwork_reviews where id=p_id for update;
 if not found or r.status is distinct from p_expected_status or r.status not in ('pending','approved') then raise exception 'Submission changed. Refresh before publishing.';end if;
 if r.publication_consent_at is null then raise exception 'Player must resubmit with permission for public display.';end if;
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
