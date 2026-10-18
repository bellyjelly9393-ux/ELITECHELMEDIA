-- LGCHL Media league writer: draft storage only. NOT APPLIED; review before `supabase db push`.
-- Drafts are never public: no anon/authenticated grants except staff SELECT, writes only via the
-- service-role RPC below, which can only ever create or refresh rows still in status 'draft'.
-- Publishing (status 'approved' + placing on lgchl-media.html) stays a separate, manual step for Seth.

create table if not exists public.lgchl_media_drafts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('night-wrap', 'weekly', 'spotlight')),
  season integer not null,
  night date not null,
  title text not null,
  dek text,
  body_md text not null,
  payload jsonb not null default '{}'::jsonb,  -- cards, scores, mentions, metrics (same shape as the LG Media page cards)
  generator text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, season, night)
);

alter table public.lgchl_media_drafts enable row level security;
revoke all on table public.lgchl_media_drafts from public, anon, authenticated;
grant select on table public.lgchl_media_drafts to authenticated;
drop policy if exists lgchl_media_drafts_staff_read on public.lgchl_media_drafts;
create policy lgchl_media_drafts_staff_read on public.lgchl_media_drafts for select to authenticated using ((select public.is_vvhl_staff()));

create or replace function public.lgchl_media_save_draft(
  p_kind text, p_season integer, p_night date, p_title text, p_dek text, p_body_md text, p_payload jsonb, p_generator text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid;
begin
  insert into public.lgchl_media_drafts (kind, season, night, title, dek, body_md, payload, generator)
  values (p_kind, p_season, p_night, p_title, p_dek, p_body_md, coalesce(p_payload, '{}'::jsonb), p_generator)
  on conflict (kind, season, night) do update
    set title = excluded.title, dek = excluded.dek, body_md = excluded.body_md, payload = excluded.payload,
        generator = excluded.generator, updated_at = now()
    where public.lgchl_media_drafts.status = 'draft'   -- approved/rejected drafts are never overwritten
  returning id into v_id;
  return v_id;  -- null when an approved/rejected row already exists
end $$;
revoke all on function public.lgchl_media_save_draft(text, integer, date, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.lgchl_media_save_draft(text, integer, date, text, text, text, jsonb, text) to service_role;

-- Optional nightly kick (12:50 AM EDT Mon/Tue/Wed, after the 12:15 full sync). Created DISABLED.
create or replace function private.lgchl_kick_night_wrap()
returns bigint language plpgsql security definer set search_path to '' as $$
declare v_req bigint;
begin
  select net.http_post(
    url := 'https://lrgllzvwgvqagcpiyvfd.supabase.co/functions/v1/lgchl-league-writer',
    body := jsonb_build_object('dryRun', false),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-token', (select value from public.lg_sync_settings where key = 'sync_token')),
    timeout_milliseconds := 60000) into v_req;
  return v_req;
end $$;
revoke all on function private.lgchl_kick_night_wrap() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'lgchl-night-wrap-drafts';
select cron.schedule('lgchl-night-wrap-drafts', '50 4 * * 1,2,3', 'select private.lgchl_kick_night_wrap()');
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'lgchl-night-wrap-drafts';
