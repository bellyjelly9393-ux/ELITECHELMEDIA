-- lgchl-league-sync now fills lgchl_games.decided_in (REG/OT/SO) from LG's public game page.
-- Carry it to hitmen_schedule_games.overtime when it first becomes known, so nobody hand-fixes it nightly.
create or replace function private.hitmen_apply_lgchl_final()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_away text; v_home text; v_calgary_home boolean; v_opp text; v_id uuid; v_new_decision boolean;
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
    overtime = case when new.decided_in is not null then new.decided_in in ('OT','SO') else s.overtime end,
    source_url = coalesce(s.source_url, new.source_url),
    source_label = coalesce(s.source_label, 'LGCHL official game index'),
    updated_at = now()
  where s.id = v_id and (s.status <> 'final' or s.calgary_score is null);
  -- Decision arrives after the score (separate page read): update only the flag, only if it differs.
  v_new_decision := new.decided_in is not null and (tg_op = 'INSERT' or old.decided_in is distinct from new.decided_in);
  if v_new_decision then
    update public.hitmen_schedule_games s set overtime = new.decided_in in ('OT','SO'), updated_at = now()
     where s.id = v_id and s.overtime is distinct from (new.decided_in in ('OT','SO'));
  end if;
  return new;
end $function$;

drop trigger if exists hitmen_apply_lgchl_final on public.lgchl_games;
create trigger hitmen_apply_lgchl_final after insert or update of status, home_score, away_score, decided_in
  on public.lgchl_games for each row execute function private.hitmen_apply_lgchl_final();
