-- Season 55 EliteChel Playoff Predictor. Prepare-only migration: first-round series
-- are seeded CLOSED. Admin must verify official contest rules, series and times before opening.
-- Source: assets/lgchl/playoffs/s55.json; never credit unverified live results.
create table if not exists public.ecm_playoff_series (
  id text primary key,
  season integer not null default 55 check (season > 0),
  round_no smallint not null check (round_no between 1 and 6),
  league text not null check (league in ('WHL','OHL','QMJHL','CUP')),
  conference text not null,
  team_a integer not null,
  team_b integer not null,
  seed_a smallint not null check (seed_a > 0),
  seed_b smallint not null check (seed_b > 0),
  lock_at timestamptz not null,
  is_open boolean not null default false,
  confirmed_winner_id integer,
  actual_games smallint,
  verified_at timestamptz,
  verified_source_url text,
  created_at timestamptz not null default now(),
  constraint ecm_series_different_teams check (team_a <> team_b),
  constraint ecm_series_result_valid check (
    (confirmed_winner_id is null and actual_games is null and verified_at is null)
    or (confirmed_winner_id in (team_a, team_b) and actual_games between 4 and 7 and verified_at is not null)
  )
);
create index if not exists ecm_playoff_series_round_idx on public.ecm_playoff_series(season,round_no);
create table if not exists public.ecm_playoff_handles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null check (handle ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{2,23}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists ecm_playoff_handles_unique_lower on public.ecm_playoff_handles(lower(handle));
create table if not exists public.ecm_playoff_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id text not null references public.ecm_playoff_series(id) on delete cascade,
  winner_id integer not null,
  games smallint not null check (games between 4 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,series_id)
);
create index if not exists ecm_playoff_picks_series_idx on public.ecm_playoff_picks(series_id);
alter table public.ecm_playoff_series enable row level security;
alter table public.ecm_playoff_handles enable row level security;
alter table public.ecm_playoff_picks enable row level security;
revoke all on public.ecm_playoff_series,public.ecm_playoff_handles,public.ecm_playoff_picks from anon,authenticated;
grant select on public.ecm_playoff_series to anon,authenticated;
grant select on public.ecm_playoff_handles,public.ecm_playoff_picks to authenticated;
grant all on public.ecm_playoff_series,public.ecm_playoff_handles,public.ecm_playoff_picks to service_role;
create policy ecm_playoff_series_public_read on public.ecm_playoff_series
  for select to anon,authenticated using (true);
create policy ecm_playoff_handles_own_read on public.ecm_playoff_handles
  for select to authenticated using (user_id=(select auth.uid()));
create policy ecm_playoff_picks_own_read on public.ecm_playoff_picks
  for select to authenticated using (user_id=(select auth.uid()));

-- Submit an entire round in one atomic operation. This is the ONLY public write path.
-- The function is privileged solely to enforce cross-row, clock-based and identity validation.
create or replace function public.ecm_predictor_submit_ballot(
  p_round integer, p_handle text, p_ballot jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $body$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_count integer;
  v_distinct integer;
  v_ready boolean;
  v_name text := btrim(p_handle);
begin
  if v_uid is null then raise exception 'sign_in_required'; end if;
  if p_round not between 1 and 6 then raise exception 'invalid_round'; end if;
  if v_name is null or v_name !~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{2,23}$' then
    raise exception 'invalid_leaderboard_name';
  end if;
  if p_ballot is null or jsonb_typeof(p_ballot) <> 'array' then raise exception 'invalid_ballot'; end if;

  -- Lock matchup rows so result-verification or disabling cannot race a submitted ballot.
  perform 1 from public.ecm_playoff_series
    where season = 55 and round_no = p_round order by id for update;
  select count(*), bool_and(is_open and lock_at > clock_timestamp())
    into v_total,v_ready
    from public.ecm_playoff_series where season=55 and round_no=p_round;
  if v_total = 0 or not coalesce(v_ready,false) then raise exception 'round_closed'; end if;

  select count(*),count(distinct entry->>'series_id')
    into v_count,v_distinct from jsonb_array_elements(p_ballot) as entries(entry);
  if v_count <> v_total or v_distinct <> v_total then raise exception 'complete_round_required'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_ballot) as b(series_id text,winner_id integer,games integer)
    left join public.ecm_playoff_series s
      on s.id=b.series_id and s.season=55 and s.round_no=p_round
    where s.id is null or b.winner_id is null or b.winner_id not in(s.team_a,s.team_b)
      or b.games not between 4 and 7
  ) then raise exception 'invalid_pick'; end if;

  insert into public.ecm_playoff_handles(user_id,handle) values(v_uid,v_name)
  on conflict(user_id) do update set handle=excluded.handle;

  insert into public.ecm_playoff_picks(user_id,series_id,winner_id,games)
  select v_uid,b.series_id,b.winner_id,b.games
    from jsonb_to_recordset(p_ballot) as b(series_id text,winner_id integer,games smallint)
  on conflict(user_id,series_id) do update
    set winner_id=excluded.winner_id,games=excluded.games,updated_at=clock_timestamp();
  return jsonb_build_object('ok',true,'round',p_round,'saved',v_total);
