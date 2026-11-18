begin;
create table if not exists public.lg3s_match_state (
  id text primary key default 'gbr_live',
  home_team text not null default 'GBR' check (home_team ~ '^[A-Z]{3}$'),
  away_team text not null default 'SWE' check (away_team ~ '^[A-Z]{3}$'),
  home_score int not null default 0 check (home_score >= 0),
  away_score int not null default 0 check (away_score >= 0),
  home_sog int not null default 0 check (home_sog >= 0),
  away_sog int not null default 0 check (away_sog >= 0),
  period text not null default '1ST',
  clock text not null default '20:00' check (clock ~ '^[0-9]{2}:[0-5][0-9]$'),
  red_zone_active boolean not null default false,
  kit_variant text not null default 'royal_blue' check (kit_variant in ('royal_blue', 'away_white')),
  jersey_side text not null default 'front' check (jersey_side in ('front', 'back')),
  active_formation text not null default 'trap' check (active_formation in ('trap', 'overload', 'rush')),
  camera_angle text not null default 'ice' check (camera_angle in ('ice','overhead','jumbotron','goalie','orbit')),
  highlighted_player int not null default 88 check (highlighted_player in (88,20,19,35)),
  lower_third_visible boolean not null default false,
  lower_third_until timestamptz,
  goal_horn_trigger timestamptz,
  ocr_crop jsonb,
  ocr_result jsonb,
  whiparound jsonb not null default '[]',
  boxscore jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.lg3s_match_state
  add column if not exists lower_third_until timestamptz,
  add column if not exists ocr_crop jsonb,
  add column if not exists ocr_result jsonb,
  add column if not exists whiparound jsonb not null default '[]',
  add column if not exists boxscore jsonb not null default '[]';
insert into public.lg3s_match_state (id) values ('gbr_live') on conflict do nothing;

create table if not exists public.lg3s_three_stars_votes (
  player_number int primary key,
  gamertag text not null,
  player_name text not null,
  position text not null,
  votes int not null default 0 check (votes >= 0)
);
insert into public.lg3s_three_stars_votes (player_number, gamertag, player_name, position, votes)
values (88,'xKirk_88','L. KIRK','C',0), (20,'LakeShow_20','B. LAKE','LW',0),
       (19,'Clem_D19','D. CLEMENTS','LD',0), (35,'BownsWall_35','B. BOWNS','G',0)
on conflict do nothing;

create table if not exists public.lg3s_tactical_formations (
  slug text primary key check (slug in ('trap','overload','rush')),
  positions jsonb not null check (jsonb_typeof(positions) = 'object')
);
insert into public.lg3s_tactical_formations values
  ('trap','{"88":[2,0],"20":[-5,-5],"19":[-9,5],"35":[-23,0]}'),
  ('overload','{"88":[11,-4],"20":[16,-8],"19":[3,-7],"35":[-23,0]}'),
  ('rush','{"88":[15,1],"20":[10,-6],"19":[-1,5],"35":[-23,0]}')
on conflict do nothing;

create schema if not exists lg3s_private;
create table if not exists lg3s_private.ballot (
  voter_id uuid primary key,
  player_number int not null references public.lg3s_three_stars_votes
);
alter table lg3s_private.ballot enable row level security;
revoke all on lg3s_private.ballot from public, anon, authenticated;
grant usage on schema lg3s_private to authenticated;

create or replace function lg3s_private.cast_vote(p_num int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  voter uuid := auth.uid();
  chosen int;
begin
  if voter is null then raise exception 'Sign in to vote' using errcode = '42501'; end if;
  if not exists (select 1 from public.lg3s_three_stars_votes where player_number = p_num) then
    raise exception 'Unknown player' using errcode = '22023';
  end if;
  insert into lg3s_private.ballot values (voter, p_num) on conflict do nothing;
  if found then
    update public.lg3s_three_stars_votes set votes = votes + 1 where player_number = p_num;
    return;
  end if;
  select player_number into chosen from lg3s_private.ballot where voter_id = voter;
  if chosen <> p_num then raise exception 'You already voted' using errcode = '23505'; end if;
end
$$;
revoke all on function lg3s_private.cast_vote(int) from public, anon, authenticated;
grant execute on function lg3s_private.cast_vote(int) to authenticated;

create or replace function public.increment_gbr_star_vote(p_num int)
returns void language sql security invoker set search_path = '' as $$
  select lg3s_private.cast_vote(p_num);
$$;
revoke all on function public.increment_gbr_star_vote(int) from public, anon, authenticated;
grant execute on function public.increment_gbr_star_vote(int) to authenticated;

alter table public.lg3s_match_state enable row level security;
alter table public.lg3s_three_stars_votes enable row level security;
alter table public.lg3s_tactical_formations enable row level security;
revoke all on public.lg3s_match_state, public.lg3s_three_stars_votes, public.lg3s_tactical_formations from public, anon, authenticated;
grant select on public.lg3s_match_state, public.lg3s_three_stars_votes, public.lg3s_tactical_formations to anon, authenticated;
grant update (lower_third_visible,lower_third_until) on public.lg3s_match_state to authenticated;
grant select, update on public.lg3s_match_state to service_role;
grant select on public.lg3s_three_stars_votes, public.lg3s_tactical_formations to service_role;

drop policy if exists lg3s_read_match on public.lg3s_match_state;
create policy lg3s_read_match on public.lg3s_match_state for select to anon, authenticated using (true);
drop policy if exists lg3s_read_votes on public.lg3s_three_stars_votes;
create policy lg3s_read_votes on public.lg3s_three_stars_votes for select to anon, authenticated using (true);
drop policy if exists lg3s_read_formations on public.lg3s_tactical_formations;
create policy lg3s_read_formations on public.lg3s_tactical_formations for select to anon, authenticated using (true);
drop policy if exists lg3s_director_lower_third on public.lg3s_match_state;
create policy lg3s_director_lower_third on public.lg3s_match_state for update to authenticated
  using (id = 'gbr_live' and auth.jwt()->'app_metadata'->>'lg3s_director' = 'true')
  with check (id = 'gbr_live' and auth.jwt()->'app_metadata'->>'lg3s_director' = 'true');

create or replace function lg3s_private.stamp_match_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;
drop trigger if exists lg3s_stamp_match on public.lg3s_match_state;
create trigger lg3s_stamp_match before update on public.lg3s_match_state
  for each row execute function lg3s_private.stamp_match_update();

do $$
declare table_name text;
begin
  foreach table_name in array array['lg3s_match_state','lg3s_three_stars_votes','lg3s_tactical_formations'] loop
    if not exists (select from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
commit;
