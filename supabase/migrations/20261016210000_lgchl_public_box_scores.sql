-- DRAFT / NOT APPLIED. Public LGCHL game data only; existing private Calgary tables are untouched.
create schema if not exists private;
create table private.lg_media_player_identities (
  lg_user_id bigint primary key check(lg_user_id>0),
  player_id uuid not null unique default gen_random_uuid()
);
create table private.lgchl_public_box_jobs (
  lg_game_id bigint primary key references public.lgchl_games(lg_game_id),
  status text not null default 'pending' check(status in ('pending','fetching','done','failed','challenge')),
  requested_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, error text
);
create table private.lgchl_media_sync_control (
  singleton boolean primary key default true check(singleton),
  owner uuid, expires_at timestamptz, paused boolean not null default false
);
insert into private.lgchl_media_sync_control(singleton) values(true);
alter table private.lg_media_player_identities enable row level security;
alter table private.lgchl_public_box_jobs enable row level security;
alter table private.lgchl_media_sync_control enable row level security;
revoke all on private.lg_media_player_identities,private.lgchl_public_box_jobs,private.lgchl_media_sync_control from public,anon,authenticated;
grant all on private.lg_media_player_identities,private.lgchl_public_box_jobs,private.lgchl_media_sync_control to service_role;

create table public.lgchl_public_box_scores (
  lg_game_id bigint primary key references public.lgchl_games(lg_game_id),
  season integer not null check(season=55), week integer, game_at timestamptz not null,
  away_lg_team_id bigint not null, home_lg_team_id bigint not null,
  away_score integer not null check(away_score>=0), home_score integer not null check(home_score>=0),
  team_stats jsonb not null default '{}', period_scoring jsonb not null default '[]',
  source_url text not null, source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
  fetched_at timestamptz not null, imported_at timestamptz not null default clock_timestamp()
);
create table public.lgchl_public_player_lines (
  lg_game_id bigint not null references public.lgchl_public_box_scores(lg_game_id),
  player_id uuid not null references private.lg_media_player_identities(player_id),
  gamertag text not null check(length(gamertag) between 1 and 100),
  lg_team_id bigint not null, player_kind text not null check(player_kind in ('skater','goalie')),
  position text check(position in ('LW','C','RW','LD','RD','G')),
  goals integer, assists integer, points integer, plus_minus integer,
  toi_seconds integer, twp_seconds integer, shots integer, deflections integer, passing_pct numeric,
  hits integer, takeaways integer, giveaways integer, blocked_shots integer, interceptions integer, pim integer,
  saves integer, shots_against integer, goals_against integer, save_pct numeric check(save_pct between 0 and 1), gaa numeric,
  imported_at timestamptz not null default clock_timestamp(),
  primary key(lg_game_id,player_id,player_kind),
  check(player_kind<>'skater' or (goals>=0 and assists>=0 and points=goals+assists))
);
create index lgchl_public_player_recent on public.lgchl_public_player_lines(player_id,lg_game_id);
alter table public.lgchl_public_box_scores enable row level security;
alter table public.lgchl_public_player_lines enable row level security;
create policy lgchl_public_box_read on public.lgchl_public_box_scores for select to anon,authenticated using(true);
create policy lgchl_public_lines_read on public.lgchl_public_player_lines for select to anon,authenticated using(true);
revoke all on public.lgchl_public_box_scores,public.lgchl_public_player_lines from public,anon,authenticated;
grant select on public.lgchl_public_box_scores,public.lgchl_public_player_lines to anon,authenticated;
grant all on public.lgchl_public_box_scores,public.lgchl_public_player_lines to service_role;

create function private.lgchl_public_queue_final() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='final' and new.season=55 then
  insert into private.lgchl_public_box_jobs(lg_game_id) values(new.lg_game_id) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.lgchl_public_queue_final() from public,anon,authenticated;