end;
$body$;
revoke all on function public.ecm_predictor_submit_ballot(integer,text,jsonb) from public;
grant execute on function public.ecm_predictor_submit_ballot(integer,text,jsonb) to authenticated;

-- Public scoreboard returns ONLY pseudonyms and aggregated points, never email, UUID or ballots.
-- It computes from admin-confirmed series results, never unverified game feeds or browser scores.
create or replace function public.ecm_predictor_leaderboard(p_round integer default null)
returns table(
  rank bigint, handle text, points bigint, correct_winners bigint,
  exact_calls bigint, upset_calls bigint, perfect_rounds bigint
)
language sql stable security definer set search_path = ''
as $body$
with scored as (
  select p.user_id,s.round_no,s.id,
    (s.confirmed_winner_id is not null and s.actual_games is not null and s.verified_at is not null) as decided,
    (s.confirmed_winner_id=p.winner_id and s.actual_games is not null and s.verified_at is not null) as correct,
    (s.confirmed_winner_id=p.winner_id and s.actual_games=p.games and s.verified_at is not null) as exact,
    (s.confirmed_winner_id=p.winner_id and s.verified_at is not null and
      case when p.winner_id=s.team_a then s.seed_a>s.seed_b
           when p.winner_id=s.team_b then s.seed_b>s.seed_a
           else false end) as upset
  from public.ecm_playoff_picks p
  join public.ecm_playoff_series s on s.id=p.series_id
  where s.season=55 and (p_round is null or s.round_no=p_round)
),
per_round as (
 select user_id,round_no,count(*) as picks,
  count(*) filter(where decided) as resolved,
  count(*) filter(where correct) as winners,
  count(*) filter(where exact) as exacts,
  count(*) filter(where upset) as upsets,
  (10*count(*) filter(where correct)
   +5*count(*) filter(where exact)
   +5*count(*) filter(where upset))::bigint as base_points
 from scored group by user_id,round_no
),
bonus as (
 select r.*,
   case when r.picks>=2 and r.resolved=r.picks and r.exacts=r.picks and
     r.picks=(select count(*) from public.ecm_playoff_series s
                where s.season=55 and s.round_no=r.round_no and s.is_open)
   then 1::bigint else 0::bigint end as perfect
 from per_round r
),
totals as (
 select h.user_id,h.handle,
   coalesce(sum(b.base_points+20*b.perfect),0)::bigint as total,
   coalesce(sum(b.winners),0)::bigint as wins,
   coalesce(sum(b.exacts),0)::bigint as exact,
   coalesce(sum(b.upsets),0)::bigint as upsets,
   coalesce(sum(b.perfect),0)::bigint as perfects
 from public.ecm_playoff_handles h
 join bonus b on b.user_id=h.user_id
 group by h.user_id,h.handle
)
select row_number() over(order by t.total desc,t.wins desc,t.exact desc,t.handle asc)::bigint,
  t.handle,t.total,t.wins,t.exact,t.upsets,t.perfects
from totals t
order by t.total desc,t.wins desc,t.exact desc,t.handle asc
limit 100;
$body$;
revoke all on function public.ecm_predictor_leaderboard(integer) from public;
grant execute on function public.ecm_predictor_leaderboard(integer) to anon,authenticated;

-- This seeding is a draft imported from the saved official S55 bracket. Entries are
-- disabled until admin verifies current matchups, first-game times, and publishes rules.
insert into public.ecm_playoff_series
  (id,season,round_no,league,conference,team_a,team_b,seed_a,seed_b,lock_at,is_open)
values
  ('s55-whl-eastern-r1-2',55,1,'WHL','Eastern',2983,415,6,3,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-whl-eastern-r1-3',55,1,'WHL','Eastern',377,385,5,4,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-whl-western-r1-6',55,1,'WHL','Western',400,399,6,2,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-whl-western-r1-7',55,1,'WHL','Western',419,2981,5,4,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-ohl-eastern-r1-10',55,1,'OHL','Eastern',444,448,6,3,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-ohl-eastern-r1-11',55,1,'OHL','Eastern',402,447,4,2,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-ohl-western-r1-14',55,1,'OHL','Western',383,451,6,2,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-ohl-western-r1-15',55,1,'OHL','Western',514,408,5,4,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-qmjhl-eastern-r1-18',55,1,'QMJHL','Eastern',457,455,6,3,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-qmjhl-eastern-r1-19',55,1,'QMJHL','Eastern',467,468,5,4,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-qmjhl-western-r1-22',55,1,'QMJHL','Western',382,466,6,3,'2026-11-16T02:00:00.000Z'::timestamptz,false),
  ('s55-qmjhl-western-r1-23',55,1,'QMJHL','Western',458,460,5,4,'2026-11-16T02:00:00.000Z'::timestamptz,false)
on conflict(id) do nothing;
