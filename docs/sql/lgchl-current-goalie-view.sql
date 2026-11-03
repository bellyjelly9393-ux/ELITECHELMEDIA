create or replace view public.wm_lgchl_s55_player_leaders with (security_invoker=true) as SELECT p.gamertag,
    p."position",
    p.player_kind,
    p.lg_team_id,
    t.name AS team_name,
    p.games_played AS gp,
    p.fetched_at,
    COALESCE((p.stats ->> 'goals'::text)::numeric, 0::numeric)::integer AS goals,
    COALESCE((p.stats ->> 'assists'::text)::numeric, 0::numeric)::integer AS assists,
    COALESCE((p.stats ->> 'points'::text)::numeric, 0::numeric)::integer AS points,
    COALESCE((p.stats ->> 'plusminus'::text)::numeric, 0::numeric)::integer AS plus_minus,
    COALESCE((p.stats ->> 'shots'::text)::numeric, 0::numeric)::integer AS shots,
    COALESCE((p.stats ->> 'hits'::text)::numeric, 0::numeric)::integer AS hits,
    COALESCE((p.stats ->> 'takeaway'::text)::numeric, 0::numeric)::integer AS takeaways,
    COALESCE((p.stats ->> 'bs'::text)::numeric, 0::numeric)::integer AS blocked_shots,
        CASE
            WHEN p.player_kind = 'goalie'::text THEN COALESCE((p.stats ->> 'savep'::text)::numeric, 0::numeric)
            ELSE NULL::numeric
        END AS save_pct,
        CASE
            WHEN p.player_kind = 'goalie'::text THEN COALESCE((p.stats ->> 'gaa'::text)::numeric, 0::numeric)
            ELSE NULL::numeric
        END AS gaa,
        CASE
            WHEN p.player_kind = 'goalie'::text THEN COALESCE((p.stats ->> 'sog'::text)::numeric, 0::numeric)
            ELSE NULL::numeric
        END AS goalie_shots_against,
        CASE
            WHEN p.player_kind = 'goalie'::text THEN COALESCE((p.stats ->> 'ga'::text)::numeric, 0::numeric)
            ELSE NULL::numeric
        END AS goalie_goals_against,
    p.lg_user_id,
    CASE WHEN p.player_kind='goalie' THEN (p.stats->>'wins')::integer END AS wins,
    CASE WHEN p.player_kind='goalie' THEN (p.stats->>'losses')::integer END AS losses,
    CASE WHEN p.player_kind='goalie' THEN (p.stats->>'otl')::integer END AS otl,
    CASE WHEN p.player_kind='goalie' THEN (p.stats->>'gso')::integer END AS shutouts,
    CASE WHEN p.player_kind='goalie' THEN (p.stats->>'saves')::integer END AS saves,
    CASE WHEN p.player_kind='goalie' THEN p.stats->>'toi' END AS toi
   FROM lg_player_season_stats p
     LEFT JOIN lgchl_teams t ON t.season = 55 AND t.lg_team_id = p.lg_team_id
  WHERE p.season = 55 AND p.league_code = 'LGCHL'::text AND p.season_type = 'regular'::text AND COALESCE(p.stats->>'current_source_missing','false') <> 'true';
