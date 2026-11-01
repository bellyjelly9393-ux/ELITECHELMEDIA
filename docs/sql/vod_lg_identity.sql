begin;
-- Review-only installer. Do not run against production without approval.
-- Requires the existing VOD approval/player-matching schemas. No backfill.
create unique index vod_report_canonical_game
 on public.team_player_game_reports(team_id,schedule_game_id,(evidence->'canonical_key'))
 where ai_review_id is not null and evidence ? 'canonical_key';

create table public.vod_verified_game_players (
 schedule_game_id uuid not null references public.hitmen_schedule_games(id),
 team_id uuid not null references public.teams(id),
 league text not null check (league ~ '^[A-Z0-9_]+$'),
 season integer not null check (season > 0),
 lg_user_id text not null check (lg_user_id ~ '^[1-9][0-9]*$'),
 locker_id uuid not null references public.team_player_lockers(id),
 evidence text not null check (length(btrim(evidence)) >= 12),
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 primary key(schedule_game_id, league, season, lg_user_id),
 unique(schedule_game_id, locker_id)
);
create table public.vod_verified_player_aliases (
 schedule_game_id uuid not null,
 league text not null,
 season integer not null,
 lg_user_id text not null,
 name text not null check (name=lower(btrim(name)) and name<>''),
 kind text not null check (kind in ('gamertag','chel_character','broadcast')),
 evidence text not null check (length(btrim(evidence)) >= 12),
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 primary key(schedule_game_id,league,season,lg_user_id,name),
 foreign key(schedule_game_id,league,season,lg_user_id)
 references public.vod_verified_game_players(schedule_game_id,league,season,lg_user_id)
);
-- Conflicting aliases are retained as ambiguity, never resolved by insertion order.
-- This is the console account verified for THIS game, not a roster-name inference.
create table public.vod_verified_platform_accounts (
 schedule_game_id uuid not null,
 league text not null,
 season integer not null,
 lg_user_id text not null,
 platform text not null check(platform in ('xbox','playstation')),
 gamertag text not null check(length(btrim(gamertag)) between 1 and 80),
 source_url text not null,
 evidence text not null check(length(btrim(evidence))>=12),
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 primary key(schedule_game_id,league,season,lg_user_id),
 foreign key(schedule_game_id,league,season,lg_user_id)
 references public.vod_verified_game_players(schedule_game_id,league,season,lg_user_id)
);
create unique index vod_platform_game_account on public.vod_verified_platform_accounts(schedule_game_id,platform,lower(btrim(gamertag)));
alter table public.vod_verified_platform_accounts enable row level security;
revoke all on public.vod_verified_platform_accounts from public,anon,authenticated;
grant select,insert on public.vod_verified_platform_accounts to authenticated;
create policy vod_platform_read on public.vod_verified_platform_accounts for select to authenticated
 using(exists(select 1 from public.vod_verified_game_players p where p.schedule_game_id=vod_verified_platform_accounts.schedule_game_id and p.league=vod_verified_platform_accounts.league and p.season=vod_verified_platform_accounts.season and p.lg_user_id=vod_verified_platform_accounts.lg_user_id));
create policy vod_platform_insert on public.vod_verified_platform_accounts for insert to authenticated
 with check(verified_by=auth.uid() and exists(select 1 from public.vod_verified_game_players p where p.schedule_game_id=vod_verified_platform_accounts.schedule_game_id and p.league=vod_verified_platform_accounts.league and p.season=vod_verified_platform_accounts.season and p.lg_user_id=vod_verified_platform_accounts.lg_user_id));
alter table public.vod_verified_game_players enable row level security;
alter table public.vod_verified_player_aliases enable row level security;
revoke all on public.vod_verified_game_players,public.vod_verified_player_aliases from public,anon,authenticated;
grant select,insert on public.vod_verified_game_players,public.vod_verified_player_aliases to authenticated;
create policy vod_verified_roster_read on public.vod_verified_game_players for select to authenticated
 using(private.vvhl_can_manage_team(auth.uid(),team_id));
