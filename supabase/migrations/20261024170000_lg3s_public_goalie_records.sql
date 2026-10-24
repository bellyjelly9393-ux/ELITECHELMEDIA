-- Goalie wins and season GAA from verified box scores.
-- LG's goalie table is S, Sv%, GA, Sv, GAA. It has no decision column and no time-on-ice.
-- Every verified team-game currently has exactly one goalie line, so that goalie is the
-- goalie of record: a win is the verified result (their team scored more). A game with
-- more than one goalie on the same team is not given a win, because the decision cannot
-- be split from the box score.
-- Season GAA uses the per-game GAA LG published. toi_seconds is null, so minutes are
-- recovered as GA/GAA when GAA > 0. A shutout (GA 0, GAA 0) counts as one standard game.

create or replace view public.lg3s_public_goalie_records
  with (security_invoker = true) as
with lines as (
  select l.lg_game_id, l.lg_user_id, l.gamertag, l.lg_team_id, l.nation,
         l.shots_against, l.goals_against, l.saves, l.gaa, l.game_night_date,
         g.away_lg_team_id, g.home_lg_team_id, g.away_score, g.home_score,
         count(*) over (partition by l.lg_game_id, l.lg_team_id) as goalies_on_team
  from public.lg3s_public_player_lines l
  join public.lg3s_public_games g on g.lg_game_id = l.lg_game_id
  where l.player_kind = 'goalie'
    and g.is_verified
    and g.away_score is not null
    and g.home_score is not null
)
select lg_user_id,
  (array_agg(gamertag order by game_night_date desc))[1] as gamertag,
  array_agg(distinct nation) as nations_played_for,
  count(*)::int as gp,
  count(*) filter (
    where goalies_on_team = 1
      and (
        (lg_team_id = home_lg_team_id and home_score > away_score)
        or (lg_team_id = away_lg_team_id and away_score > home_score)
      )
  )::int as wins,
  round(
    sum(goals_against)::numeric
    / nullif(sum(case
        when gaa > 0 then goals_against::numeric / gaa
        when goals_against = 0 and coalesce(gaa, 0) = 0 then 1
      end), 0)
  , 2) as gaa,
  sum(shots_against)::int as sa,
  sum(goals_against)::int as ga,
  sum(saves)::int as sv
from lines
group by lg_user_id;

grant select on public.lg3s_public_goalie_records to anon, authenticated;

-- The live games view is security_invoker and reads is_forfeit. Without this column
-- grant, anon selects of lg3s_public_games fail. The column is not created in this
-- branch; skip the grant where it does not exist yet.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lg3s_games' and column_name = 'is_forfeit'
  ) then
    execute 'grant select (is_forfeit) on public.lg3s_games to anon, authenticated';
  end if;
end $$;
