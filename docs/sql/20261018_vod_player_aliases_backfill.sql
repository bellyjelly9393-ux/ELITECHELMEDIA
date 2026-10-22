-- One-time back-fill of private.vod_player_aliases from past VOD choices (run once, Oct 18 2026).
-- Sources: active vod_game_publications.report and vod_review_sessions.review_document player_matches.
-- Skips: 'tron' (needs a decision), any name linked to more than one target, any name whose
-- existing alias row points elsewhere, blank choices, and lockers outside the review's team.
with src as (
  select v.team_id,v.review_id,v.published_at ts,lower(btrim(m.key)) k,m.value v
  from public.vod_game_publications v
  cross join lateral jsonb_each_text(case when jsonb_typeof(v.report->'player_matches')='object' then v.report->'player_matches' else '{}'::jsonb end) m
  where v.active
  union all
  select s.team_id,s.id,s.updated_at,lower(btrim(m.key)),m.value
  from public.vod_review_sessions s
  cross join lateral jsonb_each_text(case when jsonb_typeof(s.review_document->'player_matches')='object' then s.review_document->'player_matches' else '{}'::jsonb end) m
), valid as (
  select src.*,l.season locker_season from src
  left join public.team_player_lockers l on l.id::text=src.v and l.team_id=src.team_id
  where src.k<>'' and coalesce(btrim(src.v),'')<>'' and (src.v='ignore' or l.id is not null)
), grouped as (
  select team_id,k,count(distinct v) targets,max(v) v,max(ts) ts,max(locker_season) locker_season,
    (array_agg(review_id order by ts desc))[1] review_id
  from valid group by team_id,k
), decided as (
  select g.*,
    case when g.k='tron' then 'skip_tron'
         when g.targets>1 then 'conflict_sources'
         when a.id is not null and ((a.ignored and g.v<>'ignore') or (not a.ignored and a.locker_id::text is distinct from g.v)) then 'conflict_existing'
         when a.id is not null then 'already_saved'
         else 'insert' end decision
  from grouped g
  left join private.vod_player_aliases a on a.team_id=g.team_id and lower(btrim(a.source_alias))=g.k
), ins as (
  insert into private.vod_player_aliases(team_id,season,locker_id,source_alias,ignored,created_at,updated_at,source_review_id)
  select d.team_id,
    coalesce(d.locker_season,
      (select h.season from public.hitmen_schedule_games h join public.vod_review_sessions s on s.schedule_game_id=h.id and h.team_id=s.team_id where s.id=d.review_id),
      (select max(season) from public.team_player_lockers where team_id=d.team_id)),
    case when d.v='ignore' then null else d.v::uuid end,d.k,d.v='ignore',d.ts,d.ts,
    (select id from public.vod_review_sessions where id=d.review_id)
  from decided d where d.decision='insert'
  on conflict (team_id,lower(btrim(source_alias))) do nothing
  returning ignored
)
select jsonb_build_object(
  'inserted_links',(select count(*) from ins where not ignored),
  'inserted_ignores',(select count(*) from ins where ignored),
  'already_saved',(select count(*) from decided where decision='already_saved'),
  'skipped',(select coalesce(jsonb_agg(jsonb_build_object('team',team_id,'name',k,'reason',decision)),'[]'::jsonb) from decided where decision not in ('insert','already_saved'))
) result;