create policy vod_verified_alias_read on public.vod_verified_player_aliases for select to authenticated
 using(exists(select 1 from public.vod_verified_game_players p where p.schedule_game_id=vod_verified_player_aliases.schedule_game_id and p.league=vod_verified_player_aliases.league and p.season=vod_verified_player_aliases.season and p.lg_user_id=vod_verified_player_aliases.lg_user_id));

-- Inserts are checked even when made directly through the Data API.
create function public.vod_check_identity_evidence() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.vod_verified_game_players; g public.hitmen_schedule_games;
begin
 if auth.uid() is null then raise exception 'Management verification required' using errcode='42501'; end if;
 perform 1 from public.hitmen_schedule_games where id=new.schedule_game_id for update;
 if tg_table_name='vod_verified_game_players' then
  select * into g from public.hitmen_schedule_games where id=new.schedule_game_id and team_id=new.team_id and season=new.season;
  if g.id is null or not coalesce(private.vvhl_can_manage_team(auth.uid(),new.team_id),false) then raise exception 'Verified game and season required' using errcode='42501'; end if;
  if (select count(*) from public.team_player_lockers l where l.team_id=new.team_id and l.season=new.season and l.lg_user_id::text=new.lg_user_id)<>1
   or not exists(select 1 from public.team_player_lockers l where l.id=new.locker_id and l.team_id=new.team_id and l.season=new.season and l.lg_user_id::text=new.lg_user_id)
  then raise exception 'Missing or ambiguous LG locker identity'; end if;
  -- One game cannot silently combine leagues.
  if exists(select 1 from public.vod_verified_game_players x where x.schedule_game_id=new.schedule_game_id and x.league<>new.league) then raise exception 'Conflicting game league'; end if;
 else
  select * into p from public.vod_verified_game_players where schedule_game_id=new.schedule_game_id and league=new.league and season=new.season and lg_user_id=new.lg_user_id;
  if p.locker_id is null or not coalesce(private.vvhl_can_manage_team(auth.uid(),p.team_id),false) then raise exception 'Verified game participant required' using errcode='42501'; end if;
  if tg_table_name='vod_verified_platform_accounts' then
   if new.source_url !~ '^https://(www\.)?leaguegaming\.com/forums/[^#[:space:]]+$'
    or substring(new.source_url from '[?&]userid=([0-9]+)(?:&|$)') is distinct from new.lg_user_id
    or (select count(*) from regexp_matches(new.source_url,'[?&]userid=','g'))<>1
   then raise exception 'LG profile evidence must identify this exact LG user ID'; end if;
  end if;
 end if;
 new.verified_by:=auth.uid();new.verified_at:=now();return new;
end $$;
create trigger vod_check_roster before insert on public.vod_verified_game_players for each row execute function public.vod_check_identity_evidence();
create trigger vod_check_alias before insert on public.vod_verified_player_aliases for each row execute function public.vod_check_identity_evidence();
create trigger vod_check_platform before insert on public.vod_verified_platform_accounts for each row execute function public.vod_check_identity_evidence();
create policy vod_verified_roster_insert on public.vod_verified_game_players for insert to authenticated
 with check(verified_by=auth.uid() and private.vvhl_can_manage_team(auth.uid(),team_id));
create policy vod_verified_alias_insert on public.vod_verified_player_aliases for insert to authenticated
 with check(verified_by=auth.uid() and exists(select 1 from public.vod_verified_game_players p where p.schedule_game_id=vod_verified_player_aliases.schedule_game_id and p.league=vod_verified_player_aliases.league and p.season=vod_verified_player_aliases.season and p.lg_user_id=vod_verified_player_aliases.lg_user_id));

