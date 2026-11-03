-- Elite Chel S55 provisional rating audit. READ ONLY.
-- Not a public score. Deduplicate by LG ID + player_kind; do not mix goalie/skater records.
-- Category weights sum to 100 for each position.
-- C: offense 20, defense 25, faceoffs 20, passing 15, possession 10, discipline 10.
-- W: offense 35, defense 15, faceoffs 5, passing 20, possession 15, discipline 10.
-- D: offense 15, defense 35, passing 15, possession 25, discipline 10.
-- G: shot stopping 45, high-danger 25, consistency 20, puck management 10.
-- IMPORTANT: Faceoffs, discipline, high-danger saves, puck management, and direct
-- passing/coverage events are NOT in the current public view. Do not fabricate them.
-- A separate provisional measurable-data index is computed below from existing fields.
-- Per-game metrics are percentile-ranked within position and GP>=5 peer groups.
-- A minimum of 5 games is a temporary screening threshold, not a finalized ECO rule.
WITH raw AS (
 SELECT *, row_number() OVER (
  PARTITION BY lg_user_id,player_kind
  ORDER BY gp DESC NULLS LAST,fetched_at DESC NULLS LAST
 ) AS duplicate_rank
 FROM public.wm_lgchl_s55_player_leaders
 WHERE lg_user_id IS NOT NULL
), clean AS (
 SELECT *,
  CASE WHEN player_kind='goalie' THEN 'G'
       WHEN position='C' THEN 'C'
       WHEN position IN ('LW','RW') THEN 'W'
       WHEN position IN ('LD','RD') THEN 'D' END AS rating_position
 FROM raw WHERE duplicate_rank=1
), eligible AS (
 SELECT *,
  goals::numeric/nullif(gp,0) as gpg,
  assists::numeric/nullif(gp,0) as apg,
  shots::numeric/nullif(gp,0) as spg,
  hits::numeric/nullif(gp,0) as hpg,
  takeaways::numeric/nullif(gp,0) as tpg,
  blocked_shots::numeric/nullif(gp,0) as bpg,
  wins::numeric/nullif(gp,0) as winrate,
  shutouts::numeric/nullif(gp,0) as shutoutrate
 FROM clean WHERE gp>=5 AND rating_position IS NOT NULL
), pct AS (
 SELECT *,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY gpg) pg,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY apg) pa,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY spg) ps,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY hpg) ph,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY tpg) pt,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY bpg) pb,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY save_pct) psv,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY gaa DESC) pgaa,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY winrate) pw,
 percent_rank() OVER(PARTITION BY rating_position ORDER BY shutoutrate) pso
 FROM eligible
), score AS (
 SELECT *,
 CASE rating_position
  WHEN 'C' THEN .25*pg+.20*pa+.10*ps+.25*pt+.10*pb+.10*ph
  WHEN 'W' THEN .35*pg+.25*pa+.15*ps+.10*pt+.05*pb+.10*ph
  WHEN 'D' THEN .10*pg+.15*pa+.10*ps+.25*pt+.25*pb+.15*ph
  WHEN 'G' THEN .55*psv+.20*pgaa+.15*pw+.10*pso
 END AS measured_index
 FROM pct
)
SELECT rating_position,count(*) eligible_players,
 round((min(measured_index)*100)::numeric,1) min_index,
 round((avg(measured_index)*100)::numeric,1) mean_index,
 round((max(measured_index)*100)::numeric,1) max_index,
 count(*) FILTER(WHERE measured_index IS NULL) missing_index
FROM score GROUP BY rating_position ORDER BY rating_position;
