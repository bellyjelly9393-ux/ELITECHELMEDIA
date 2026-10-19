-- Accent/case-insensitive team matching for Hitmen schedule links, and no cross-game fallback.
-- Bug: hitmen_autorecap_games picked "any schedule row within 30 min" (limit 1, no opponent check), so
-- LG 917581 (Brantford, 00:30 UTC) got the 01:00 Chicoutimi row; the final trigger compared names
-- exactly, so LG "Chicoutimi Sagueneens" never matched schedule "Chicoutimi Saguenéens".

-- 1. Normalised name key (no extension needed): strip accents, lower-case, keep [a-z0-9].
create or replace function private.hitmen_name_key(p text)
returns text language sql immutable parallel safe set search_path to '' as $$
  select regexp_replace(lower(translate(coalesce(p, ''),
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿŒœÆæ',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyyOoAa')), '[^a-z0-9]+', '', 'g');
$$;
revoke all on function private.hitmen_name_key(text) from public, anon, authenticated;

-- 2. Final-score trigger: same opponent by key, nearest scheduled row within 30 minutes only.
create or replace function private.hitmen_apply_lgchl_final()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_away text; v_home text; v_calgary_home boolean; v_opp text; v_id uuid;
begin
  if new.status <> 'final' or new.home_score is null or new.away_score is null then return new; end if;
  select name into v_away from public.lgchl_teams where lg_team_id = new.away_lg_team_id and season = new.season;
  select name into v_home from public.lgchl_teams where lg_team_id = new.home_lg_team_id and season = new.season;
  if v_home = 'Calgary Hitmen' then v_calgary_home := true; v_opp := v_away;
  elsif v_away = 'Calgary Hitmen' then v_calgary_home := false; v_opp := v_home;
  else return new; end if;
  select s.id into v_id from public.hitmen_schedule_games s
   where s.team_id = 'b0bcbdda-da9d-419d-8f61-b34937966d49' and s.season = new.season
     and private.hitmen_name_key(s.opponent_name) = private.hitmen_name_key(v_opp)
     and abs(extract(epoch from (s.scheduled_at - new.game_at))) <= 1800
   order by abs(extract(epoch from (s.scheduled_at - new.game_at))), s.id limit 1;
  if v_id is null then return new; end if;
  update public.hitmen_schedule_games s set
    status = 'final',
    calgary_score = case when v_calgary_home then new.home_score else new.away_score end,
    opponent_score = case when v_calgary_home then new.away_score else new.home_score end,
    source_url = coalesce(s.source_url, new.source_url),
    source_label = coalesce(s.source_label, 'LGCHL official game index'),
    updated_at = now()
  where s.id = v_id and (s.status <> 'final' or s.calgary_score is null);
  return new;
end $function$;

-- 3. Recap queue: link only the schedule row for the SAME opponent (by key), nearest in time; else null.
create or replace function public.hitmen_autorecap_games(p_days integer default 14, p_lg_game_id bigint default null)
returns table (lg_game_id bigint, game_at timestamptz, week integer, status text, away_lg_team_id integer, home_lg_team_id integer,
               away_score integer, home_score integer, source_url text, game_no integer, schedule_game_id uuid,
               has_recap boolean, due boolean)
language sql stable security definer set search_path to '' as $$
  with finals as (
    select g.*, row_number() over (order by g.game_at)::int as n
      from public.lgchl_games g
     where g.season = 55 and g.status = 'final' and 412 in (g.home_lg_team_id, g.away_lg_team_id)
       and g.home_score is not null and g.away_score is not null
  )
  select f.lg_game_id, f.game_at, f.week, f.status, f.away_lg_team_id, f.home_lg_team_id, f.away_score::int, f.home_score::int,
         coalesce(f.source_url, 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' || f.lg_game_id),
         f.n,
         (select s.id from public.hitmen_schedule_games s
            join public.lgchl_teams o on o.season = f.season
                 and o.lg_team_id = case when f.home_lg_team_id = 412 then f.away_lg_team_id else f.home_lg_team_id end
           where s.team_id = 'b0bcbdda-da9d-419d-8f61-b34937966d49' and s.season = 55
             and private.hitmen_name_key(s.opponent_name) = private.hitmen_name_key(o.name)
             and abs(extract(epoch from (s.scheduled_at - f.game_at))) <= 1800
           order by abs(extract(epoch from (s.scheduled_at - f.game_at))), s.id limit 1),
         private.hitmen_recap_exists(f.lg_game_id),
         coalesce(a.attempts, 0) < 30 and (a.last_attempt_at is null or a.last_attempt_at < now() - interval '9 minutes')
    from finals f
    left join public.hitmen_autorecap_attempts a on a.lg_game_id = f.lg_game_id
   where (p_lg_game_id is not null and f.lg_game_id = p_lg_game_id)
      or (p_lg_game_id is null and f.game_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 60))))
   order by f.game_at;
$$;

-- 4. Dedupe helper: opponent-name fallback is accent-insensitive too, so a renamed recap still counts.
create or replace function private.hitmen_recap_exists(p_lg_game_id bigint)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (
    select 1
      from public.media_posts m, public.lgchl_games g
      join public.lgchl_teams th on th.lg_team_id = g.home_lg_team_id and th.season = g.season
      join public.lgchl_teams ta on ta.lg_team_id = g.away_lg_team_id and ta.season = g.season
     where g.lg_game_id = p_lg_game_id and m.post_type = 'recap'
       and (m.source_metrics->>'lg_game_id' = p_lg_game_id::text
            or (private.hitmen_name_key(m.source_metrics->>'opponent') = private.hitmen_name_key(case when th.name = 'Calgary Hitmen' then ta.name else th.name end)
                and m.source_metrics->>'game_date' = to_char(g.game_at at time zone 'America/Toronto', 'YYYY-MM-DD')
                and coalesce(m.source_metrics->>'final','') in ('',
                     (case when th.name = 'Calgary Hitmen' then g.home_score else g.away_score end) || '-' ||
                     (case when th.name = 'Calgary Hitmen' then g.away_score else g.home_score end))))
  );
$function$;
