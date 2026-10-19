-- Run inside a transaction that is rolled back:  begin; \i this file; rollback;
-- Raises an exception on any failure.
do $$
declare v_id uuid; v_sched uuid; v_brant uuid; v_chi uuid;
begin
  assert private.hitmen_name_key('Chicoutimi Sagueneens') = private.hitmen_name_key('Chicoutimi Saguenéens'), 'accent key';
  assert private.hitmen_name_key('RIMOUSKI Océanic') = private.hitmen_name_key('rimouski oceanic'), 'case key';
  assert private.hitmen_name_key('Brantford Bulldogs') <> private.hitmen_name_key('Chicoutimi Saguenéens'), 'distinct teams';

  -- Recap queue links each Oct 18 game to its own schedule row (not the neighbouring game).
  select schedule_game_id into v_brant from public.hitmen_autorecap_games(60, 917581);
  select schedule_game_id into v_chi from public.hitmen_autorecap_games(60, 917609);
  assert v_brant = 'dc405c80-27fc-44e0-b548-bdd52de936f0', 'Brantford link: ' || coalesce(v_brant::text, 'null');
  assert v_chi = '6d08592b-8bc0-4a3b-b7b2-11b2a84bf46d', 'Chicoutimi link: ' || coalesce(v_chi::text, 'null');

  -- Final trigger matches the accented schedule name: reset the Chicoutimi row, re-fire the LG final.
  update public.hitmen_schedule_games set status = 'scheduled', calgary_score = null, opponent_score = null
   where id = '6d08592b-8bc0-4a3b-b7b2-11b2a84bf46d';
  update public.lgchl_games set home_score = home_score where lg_game_id = 917609;
  select id into v_id from public.hitmen_schedule_games
   where id = '6d08592b-8bc0-4a3b-b7b2-11b2a84bf46d' and status = 'final' and calgary_score = 3 and opponent_score = 5;
  assert v_id is not null, 'trigger did not finalize the accented Chicoutimi row';
  raise notice 'hitmen accent/schedule-link tests passed';
end $$;
