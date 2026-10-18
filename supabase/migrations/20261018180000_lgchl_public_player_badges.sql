-- PUBLIC LGCHL MEDIA ONLY.
-- Append the official, stable LG user ID to the existing public season leader view.
-- Preserve every existing column, its type and order; preserve security_invoker.
-- This migration does not alter scouting, VOD, game reports or private material.

CREATE OR REPLACE VIEW public.wm_lgchl_s55_player_leaders
WITH (security_invoker = true)
AS
 SELECT
    p.gamertag,
    p."position",
    p.player_kind,
    p.lg_team_id,
    t.name AS team_name,
    p.games_played AS gp,
    p.fetched_at,
    COALESCE((p.stats ->> 'goals')::numeric, 0::numeric)::integer AS goals,
    COALESCE((p.stats ->> 'assists')::numeric, 0::numeric)::integer AS assists,
    COALESCE((p.stats ->> 'points')::numeric, 0::numeric)::integer AS points,
    COALESCE((p.stats ->> 'plusminus')::numeric, 0::numeric)::integer AS plus_minus,
    COALESCE((p.stats ->> 'shots')::numeric, 0::numeric)::integer AS shots,
    COALESCE((p.stats ->> 'hits')::numeric, 0::numeric)::integer AS hits,
    COALESCE((p.stats ->> 'takeaway')::numeric, 0::numeric)::integer AS takeaways,
    COALESCE((p.stats ->> 'bs')::numeric, 0::numeric)::integer AS blocked_shots,
    CASE WHEN p.player_kind = 'goalie'
      THEN COALESCE((p.stats ->> 'savep')::numeric, 0::numeric)
      ELSE NULL::numeric END AS save_pct,
    CASE WHEN p.player_kind = 'goalie'
      THEN COALESCE((p.stats ->> 'gaa')::numeric, 0::numeric)
      ELSE NULL::numeric END AS gaa,
    CASE WHEN p.player_kind = 'goalie'
      THEN COALESCE((p.stats ->> 'sog')::numeric, 0::numeric)
      ELSE NULL::numeric END AS goalie_shots_against,
    CASE WHEN p.player_kind = 'goalie'
      THEN COALESCE((p.stats ->> 'ga')::numeric, 0::numeric)
      ELSE NULL::numeric END AS goalie_goals_against,
    p.lg_user_id
   FROM public.lg_player_season_stats p
   LEFT JOIN public.lgchl_teams t ON t.season = 55 AND t.lg_team_id = p.lg_team_id
  WHERE p.season = 55 AND p.league_code = 'LGCHL' AND p.season_type = 'regular';

-- The historical summary is COPIED into a strictly public-safe table because
-- anon RLS on lg_player_season_stats permits S55 only. A security-invoker
-- view over historical source rows would correctly return nothing, while a
-- security-definer view could leak private columns. Do neither.
--
-- Only completed prior LGCHL regular seasons are included. Multiple entries
-- for the same LG user/season/kind are skipped instead of double counted.
CREATE TABLE IF NOT EXISTS public.lgchl_public_player_badges (
  lg_user_id bigint NOT NULL,
  player_kind text NOT NULL CHECK (player_kind = 'skater'),
  prev_gp integer,
  prev_ppg numeric,
  career_best_ppg numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lg_user_id,player_kind)
);
ALTER TABLE public.lgchl_public_player_badges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lgchl_public_player_badges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lgchl_public_player_badges TO anon, authenticated;

DROP POLICY IF EXISTS lgchl_public_player_badges_read ON public.lgchl_public_player_badges;
CREATE POLICY lgchl_public_player_badges_read
ON public.lgchl_public_player_badges
FOR SELECT TO anon, authenticated USING (true);

WITH valid_seasons AS (
    SELECT
      h.lg_user_id,
      h.player_kind,
      h.season,
      MAX(h.games_played) AS gp,
      MAX((h.stats ->> 'points')::numeric / NULLIF(h.games_played,0)) AS ppg
    FROM public.lg_player_season_stats h
    WHERE h.league_code = 'LGCHL'
      AND h.season_type = 'regular'
      AND h.season < 55
      AND h.player_kind = 'skater'
      AND h.lg_user_id IS NOT NULL
      AND h.games_played >= 10
      AND h.stats ? 'points'
      AND (h.stats ->> 'points') ~ '^[0-9]+([.][0-9]+)?$'
    GROUP BY h.lg_user_id, h.player_kind, h.season
    HAVING COUNT(*) = 1
), history AS (
    SELECT
      lg_user_id,
      player_kind,
      MAX(gp) FILTER (WHERE season=54) AS prev_gp,
      MAX(ppg) FILTER (WHERE season=54) AS prev_ppg,
      MAX(ppg) AS career_best_ppg
    FROM valid_seasons
    GROUP BY lg_user_id, player_kind
)
INSERT INTO public.lgchl_public_player_badges
  (lg_user_id, player_kind, prev_gp, prev_ppg, career_best_ppg, updated_at)
SELECT lg_user_id, player_kind, prev_gp, prev_ppg, career_best_ppg, now()
FROM history
ON CONFLICT (lg_user_id, player_kind)
DO UPDATE SET prev_gp=excluded.prev_gp,
              prev_ppg=excluded.prev_ppg,
              career_best_ppg=excluded.career_best_ppg,
              updated_at=excluded.updated_at;

COMMENT ON TABLE public.lgchl_public_player_badges IS
  'Safe public aggregate of LGCHL previous-season scoring rates keyed by official LG user ID; does not expose source scouting or VOD records.';
-- Historical imports are rerun only through an explicitly approved
-- maintenance refresh, never via the public browser or a client secret.
