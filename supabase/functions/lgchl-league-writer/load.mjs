// Loads one LGCHL game night through the privacy-checked public reader (public-sources.mjs).
// The composer receives only what this returns; it has no database handle of its own.
import { PUBLIC_SOURCES } from './public-sources.mjs';

export const TZ = 'America/Toronto';
const cols = (t) => PUBLIC_SOURCES[t].columns;
export const localDate = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

export async function loadNight(reader, { night, season = 55 }) {
  if (!/^\d{4}-\d\d-\d\d$/.test(String(night))) throw new Error('night must be YYYY-MM-DD (Eastern)');
  const S = { op: 'eq', value: season };
  const [teams, games] = await Promise.all([
    reader.read('lgchl_teams', cols('lgchl_teams'), { season: S }),
    reader.read('lgchl_games', cols('lgchl_games'), { season: S }, { order: 'game_at' }),
  ]);
  const nightGames = games.filter((g) => localDate(g.game_at) === night);
  if (!nightGames.length) return { night, season, teams, games, nightGames, empty: true };
  const nightStart = Math.min(...nightGames.map((g) => Date.parse(g.game_at)));
  const lastStart = Math.max(...nightGames.map((g) => Date.parse(g.game_at)));
  const later = games.map((g) => Date.parse(g.game_at)).filter((t) => t > lastStart + 6 * 3600e3);
  const nextStart = later.length ? Math.min(...later) : null;
  const ids = nightGames.map((g) => g.lg_game_id);

  const [snapshots, current, boxes, leaders, goalieSeason] = await Promise.all([
    reader.read('lgchl_standings_snapshots', cols('lgchl_standings_snapshots'), { season: S }, { order: 'taken_at' }),
    reader.read('lgchl_standings_current', cols('lgchl_standings_current'), {}),
    reader.read('lg_game_box_scores', cols('lg_game_box_scores'), { league: { op: 'eq', value: 'LGCHL' }, season: S }),
    reader.read('wm_lgchl_s55_player_leaders', cols('wm_lgchl_s55_player_leaders'), {}),
    reader.read('lg_player_season_stats', cols('lg_player_season_stats'), { league_code: { op: 'eq', value: 'LGCHL' }, season: S, season_type: { op: 'eq', value: 'regular' }, player_kind: { op: 'eq', value: 'goalie' } }),
  ]);
  const boxIds = boxes.map((b) => b.lg_game_id);
  const lines = boxIds.length ? await reader.read('lg_game_player_lines', cols('lg_game_player_lines'), { lg_game_id: { op: 'in', value: boxIds } }) : [];
  // Optional league-wide night deltas (only once the stat-history migration is live).
  const history = await reader.read('lgchl_player_stat_history', cols('lgchl_player_stat_history'), {
    season: S, taken_at: { op: 'gte', value: new Date(nightStart - 36 * 3600e3).toISOString() },
  });
  return { night, season, teams, games, nightGames, ids, nightStart, lastStart, nextStart, snapshots, current, boxes, lines, leaders, goalieSeason, history };
}