create trigger lgchl_public_final_queue after insert or update of status on public.lgchl_games
for each row execute function private.lgchl_public_queue_final();
-- Backfill is queued, never fetched by this migration.
insert into private.lgchl_public_box_jobs(lg_game_id)
select lg_game_id from public.lgchl_games where season=55 and status='final' on conflict do nothing;

create function public.lgchl_media_acquire_lease(p_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update private.lgchl_media_sync_control set owner=p_owner,expires_at=now()+interval '180 seconds'
 where singleton and not paused and (owner is null or expires_at<clock_timestamp());
 return found;
end $$;
-- Renew and fence each LG request; return server expiry so a delayed response cannot start an expired fetch.
create function public.lgchl_media_before_fetch(p_owner uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare v_expiry timestamptz;
begin
 update private.lgchl_media_sync_control set expires_at=clock_timestamp()+interval '180 seconds'
 where singleton and owner=p_owner and expires_at>clock_timestamp() and not paused
 returning expires_at into v_expiry;
 return v_expiry;
end $$;
create function public.lgchl_media_release_lease(p_owner uuid) returns void
language sql security definer set search_path='' as $$
 update private.lgchl_media_sync_control set owner=null,expires_at=null where singleton and owner=p_owner;
$$;
create function public.lgchl_media_claim_box(p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id bigint; v_game public.lgchl_games;
begin
 if not exists(select 1 from private.lgchl_media_sync_control where singleton and owner=p_owner and expires_at>now() and not paused) then return null; end if;
 -- A lost fetch is a manual-review failure, never an automatic second LG request.
 update private.lgchl_public_box_jobs set status='failed',error='Interrupted fetch; review before explicit requeue'
 where status='fetching' and started_at<now()-interval '10 minutes';
 select j.lg_game_id into v_id from private.lgchl_public_box_jobs j
 join public.lgchl_games g on g.lg_game_id=j.lg_game_id
 where j.status='pending' and g.status='final' order by g.game_at desc,j.lg_game_id for update of j skip locked limit 1;
 if v_id is null then return null; end if;
 update private.lgchl_public_box_jobs set status='fetching',started_at=clock_timestamp() where lg_game_id=v_id;
 select * into v_game from public.lgchl_games where lg_game_id=v_id;
 return jsonb_build_object('lg_game_id',v_game.lg_game_id,'season',v_game.season,'status',v_game.status,'week',v_game.week,
 'game_at',v_game.game_at,'away_lg_team_id',v_game.away_lg_team_id,'home_lg_team_id',v_game.home_lg_team_id,
 'away_score',v_game.away_score,'home_score',v_game.home_score);
end $$;
create function public.lgchl_media_fail_box(p_owner uuid,p_lg_game_id bigint,p_error text,p_challenge boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.lgchl_media_sync_control where singleton and owner=p_owner) then raise exception 'No sync lease'; end if;
 update private.lgchl_public_box_jobs set status=case when p_challenge then 'challenge' else 'failed' end,
 error=left(p_error,500),completed_at=clock_timestamp() where lg_game_id=p_lg_game_id and status='fetching';
 if p_challenge then update private.lgchl_media_sync_control set paused=true where singleton; end if;
end $$;
create function public.lgchl_media_resume_boxes() returns void language sql security definer set search_path='' as $$
 update private.lgchl_media_sync_control set paused=false where singleton;
$$;

create function public.lgchl_media_save_box(p_owner uuid,p_payload jsonb,p_fetched_at timestamptz,p_sha256 text)
returns integer language plpgsql security definer set search_path='' as $$
declare g public.lgchl_games; p jsonb; v_player uuid; v_n integer:=0; v_stats jsonb:='{}'; v_side bigint; v_one jsonb; v_periods jsonb:='[]'; v_period jsonb; v_cells jsonb;
begin
 if not exists(select 1 from private.lgchl_media_sync_control where singleton and owner=p_owner and expires_at>now()) then raise exception 'No sync lease'; end if;
 select * into strict g from public.lgchl_games where lg_game_id=(p_payload->>'lg_game_id')::bigint and status='final' and season=55;
 if (p_payload->>'source_game_id')::bigint is distinct from g.lg_game_id then raise exception 'Canonical source game mismatch'; end if;
 if g.away_score is distinct from (p_payload->>'away_score')::integer or g.home_score is distinct from (p_payload->>'home_score')::integer
 or g.away_lg_team_id is distinct from (p_payload->>'away_lg_team_id')::bigint or g.home_lg_team_id is distinct from (p_payload->>'home_lg_team_id')::bigint then raise exception 'Official final mismatch'; end if;
 if exists(select 1 from public.lgchl_public_box_scores where lg_game_id=g.lg_game_id) then
  update private.lgchl_public_box_jobs set status='done' where lg_game_id=g.lg_game_id; return 0;
 end if;
 if not exists(select 1 from private.lgchl_public_box_jobs where lg_game_id=g.lg_game_id and status='fetching') then raise exception 'Game was not claimed'; end if;
 if jsonb_typeof(p_payload->'players')<>'array' or jsonb_array_length(p_payload->'players')<12 then raise exception 'Incomplete player lines'; end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'players') x
  where x->>'player_kind'='skater' and (
   x->>'position' is null or exists(select 1 from unnest(array['goals','assists','points','plus_minus','toi_seconds','twp_seconds','shots','deflections','passing_pct','hits','takeaways','giveaways','blocked_shots','interceptions','pim']) k where jsonb_typeof(x->k) is distinct from 'number'))
  or x->>'player_kind'='goalie' and exists(select 1 from unnest(array['saves','shots_against','goals_against','save_pct','gaa','toi_seconds']) k where jsonb_typeof(x->k) is distinct from 'number')
 ) then raise exception 'Missing required player statistics'; end if;
 foreach v_side in array array[g.away_lg_team_id,g.home_lg_team_id] loop
  if (select count(*) from jsonb_array_elements(p_payload->'players') x where (x->>'lg_team_id')::bigint=v_side and x->>'player_kind'='skater')<5 then raise exception 'Incomplete sixes roster'; end if;
  if not exists(select 1 from jsonb_array_elements(p_payload->'players') x where (x->>'lg_team_id')::bigint=v_side and x->>'player_kind'='goalie')
  or (select sum((x->>'goals')::integer) from jsonb_array_elements(p_payload->'players') x where (x->>'lg_team_id')::bigint=v_side and x->>'player_kind'='skater')
     is distinct from (case when v_side=g.away_lg_team_id then g.away_score else g.home_score end) then raise exception 'Player scoring does not reconcile'; end if;
  -- Only known numeric team-stat fields can cross the public boundary.
  select coalesce(jsonb_object_agg(e.key,e.value),'{}') into v_one
  from jsonb_each(coalesce(p_payload->'team_stats'->v_side::text,'{}')) e
  where e.key in ('goals','shots','hits','pim','possession_seconds','passing_pct','faceoffs_won','pp_goals','pp_opportunities') and jsonb_typeof(e.value) in ('number','null');
  if exists(select 1 from unnest(array['goals','shots','possession_seconds']) k where jsonb_typeof(v_one->k) is distinct from 'number')
  or (v_one->>'goals')::integer is distinct from (case when v_side=g.away_lg_team_id then g.away_score else g.home_score end)
  then raise exception 'Missing or contradictory team statistics'; end if;
  v_stats:=v_stats||jsonb_build_object(v_side::text,v_one);
 end loop;
 for v_period in select * from jsonb_array_elements(coalesce(p_payload->'period_scoring','[]')) loop
  if (v_period->>'lg_team_id')::bigint in (g.away_lg_team_id,g.home_lg_team_id) then
   select coalesce(jsonb_agg(jsonb_build_object('label',x->>'label','goals',(x->>'goals')::integer)),'[]') into v_cells
   from jsonb_array_elements(coalesce(v_period->'periods','[]')) x
   where x->>'label' ~* '^(1st|2nd|3rd|[123]|period [123]|OT[0-9]*|SO|total|final)$'
     and jsonb_typeof(x->'goals')='number' and (x->>'goals')::numeric between 0 and 100;
   v_periods:=v_periods||jsonb_build_array(jsonb_build_object('lg_team_id',(v_period->>'lg_team_id')::bigint,'periods',v_cells));
  end if;
 end loop;
 foreach v_side in array array[g.away_lg_team_id,g.home_lg_team_id] loop
  if (select count(*) from jsonb_array_elements(v_periods) x where (x->>'lg_team_id')::bigint=v_side)<>1 then raise exception 'Incomplete period scoring'; end if;
  select x->'periods' into v_cells from jsonb_array_elements(v_periods) x where (x->>'lg_team_id')::bigint=v_side;
  if (select count(*) from jsonb_array_elements(v_cells) x where x->>'label' ~* '^(1st|1|period 1)$')<>1
   or (select count(*) from jsonb_array_elements(v_cells) x where x->>'label' ~* '^(2nd|2|period 2)$')<>1
   or (select count(*) from jsonb_array_elements(v_cells) x where x->>'label' ~* '^(3rd|3|period 3)$')<>1
   then raise exception 'Missing or duplicate regular period'; end if;
  if (select count(*) from jsonb_array_elements(v_cells) x where x->>'label' ~* '^(total|final)$')<>1
   or (select (x->>'goals')::integer from jsonb_array_elements(v_cells) x where x->>'label' ~* '^(total|final)$') is distinct from (case when v_side=g.away_lg_team_id then g.away_score else g.home_score end)
   or (select count(*) from jsonb_array_elements(v_cells) x where x->>'label' !~* '^(total|final)$')<3
   or (select sum((x->>'goals')::integer) from jsonb_array_elements(v_cells) x where x->>'label' !~* '^(total|final)$') is distinct from (case when v_side=g.away_lg_team_id then g.away_score else g.home_score end)
  then raise exception 'Period scoring does not reconcile'; end if;
 end loop;
 insert into public.lgchl_public_box_scores(lg_game_id,season,week,game_at,away_lg_team_id,home_lg_team_id,away_score,home_score,team_stats,period_scoring,source_url,source_sha256,fetched_at) values(g.lg_game_id,g.season,g.week,g.game_at,g.away_lg_team_id,g.home_lg_team_id,g.away_score,g.home_score,v_stats,
 v_periods,'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='||g.lg_game_id,p_sha256,p_fetched_at);
 for p in select * from jsonb_array_elements(p_payload->'players') loop
  if (p->>'lg_team_id')::bigint not in (g.away_lg_team_id,g.home_lg_team_id) then raise exception 'Unexpected team'; end if;
  insert into private.lg_media_player_identities(lg_user_id) values((p->>'lg_user_id')::bigint) on conflict do nothing;
  select player_id into strict v_player from private.lg_media_player_identities where lg_user_id=(p->>'lg_user_id')::bigint;
  insert into public.lgchl_public_player_lines(
   lg_game_id,player_id,gamertag,lg_team_id,player_kind,position,goals,assists,points,plus_minus,toi_seconds,twp_seconds,shots,deflections,passing_pct,
   hits,takeaways,giveaways,blocked_shots,interceptions,pim,saves,shots_against,goals_against,save_pct,gaa)
  values(g.lg_game_id,v_player,p->>'gamertag',(p->>'lg_team_id')::bigint,p->>'player_kind',p->>'position',
   (p->>'goals')::integer,(p->>'assists')::integer,(p->>'points')::integer,(p->>'plus_minus')::integer,(p->>'toi_seconds')::integer,
   (p->>'twp_seconds')::integer,(p->>'shots')::integer,(p->>'deflections')::integer,(p->>'passing_pct')::numeric,
   (p->>'hits')::integer,(p->>'takeaways')::integer,(p->>'giveaways')::integer,(p->>'blocked_shots')::integer,(p->>'interceptions')::integer,
   (p->>'pim')::integer,(p->>'saves')::integer,(p->>'shots_against')::integer,(p->>'goals_against')::integer,(p->>'save_pct')::numeric,(p->>'gaa')::numeric);
  v_n:=v_n+1;
 end loop;
 update private.lgchl_public_box_jobs set status='done',error=null,completed_at=clock_timestamp() where lg_game_id=g.lg_game_id;
 return v_n;
end $$;

create view public.lgchl_public_trending with(security_invoker=true) as
with ranked as (
 select p.*,b.game_at,b.season,b.source_url,b.fetched_at,
 row_number() over(partition by p.player_id order by b.game_at desc,p.lg_game_id desc) as rn
 from public.lgchl_public_player_lines p join public.lgchl_public_box_scores b using(lg_game_id) where p.player_kind='skater'
)
select player_id,(array_agg(gamertag order by rn))[1] as gamertag,(array_agg(lg_team_id order by rn))[1] as lg_team_id,
 count(*)::integer as gp,sum(goals)::integer as goals,sum(assists)::integer as assists,sum(points)::integer as points,
 min(game_at) as first_game_at,max(game_at) as last_game_at,max(imported_at) as imported_at,max(fetched_at) as fetched_at,
 jsonb_agg(source_url order by rn) as source_urls
from ranked where rn<=5 group by player_id having count(*)=5;

create view public.lgchl_public_weekly_players with(security_invoker=true) as
select b.week,p.player_id,(array_agg(p.gamertag order by b.game_at desc,b.lg_game_id desc))[1] as gamertag,
 (array_agg(p.lg_team_id order by b.game_at desc,b.lg_game_id desc))[1] as lg_team_id,
 count(*)::integer as gp,sum(p.goals)::integer as goals,sum(p.assists)::integer as assists,sum(p.points)::integer as points,
 max(b.game_at) as last_game_at,max(p.imported_at) as imported_at,max(b.fetched_at) as fetched_at,jsonb_agg(b.source_url order by b.game_at desc,b.lg_game_id desc) as source_urls
from public.lgchl_public_player_lines p join public.lgchl_public_box_scores b using(lg_game_id)
where p.player_kind='skater' and b.week=(select max(week) from public.lgchl_public_box_scores)
group by b.week,p.player_id;

create view public.lgchl_public_box_coverage with(security_invoker=true) as
select (select count(*)::integer from public.lgchl_games where season=55 and status='final') as final_games,
 count(*)::integer as imported_games,max(imported_at) as imported_at from public.lgchl_public_box_scores;
grant select on public.lgchl_public_trending,public.lgchl_public_weekly_players,public.lgchl_public_box_coverage to anon,authenticated,service_role;

-- The additional worker is created DISABLED; it is enabled only after owner approval,
-- real public-HTML validation, migration application and Edge Function opt-in.
create function private.lgchl_public_kick_sync() returns bigint language plpgsql security definer set search_path='' as $$
declare v_req bigint;
begin
 if not exists(select 1 from private.lgchl_public_box_jobs where status='pending')
 or exists(select 1 from private.lgchl_media_sync_control where paused or expires_at>now()) then return null; end if;
 select net.http_post(url:='https://lrgllzvwgvqagcpiyvfd.supabase.co/functions/v1/lgchl-league-sync',
 body:=jsonb_build_object('mode','continue','publicOnly',true,'budgetMs',100000),
 headers:=jsonb_build_object('Content-Type','application/json','x-sync-token',(select value from public.lg_sync_settings where key='sync_token')),
 timeout_milliseconds:=150000) into v_req;
 return v_req;
end $$;
revoke all on function private.lgchl_public_kick_sync() from public,anon,authenticated;
grant execute on function private.lgchl_public_kick_sync() to service_role;
do $privileges$
declare r record;
begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lgchl_media_%'
 loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);
      execute format('grant execute on function %s to service_role',r.signature); end loop;
end $privileges$;
do $schedule$
declare v_id bigint;
begin
 select cron.schedule('lgchl-public-box-scores','*/3 * * * *','select private.lgchl_public_kick_sync()') into v_id;
 perform cron.alter_job(v_id,active:=false);
end $schedule$;