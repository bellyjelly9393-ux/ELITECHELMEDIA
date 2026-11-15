-- LGCHL S55 public postseason player statistics.
-- Separate from private player/game scouting tables and the regular-season archive.
-- Reviewed data only: no client write permissions; no privileged functions.
create table if not exists public.ecm_lgchl_s55_playoff_public_players (
 season integer not null default 55 check (season=55),
 lg_user_id bigint not null check (lg_user_id>0),
 lg_team_id integer not null check (lg_team_id>0),
 player_kind text not null check (player_kind in ('skater','goalie')),
 gamertag text not null check (length(gamertag) between 1 and 100),
 team_name text not null check (length(team_name) between 1 and 100),
 league text not null check (league in ('OHL','WHL','QMJHL')),
 gp integer not null default 0 check (gp>=0),
 goals integer check (goals>=0),
 assists integer check (assists>=0),
 points integer check (points>=0),
 saves integer check (saves>=0),
 shots_against integer check (shots_against>=0),
 goals_against integer check (goals_against>=0),
 save_pct numeric(6,5) check (save_pct between 0 and 1),
 gaa numeric(8,3) check (gaa>=0),
 source_url text,
 source_checked_at timestamptz,
 verified boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(season,lg_team_id,lg_user_id,player_kind),
 constraint ecm_playoff_verified_source check (
   not verified or (
      gp>0 and
      source_checked_at is not null and
      source_url ~* '^https://(www\.)?leaguegaming\.com/'
   )
 )
);
alter table public.ecm_lgchl_s55_playoff_public_players enable row level security;
revoke all on table public.ecm_lgchl_s55_playoff_public_players from anon, authenticated;
grant select on table public.ecm_lgchl_s55_playoff_public_players to anon, authenticated;
create policy "Read verified LGCHL S55 playoff player stats"
on public.ecm_lgchl_s55_playoff_public_players
for select to anon, authenticated
using (
  verified=true and season=55 and gp>0
  and source_checked_at is not null
  and source_url ~* '^https://(www\.)?leaguegaming\.com/'
);
comment on table public.ecm_lgchl_s55_playoff_public_players is 'Public reviewed LGCHL season 55 playoff player stat totals only. All writes are operator/service only. Never imported from Elite Labs.';
