-- Sticky VOD player-name links (Oct 18 2026).
-- A CHEL/in-game name linked (or excluded) once is remembered for the whole team and
-- pre-filled on every future VOD. Keyed per team on lower(btrim(name)), the same key
-- vod-lab.js uses (playerNameKey) and publish_vod_review reads from player_matches.
--
-- Seasons: lockers are per season (team_player_lockers.season). Each alias row keeps the
-- season/locker of its most recent link; private.vod_alias_locker_for_season() maps that
-- locker to the same player's locker in the requested season (lg_user_id, then user_id,
-- then exact gamertag; unique matches only). An unresolvable link is simply not suggested.

-- 1. Table shape -------------------------------------------------------------------------
alter table private.vod_player_aliases
  add column if not exists ignored boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists source_review_id uuid references public.vod_review_sessions(id) on delete set null;
update private.vod_player_aliases set updated_at=created_at where updated_at>created_at;
alter table private.vod_player_aliases alter column locker_id drop not null;
alter table private.vod_player_aliases drop constraint if exists vod_player_aliases_target_check;
alter table private.vod_player_aliases add constraint vod_player_aliases_target_check
  check ((ignored and locker_id is null) or (not ignored and locker_id is not null));

-- Latest link per team+name wins; older duplicates (other seasons) are removed.
delete from private.vod_player_aliases a
using (
  select id,row_number() over (partition by team_id,lower(btrim(source_alias))
    order by season desc,updated_at desc,created_at desc,id desc) rn
  from private.vod_player_aliases
) d
where a.id=d.id and d.rn>1;
drop index if exists private.vod_player_aliases_unique;
create unique index if not exists vod_player_aliases_team_alias_key
  on private.vod_player_aliases (team_id,lower(btrim(source_alias)));

-- 2. Season resolver (invoker; used by the routing trigger and the saved map) ----------------
-- BEGIN vod_alias_locker_for_season
create or replace function private.vod_alias_locker_for_season(alias_locker uuid, target_team uuid, target_season integer)
returns uuid language plpgsql stable set search_path='' as $$
declare src public.team_player_lockers; hit uuid; n integer;
begin
if alias_locker is null then return null; end if;
select * into src from public.team_player_lockers where id=alias_locker and team_id=target_team;
if src.id is null then return null; end if;
if src.season=target_season then return src.id; end if;
if src.lg_user_id is not null then
  select count(*),min(id::text)::uuid into n,hit from public.team_player_lockers
  where team_id=target_team and season=target_season and lg_user_id=src.lg_user_id;
  if n=1 then return hit; end if;
end if;
if src.user_id is not null then
  select count(*),min(id::text)::uuid into n,hit from public.team_player_lockers
  where team_id=target_team and season=target_season and user_id=src.user_id;
  if n=1 then return hit; end if;
end if;
select count(*),min(id::text)::uuid into n,hit from public.team_player_lockers
where team_id=target_team and season=target_season and lower(btrim(gamertag))=lower(btrim(src.gamertag));
if n=1 then return hit; end if;
return null;
end $$;
-- END vod_alias_locker_for_season
revoke all on function private.vod_alias_locker_for_season(uuid,uuid,integer) from public,anon;
grant execute on function private.vod_alias_locker_for_season(uuid,uuid,integer) to authenticated,service_role;

