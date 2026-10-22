-- Wildman Hockey: Calgary Hitmen Season 55 weekly player and roster-group reports
-- Source-controlled definitions of deployed private Supabase functions.
-- Stats-only reports from unique game records; shared roster membership is NOT verified shift chemistry.
-- Preserves manual pilot rows. Existing reports are not updated by the generator.

BEGIN;

CREATE OR REPLACE FUNCTION private.generate_hitmen_player_weeklies(p_team uuid, p_season integer, p_max_week integer DEFAULT 999, p_allow_open boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_creator uuid; v_added integer := 0;
BEGIN
  SELECT user_id INTO v_creator
  FROM public.team_memberships
  WHERE team_id=p_team AND active IS TRUE AND role IN ('owner','gm','agm')
  ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at
  LIMIT 1;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'No active team manager; weekly report generation aborted'; END IF;

  WITH source_game_counts AS (
    SELECT schedule_game_id, count(*) AS roster_rows
    FROM public.team_player_game_reports
    WHERE team_id=p_team AND season=p_season AND week BETWEEN 1 AND p_max_week
      AND ai_review_id IS NULL AND schedule_game_id IS NOT NULL
    GROUP BY schedule_game_id
  ),
  scored AS (
    SELECT g.*,
      c.roster_rows,
      COALESCE((g.stats->>'goals')::integer,0) AS n_goals,
      COALESCE((g.stats->>'assists')::integer,0) AS n_assists,
      COALESCE((g.stats->>'points')::integer,0) AS n_points,
      COALESCE((g.stats->>'shots')::integer,0) AS n_shots,
      COALESCE((g.stats->>'plus_minus')::integer,0) AS n_plus_minus,
      COALESCE((g.stats->>'giveaways')::integer,0) AS n_giveaways,
      COALESCE((g.stats->>'takeaways')::integer,0) AS n_takeaways,
      COALESCE((g.stats->>'pim')::integer,0) AS n_pim,
      COALESCE((g.stats->>'hits')::integer,0) AS n_hits,
      COALESCE((g.stats->>'blocked_shots')::integer,0) AS n_blocks,
      COALESCE((g.stats->>'saves')::integer,0) AS n_saves,
      COALESCE((g.stats->>'shots_faced')::integer,0) AS n_shots_faced,
      COALESCE((g.stats->>'goals_against')::integer,0) AS n_goals_against
    FROM public.team_player_game_reports g
    JOIN source_game_counts c ON c.schedule_game_id=g.schedule_game_id
    WHERE g.team_id=p_team AND g.season=p_season AND g.week BETWEEN 1 AND p_max_week
      AND g.ai_review_id IS NULL AND g.schedule_game_id IS NOT NULL
      AND g.stats <> '{}'::jsonb AND g.result ~ '^(W|L|OTL) [0-9]+-[0-9]+$'
      AND (
        (upper(g.position_played)='G' AND g.stats ? 'saves' AND g.stats ? 'shots_faced') OR
        (upper(g.position_played)<>'G' AND g.stats ? 'goals' AND g.stats ? 'assists' AND g.stats ? 'points')
      )
  ),
  totals AS (
    SELECT week,locker_id,
      count(*)::integer games, count(DISTINCT schedule_game_id)::integer unique_games,
      max(game_date) newest_game,
      count(*) FILTER(WHERE roster_rows<6)::integer partial_games,
      count(*) FILTER(WHERE result LIKE 'W %')::integer wins,
      count(*) FILTER(WHERE result LIKE 'L %')::integer losses,
      count(*) FILTER(WHERE result LIKE 'OTL %')::integer ot_losses,
      bool_and(upper(position_played)='G') goalie,
      sum(n_goals)::integer goals,sum(n_assists)::integer assists,sum(n_points)::integer points,
      sum(n_shots)::integer shots,sum(n_plus_minus)::integer plus_minus,
      sum(n_giveaways)::integer giveaways,sum(n_takeaways)::integer takeaways,
      sum(n_pim)::integer pim,sum(n_hits)::integer hits,sum(n_blocks)::integer blocks,
      sum(n_saves)::integer saves,sum(n_shots_faced)::integer shots_faced,
      sum(n_goals_against)::integer goals_against,
      jsonb_agg(jsonb_build_object('type','recorded_game_stats','report_id',id,'schedule_game_id',schedule_game_id,'position',position_played,'opponent',opponent_name) ORDER BY game_date,id) as refs
    FROM scored
    GROUP BY week,locker_id
    HAVING count(*)=count(DISTINCT schedule_game_id)
  ), inserted AS (
    INSERT INTO public.team_player_weekly_reports
      (team_id,season,locker_id,week,games_played,record,stats,summary,
       strengths,focus_next_week,line_performance,evidence,visibility,created_by)
    SELECT p_team,p_season,locker_id,week,games,
      wins::text||'-'||losses::text||'-'||ot_losses::text,
      CASE WHEN goalie THEN jsonb_build_object(
        'saves',saves,'shots_faced',shots_faced,'goals_against',goals_against,
        'save_percentage',CASE WHEN shots_faced>0 THEN round(saves::numeric*100/shots_faced,1) ELSE NULL END,
        'source','recorded_game_stats','partial_team_roster_games',partial_games)
      ELSE jsonb_build_object(
        'goals',goals,'assists',assists,'points',points,'shots',shots,
        'plus_minus',plus_minus,'giveaways',giveaways,'takeaways',takeaways,
        'pim',pim,'hits',hits,'blocked_shots',blocks,
        'source','recorded_game_stats','partial_team_roster_games',partial_games)
      END,
      CASE WHEN goalie THEN
        'Week '||week||': '||games||' recorded goaltending appearances ('||
        wins||'-'||losses||'-'||ot_losses||'). '||saves||' saves on '||
        shots_faced||' shots faced; '||goals_against||' goals against. '||
        CASE WHEN shots_faced>0 THEN round(saves::numeric*100/shots_faced,1)||'% combined save percentage. ' ELSE 'Save percentage unavailable. ' END
      ELSE
        'Week '||week||': '||games||' recorded games ('||
        wins||'-'||losses||'-'||ot_losses||'). '||goals||CASE WHEN goals=1 THEN ' goal, ' ELSE ' goals, ' END||
        assists||CASE WHEN assists=1 THEN ' assist, ' ELSE ' assists, ' END||
        points||CASE WHEN points=1 THEN ' point, ' ELSE ' points, ' END||
        shots||CASE WHEN shots=1 THEN ' shot and ' ELSE ' shots and ' END||
        CASE WHEN plus_minus>0 THEN '+' ELSE '' END||plus_minus||' recorded plus/minus. '
      END ||
      CASE WHEN partial_games>0 THEN
        'Team box-score player coverage is incomplete for '||partial_games||' of these games; missing player records cannot be treated as non-participation.'
      ELSE 'These totals count each documented game once.' END,
      CASE WHEN goalie THEN
        'Recorded '||saves||' saves across '||games||' appearances. These are box-score totals, not a film-based assessment of positioning or rebound control.'
      ELSE
        'Recorded '||points||' points on '||shots||' shots, plus '||takeaways||' takeaways and '||blocks||' blocked shots. Production is documented; individual tactical strengths require player-verified film.'
      END,
      CASE WHEN goalie THEN
        'Review individual goals-against sequences and rebound outcomes with verified film before assigning goalie technique grades.'
      ELSE
        'Review puck management ('||giveaways||' giveaways vs '||takeaways||
        ' takeaways) and '||pim||' penalty minutes. Separate confirmed statistical outcomes from VOD interpretation before making coaching adjustments.'
      END,
      'Not graded. Shared ice time, stable line assignment, and chemistry are not verified by individual game box scores.',
      refs || jsonb_build_array(jsonb_build_object('type','generation_metadata',
       'generator','wildman_weekly_stats_v1','automated',true,
       'partial_team_roster_games',partial_games,'claim_policy','box-score-only; no invented VOD or chemistry')),
      'team',v_creator
    FROM totals
    WHERE games=unique_games AND (p_allow_open OR newest_game <= now()-interval '5 days')
    ON CONFLICT (team_id,season,locker_id,week) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_added FROM inserted;
  RETURN v_added;
END;
$function$


CREATE OR REPLACE FUNCTION private.generate_hitmen_roster_group_weeklies(p_team uuid, p_season integer, p_max_week integer DEFAULT 999, p_allow_open boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_creator uuid; v_added integer := 0;
BEGIN
 SELECT user_id INTO v_creator FROM public.team_memberships
 WHERE team_id=p_team AND active IS TRUE AND role IN('owner','gm','agm')
 ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END,created_at LIMIT 1;
 IF v_creator IS NULL THEN RAISE EXCEPTION 'No active team manager; roster-group generator aborted'; END IF;
 WITH source AS (
   SELECT g.id,g.week,g.schedule_game_id,g.game_date,g.locker_id,
          upper(g.position_played) position_played,g.result,g.stats,l.gamertag
   FROM public.team_player_game_reports g
   JOIN public.team_player_lockers l ON l.id=g.locker_id AND l.team_id=g.team_id AND l.season=g.season
   WHERE g.team_id=p_team AND g.season=p_season
      AND g.week BETWEEN 1 AND p_max_week
      AND g.ai_review_id IS NULL AND g.schedule_game_id IS NOT NULL
      AND g.result ~ '^(W|L|OTL) [0-9]+-[0-9]+$'
      AND g.stats ? 'goals' AND g.stats ? 'assists'
      AND upper(g.position_played) IN ('LW','C','RW','LD','RD')
 ),
 game_groups AS (
  SELECT week,schedule_game_id,'forwards'::text AS kind,
         jsonb_agg(to_jsonb(locker_id::text) ORDER BY locker_id::text) AS member_ids,
         string_agg(gamertag,' / ' ORDER BY lower(gamertag),locker_id) AS names,
         max(result) AS result,min(game_date) AS at_time,
         sum(coalesce((stats->>'goals')::integer,0))::int AS player_goals,
         sum(coalesce((stats->>'assists')::integer,0))::int AS player_assists,
         jsonb_agg(jsonb_build_object('report_id',id,'position',position_played,'locker_id',locker_id) ORDER BY locker_id::text) AS player_sources
  FROM source WHERE position_played IN('LW','C','RW')
  GROUP BY week,schedule_game_id
  HAVING count(*)=3 AND count(DISTINCT locker_id)=3
  UNION ALL
  SELECT week,schedule_game_id,'defense'::text,
         jsonb_agg(to_jsonb(locker_id::text) ORDER BY locker_id::text),
         string_agg(gamertag,' / ' ORDER BY lower(gamertag),locker_id),
         max(result),min(game_date),
         sum(coalesce((stats->>'goals')::integer,0))::int,
         sum(coalesce((stats->>'assists')::integer,0))::int,
         jsonb_agg(jsonb_build_object('report_id',id,'position',position_played,'locker_id',locker_id) ORDER BY locker_id::text)
  FROM source WHERE position_played IN('LD','RD')
  GROUP BY week,schedule_game_id
  HAVING count(*)=2 AND count(DISTINCT locker_id)=2
 ), agg AS (
  SELECT week,kind,member_ids,min(names) names,count(*)::int games,max(at_time) newest_game,
   count(*) FILTER(WHERE result LIKE 'W %')::int wins,
   count(*) FILTER(WHERE result LIKE 'L %')::int losses,
   count(*) FILTER(WHERE result LIKE 'OTL %')::int ot_losses,
   sum(player_goals)::int individual_goals,
   sum(player_assists)::int individual_assists,
   sum((split_part(split_part(result,' ',2),'-',1))::int)::int team_gf,
   sum((split_part(split_part(result,' ',2),'-',2))::int)::int team_ga,
   jsonb_agg(jsonb_build_object('type','shared_roster_game','schedule_game_id',schedule_game_id,
     'team_result',result,'box_score_sources',player_sources) ORDER BY at_time,schedule_game_id) source_evidence
  FROM game_groups GROUP BY week,kind,member_ids
  HAVING count(*)>=2
 ), inserted AS (
  INSERT INTO public.team_line_weekly_reports
   (team_id,season,week,line_label,player_locker_ids,games_played,record,
    goals_for,goals_against,stats,summary,strengths,issues,next_adjustments,evidence,visibility,created_by)
  SELECT p_team,p_season,week,
    names||CASE WHEN kind='forwards' THEN ' (roster group)' ELSE ' (D pair, roster)' END,
    member_ids,games,NULL,NULL,NULL,
    jsonb_build_object('source','shared_roster_box_score','group_kind',kind,
     'team_record',wins::text||'-'||losses::text||'-'||ot_losses::text,
     'team_goals_for_in_games',team_gf,'team_goals_against_in_games',team_ga,
     'sum_individual_goals',individual_goals,'sum_individual_assists',individual_assists,
     'shift_overlap_verified',false,'chemistry_grade',NULL),
    'Week '||week||': These '||CASE WHEN kind='forwards' THEN 'three forwards' ELSE 'two defenders' END||
      ' appear together on '||games||' official game rosters. The team went '||wins||'-'||losses||
      '-'||ot_losses||' in those appearances ('||team_gf||' goals for, '||team_ga||
      ' against). Shared shifts, stable on-ice assignments and line-specific results have not been verified.',
    'Summing each member''s individual box-score contributions produces '||individual_goals||
      ' goals and '||individual_assists||' assists across those roster appearances. This is not a measured on-ice combination total.',
    'Roster overlap is verified only at the game level. No individual line chemistry score, shift overlap, or on-ice goal differential can be derived from these records.',
    'Verify line and partner assignments in actual game footage, then assess passing support, coverage rotations and puck-management decisions before grading chemistry.',
    source_evidence || jsonb_build_array(jsonb_build_object('type','generation_metadata',
      'generator','wildman_roster_group_v1','automated',true,
      'claim_policy','shared game roster only; not proven shared shift chemistry')),
    'team',v_creator
  FROM agg a
  WHERE (p_allow_open OR newest_game <= now()-interval '5 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.team_line_weekly_reports old
      WHERE old.team_id=p_team AND old.season=p_season
        AND old.week=a.week AND (old.player_locker_ids @> a.member_ids AND a.member_ids @> old.player_locker_ids)
    )
  ON CONFLICT (team_id,season,week,line_label) DO NOTHING
  RETURNING id
 )
 SELECT count(*) INTO v_added FROM inserted;
 RETURN v_added;
END;
$function$


REVOKE ALL ON FUNCTION private.generate_hitmen_player_weeklies(uuid,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.generate_hitmen_player_weeklies(uuid,integer,integer,boolean) TO postgres,service_role;
REVOKE ALL ON FUNCTION private.generate_hitmen_roster_group_weeklies(uuid,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.generate_hitmen_roster_group_weeklies(uuid,integer,integer,boolean) TO postgres,service_role;

COMMIT;

-- Live production cron: hitmen-season55-weekly-development-v1 (job 15)
-- Daily 16:15 UTC: private.generate_hitmen_player_weeklies(team_uuid,55,999,false)
-- and private.generate_hitmen_roster_group_weeklies(team_uuid,55,999,false)
-- Only considers a group's last recorded game when it is at least five days old.
-- SELECT cron.unschedule('hitmen-season55-weekly-development-v1'); -- rollback scheduler only
-- Data backfill was run once: 43 generated player reports + 12 generated group reports.
