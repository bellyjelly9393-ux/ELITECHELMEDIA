-- Server-side Hitmen recaps: no browser session needed.
-- pg_cron -> private.hitmen_kick_autorecap() -> Edge Function hitmen-recap-autowriter, only when an
-- official LGCHL Calgary final (last 14 days) has no recap yet. The function reads the public LG game
-- page, reconciles every total against the official final and publishes through
-- public.hitmen_publish_verified_recap, which is the only write path and refuses duplicates.

-- 1. Per-game attempt log (service role only), used to back off on pages that are not ready yet.
create table if not exists public.hitmen_autorecap_attempts (
  lg_game_id bigint primary key references public.lgchl_games(lg_game_id) on delete cascade,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  published_post_id uuid references public.media_posts(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.hitmen_autorecap_attempts enable row level security;
revoke all on table public.hitmen_autorecap_attempts from anon, authenticated;

-- 2. Never two published recaps for one LG game.
create unique index if not exists media_posts_one_published_recap_per_lg_game
  on public.media_posts ((source_metrics->>'lg_game_id'))
  where post_type = 'recap' and published and source_metrics ? 'lg_game_id';

-- 3. Calgary finals with the context a recap needs. due = not attempted in the last 9 minutes and
--    fewer than 30 failed attempts (about 4.5 hours of retries). has_recap uses the same matching as the existing dedupe helper.
create or replace function public.hitmen_autorecap_games(p_days integer default 14, p_lg_game_id bigint default null)
returns table (lg_game_id bigint, game_at timestamptz, week integer, status text, away_lg_team_id integer, home_lg_team_id integer,
               away_score integer, home_score integer, source_url text, game_no integer, schedule_game_id uuid,
               has_recap boolean, due boolean)
language sql stable security definer set search_path to '' as $$
  with finals as (
    select g.*, row_number() over (order by g.game_at)::int as n
      from public.lgchl_games g
     where g.season = 55 and g.status = 'final' and 412 in (g.home_lg_team_id, g.away_lg_team_id)
       and g.home_score is not null and g.away_score is not null
  )
  select f.lg_game_id, f.game_at, f.week, f.status, f.away_lg_team_id, f.home_lg_team_id, f.away_score::int, f.home_score::int,
         coalesce(f.source_url, 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' || f.lg_game_id),
         f.n,
         (select s.id from public.hitmen_schedule_games s
           where s.team_id = 'b0bcbdda-da9d-419d-8f61-b34937966d49' and s.season = 55
             and abs(extract(epoch from (s.scheduled_at - f.game_at))) <= 1800 limit 1),
         private.hitmen_recap_exists(f.lg_game_id),
         coalesce(a.attempts, 0) < 30 and (a.last_attempt_at is null or a.last_attempt_at < now() - interval '9 minutes')
    from finals f
    left join public.hitmen_autorecap_attempts a on a.lg_game_id = f.lg_game_id
   where (p_lg_game_id is not null and f.lg_game_id = p_lg_game_id)
      or (p_lg_game_id is null and f.game_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 60))))
   order by f.game_at;
$$;

create or replace function public.hitmen_autorecap_note(p_lg_game_id bigint, p_error text)
returns void language sql security definer set search_path to '' as $$
  insert into public.hitmen_autorecap_attempts as a (lg_game_id, attempts, last_attempt_at, last_error, updated_at)
  values (p_lg_game_id, 1, now(), left(p_error, 500), now())
  on conflict (lg_game_id) do update set attempts = a.attempts + 1, last_attempt_at = now(), last_error = excluded.last_error, updated_at = now();
$$;

-- 4. The only write path. Re-checks the official final and refuses any game that already has a recap.
create or replace function public.hitmen_publish_verified_recap(p_lg_game_id bigint, p_title text, p_body text, p_metrics jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare g public.lgchl_games; v_id uuid; v_home boolean; v_cs int; v_os int;
begin
  perform pg_advisory_xact_lock(hashtext('hitmen_recap'), p_lg_game_id::int);
  select * into g from public.lgchl_games where lg_game_id = p_lg_game_id;
  if not found or g.status <> 'final' or g.season <> 55 or 412 not in (g.home_lg_team_id, g.away_lg_team_id) then
    raise exception 'Game % is not an official Calgary Season 55 final', p_lg_game_id;
  end if;
  v_home := g.home_lg_team_id = 412;
  v_cs := case when v_home then g.home_score else g.away_score end;
  v_os := case when v_home then g.away_score else g.home_score end;
  if (p_metrics->>'calgary_score')::int is distinct from v_cs or (p_metrics->>'opponent_score')::int is distinct from v_os
     or (p_metrics->>'lg_game_id')::bigint is distinct from p_lg_game_id then
    raise exception 'Recap score does not match the official final for game %', p_lg_game_id;
  end if;
  if coalesce(trim(p_title), '') = '' or length(coalesce(p_body, '')) < 400 then raise exception 'Recap is empty'; end if;
  if private.hitmen_recap_exists(p_lg_game_id) then return null; end if;
  insert into public.media_posts (season, post_type, title, body, source_metrics, is_auto_draft, published, published_at)
  values ('S55', 'recap', left(trim(p_title), 160), p_body,
          p_metrics || jsonb_build_object('lg_game_id', p_lg_game_id, 'team', 'Calgary Hitmen', 'auto', true),
          false, true, now())
  returning id into v_id;
  insert into public.hitmen_autorecap_attempts as a (lg_game_id, attempts, last_attempt_at, last_error, published_post_id, updated_at)
  values (p_lg_game_id, 1, now(), null, v_id, now())
  on conflict (lg_game_id) do update set attempts = a.attempts + 1, last_attempt_at = now(), last_error = null, published_post_id = v_id, updated_at = now();
  return v_id;
end $$;

revoke all on function public.hitmen_autorecap_games(integer, bigint) from public, anon, authenticated;
revoke all on function public.hitmen_autorecap_note(bigint, text) from public, anon, authenticated;
revoke all on function public.hitmen_publish_verified_recap(bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.hitmen_autorecap_games(integer, bigint) to service_role;
grant execute on function public.hitmen_autorecap_note(bigint, text) to service_role;
grant execute on function public.hitmen_publish_verified_recap(bigint, text, text, jsonb) to service_role;

-- 5. Kick: no LG request and no Edge Function call unless a recap is actually due.
create or replace function private.hitmen_kick_autorecap()
returns bigint language plpgsql security definer set search_path to '' as $$
declare v_req bigint;
begin
  if not exists (select 1 from public.hitmen_autorecap_games(14, null) x where not x.has_recap and x.due) then return null; end if;
  select net.http_post(
    url := 'https://lrgllzvwgvqagcpiyvfd.supabase.co/functions/v1/hitmen-recap-autowriter',
    body := jsonb_build_object('max', 4),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-token', (select value from public.lg_sync_settings where key = 'sync_token')),
    timeout_milliseconds := 120000) into v_req;
  return v_req;
end $$;
revoke all on function private.hitmen_kick_autorecap() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'hitmen-autorecap';
select cron.schedule('hitmen-autorecap', '*/5 * * * *', 'select private.hitmen_kick_autorecap()');
