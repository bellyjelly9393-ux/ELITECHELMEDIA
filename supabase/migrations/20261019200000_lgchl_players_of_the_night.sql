-- LGCHL Media: Players of the Night (approved by Seth, Oct 19 2026).
-- Per game night: each player's LG season totals saved before the night's first game vs. the last
-- totals saved after it and before the next night started. Public season totals only.

create or replace view public.lgchl_public_night_players
with (security_invoker = true) as
with nights as (
  select (game_at at time zone 'America/Toronto')::date as night, min(game_at) as starts_at,
         count(*) as games, count(*) filter (where status = 'final') as finals,
         sum(coalesce(away_score, 0) + coalesce(home_score, 0)) filter (where status = 'final') as final_goals
  from public.lgchl_games where season = 55 group by 1
), win as (
  select n.*, lead(n.starts_at) over (order by n.night) as next_at from nights n
), recent as (
  select * from win where finals > 0 order by night desc limit 7
), base as (
  select distinct on (r.night, h.player_kind, h.gamertag) r.night, h.*
  from recent r join public.lgchl_player_stat_history h on h.season = 55 and h.taken_at < r.starts_at
  order by r.night, h.player_kind, h.gamertag, h.taken_at desc
), cur as (
  select distinct on (r.night, h.player_kind, h.gamertag) r.night, h.*
  from recent r join public.lgchl_player_stat_history h
    on h.season = 55 and h.taken_at >= r.starts_at and (r.next_at is null or h.taken_at < r.next_at)
  order by r.night, h.player_kind, h.gamertag, h.taken_at desc
)
select c.night, r.games as night_games, r.finals as night_finals, r.final_goals as night_final_goals,
  c.player_kind, c.gamertag, c.position, c.lg_team_id,
  c.gp - b.gp as gp, c.goals - b.goals as goals, c.assists - b.assists as assists, c.points - b.points as points,
  c.plus_minus - b.plus_minus as plus_minus, c.shots - b.shots as shots, c.hits - b.hits as hits,
  c.goalie_saves - b.goalie_saves as saves, c.goalie_shots_against - b.goalie_shots_against as shots_against,
  c.goalie_goals_against - b.goalie_goals_against as goals_against,
  b.taken_at as since_at, c.taken_at as through_at
from cur c join base b using (night, player_kind, gamertag) join recent r using (night)
where c.gp > b.gp;

-- Players of the Week: the current game week (latest week with a final), in progress or complete.
create or replace view public.lgchl_public_week_players
with (security_invoker = true) as
with weeks as (
  select week, min(game_at) as starts_at, bool_and(status = 'final') as done, bool_or(status = 'final') as started
  from public.lgchl_games where season = 55 and week is not null group by week
), wk as (
  select w.week, w.starts_at, w.done,
         (select min(n.starts_at) from weeks n where n.week > w.week) as next_at
  from weeks w where w.started order by w.week desc limit 1
), base as (
  select distinct on (h.player_kind, h.gamertag) h.*
  from public.lgchl_player_stat_history h, wk
  where h.season = 55 and h.taken_at < wk.starts_at
  order by h.player_kind, h.gamertag, h.taken_at desc
), cur as (
  select distinct on (h.player_kind, h.gamertag) h.*
  from public.lgchl_player_stat_history h, wk
  where h.season = 55 and h.taken_at >= wk.starts_at and (wk.next_at is null or h.taken_at < wk.next_at)
  order by h.player_kind, h.gamertag, h.taken_at desc
)
select wk.week, c.player_kind, c.gamertag, c.position, c.lg_team_id,
  c.gp - b.gp as gp, c.goals - b.goals as goals, c.assists - b.assists as assists, c.points - b.points as points,
  c.plus_minus - b.plus_minus as plus_minus, c.shots - b.shots as shots, c.hits - b.hits as hits,
  c.goalie_saves - b.goalie_saves as saves, c.goalie_shots_against - b.goalie_shots_against as shots_against,
  c.goalie_goals_against - b.goalie_goals_against as goals_against, c.taken_at as through_at,
  wk.done as week_complete
from cur c join base b using (player_kind, gamertag) cross join wk
where c.gp > b.gp;

revoke all on public.lgchl_public_night_players, public.lgchl_public_week_players from public, anon, authenticated;
grant select on public.lgchl_public_night_players, public.lgchl_public_week_players to anon, authenticated;