-- 3. Saved map {name_key: locker_id | 'ignore'} for a team and game season -------------------
create or replace function private.vod_saved_player_matches(target_team uuid, target_season integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
if auth.uid() is null or not private.vvhl_can_manage_team(auth.uid(),target_team) then
  raise exception 'Management access to this team is required' using errcode='42501';
end if;
return coalesce((select jsonb_object_agg(k,v) from (
  select lower(btrim(a.source_alias)) k,
    case when a.ignored then 'ignore'
      else private.vod_alias_locker_for_season(a.locker_id,a.team_id,target_season)::text end v
  from private.vod_player_aliases a where a.team_id=target_team
) s where v is not null and k<>''),'{}'::jsonb);
end $$;
revoke all on function private.vod_saved_player_matches(uuid,integer) from public,anon;
grant execute on function private.vod_saved_player_matches(uuid,integer) to authenticated;

-- 4. Remember a review's choices (latest wins). '' (explicitly left unmatched) forgets the link.
create or replace function private.vod_remember_player_matches(target_review uuid, choices jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare r public.vod_review_sessions; game_season integer; m record; k text; l public.team_player_lockers; n integer:=0;
begin
select * into r from public.vod_review_sessions where id=target_review;
if r.id is null or auth.uid() is null or not private.vvhl_can_manage_team(auth.uid(),r.team_id) then
  raise exception 'Management access to this team is required' using errcode='42501';
end if;
if jsonb_typeof(choices) is distinct from 'object' then return 0; end if;
select season into game_season from public.hitmen_schedule_games where id=r.schedule_game_id and team_id=r.team_id;
if game_season is null then select max(season) into game_season from public.team_player_lockers where team_id=r.team_id; end if;
for m in select key,value from jsonb_each_text(choices) loop
  k:=lower(btrim(m.key));
  if k='' then continue; end if;
  if m.value is null or btrim(m.value)='' then
    delete from private.vod_player_aliases where team_id=r.team_id and lower(btrim(source_alias))=k;
  elsif m.value='ignore' then
    if game_season is null then continue; end if;
    insert into private.vod_player_aliases(team_id,season,locker_id,source_alias,created_by,ignored,updated_at,source_review_id)
    values(r.team_id,game_season,null,k,auth.uid(),true,now(),r.id)
    on conflict (team_id,lower(btrim(source_alias))) do update set
      locker_id=null,ignored=true,season=excluded.season,updated_at=now(),source_review_id=excluded.source_review_id;
  else
    l:=null;
    select * into l from public.team_player_lockers where id::text=m.value and team_id=r.team_id;
    if l.id is null then continue; end if;
    insert into private.vod_player_aliases(team_id,season,locker_id,source_alias,created_by,ignored,updated_at,source_review_id)
    values(r.team_id,l.season,l.id,k,auth.uid(),false,now(),r.id)
    on conflict (team_id,lower(btrim(source_alias))) do update set
      locker_id=excluded.locker_id,ignored=false,season=excluded.season,updated_at=now(),source_review_id=excluded.source_review_id;
  end if;
  n:=n+1;
end loop;
return n;
end $$;
revoke all on function private.vod_remember_player_matches(uuid,jsonb) from public,anon;
grant execute on function private.vod_remember_player_matches(uuid,jsonb) to authenticated;

-- 5. Match context: adds `saved` (backward compatible; existing keys unchanged) -----------------
create or replace function public.vod_player_match_context(target_review uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.vod_review_sessions; game_season integer; candidates jsonb; suggestions jsonb; saved jsonb;
begin
select * into r from public.vod_review_sessions where id=target_review;
if r.id is null or auth.uid() is null or not private.vvhl_can_manage_team(auth.uid(),r.team_id) then
 raise exception 'Management access to this team is required' using errcode='42501';
end if;
select season into game_season from public.hitmen_schedule_games where id=r.schedule_game_id and team_id=r.team_id;
if game_season is null then select max(season) into game_season from public.team_player_lockers where team_id=r.team_id; end if;
select coalesce(jsonb_agg(x order by x.gamertag),'[]'::jsonb) into candidates from (
 select l.id,l.gamertag,l.position,l.lg_user_id::text as lg_user_id,
 exists(select 1 from public.team_player_game_reports g where g.team_id=r.team_id and g.locker_id=l.id and g.schedule_game_id=r.schedule_game_id and g.ai_review_id is null) as played,
 exists(select 1 from public.lineups u join public.lineup_slots s on s.lineup_id=u.id
 where u.team_id=r.team_id and u.schedule_game_id=r.schedule_game_id and u.is_active is not false and s.player_id=l.player_id) as lineup
 from public.team_player_lockers l where l.team_id=r.team_id and l.season=game_season
) x;
select coalesce(jsonb_agg(distinct jsonb_build_object('name',m.key,'locker_id',l.id,'gamertag',l.gamertag)),'[]'::jsonb)
into suggestions from public.vod_game_publications v
cross join lateral jsonb_each_text(coalesce(v.report->'player_matches','{}'::jsonb)) m
join public.team_player_lockers l on l.id::text=m.value and l.team_id=r.team_id and l.season=game_season
where v.team_id=r.team_id and v.active and v.review_id<>r.id;
saved:=private.vod_saved_player_matches(r.team_id,game_season);
return jsonb_build_object('candidates',candidates,'suggestions',suggestions,'matches',coalesce(r.review_document->'player_matches','{}'::jsonb),'saved',saved);
end $$;
revoke all on function public.vod_player_match_context(uuid) from public,anon;
grant execute on function public.vod_player_match_context(uuid) to authenticated,service_role;

-- 6. Publish: names without an explicit choice in this review use the saved link; every
--    choice is then remembered. Everything else is unchanged.
create or replace function public.publish_vod_review(target_review uuid, expected_updated_at timestamp with time zone, report jsonb)
returns jsonb language plpgsql set search_path to '' as $function$
declare r public.vod_review_sessions; p jsonb; n integer; routed integer:=0; l public.team_player_lockers; matches integer; unmatched jsonb:='[]'::jsonb; latest integer; entry record; resolved jsonb:='[]'::jsonb; selected text; source_name text; chosen jsonb; saved jsonb;
begin
select * into r from public.vod_review_sessions where id=target_review for update;
if r.id is null or auth.uid() is null or not private.vvhl_can_manage_team(auth.uid(),r.team_id) then
raise exception 'Management access to this team is required' using errcode='42501';
end if;
if r.updated_at is distinct from expected_updated_at then raise exception 'Review changed elsewhere. Refresh before publishing.'; end if;
select season into latest from public.hitmen_schedule_games where id=r.schedule_game_id and team_id=r.team_id;
if latest is null then select max(season) into latest from public.team_player_lockers where team_id=r.team_id; end if;
chosen:=coalesce(report->'player_matches',r.review_document->'player_matches','{}'::jsonb);
if jsonb_typeof(chosen) is distinct from 'object' then chosen:='{}'::jsonb; end if;
saved:=private.vod_saved_player_matches(r.team_id,latest);
chosen:=coalesce((select jsonb_object_agg(k,saved->k) from (
  select distinct lower(btrim(x->>'player')) k
  from jsonb_array_elements(case when jsonb_typeof(report->'players')='array' then report->'players' else '[]'::jsonb end) x
) names where k<>'' and saved ? k and not chosen ? k),'{}'::jsonb)||chosen;
report:=report||jsonb_build_object(
'player_matches',chosen,
'approved_periods',coalesce((select jsonb_agg(to_jsonb(s) order by s.start_seconds) from public.vod_review_segments s
where s.review_id=r.id and s.archived_at is null and s.status='complete'),'[]'::jsonb),
'approved_markers',coalesce((select jsonb_agg(to_jsonb(m) order by m.timestamp_seconds) from public.vod_review_markers m
join public.vod_review_segments s on s.id=m.segment_id
where s.review_id=r.id and s.archived_at is null and s.status='complete'),'[]'::jsonb));
update public.vod_review_sessions set review_document=report,
full_game_summary=coalesce(nullif(report->>'summary',''),full_game_summary),
tactical_report=coalesce(nullif(report->>'tactical_report',''),tactical_report),
player_report=coalesce(nullif(report->>'player_report',''),player_report),status='complete',updated_at=now() where id=r.id;
insert into public.vod_game_publications(review_id,team_id,report,published_by)
values(r.id,r.team_id,report,auth.uid())
on conflict(review_id) do update set report=excluded.report,active=true,
published_by=excluded.published_by,published_at=now();
-- Keep original report names and evidence intact; resolve only the routing identity.
for p in select value from jsonb_array_elements(report->'players') loop
source_name:=btrim(p->>'player');
selected:=report->'player_matches'->>lower(source_name);
if selected='ignore' then continue; end if;
if selected is not null and selected<>'' then
  select count(*) into matches from public.team_player_lockers where id::text=selected and team_id=r.team_id and season=latest;
  if matches<>1 then raise exception 'Selected player does not belong to this team and game season'; end if;
  select * into l from public.team_player_lockers where id::text=selected and team_id=r.team_id and season=latest;
else
  select count(*) into matches from public.team_player_lockers where team_id=r.team_id and season=latest and lower(btrim(gamertag))=lower(source_name);
  if matches<>1 then unmatched:=unmatched||jsonb_build_array(source_name); continue; end if;
  select * into l from public.team_player_lockers where team_id=r.team_id and season=latest and lower(btrim(gamertag))=lower(source_name);
end if;
resolved:=resolved||jsonb_build_array(p||jsonb_build_object('locker_id',l.id,'source_name',source_name));
end loop;
-- Multiple CHEL names and the gamertag share ONE canonical locker entry.
for entry in select value->>'locker_id' as locker_id, jsonb_agg(value) as entries
  from jsonb_array_elements(resolved) group by value->>'locker_id' loop
select * into l from public.team_player_lockers where id::text=entry.locker_id and team_id=r.team_id;
p:=jsonb_build_object('player',l.gamertag,'position',l.position,
  'source_names',(select jsonb_agg(distinct value->>'source_name') from jsonb_array_elements(entry.entries)),
  'rating',(select value->'rating' from jsonb_array_elements(entry.entries) where value->'rating'<>'null'::jsonb order by (lower(value->>'source_name')=lower(l.gamertag)) desc limit 1),
  'evidence_timestamps',coalesce((select jsonb_agg(t order by t) from (select distinct t from jsonb_array_elements(entry.entries) e cross join lateral jsonb_array_elements(coalesce(e->'evidence_timestamps','[]'::jsonb)) t) stamps),'[]'::jsonb));
-- Distinct lines retain each observation without repeating identical notes.
for selected in select unnest(array['strengths','concerns','habits','coach_note']) loop
  p:=p||jsonb_build_object(selected,(select string_agg(line,E'\n' order by line) from
    (select distinct btrim(line) line from jsonb_array_elements(entry.entries) e
     cross join lateral regexp_split_to_table(coalesce(e->>selected,''),E'\n') line where btrim(line)<>'') notes));
end loop;
insert into public.team_player_game_reports(team_id,season,locker_id,schedule_game_id,game_date,opponent_name,position_played,ai_review_id,stats,visibility,created_by)
select r.team_id,l.season,l.id,r.schedule_game_id,r.game_date,r.opponent_label,p->>'position',r.id,'{}'::jsonb,'management',auth.uid()
on conflict (ai_review_id,locker_id) where ai_review_id is not null do nothing;
update public.team_player_game_reports g set
strengths=coalesce(nullif(p->>'strengths',''),g.strengths),improvements=coalesce(nullif(p->>'concerns',''),g.improvements),
tactical_notes=coalesce(nullif(p->>'habits',''),g.tactical_notes),coach_summary=coalesce(nullif(p->>'coach_note',''),g.coach_summary),
visibility='player',position_played=coalesce(nullif(p->>'position',''),g.position_played),updated_at=now(),
evidence=(case when jsonb_typeof(g.evidence)='object' then g.evidence else jsonb_build_object('legacy_evidence',g.evidence) end)||jsonb_build_object(
'source_names',p->'source_names','lg_user_id',l.lg_user_id,'verification','approved','approved_by',auth.uid(),'rating',p->'rating',
'evidence_timestamps',coalesce(p->'evidence_timestamps','[]'::jsonb),'approved_at',now(),
'source_vod_url',r.vod_url,'timestamp_basis','full_vod','source_start_seconds',r.source_start_seconds,
'source_end_seconds',r.source_end_seconds,'approved_periods',report->'approved_periods',
'unit_reports',coalesce((select jsonb_agg(distinct u) from jsonb_array_elements(report->'units') u
where exists(select 1 from jsonb_array_elements_text(u->'players') member
where exists(select 1 from jsonb_array_elements_text(p->'source_names') name where lower(btrim(member))=lower(btrim(name))))),'[]'::jsonb))
where g.ai_review_id=r.id and g.team_id=r.team_id and g.locker_id=l.id;
get diagnostics n=row_count;routed:=routed+n;
end loop;
-- A corrected mapping withdraws obsolete VOD routing without deleting its audit evidence.
update public.team_player_game_reports g set visibility='management',updated_at=now()
where g.ai_review_id=r.id and g.team_id=r.team_id and not exists(select 1 from jsonb_array_elements(resolved) e where e->>'locker_id'=g.locker_id::text);
-- Remember this game's choices for future VODs (latest wins).
perform private.vod_remember_player_matches(r.id,report->'player_matches');
return jsonb_build_object('review_id',r.id,'player_reports',routed,'unmatched_players',unmatched);
end $function$;

-- 7. Routing trigger: reads the new alias shape (skips excluded names, maps across seasons).
CREATE OR REPLACE FUNCTION public.route_vod_player_reports()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  game_season integer;
  game_week integer;
  entry record;
  target_locker uuid;
  matches integer;
  current_seasons integer;
begin
  if new.worker_status <> 'ready_for_review' or new.created_by is null then return new; end if;
  -- Structured period reports use the approved publication workflow; do not route drafts.
  if jsonb_typeof(new.worker_result->'period_reports')='array' then
    if jsonb_array_length(new.worker_result->'period_reports')>=3 then return new; end if;
  end if;
  if jsonb_typeof(new.worker_result->'chunks') is distinct from 'array' then return new; end if;

  if new.schedule_game_id is not null then
    select season,week into game_season,game_week
    from public.hitmen_schedule_games
    where id=new.schedule_game_id and team_id=new.team_id;
    if game_season is null then return new; end if;
  else
    select count(distinct season),min(season) into current_seasons,game_season
    from public.team_player_lockers where team_id=new.team_id;
    if current_seasons <> 1 then return new; end if;
  end if;

  for entry in
    select
      lower(btrim(p->>'player')) as player_key,
      regexp_replace(lower(btrim(p->>'player')), '[^a-z0-9]+', ' ', 'g') as player_norm,
      string_agg(distinct nullif(p->>'strengths',''), E'\n') as strengths,
      string_agg(distinct nullif(p->>'concerns',''), E'\n') as improvements,
      string_agg(distinct nullif(p->>'habits',''), E'\n') as tactical_notes,
      string_agg(distinct nullif(p->>'coach_note',''), E'\n') as coach_summary,
      jsonb_agg(distinct jsonb_build_object(
        'period',c->>'label','start',c->'start','end',c->'end',
        'player',p->>'player','confidence',p->>'confidence',
        'timestamps',p->'evidence_timestamps'
      )) as evidence
    from jsonb_array_elements(new.worker_result->'chunks') c
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(c#>'{review,player_evaluations}')='array'
        then c#>'{review,player_evaluations}' else '[]'::jsonb end
    ) p
    where nullif(btrim(p->>'player'),'') is not null
      and jsonb_typeof(p->'evidence_timestamps')='array'
      and jsonb_array_length(p->'evidence_timestamps')>0
      and exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(c#>'{review,observations}')='array'
            then c#>'{review,observations}' else '[]'::jsonb end
        ) o
        where lower(btrim(o->>'player'))=lower(btrim(p->>'player'))
          and o->>'source'='gameplay'
      )
    group by lower(btrim(p->>'player')),
             regexp_replace(lower(btrim(p->>'player')), '[^a-z0-9]+', ' ', 'g')
    order by lower(btrim(p->>'player'))
  loop
    select count(distinct candidate_locker),(array_agg(distinct candidate_locker))[1]
      into matches,target_locker
    from (
      select l.id as candidate_locker
      from public.team_player_lockers l
      left join public.hitmen_discord_player_links d
        on d.locker_id=l.id and d.season=l.season
      where l.team_id=new.team_id
        and l.season=game_season
        and (
          regexp_replace(lower(btrim(l.gamertag)), '[^a-z0-9]+', ' ', 'g')=entry.player_norm
          or (
            d.roster_alias is not null
            and (
              regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g')=entry.player_norm
              or (
                length(regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g'))>=3
                and (
                  entry.player_norm like '% ' || regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g')
                  or entry.player_norm like regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g') || ' %'
                )
              )
            )
          )
        )
      union
      -- Saved VOD links persist across seasons; map to this season's locker. Excluded names never route.
      select resolved.locker_id
      from (
        select private.vod_alias_locker_for_season(va.locker_id,va.team_id,game_season) as locker_id
        from private.vod_player_aliases va
        where va.team_id=new.team_id
          and not va.ignored
          and va.locker_id is not null
          and regexp_replace(lower(btrim(va.source_alias)), '[^a-z0-9]+', ' ', 'g')=entry.player_norm
      ) resolved
      where resolved.locker_id is not null
    ) candidates;

    if matches <> 1 then continue; end if;

    insert into public.team_player_game_reports
      (team_id,season,locker_id,ai_review_id,schedule_game_id,week,game_date,opponent_name,
       strengths,improvements,tactical_notes,coach_summary,evidence,visibility,created_by)
    values (
      new.team_id,game_season,target_locker,new.id,new.schedule_game_id,game_week,
      new.game_date,new.opponent_label,entry.strengths,entry.improvements,entry.tactical_notes,
      '[AI draft — needs management review]' || E'\n' || coalesce(entry.coach_summary,''),
      jsonb_build_object(
        'source','vod_ai','review_id',new.id,'vod_url',new.vod_url,
        'source_offset_seconds',new.source_start_seconds,'verification','needs_review',
        'source_player_label',entry.player_key,'chunks',entry.evidence
      ),
      'management',new.created_by
    )
    on conflict (ai_review_id,locker_id) where ai_review_id is not null do nothing;
  end loop;

  return new;
end
$function$
;