create function public.vod_resolve_player_identity(target_review uuid, source_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.vod_review_sessions; p public.vod_verified_game_players; n integer;
begin
 select * into r from public.vod_review_sessions where id=target_review;
 if r.id is null or auth.uid() is null or not coalesce(private.vvhl_can_manage_team(auth.uid(),r.team_id),false) then raise exception 'Management access required' using errcode='42501'; end if;
 if not exists(select 1 from public.vod_verified_game_players v join public.hitmen_schedule_games g on g.id=v.schedule_game_id and g.team_id=v.team_id and g.season=v.season where v.schedule_game_id=r.schedule_game_id and v.team_id=r.team_id) then
  return jsonb_build_object('status','unresolved','reason','no_verified_game_roster','source_name',source_name);
 end if;
 select count(*) into n from public.vod_verified_player_aliases a join public.vod_verified_game_players v using(schedule_game_id,league,season,lg_user_id)
 where a.schedule_game_id=r.schedule_game_id and v.team_id=r.team_id and a.name=lower(btrim(source_name));
 if n<>1 then return jsonb_build_object('status','unresolved','reason',case when n>1 then 'ambiguous_alias' else 'unverified_alias' end,'source_name',source_name); end if;
 select v.* into p from public.vod_verified_player_aliases a join public.vod_verified_game_players v using(schedule_game_id,league,season,lg_user_id)
 where a.schedule_game_id=r.schedule_game_id and v.team_id=r.team_id and a.name=lower(btrim(source_name));
 -- Recheck locker binding at use time: a later import must not redirect an old verification.
 if not exists(select 1 from public.hitmen_schedule_games g where g.id=p.schedule_game_id and g.team_id=p.team_id and g.season=p.season)
 or (select count(*) from public.team_player_lockers l where l.team_id=p.team_id and l.season=p.season and l.lg_user_id::text=p.lg_user_id)<>1
 or not exists(select 1 from public.team_player_lockers l where l.id=p.locker_id and l.team_id=p.team_id and l.season=p.season and l.lg_user_id::text=p.lg_user_id)
 then return jsonb_build_object('status','unresolved','reason','missing_or_ambiguous_lg_id','source_name',source_name); end if;
 return jsonb_build_object('status','resolved','canonical_key',jsonb_build_array(p.league,p.season,p.lg_user_id),'league',p.league,'season',p.season,'lg_user_id',p.lg_user_id,'locker_id',p.locker_id,'source_name',source_name);
end $$;

create or replace function public.vod_player_match_context(target_review uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.vod_review_sessions; candidates jsonb; matches jsonb:='{}'; item jsonb; identity jsonb;
begin
 select * into r from public.vod_review_sessions where id=target_review;
 if r.id is null or auth.uid() is null or not coalesce(private.vvhl_can_manage_team(auth.uid(),r.team_id),false) then raise exception 'Management access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'gamertag',l.gamertag,'position',l.position,'lg_user_id',p.lg_user_id,'league',p.league,'season',p.season,'played',true,'account_gamertag',a.gamertag,'account_platform',a.platform)),'[]') into candidates
 from public.vod_verified_game_players p join public.team_player_lockers l on l.id=p.locker_id and l.team_id=p.team_id and l.season=p.season and l.lg_user_id::text=p.lg_user_id
 left join public.vod_verified_platform_accounts a on a.schedule_game_id=p.schedule_game_id and a.league=p.league and a.season=p.season and a.lg_user_id=p.lg_user_id
 join public.hitmen_schedule_games g on g.id=p.schedule_game_id and g.team_id=p.team_id and g.season=p.season
 where p.schedule_game_id=r.schedule_game_id and p.team_id=r.team_id
 and (select count(*) from public.team_player_lockers x where x.team_id=p.team_id and x.season=p.season and x.lg_user_id::text=p.lg_user_id)=1;
 for item in select value from jsonb_array_elements(coalesce(r.review_document->'players','[]')) loop
  identity:=public.vod_resolve_player_identity(r.id,item->>'player');
  if identity->>'status'='resolved' then matches:=matches||jsonb_build_object(lower(btrim(item->>'player')),identity->>'locker_id'); end if;
 end loop;
 return jsonb_build_object('identity_version',2,'candidates',candidates,'matches',matches,'suggestions','[]'::jsonb);
end $$;

create function public.vod_verify_player_alias(target_review uuid, source_name text, target_locker uuid, alias_kind text, source_evidence text)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.vod_review_sessions; p public.vod_verified_game_players;
begin
 select * into r from public.vod_review_sessions where id=target_review for update;
 if r.id is null or auth.uid() is null or not coalesce(private.vvhl_can_manage_team(auth.uid(),r.team_id),false) then raise exception 'Management access required' using errcode='42501'; end if;
 select * into p from public.vod_verified_game_players where schedule_game_id=r.schedule_game_id and team_id=r.team_id and locker_id=target_locker;
 if p.locker_id is null then raise exception 'Verified game participant required'; end if;
 insert into public.vod_verified_player_aliases(schedule_game_id,league,season,lg_user_id,name,kind,evidence,verified_by)
 values(p.schedule_game_id,p.league,p.season,p.lg_user_id,lower(btrim(source_name)),alias_kind,source_evidence,auth.uid())
 on conflict do nothing;
end $$;

revoke all on function public.vod_check_identity_evidence() from public,anon,authenticated;
revoke all on function public.vod_resolve_player_identity(uuid,text),public.vod_verify_player_alias(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.vod_resolve_player_identity(uuid,text),public.vod_verify_player_alias(uuid,text,uuid,text,text) to authenticated;

create or replace function public.publish_vod_review(target_review uuid, expected_updated_at timestamp with time zone, report jsonb)
returns jsonb language plpgsql security invoker set search_path to '' as $function$
declare r public.vod_review_sessions; p jsonb; n integer; routed integer:=0; l public.team_player_lockers; unmatched jsonb:='[]'::jsonb; entry record; resolved jsonb:='[]'::jsonb; selected text; source_name text; identity jsonb; unresolved jsonb:='[]'::jsonb; canonical_reports jsonb:='[]'::jsonb;
begin
select * into r from public.vod_review_sessions where id=target_review for update;
if r.id is null or auth.uid() is null or not coalesce(private.vvhl_can_manage_team(auth.uid(),r.team_id),false) then
raise exception 'Management access to this team is required' using errcode='42501';
end if;
if r.updated_at is distinct from expected_updated_at then raise exception 'Review changed elsewhere. Refresh before publishing.'; end if;
-- Serialise publications across reviews of the same game.
perform 1 from public.hitmen_schedule_games where id=r.schedule_game_id and team_id=r.team_id for update;
-- Never mutate existing reports/publications, including historical identity corrections.
if exists(select 1 from public.vod_game_publications where review_id=r.id)
 or exists(select 1 from public.team_player_game_reports where ai_review_id=r.id)
 or exists(select 1 from public.team_player_game_reports g
 where g.schedule_game_id=r.schedule_game_id and g.team_id=r.team_id and g.ai_review_id is not null)
then raise exception 'Existing scouting reports are protected. Use a separately reviewed correction workflow.'; end if;
-- Resolve identities before storing any publication. Caller matches never prove identity.
for p in select value from jsonb_array_elements(report->'players') loop
 source_name:=btrim(p->>'player');
 if report->'player_matches'->>lower(source_name)='ignore' then continue; end if;
 if report->'player_matches' ? lower(source_name) and report->'player_matches'->>lower(source_name)='' then
  unmatched:=unmatched||jsonb_build_array(source_name);unresolved:=unresolved||jsonb_build_array(jsonb_build_object('status','unresolved','reason','withheld_by_reviewer','source_name',source_name));continue;
 end if;
 identity:=public.vod_resolve_player_identity(r.id,source_name);
 if identity->>'status'<>'resolved' then
  unmatched:=unmatched||jsonb_build_array(source_name);unresolved:=unresolved||jsonb_build_array(identity);continue;
 end if;
 resolved:=resolved||jsonb_build_array(p||identity);
end loop;
-- One report per league + season + LG user ID; locker is the verified delivery address.
for entry in select value->>'locker_id' as locker_id, jsonb_agg(value) as entries
  from jsonb_array_elements(resolved) group by value->'canonical_key',value->>'locker_id' loop
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
p:=p||jsonb_build_object('locker_id',l.id,'canonical_key',entry.entries->0->'canonical_key','league',entry.entries->0->>'league','season',l.season,'lg_user_id',l.lg_user_id::text);
canonical_reports:=canonical_reports||jsonb_build_array(p);
end loop;
report:=report||jsonb_build_object('identity_version',2,'unresolved_identities',unresolved,'resolved_identities',resolved,'canonical_players',canonical_reports);
report:=report||jsonb_build_object(
'player_matches',coalesce(report->'player_matches',r.review_document->'player_matches','{}'::jsonb),
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
values(r.id,r.team_id,report,auth.uid());
for p in select value from jsonb_array_elements(canonical_reports) loop
select * into l from public.team_player_lockers where id::text=p->>'locker_id' and team_id=r.team_id;
insert into public.team_player_game_reports(team_id,season,locker_id,schedule_game_id,game_date,opponent_name,position_played,ai_review_id,stats,visibility,created_by)
select r.team_id,l.season,l.id,r.schedule_game_id,r.game_date,r.opponent_label,p->>'position',r.id,'{}'::jsonb,'management',auth.uid()
on conflict (ai_review_id,locker_id) where ai_review_id is not null do nothing;
update public.team_player_game_reports g set
strengths=coalesce(nullif(p->>'strengths',''),g.strengths),improvements=coalesce(nullif(p->>'concerns',''),g.improvements),
tactical_notes=coalesce(nullif(p->>'habits',''),g.tactical_notes),coach_summary=coalesce(nullif(p->>'coach_note',''),g.coach_summary),
visibility='player',position_played=coalesce(nullif(p->>'position',''),g.position_played),updated_at=now(),
evidence=(case when jsonb_typeof(g.evidence)='object' then g.evidence else jsonb_build_object('legacy_evidence',g.evidence) end)||jsonb_build_object(
'source_names',p->'source_names','canonical_key',p->'canonical_key','league',p->>'league','season',l.season,'lg_user_id',l.lg_user_id::text,'verification','approved','approved_by',auth.uid(),'rating',p->'rating',
'evidence_timestamps',coalesce(p->'evidence_timestamps','[]'::jsonb),'approved_at',now(),
'source_vod_url',r.vod_url,'timestamp_basis','full_vod','source_start_seconds',r.source_start_seconds,
'source_end_seconds',r.source_end_seconds,'approved_periods',report->'approved_periods',
'unit_reports',coalesce((select jsonb_agg(distinct u) from jsonb_array_elements(report->'units') u
where exists(select 1 from jsonb_array_elements_text(u->'players') member
where exists(select 1 from jsonb_array_elements_text(p->'source_names') name where lower(btrim(member))=lower(btrim(name))))),'[]'::jsonb))
where g.ai_review_id=r.id and g.team_id=r.team_id and g.locker_id=l.id;
get diagnostics n=row_count;routed:=routed+n;
end loop;
return jsonb_build_object('review_id',r.id,'player_reports',routed,'unmatched_players',unmatched,'unresolved_identities',unresolved);
end $function$;

revoke all on function public.publish_vod_review(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.publish_vod_review(uuid,timestamptz,jsonb) to authenticated;

revoke all on function public.vod_player_match_context(uuid) from public,anon;
grant execute on function public.vod_player_match_context(uuid) to authenticated;

commit;
