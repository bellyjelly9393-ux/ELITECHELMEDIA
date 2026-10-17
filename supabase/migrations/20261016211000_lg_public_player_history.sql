-- DRAFT / NOT APPLIED. One-way LG Stats Client import, with public allowlisted season fields only.
-- Depends on the public-box-score migration's private LG-ID -> random public UUID mapping.
create table public.lg_public_history_imports (
 import_id uuid primary key, status text not null default 'staging' check(status in ('staging','complete')),
 source_label text not null check(length(source_label) between 1 and 200), source_captured_at timestamptz,
 expected_rows integer not null check(expected_rows>0), imported_rows integer not null default 0,
 started_at timestamptz not null default clock_timestamp(), imported_at timestamptz
);
create table public.lg_public_history_current (
 singleton boolean primary key default true check(singleton), import_id uuid references public.lg_public_history_imports(import_id)
);
insert into public.lg_public_history_current(singleton) values(true);
create table public.lg_public_player_seasons (
 import_id uuid not null references public.lg_public_history_imports(import_id),
 player_id uuid not null references private.lg_media_player_identities(player_id),
 gamertag text not null check(length(gamertag) between 1 and 100),
 league text not null check(league in ('NHL','AHL','ECHL','CHL','NCAA')), season integer not null check(season>=1),
 player_kind text not null check(player_kind in ('skater','goalie')), lg_team_id bigint, team_name text,
 position text check(position in ('LW','C','RW','LD','RD','G')),
 gp integer not null check(gp>=0), goals integer, assists integer, points integer, plus_minus integer,
 wins integer, losses integer, otl integer, saves integer, shots_against integer, goals_against integer,
 save_pct numeric check(save_pct between 0 and 1), gaa numeric, shutouts integer,
 source_url text not null, source_captured_at timestamptz, imported_at timestamptz not null default clock_timestamp(),
 primary key(import_id,player_id,league,season,player_kind)
);
create index lg_public_season_compare on public.lg_public_player_seasons(import_id,league,season,player_id);
alter table public.lg_public_history_imports enable row level security;
alter table public.lg_public_history_current enable row level security;
alter table public.lg_public_player_seasons enable row level security;
create policy lg_public_import_read on public.lg_public_history_imports for select to anon,authenticated using(status='complete');
create policy lg_public_history_pointer_read on public.lg_public_history_current for select to anon,authenticated using(true);
create policy lg_public_seasons_read on public.lg_public_player_seasons for select to anon,authenticated
 using(import_id=(select c.import_id from public.lg_public_history_current c where c.singleton));
revoke all on public.lg_public_history_imports,public.lg_public_history_current,public.lg_public_player_seasons from public,anon,authenticated;
grant select on public.lg_public_history_imports,public.lg_public_history_current,public.lg_public_player_seasons to anon,authenticated;
grant all on public.lg_public_history_imports,public.lg_public_history_current,public.lg_public_player_seasons to service_role;

