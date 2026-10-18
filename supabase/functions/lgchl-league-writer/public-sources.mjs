// Privacy boundary for every LGCHL league-wide write-up (night wraps, LG Media league pages).
//
// The league writer may read ONLY these public LeagueGaming-derived tables, and only these columns.
// Everything here mirrors what anyone can see on leaguegaming.com: the official schedule and finals,
// standings, published box scores and season player stats. Nothing collected for Hitmen scouting,
// film/VOD review, opponent reports, tendencies, chemistry, Lineup Lab / War Room, ratings models or
// Hitmen strategy is reachable through this module. Adding a table here is a privacy decision and
// must be reviewed; tests/lgchl-league-writer.test.mjs fails on any forbidden name.
//
// Notably excluded columns: lg_user_id, raw (raw LG page JSON), scouting_player_id, period_stats
// (the stored blob carries the page's signup log, not just periods), and anything not listed.
export const PUBLIC_SOURCES = Object.freeze({
  lgchl_teams: { columns: ['lg_team_id', 'season', 'name', 'abbr', 'nickname', 'league', 'conference', 'division'] },
  lgchl_games: { columns: ['lg_game_id', 'season', 'week', 'game_at', 'away_lg_team_id', 'home_lg_team_id', 'away_score', 'home_score', 'status', 'decided_in', 'source_url'] },
  lgchl_standings_snapshots: { columns: ['season', 'lg_team_id', 'taken_at', 'gp', 'w', 'l', 'otw', 'otl', 'pts', 'gf', 'ga', 'gd', 'streak', 'last10', 'division_rank'] },
  lgchl_standings_current: { columns: ['lg_team_id', 'name', 'abbr', 'nickname', 'league', 'conference', 'division', 'gp', 'w', 'l', 'otw', 'otl', 'pts', 'gf', 'ga', 'gd', 'streak', 'last10', 'division_rank', 'conference_rank', 'conference_size', 'standings_at'] },
  // Published LG box scores. Readable server-side only; the writer never selects lg_user_id/raw/period_stats.
  lg_game_box_scores: { columns: ['lg_game_id', 'league', 'season', 'home_lg_team_id', 'away_lg_team_id', 'home_team_name', 'away_team_name', 'home_score', 'away_score', 'team_stats', 'captured_at'], required: { league: 'LGCHL' } },
  lg_game_player_lines: { columns: ['lg_game_id', 'gamertag', 'team_name', 'side', 'position', 'goals', 'assists', 'points', 'plus_minus', 'shots', 'hits', 'ppg', 'shg', 'gwg', 'saves', 'shots_against', 'goals_against'] },
  // Public LG season stats (anon-readable view used by the LG Media leaders board).
  wm_lgchl_s55_player_leaders: { columns: ['gamertag', 'position', 'player_kind', 'lg_team_id', 'team_name', 'gp', 'fetched_at', 'goals', 'assists', 'points', 'plus_minus', 'shots', 'hits', 'takeaways', 'blocked_shots', 'save_pct', 'gaa', 'goalie_shots_against', 'goalie_goals_against'] },
  // Goalie record/shutouts live in the LG stats JSON; only LGCHL S55 regular season rows, never scouting_player_id.
  lg_player_season_stats: { columns: ['league_code', 'season', 'season_type', 'gamertag', 'position', 'player_kind', 'lg_team_id', 'team_name', 'games_played', 'fetched_at', 'stats'], required: { league_code: 'LGCHL', season_type: 'regular' } },
  // Optional: per-sync copies of public season totals (migration 20261017140000, not yet applied live).
  // When present, night deltas give every player's night league-wide, not just box-scored games.
  lgchl_player_stat_history: { columns: ['season', 'player_kind', 'gamertag', 'lg_team_id', 'position', 'gp', 'goals', 'assists', 'points', 'plus_minus', 'shots', 'hits', 'goalie_saves', 'goalie_shots_against', 'goalie_goals_against', 'taken_at'], optional: true },
});

// Defence in depth: even if someone adds a table above, these name fragments are never readable.
export const FORBIDDEN_NAME = /(hitmen_|scout|vod|film|pregame|tendenc|chemistry|lineup|war_?room|battle_plan|unit_plan|rating|valuation|intelligence|opponent|team_player_|weekly_report|chelscout|locker|stall|bid_|market|ai_analysis|media_posts|postgame_media|secret|auth_snapshot|lg_roster|profiles|memberships)/i;
// lg_game_player_lines / lgchl_* names are allowed explicitly; the check below runs on the allowlist too.

