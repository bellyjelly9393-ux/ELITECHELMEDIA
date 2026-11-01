-- LG3s "Pick Your 4": weekly fantasy game on the LG3s media page.
-- One Superstar, one Breakout, one Diamond in the Rough and one Goalie, from four different nations, under a weekly salary cap.
-- Sign-in is Discord via Supabase Auth. Entries can only be written through public.lg3s_p4_save(), which enforces
-- the lock time, the categories, the cap and the four-nation rule. Scores are live views over VERIFIED game lines,
-- so they update whenever stats are verified. Other people's picks are hidden until the week locks.

-- ---------- config ----------
create table if not exists public.lg3s_p4_weeks (
  week        int primary key,
  season      int not null default 1,
  start_date  date not null,
  end_date    date not null,
  lock_at     timestamptz not null,
  cap         int not null default 36,
  built_at    timestamptz not null default now()
);

create table if not exists public.lg3s_p4_pool (
  week          int not null references public.lg3s_p4_weeks(week) on delete cascade,
  lg_user_id    bigint not null,
  gamertag      text not null,
  lg_team_id    int,
  nation        text not null,
  kind          text not null check (kind in ('skater','goalie')),
  category      text not null check (category in ('superstar','breakout','diamond','goalie')),
  price         int  not null check (price between 4 and 15),
  gp            int  not null,
  fp_season     numeric(6,2) not null,
  fp_last3      numeric(6,2) not null,
  goals int, assists int, points int, shots int, hits int,
  saves int, shots_against int, goals_against int,
  primary key (week, lg_user_id)
);

create table if not exists public.lg3s_p4_entries (
  id            bigint generated always as identity primary key,
  week          int not null references public.lg3s_p4_weeks(week),
  user_id       uuid not null,
  display_name  text not null,
  superstar     bigint not null,
  breakout      bigint not null,
  diamond       bigint not null,
  goalie        bigint not null,
  total_price   int not null,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (week, user_id)
);

create schema if not exists private;
create table if not exists private.lg3s_p4_blocked_tags (tag text primary key);
insert into private.lg3s_p4_blocked_tags(tag) values
 ('HAWK8TUAH'),('STLxPsykoTokerx'),('kleboldz'),('Dissizznuts_88'),('RedSkinStallion'),('NigelFromTinder'),('Trumpz_Right_Ear'),
 ('Na9y420'),('Perc4you'),('D1ggy420'),('Borat_Sagdiyev94'),('Call1-800gambler'),('Smokeythepot797'),('caucasiansensation'),
 ('shape420'),('Thebaldeagle69'),('BoooBeee Orr'),('OOPSxIxTOOTED'),('Stag_Arms-USA'),('Obama Lamb'),('segzmachine'),
 ('SnatchinBiscuits'),('BosomeMustache'),('BuzzFerda69'),('Spicy-Big-Dad-9')
on conflict do nothing;

alter table public.lg3s_p4_weeks   enable row level security;
alter table public.lg3s_p4_pool    enable row level security;
alter table public.lg3s_p4_entries enable row level security;
revoke all on public.lg3s_p4_weeks, public.lg3s_p4_pool, public.lg3s_p4_entries from anon, authenticated;
revoke all on schema private from anon, authenticated;

-- Players may read only their own entries (writes go through lg3s_p4_save).
drop policy if exists p4_entries_own_read on public.lg3s_p4_entries;
create policy p4_entries_own_read on public.lg3s_p4_entries for select to authenticated using (user_id = (select auth.uid()));
grant select on public.lg3s_p4_entries to authenticated;

-- ---------- scoring (one place) ----------
-- Skater: goal 3, assist 2, shot on goal 0.5, hit 0.25, hat trick +3, team win +1.
-- Goalie: save 1, goal against -0.5, win +4, shutout +5.
create or replace function private.lg3s_p4_fp(kind text, g int, a int, s int, h int, sv int, sa int, ga int, won boolean)
returns numeric language sql immutable set search_path = '' as $$
  select case when kind = 'goalie'
    then 1.0*coalesce(sv,0) - 0.5*coalesce(ga,0) + 4*won::int + 5*(coalesce(ga,0)=0 and coalesce(sa,0)>0)::int
    else 3*coalesce(g,0) + 2*coalesce(a,0) + 0.5*coalesce(s,0) + 0.25*coalesce(h,0) + 3*(coalesce(g,0)>=3)::int + won::int end