create function public.lgchl_media_history_begin(p_import_id uuid,p_expected_rows integer,p_source_label text,p_source_captured_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 insert into public.lg_public_history_imports(import_id,expected_rows,source_label,source_captured_at)
 values(p_import_id,p_expected_rows,p_source_label,p_source_captured_at);
 return p_import_id;
end $$;
create function public.lgchl_media_history_append(p_import_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; v_player uuid; v_count integer:=0; v_capture timestamptz; v_league_id integer;
begin
 select source_captured_at into v_capture from public.lg_public_history_imports where import_id=p_import_id and status='staging' for update;
 if not found then raise exception 'No staging history import'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'Expected at most 1000 sanitized rows'; end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  v_league_id:=case r->>'league' when 'NHL' then 37 when 'AHL' then 38 when 'ECHL' then 84 when 'CHL' then 39 when 'NCAA' then 112 end;
  if v_league_id is null then raise exception 'Unknown LG league'; end if;
  insert into private.lg_media_player_identities(lg_user_id) values((r->>'lg_user_id')::bigint) on conflict do nothing;
  select player_id into strict v_player from private.lg_media_player_identities where lg_user_id=(r->>'lg_user_id')::bigint;
  insert into public.lg_public_player_seasons(
   import_id,player_id,gamertag,league,season,player_kind,lg_team_id,team_name,position,gp,goals,assists,points,plus_minus,
   wins,losses,otl,saves,shots_against,goals_against,save_pct,gaa,shutouts,source_url,source_captured_at)
  values(p_import_id,v_player,r->>'gamertag',r->>'league',(r->>'season')::integer,r->>'player_kind',
   (r->>'lg_team_id')::bigint,r->>'team_name',r->>'position',(r->>'gp')::integer,(r->>'goals')::integer,
   (r->>'assists')::integer,(r->>'points')::integer,(r->>'plus_minus')::integer,(r->>'wins')::integer,(r->>'losses')::integer,
   (r->>'otl')::integer,(r->>'saves')::integer,(r->>'shots_against')::integer,(r->>'goals_against')::integer,
   (r->>'save_pct')::numeric,(r->>'gaa')::numeric,(r->>'shutouts')::integer,
   'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=player_stats&leagueid='||v_league_id||'&seasonid='||(r->>'season')::integer,v_capture)
  on conflict(import_id,player_id,league,season,player_kind) do update set
   gamertag=excluded.gamertag,lg_team_id=excluded.lg_team_id,team_name=excluded.team_name,position=excluded.position,
   gp=excluded.gp,goals=excluded.goals,assists=excluded.assists,points=excluded.points,plus_minus=excluded.plus_minus,
   wins=excluded.wins,losses=excluded.losses,otl=excluded.otl,saves=excluded.saves,shots_against=excluded.shots_against,
   goals_against=excluded.goals_against,save_pct=excluded.save_pct,gaa=excluded.gaa,shutouts=excluded.shutouts;
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
create function public.lgchl_media_history_publish(p_import_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; v_expected integer;
begin
 select expected_rows into v_expected from public.lg_public_history_imports where import_id=p_import_id and status='staging' for update;
 if not found then raise exception 'No staging history import'; end if;
 select count(*) into v_count from public.lg_public_player_seasons where import_id=p_import_id;
 if v_count<>v_expected then raise exception 'Incomplete history import: % of % rows',v_count,v_expected; end if;
 update public.lg_public_history_imports set status='complete',imported_rows=v_count,imported_at=clock_timestamp() where import_id=p_import_id;
 update public.lg_public_history_current set import_id=p_import_id where singleton;
 return v_count;
end $$;

create view public.lgchl_public_breakout_watch with(security_invoker=true) as
select c.player_id,c.gamertag,c.position,c.lg_team_id,c.gp,c.goals,c.assists,c.points,c.plus_minus,
 c.points::numeric/nullif(c.gp,0) as ppg,p.gp as prev_gp,p.points as prev_points,p.points::numeric/nullif(p.gp,0) as prev_ppg,
 c.points::numeric/nullif(c.gp,0)-p.points::numeric/nullif(p.gp,0) as improvement,
 c.source_url,p.source_url as history_source_url,c.imported_at,p.imported_at as history_imported_at,c.source_captured_at
from public.lg_public_player_seasons c join public.lg_public_player_seasons p
 on p.import_id=c.import_id and p.player_id=c.player_id and p.player_kind=c.player_kind and p.league='CHL' and p.season=54
where c.league='CHL' and c.season=55 and c.player_kind='skater' and c.gp>=6 and p.gp>=10
 and c.points::numeric/c.gp>p.points::numeric/p.gp;

create view public.lgchl_public_ahl_movement with(security_invoker=true) as
select c.player_id,c.gamertag,c.position,c.lg_team_id,c.gp,c.points,c.plus_minus,c.points::numeric/nullif(c.gp,0) as ppg,
 'AHL'::text as from_league,54 as from_season,p.gp as from_gp,p.points as from_points,p.plus_minus as from_plus_minus,
 p.points::numeric/nullif(p.gp,0) as from_ppg,
 c.source_url,p.source_url as history_source_url,c.imported_at,p.imported_at as history_imported_at,c.source_captured_at
from public.lg_public_player_seasons c join public.lg_public_player_seasons p
 on p.import_id=c.import_id and p.player_id=c.player_id and p.player_kind=c.player_kind and p.league='AHL' and p.season=54
where c.league='CHL' and c.season=55 and c.player_kind='skater' and c.gp>=4 and p.gp>=5;
grant select on public.lgchl_public_breakout_watch,public.lgchl_public_ahl_movement to anon,authenticated,service_role;

revoke all on function public.lgchl_media_history_begin(uuid,integer,text,timestamptz),
 public.lgchl_media_history_append(uuid,jsonb),public.lgchl_media_history_publish(uuid) from public,anon,authenticated;
grant execute on function public.lgchl_media_history_begin(uuid,integer,text,timestamptz),
 public.lgchl_media_history_append(uuid,jsonb),public.lgchl_media_history_publish(uuid) to service_role;