// Columns that must never be selected from any source, even if a future allowlist edit adds them.
export const FORBIDDEN_COLUMNS = new Set(['lg_user_id', 'raw', 'scouting_player_id', 'period_stats', 'source_snapshot_id', 'author_id', 'team_id']);

export class PrivacyError extends Error {
  constructor(message) { super(message); this.name = 'PrivacyError'; }
}

const FILTER_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not.is']);

export function assertPublicRead(table, columns, filters = {}) {
  const src = Object.prototype.hasOwnProperty.call(PUBLIC_SOURCES, table) ? PUBLIC_SOURCES[table] : null;
  if (!src) throw new PrivacyError('League writer may not read "' + table + '": not an allowlisted public LG source');
  if (FORBIDDEN_NAME.test(table)) throw new PrivacyError('League writer may not read "' + table + '": private name');
  if (!Array.isArray(columns) || !columns.length) throw new PrivacyError('Explicit column list required for ' + table + ' (no select *)');
  for (const c of columns) {
    if (typeof c !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(c)) throw new PrivacyError('Column "' + c + '" on ' + table + ' is not a plain column name (no *, casts, joins or embeds)');
    if (FORBIDDEN_COLUMNS.has(c)) throw new PrivacyError('Column "' + c + '" is never readable by the league writer');
    if (!src.columns.includes(c)) throw new PrivacyError('Column "' + c + '" on ' + table + ' is not allowlisted');
  }
  for (const [col, cond] of Object.entries(filters)) {
    if (!src.columns.includes(col)) throw new PrivacyError('Filter column "' + col + '" on ' + table + ' is not allowlisted');
    const op = String(cond?.op ?? '');
    if (!FILTER_OPS.has(op)) throw new PrivacyError('Filter operator "' + op + '" is not allowed');
  }
  for (const [col, val] of Object.entries(src.required || {})) {
    if (!(filters[col] && filters[col].op === 'eq' && filters[col].value === val))
      throw new PrivacyError(table + ' reads must filter ' + col + ' = ' + val);
  }
  return src;
}

// Wrap any backend (PostgREST client, local JSON snapshot, test double) so the composer can only
// ever see allowlisted tables and columns. backend(table, columns, filters, opts) -> rows.
// Rows are re-projected to the requested columns, so a backend that over-returns cannot leak.
export function createPublicReader(backend) {
  if (typeof backend !== 'function') throw new TypeError('backend must be a function');
  const reads = [];
  async function read(table, columns, filters = {}, opts = {}) {
    const src = assertPublicRead(table, columns, filters);
    reads.push({ table, columns: [...columns] });
    let rows;
    try { rows = await backend(table, columns, filters, opts); }
    catch (e) { if (src.optional) return null; throw e; }
    if (rows == null && src.optional) return null;
    return (rows || []).map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null])));
  }
  return Object.freeze({ read, reads });
}

// PostgREST (supabase-js) backend. Used by the Edge Function with the service role, which is why
// the allowlist above, not RLS alone, is the boundary for the two server-only box-score tables.
export function supabaseBackend(db) {
  return async (table, columns, filters, opts = {}) => {
    const build = () => {
      let q = db.from(table).select(columns.join(','));
      for (const [col, { op, value }] of Object.entries(filters)) {
        if (op === 'in') q = q.in(col, value);
        else if (op === 'is') q = q.is(col, value);
        else if (op === 'not.is') q = q.not(col, 'is', value);
        else q = q[op](col, value);
      }
      if (opts.order) q = q.order(opts.order, { ascending: opts.ascending !== false });
      return q;
    };
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build().range(from, from + 999);
      if (error) throw new Error(table + ': ' + error.message);
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return all;
  };
}

// Local JSON snapshot backend (CLI samples and tests): { table: rows[] }. Missing optional tables -> null.
export function snapshotBackend(snapshot) {
  const cmp = { eq: (a, b) => a === b, neq: (a, b) => a !== b, gt: (a, b) => a > b, gte: (a, b) => a >= b, lt: (a, b) => a < b, lte: (a, b) => a <= b,
    in: (a, b) => b.includes(a), is: (a, b) => a === b, 'not.is': (a, b) => a !== b };
  return async (table, _columns, filters) => {
    if (!Object.prototype.hasOwnProperty.call(snapshot, table)) return null;
    return snapshot[table].filter((r) => Object.entries(filters).every(([c, { op, value }]) => {
      const v = r[c];
      if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
        const [x, y] = typeof value === 'string' && /^\d{4}-\d\d-\d\d/.test(value) ? [Date.parse(v), Date.parse(value)] : [v, value];
        return cmp[op](x, y);
      }
      return cmp[op](v, value);
    }));
  };
}
