-- lg-auth-ingest stored a goalie's Public Log "sa" value as shots_against and saved sa - ga as saves.
-- In the LG Public Log "sa" is saves, so every goalie line was short by goals against on both counts
-- (game 917493: LG shows Kudolken 13 saves on 17 shots; stored as 9 on 13).
-- Recompute from the raw Public Log fields kept on each line.
update public.lg_game_player_lines
   set saves = (raw->>'sa')::int,
       shots_against = (raw->>'sa')::int + (raw->>'ga')::int
 where raw->>'sa' ~ '^\d+$' and raw->>'ga' ~ '^\d+$'
   and ((raw->>'sa')::int > 0 or (raw->>'ga')::int > 0);
