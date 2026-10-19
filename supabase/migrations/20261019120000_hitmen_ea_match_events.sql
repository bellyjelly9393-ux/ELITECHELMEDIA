-- EA match event store for Hitmen recaps (shot map, high-danger vs perimeter split, goals timeline).
--
-- WHAT EA ACTUALLY EXPOSES (checked Oct 18 2026): the public Pro Clubs match feed
-- (/api/nhl/clubs/matches) returns per-club and per-player game totals only, with no per-event rows,
-- no x/y, no period/clock and no shot type. The only spatial data EA publishes is the 16-bucket
-- ShotsLocationOnIce1..16 / GoalsLocationOnIce1..16 on /api/nhl/members/stats, and that is a running
-- club total. So per-game shot zones are DERIVED here: snapshot each club's member totals just before
-- and just after a Calgary match and keep the difference only when it provably belongs to that one
-- match (no other match for the club in the window, games-played +1, zone shots = match shots).
-- Rows with x/y, period, clock or shot type are only written by a source that really has them
-- (source = 'manual', 'vod_review' or 'lg'); the zone tracker never fills them.

-- 1. Raw member-stat snapshots (service role only).
create table if not exists public.hitmen_ea_member_zone_snapshots (
  id uuid primary key default gen_random_uuid(),
  club_id text not null,
  platform text not null default 'common-gen5',
  captured_at timestamptz not null default now(),
  members jsonb not null,            -- { "<playername>": { gp, skshots, skgoals, shots:[16], goals:[16] } }
  last_match_id text,                -- newest match id in /clubs/matches (all types) at capture time
  last_match_at timestamptz,
  raw jsonb
);
create index if not exists hitmen_ea_member_zone_snapshots_club_time on public.hitmen_ea_member_zone_snapshots (club_id, captured_at desc);
alter table public.hitmen_ea_member_zone_snapshots enable row level security;
revoke all on table public.hitmen_ea_member_zone_snapshots from anon, authenticated;

-- 2. Event store.
create table if not exists public.hitmen_ea_match_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default 'b0bcbdda-da9d-419d-8f61-b34937966d49',
  lg_game_id bigint references public.lgchl_games(lg_game_id) on delete cascade,
  source_game_id text,               -- EA matchId
  club_id text,
  side text not null check (side in ('calgary', 'opponent')),
  period smallint check (period between 1 and 10),
  game_clock text check (game_clock ~ '^\d{1,2}:\d{2}$'),
  event_type text not null check (event_type in ('shot_zone', 'goal_zone', 'shot', 'goal', 'hit', 'takeaway', 'giveaway', 'faceoff', 'penalty')),
  player text,
  ice_zone smallint check (ice_zone between 1 and 16),   -- EA/ChelStats 16-zone model
  danger text generated always as (case when ice_zone in (4, 6, 7, 8) then 'high' when ice_zone in (10, 11, 12, 14) then 'mid'
                                        when ice_zone is null then null else 'perimeter' end) stored,
  x numeric, y numeric,
  shot_type text,
  result text,
  event_count integer not null default 1 check (event_count > 0),
  source text not null check (source in ('ea_member_zone_delta', 'vod_review', 'manual', 'lg')),
  verified boolean not null default false,
  raw jsonb,
  created_at timestamptz not null default now()
);
-- One zone bucket per player/match/source (non-partial so PostgREST upserts can target it; NULLs stay distinct).
create unique index if not exists hitmen_ea_match_events_bucket_once
  on public.hitmen_ea_match_events (source, source_game_id, club_id, player, event_type, ice_zone);
create index if not exists hitmen_ea_match_events_game on public.hitmen_ea_match_events (lg_game_id);
alter table public.hitmen_ea_match_events enable row level security;
drop policy if exists hitmen_ea_match_events_read on public.hitmen_ea_match_events;
create policy hitmen_ea_match_events_read on public.hitmen_ea_match_events for select to authenticated
  using (private.vvhl_can_read_war_room((select auth.uid()), team_id));
drop policy if exists hitmen_ea_match_events_write on public.hitmen_ea_match_events;
create policy hitmen_ea_match_events_write on public.hitmen_ea_match_events for all to authenticated
  using (private.vvhl_can_manage_team((select auth.uid()), team_id))
  with check (private.vvhl_can_manage_team((select auth.uid()), team_id));

-- 3. Kick the tracker every 2 minutes, but only around Calgary games (1h before to 2h after puck drop).
create or replace function private.hitmen_kick_ea_zone_tracker()
returns bigint language plpgsql security definer set search_path to '' as $$
declare v_req bigint;
begin
  if not exists (select 1 from public.lgchl_games g where g.season = 55 and 412 in (g.home_lg_team_id, g.away_lg_team_id)
                  and g.game_at between now() - interval '2 hours' and now() + interval '1 hour') then return null; end if;
  select net.http_post(
    url := 'https://lrgllzvwgvqagcpiyvfd.supabase.co/functions/v1/hitmen-ea-zone-tracker',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-token', (select value from public.lg_sync_settings where key = 'sync_token')),
    timeout_milliseconds := 60000) into v_req;
  return v_req;
end $$;
revoke all on function private.hitmen_kick_ea_zone_tracker() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'hitmen-ea-zone-tracker';
select cron.schedule('hitmen-ea-zone-tracker', '*/2 * * * *', 'select private.hitmen_kick_ea_zone_tracker()');
