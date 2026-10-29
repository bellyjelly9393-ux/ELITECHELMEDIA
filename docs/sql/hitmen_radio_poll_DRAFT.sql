-- =====================================================================
-- DRAFT — NOT APPLIED. Hitmen Radio "Name That Line" poll storage.
-- Needs Seth's approval before anyone runs it against Supabase
-- (project lrgllzvwgvqagcpiyvfd). Adds NEW objects only; touches no
-- existing table, function, policy or data.
--
-- Until this is applied the homepage poll shows the options with
-- "Voting opens soon" and no vote is recorded anywhere.
-- =====================================================================

begin;

create table if not exists public.hitmen_radio_poll_votes (
  id          bigint generated always as identity primary key,
  poll_id     text        not null check (char_length(poll_id) between 1 and 64),
  option_id   text        not null check (char_length(option_id) between 1 and 64),
  voter_id    uuid        not null,            -- random id from the visitor's localStorage
  ip_hash     text,                            -- sha256(salt || client ip); raw IP is never stored
  created_at  timestamptz not null default now(),
  unique (poll_id, voter_id)                   -- one vote per browser per poll
);
create index if not exists hitmen_radio_poll_votes_poll_ip_idx
  on public.hitmen_radio_poll_votes (poll_id, ip_hash);

-- Lock the table: no direct reads/writes from anon/authenticated. All access via the two functions below.
alter table public.hitmen_radio_poll_votes enable row level security;
revoke all on public.hitmen_radio_poll_votes from anon, authenticated;

-- Allowed polls/options live here so random option ids can't be stuffed in.
create or replace function public.hitmen_radio_poll_options(p_poll text)
returns text[] language sql immutable as $$
  select case p_poll
    when 'name-that-line-2026-10' then array['twenty-four-seven','setty-steady-go','wrecking-crew']
    else null end
$$;

create or replace function public.hitmen_radio_poll_results(p_poll text)
returns table (option_id text, votes bigint)
language sql stable security definer set search_path = public as $$
  select o.option_id, count(v.id)::bigint
  from unnest(public.hitmen_radio_poll_options(p_poll)) as o(option_id)
  left join public.hitmen_radio_poll_votes v on v.poll_id = p_poll and v.option_id = o.option_id
  group by o.option_id
$$;

-- Server-side guard: one vote per voter_id per poll, max 3 votes per IP per poll
-- (allows a shared household, blocks scripted stuffing from one address).
create or replace function public.hitmen_radio_poll_vote(p_poll text, p_option text, p_voter uuid)
returns table (option_id text, votes bigint, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_ip   text;
  v_hash text;
  v_status text := 'ok';
begin
  if public.hitmen_radio_poll_options(p_poll) is null or not (p_option = any(public.hitmen_radio_poll_options(p_poll))) then
    raise exception 'invalid poll or option' using errcode = '22023';
  end if;
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json ->> 'x-forwarded-for'), ''), ',', 1);
  exception when others then v_ip := '';
  end;
  v_hash := case when v_ip = '' then null else encode(extensions.digest('hitmen-radio-poll:' || v_ip, 'sha256'), 'hex') end;

  if exists (select 1 from public.hitmen_radio_poll_votes where poll_id = p_poll and voter_id = p_voter) then
    v_status := 'already_voted';
  elsif v_hash is not null and (select count(*) from public.hitmen_radio_poll_votes where poll_id = p_poll and ip_hash = v_hash) >= 3 then
    v_status := 'limit';
  else
    insert into public.hitmen_radio_poll_votes (poll_id, option_id, voter_id, ip_hash)
    values (p_poll, p_option, p_voter, v_hash)
    on conflict (poll_id, voter_id) do nothing;
  end if;

  return query select r.option_id, r.votes, v_status from public.hitmen_radio_poll_results(p_poll) r;
end $$;

revoke all on function public.hitmen_radio_poll_vote(text, text, uuid) from public;
revoke all on function public.hitmen_radio_poll_results(text) from public;
grant execute on function public.hitmen_radio_poll_vote(text, text, uuid) to anon, authenticated;
grant execute on function public.hitmen_radio_poll_results(text) to anon, authenticated;

commit;

-- =====================================================================
-- ROLLBACK (removes only what this file created; the site falls back
-- to "Voting opens soon" automatically):
--
-- begin;
--   drop function if exists public.hitmen_radio_poll_vote(text, text, uuid);
--   drop function if exists public.hitmen_radio_poll_results(text);
--   drop function if exists public.hitmen_radio_poll_options(text);
--   drop table    if exists public.hitmen_radio_poll_votes;
-- commit;
-- =====================================================================