$$;

-- Verified, non-forfeit game lines with the result for the player's team.
create or replace view private.lg3s_p4_lines as
select l.lg_game_id, l.lg_user_id, l.player_kind kind, g.game_night_date, g.scheduled_at,
       l.goals, l.assists, l.shots, l.hits, l.saves, l.shots_against, l.goals_against,
       (case when l.lg_team_id_at_game = g.away_lg_team_id then g.away_score > g.home_score else g.home_score > g.away_score end) won,
       private.lg3s_p4_fp(l.player_kind, l.goals, l.assists, l.shots, l.hits, l.saves, l.shots_against, l.goals_against,
         (case when l.lg_team_id_at_game = g.away_lg_team_id then g.away_score > g.home_score else g.home_score > g.away_score end)) fp
from public.lg3s_player_game_lines l
join public.lg3s_games g using (lg_game_id)
where g.verification_status = 'verified' and not coalesce(g.is_forfeit,false)
  and not coalesce(l.is_placeholder,false) and l.lg_user_id is not null;

-- ---------- weekly pool builder ----------
-- Categories and prices from verified stats before the lock (blend = 0.6 x season FP/GP + 0.4 x last-3 FP/GP):
--   price     = skaters $4-$15, goalies $4-$12, by percentile of the blend
--   superstar = top 25 skaters by blend (min 2 GP)
--   diamond   = other skaters priced $8 or less (the bargain bin)
--   breakout  = every other skater (the middle tier)
--   goalie    = goalies
-- A player with lines as both skater and goalie is listed once, as the role with more games. Nation from the latest roster.
create or replace function private.lg3s_p4_build_week(p_week int, p_start date, p_end date, p_cap int default 36)
returns int language plpgsql security definer set search_path = '' as $$
declare v_lock timestamptz; v_n int;
begin
  select min(scheduled_at) into v_lock from public.lg3s_games where game_night_date between p_start and p_end;
  if v_lock is null then raise exception 'no games scheduled between % and %', p_start, p_end; end if;
  if exists (select 1 from public.lg3s_p4_entries where week = p_week) then
    raise exception 'week % already has entries; pool is frozen', p_week; end if;

  insert into public.lg3s_p4_weeks(week, start_date, end_date, lock_at, cap)
  values (p_week, p_start, p_end, v_lock, p_cap)
  on conflict (week) do update set start_date = excluded.start_date, end_date = excluded.end_date,
    lock_at = excluded.lock_at, cap = excluded.cap, built_at = now();
  delete from public.lg3s_p4_pool where week = p_week;

  with f as (
    select *, row_number() over (partition by lg_user_id, kind order by scheduled_at desc) rn
    from private.lg3s_p4_lines where scheduled_at < v_lock),
  s as (
    select lg_user_id, kind, count(*) gp, avg(fp) fp_season, avg(fp) filter (where rn <= 3) fp_last3,
           sum(goals) goals, sum(assists) assists, sum(goals)+sum(assists) points, sum(shots) shots, sum(hits) hits,
           sum(saves) saves, sum(shots_against) shots_against, sum(goals_against) goals_against
    from f group by lg_user_id, kind),
  r as (
    select distinct on (rr.lg_user_id) rr.lg_user_id, rr.gamertag, rr.lg_team_id, t.nation
    from public.lg3s_roster_snapshot_rows rr
    join public.lg3s_teams t using (lg_team_id)
    where rr.snapshot_id = (select max(id) from public.lg3s_roster_snapshots)
    order by rr.lg_user_id),
  j as (
    select distinct on (s.lg_user_id) s.*, r.gamertag, r.lg_team_id, r.nation, 0.6*s.fp_season + 0.4*s.fp_last3 blend
    from s join r using (lg_user_id)
    where not exists (select 1 from private.lg3s_p4_blocked_tags b where lower(b.tag) = lower(r.gamertag))
    order by s.lg_user_id, s.gp desc, (s.kind = 'skater') desc),
  k as (
    select j.*,
      case when kind = 'goalie' then null
           else row_number() over (partition by (kind = 'skater' and gp >= 2) order by blend desc) end star_rank,
      case when kind = 'goalie' then 4 + round(8*percent_rank() over (partition by kind order by blend))::int
           else 4 + round(11*percent_rank() over (partition by kind order by blend))::int end price
    from j)
  insert into public.lg3s_p4_pool(week, lg_user_id, gamertag, lg_team_id, nation, kind, category, price, gp, fp_season, fp_last3,
                                  goals, assists, points, shots, hits, saves, shots_against, goals_against)
  select p_week, lg_user_id, gamertag, lg_team_id, nation, kind,
    case when kind = 'goalie' then 'goalie'
         when gp >= 2 and star_rank <= 25 then 'superstar'
         when price <= 8 then 'diamond'
         else 'breakout' end,
    price,
    gp, round(fp_season,2), round(fp_last3,2), goals, assists, points, shots, hits, saves, shots_against, goals_against
  from k;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Builds next week's pool once its games are on the schedule and the previous week is over. Safe to run daily.
