-- LGCHL media follow-up (approved by Seth, Oct 19 2026)
-- 1) Hide lg_player_season_stats.scouting_player_id from public/anon/authenticated reads.
--    Column-level SELECT: every column except scouting_player_id stays readable, so the
--    site's explicit-column reads keep working. service_role (edge functions) is unchanged.
revoke select on table public.lg_player_season_stats from anon, authenticated;
grant select (id, lg_league_id, league_code, season, season_type, player_kind, lg_user_id,
              gamertag, position, team_name, games_played, stats, fetched_at, lg_team_id)
  on table public.lg_player_season_stats to anon, authenticated;

-- 2) Post-night LGCHL S55 regular-season stats refresh so lgchl_player_stat_history
--    (trigger on lg_player_season_stats) is populated before the 12:50 AM ET writer.
--    04:25 UTC Mon-Wed = 12:25 AM EDT, after the 12:15 AM full league sync.
select cron.schedule('lgchl-stats-postnight', '25 4 * * 1,2,3',
  $$select public.lg_enqueue(39, 55, 55, array['regular'], 1, true)$$);

-- 3) DST (Nov 1 2026, EDT -> EST): keep both media jobs at the same ET wall-clock time.
select cron.schedule('dst-fall-back-2026-lgchl-media', '5 12 1 11 *', $$
do $d$
begin
  perform cron.alter_job(job_id := (select jobid from cron.job where jobname = 'lgchl-stats-postnight'), schedule := '25 5 * * 1,2,3');
  perform cron.alter_job(job_id := (select jobid from cron.job where jobname = 'lgchl-night-wrap-drafts'), schedule := '50 5 * * 1,2,3');
  perform cron.unschedule('dst-fall-back-2026-lgchl-media');
end $d$;
$$);