create or replace function private.lg3s_p4_auto_build()
returns text language plpgsql security definer set search_path = '' as $$
declare w record; v_start date; v_end date;
begin
  select * into w from public.lg3s_p4_weeks order by week desc limit 1;
  if w is null then return 'no weeks yet'; end if;
  if (now() at time zone 'America/Toronto')::date <= w.end_date then return 'current week not finished'; end if;
  select min(game_night_date) into v_start from public.lg3s_games where game_night_date > w.end_date;
  if v_start is null then return 'next week not scheduled'; end if;
  select max(game_night_date) into v_end from public.lg3s_games where game_night_date between v_start and v_start + 3;
  perform private.lg3s_p4_build_week(w.week + 1, v_start, v_end, w.cap);
  return 'built week ' || (w.week + 1);
end $$;
revoke all on function private.lg3s_p4_build_week(int,date,date,int), private.lg3s_p4_auto_build() from public, anon, authenticated;

-- ---------- save picks ----------
create or replace function public.lg3s_p4_save(p_week int, p_superstar bigint, p_breakout bigint, p_diamond bigint, p_goalie bigint, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w public.lg3s_p4_weeks; n_ok int; n_nat int; cost int; nm text := btrim(coalesce(p_name,''));
begin
  if uid is null then raise exception 'Sign in with Discord to lock in your picks.'; end if;
  select * into w from public.lg3s_p4_weeks where week = p_week;
  if not found then raise exception 'That week is not open.'; end if;
  if now() >= w.lock_at then raise exception 'Picks for this week are locked.'; end if;
  if length(nm) < 3 or length(nm) > 24 or nm !~ '^[A-Za-z0-9 ._''-]+$' then
    raise exception 'Team name must be 3-24 letters, numbers, spaces or . _ '' -'; end if;
  if exists (select 1 from private.lg3s_p4_blocked_tags b where position(lower(b.tag) in lower(nm)) > 0) then
    raise exception 'Please choose a different team name.'; end if;

  select count(*), count(distinct nation), coalesce(sum(price),0) into n_ok, n_nat, cost
  from public.lg3s_p4_pool p
  where p.week = p_week and (p.lg_user_id, p.category) in
    ((p_superstar,'superstar'), (p_breakout,'breakout'), (p_diamond,'diamond'), (p_goalie,'goalie'));
  if n_ok <> 4 then raise exception 'Pick one player from each category.'; end if;
  if n_nat <> 4 then raise exception 'All four picks must be from different nations.'; end if;
  if cost > w.cap then raise exception 'Over the cap: $% of $%.', cost, w.cap; end if;

  insert into public.lg3s_p4_entries(week, user_id, display_name, superstar, breakout, diamond, goalie, total_price)
  values (p_week, uid, nm, p_superstar, p_breakout, p_diamond, p_goalie, cost)
  on conflict (week, user_id) do update set display_name = excluded.display_name, superstar = excluded.superstar,
    breakout = excluded.breakout, diamond = excluded.diamond, goalie = excluded.goalie,
    total_price = excluded.total_price, updated_at = now();
  return jsonb_build_object('ok', true, 'week', p_week, 'total_price', cost, 'cap', w.cap, 'locks_at', w.lock_at);
end $$;
revoke all on function public.lg3s_p4_save(int,bigint,bigint,bigint,bigint,text) from public, anon;
grant execute on function public.lg3s_p4_save(int,bigint,bigint,bigint,bigint,text) to authenticated;

-- ---------- public read views ----------
create or replace view public.lg3s_p4_weeks_public with (security_invoker = false) as
select w.week, w.start_date, w.end_date, w.lock_at, w.cap,
       case when now() < w.lock_at then 'open'
            when (now() at time zone 'America/Toronto')::date <= w.end_date then 'live' else 'final' end status,
       (select count(*) from public.lg3s_p4_entries e where e.week = w.week and not e.hidden) entries
from public.lg3s_p4_weeks w;

create or replace view public.lg3s_p4_pool_public with (security_invoker = false) as
select week, lg_user_id, gamertag, nation, kind, category, price, gp, fp_season, fp_last3,
       goals, assists, points, shots, hits, saves, shots_against, goals_against
from public.lg3s_p4_pool;

-- Live fantasy points for each pool player in each week (verified games on that week's nights).
create or replace view public.lg3s_p4_player_scores with (security_invoker = false) as
select p.week, p.lg_user_id, count(l.lg_game_id) gp, coalesce(sum(l.fp),0)::numeric(7,2) points,
       sum(l.goals) goals, sum(l.assists) assists, sum(l.shots) shots, sum(l.hits) hits,
       sum((l.goals >= 3)::int) hat_tricks, sum(l.won::int) wins,
       sum(l.saves) saves, sum(l.goals_against) goals_against, sum((l.kind='goalie' and l.goals_against = 0 and l.shots_against > 0)::int) shutouts
from public.lg3s_p4_pool p
join public.lg3s_p4_weeks w using (week)
left join private.lg3s_p4_lines l on l.lg_user_id = p.lg_user_id and l.kind = p.kind and l.game_night_date between w.start_date and w.end_date
group by p.week, p.lg_user_id;

-- Per-entry live points (private: carries user_id). Public boards below never expose user_id.
create or replace view private.lg3s_p4_entry_points as
with e as (
  select e.*, w.lock_at from public.lg3s_p4_entries e join public.lg3s_p4_weeks w using (week) where not e.hidden),
x as (
  select e.id, e.week, e.user_id, e.display_name, e.total_price, e.updated_at, e.lock_at, s.slot, s.uid,
         p.gamertag, p.nation, p.price, coalesce(sc.points,0) pts, coalesce(sc.gp,0) gp
  from e cross join lateral (values ('superstar',e.superstar),('breakout',e.breakout),('diamond',e.diamond),('goalie',e.goalie)) s(slot,uid)
  left join public.lg3s_p4_pool p on p.week = e.week and p.lg_user_id = s.uid
  left join public.lg3s_p4_player_scores sc on sc.week = e.week and sc.lg_user_id = s.uid)
select id, week, user_id, display_name, max(total_price) total_price, max(updated_at) updated_at, max(lock_at) lock_at,
       sum(pts)::numeric(8,2) points,
       jsonb_agg(jsonb_build_object('slot',slot,'gamertag',gamertag,'nation',nation,'price',price,'points',pts,'gp',gp)
                 order by array_position(array['superstar','breakout','diamond','goalie'], slot)) picks
from x group by id, week, user_id, display_name;

-- Weekly board. Picks are shown only after the lock.
create or replace view public.lg3s_p4_board_week with (security_invoker = false) as
select week, display_name, points, total_price,
       rank() over (partition by week order by points desc) rank,
       case when now() >= lock_at then picks end picks
from private.lg3s_p4_entry_points;

-- Season board: running total across weeks, one row per player (latest team name).
create or replace view public.lg3s_p4_board_season with (security_invoker = false) as
with t as (
  select user_id, sum(points) points, count(*) weeks, max(points) best_week,
         (array_agg(display_name order by week desc, updated_at desc))[1] display_name
  from private.lg3s_p4_entry_points group by user_id)
select display_name, points::numeric(9,2) points, weeks, best_week::numeric(8,2) best_week,
       rank() over (order by points desc) rank
from t;

grant select on public.lg3s_p4_weeks_public, public.lg3s_p4_pool_public, public.lg3s_p4_player_scores,
                public.lg3s_p4_board_week, public.lg3s_p4_board_season to anon, authenticated;

-- Daily: build the next week's pool when it's ready (no-op otherwise).
select cron.schedule('lg3s-p4-auto-build', '20 16 * * *', $$select private.lg3s_p4_auto_build()$$);
