// LGCHL Season 55 playoff bracket.
// Official source: LeagueGaming playoffs page (structure, byes, series score) plus each
// series detail page (seed, best-of game list). Individual game scores are filled from those
// pages when LG prints them, and from public.lgchl_games when the league sync already has them.
// Pure module: no network. api/lgchl-playoffs.js does the fetching.

export const LEAGUE_ID = 39;
export const SEASON = 55;
export const HITMEN_LG_TEAM_ID = 412;
export const WINS_DEFAULT = 4;
export const BEST_OF_DEFAULT = 7;
const LG = 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league';

export const bracketUrl = () => `${LG}&action=league&page=playoffs&leagueid=${LEAGUE_ID}&seasonid=${SEASON}`;
export const detailUrl = (matchupId) => `${LG}&action=league&page=playoff_detail&leagueid=${LEAGUE_ID}&seasonid=${SEASON}&matchupid=${matchupId}&tournamentid=0&seasontypeid=3`;
export const gameUrl = (id) => `${LG}&action=league&page=game&gameid=${id}`;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ocirc: 'ô', Eacute: 'É' };
export const decode = (s) => String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  }
  return ENT[e] ?? ENT[e.toLowerCase()] ?? m;
});
export const text = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function isBlocked(html) {
  const s = String(html || '');
  if (/<title>\s*Just a moment/i.test(s)) return true;
  if (s.length < 800 && /challenge-platform|cf-chl|cf-mitigated/i.test(s)) return true;
  return false;
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function nyOffsetMs(utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(utcMs).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - utcMs;
}
function easternToUtc(y, mo, d, h, mi) {
  const wall = Date.UTC(y, mo, d, h, mi);
  const t = wall - nyOffsetMs(wall);
  return wall - nyOffsetMs(t);
}
function nyWeekday(utcMs) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(utcMs);
  return WEEKDAYS[name] ?? null;
}

// "Sun Nov 15 09:00pm" (schedule pages) or "Sun 15 09:00 EST" (playoff detail, evening, no meridian).
export function parseWhen(label, now = Date.now()) {
  const s = String(label || '');
  const long = /([A-Z][a-z]{2})\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([ap]m)/i.exec(s);
  if (long && MONTHS[long[2]]) {
    let h = Number(long[4]) % 12;
    if (long[6].toLowerCase() === 'pm') h += 12;
    const year = new Date(now).getUTCFullYear();
    let best = null;
    for (const y of [year - 1, year, year + 1]) {
      const t = easternToUtc(y, MONTHS[long[2]], Number(long[3]), h, Number(long[5]));
      if (best == null || Math.abs(t - now) < Math.abs(best - now)) best = t;
    }
    return new Date(best).toISOString();
  }
  const compact = /([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})/i.exec(s);
  if (!compact) return null;
  const wd = WEEKDAYS[compact[1].slice(0, 1).toUpperCase() + compact[1].slice(1, 3).toLowerCase()];
  const day = Number(compact[2]);
  let hour = Number(compact[3]);
  if (hour >= 1 && hour <= 11) hour += 12;
  const minute = Number(compact[4]);
  const base = new Date(now);
  let best = null;
  for (let delta = -1; delta <= 5; delta++) {
    const monthIndex = base.getUTCMonth() + delta;
    const y = base.getUTCFullYear() + Math.floor(monthIndex / 12);
    const mo = ((monthIndex % 12) + 12) % 12;
    const t = easternToUtc(y, mo, day, hour, minute);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23', day: 'numeric', month: 'numeric',
    }).formatToParts(t).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
    if (parts.day !== day) continue;
    if (wd != null && nyWeekday(t) !== wd) continue;
    if (best == null || Math.abs(t - now) < Math.abs(best - now)) best = t;
  }
  return best == null ? null : new Date(best).toISOString();
}

function teamIdsIn(html) {
  return [...String(html).matchAll(/team(\d+)\.png/g)].map((m) => Number(m[1])).filter((id) => id > 0);
}

function parseCell(inner, row, col, rs) {
  const id = Number((/playoff_event\(\s*\d+\s*,\s*\d+\s*,\s*(\d+)/.exec(inner) || [])[1] || 0) || null;
  const teams = teamIdsIn(inner);
  const scoreM = /pl_sp_txt">\s*(\d+)\s*-\s*(\d+)/.exec(inner);
  const score = scoreM ? [Number(scoreM[1]), Number(scoreM[2])] : null;
  const bye = /-\s*Bye\b/i.test(text(inner));
  let kind = 'empty';
  if (bye && teams.length) kind = 'bye';
  else if (teams.length >= 2) kind = 'series';
  else if (teams.length === 1) kind = 'advanced';
  return { kind, id, teams: teams.slice(0, 2), score, row, col, rs };
}

export function bracketSpec(bracket) {
  const cells = [];
  for (const row of bracket.grid) {
    for (const cell of row) {
      if (!cell || cell.span) continue;
      cells.push({
        kind: cell.kind, id: cell.id || null, teams: cell.teams || [], score: cell.score || null,
        row: cell.row, col: cell.col, rs: cell.rs,
      });
    }
  }
  return { labels: bracket.labels, finalsCol: bracket.finalsCol, rows: bracket.rows, cols: bracket.cols, cells };
}

export function bracketFromSpec(spec) {
  const grid = Array.from({ length: spec.rows }, () => Array(spec.cols).fill(null));
  for (const cell of spec.cells || []) {
    const full = {
      kind: cell.kind || 'empty', id: cell.id || null, teams: cell.teams || [], score: cell.score || null,
      row: cell.row, col: cell.col, rs: cell.rs || 1,
    };
    for (let k = 0; k < full.rs && full.row + k < spec.rows; k += 1) {
      grid[full.row + k][full.col] = k === 0 ? full : { span: true, origin: full };
    }
  }
  return { labels: spec.labels, finalsCol: spec.finalsCol, rows: spec.rows, cols: spec.cols, grid };
}

export function parseBracket(html) {
  const s = String(html || '');
  if (isBlocked(s)) throw new Error('LeagueGaming blocked the bracket request');
  const table = /<table class="playoff_table">([\s\S]*?)<\/table>/.exec(s);
  if (!table) throw new Error('playoff bracket table missing');
  const rowHtml = [...table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  if (rowHtml.length < 2) throw new Error('playoff bracket has no rows');
  const labels = [...rowHtml[0].matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => text(m[1]));
  const body = rowHtml.slice(1);
  const cols = labels.length;
  const grid = Array.from({ length: body.length }, () => Array(cols).fill(null));
  body.forEach((row, ri) => {
    let ci = 0;
    for (const td of row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)) {
      while (ci < cols && grid[ri][ci]) ci += 1;
      if (ci >= cols) break;
      const rs = Number((/rowspan="(\d+)"/.exec(td[1]) || [])[1] || 1);
      const cell = parseCell(td[2], ri, ci, rs);
      for (let k = 0; k < rs && ri + k < grid.length; k += 1) {
        grid[ri + k][ci] = k === 0 ? cell : { span: true, origin: cell };
      }
      ci += 1;
    }
  });
  const finalsCol = labels.indexOf('Finals');
  return { labels, finalsCol, rows: grid.length, cols, grid };
}

export function parseDetail(html, now = Date.now()) {
  const s = String(html || '');
  if (isBlocked(s)) throw new Error('LeagueGaming blocked a series request');
  const entries = [];
  const h4 = /<h4>([^<]+)<\/h4>([\s\S]*?)(?=<h4>|Community Voting|<\/table>)/g;
  for (const block of s.matchAll(h4)) {
    const nick = text(block[1]);
    const id = teamIdsIn(block[2])[0] || null;
    const rank = /(\d+)(?:st|nd|rd|th) in the ([A-Za-z]+(?: [A-Za-z]+)*)/.exec(block[2]);
    if (!id || !rank) continue;
    entries.push({ team_id: id, nick, seed: Number(rank[1]), group: rank[2].replace(/\s+/g, ' ').trim() });
  }
  const games = [];
  const gamesAt = s.search(/>\s*Games\s*</);
  const gamesHtml = gamesAt >= 0 ? s.slice(gamesAt, s.indexOf('<h4', gamesAt) > 0 ? s.indexOf('<h4', gamesAt) : gamesAt + 30000) : '';
  const rowRe = /<tr>\s*<td([^>]*)>([\s\S]*?)<\/td>\s*<td(?:\s[^>]*)?>([\s\S]*?)<\/td>\s*<td([^>]*)>([\s\S]*?)<\/td>\s*<\/tr>/g;
  for (const row of gamesHtml.matchAll(rowRe)) {
    const away = teamIdsIn(row[2])[0] || null;
    const home = teamIdsIn(row[5])[0] || null;
    if (!away && !home) continue;
    const gid = Number((/gameid=(\d+)/.exec(row[3]) || [])[1] || 0) || null;
    const n = Number((/Game:\s*<strong>(\d+)<\/strong>/.exec(row[3]) || [])[1] || games.length + 1);
    const label = text((/<small>([^<]*)<\/small>/.exec(row[3]) || [])[1] || '');
    const body = text(row[3]).replace(/Game:\s*\d+/, ' ');
    const sc = /(\d+)\s*(?:vs|[-–])\s*(\d+)/i.exec(body);
    const leftWin = /teamiconwin/i.test(row[1] + row[2]);
    const rightWin = /teamiconwin/i.test(row[4] + row[5]);
    const cancelled = /cancel/i.test(body);
    games.push({
      n, id: gid, label, at: parseWhen(label, now),
      away, home,
      away_score: sc ? Number(sc[1]) : null,
      home_score: sc ? Number(sc[2]) : null,
      winner: leftWin ? away : rightWin ? home : null,
      status: cancelled ? 'cancelled' : 'scheduled',
      url: gid ? gameUrl(gid) : null,
    });
  }
  return { entries, games: games.filter((g) => g.away && g.home) };
}

function originAt(grid, row, col) {
  const cell = grid[row]?.[col];
  if (!cell) return null;
  return cell.span ? cell.origin : cell;
}

function logo(id) {
  return `assets/lgchl/s55/team${id}.png`;
}

function blankTeam(id, entry) {
  return {
    id,
    name: entry?.nick || `Team ${id}`,
    nick: entry?.nick || `Team ${id}`,
    abbr: '',
    logo: logo(id),
    league: entry?.group?.split(' ')[0] || '',
    conference: entry?.group?.split(' ').slice(1).join(' ') || '',
    seed: entry?.seed ?? null,
    group: entry?.group || '',
    hitmen: id === HITMEN_LG_TEAM_ID,
  };
}

export function mergeTeams(base, matchups) {
  const teams = {};
  for (const [id, row] of Object.entries(base || {})) {
    const n = Number(id);
    teams[n] = {
      id: n,
      name: row.name || row.nick || `Team ${n}`,
      nick: row.nick || row.nickname || row.name || `Team ${n}`,
      abbr: row.abbr || '',
      logo: row.logo || logo(n),
      league: row.league || '',
      conference: row.conference || '',
      seed: row.seed ?? null,
      group: row.group || (row.league && row.conference ? `${row.league} ${row.conference}` : ''),
      hitmen: n === HITMEN_LG_TEAM_ID,
    };
  }
  for (const matchup of Object.values(matchups || {})) {
    for (const entry of matchup.entries || []) {
      const prev = teams[entry.team_id] || blankTeam(entry.team_id, entry);
      teams[entry.team_id] = {
        ...prev,
        nick: prev.nick && !/^Team /.test(prev.nick) ? prev.nick : (entry.nick || prev.nick),
        name: prev.name && !/^Team /.test(prev.name) ? prev.name : (entry.nick || prev.name),
        seed: entry.seed ?? prev.seed,
        group: entry.group || prev.group,
        league: (entry.group || '').split(' ')[0] || prev.league,
        conference: entry.group ? entry.group.split(' ').slice(1).join(' ') : prev.conference,
        logo: prev.logo || logo(entry.team_id),
        hitmen: entry.team_id === HITMEN_LG_TEAM_ID,
      };
    }
  }
  return teams;
}

function gameWinner(g) {
  if (g.status === 'cancelled') return null;
  if (g.away_score != null && g.home_score != null && g.away_score !== g.home_score) {
    return g.away_score > g.home_score ? g.away : g.home;
  }
  return g.winner || null;
}

function applyScore(game, row) {
  if (!row || row.away_score == null || row.home_score == null) return game;
  if (game.away_score != null && game.home_score != null) return game;
  let awayScore = row.away_score;
  let homeScore = row.home_score;
  if (row.away_lg_team_id === game.home && row.home_lg_team_id === game.away) {
    awayScore = row.home_score;
    homeScore = row.away_score;
  } else if (row.away_lg_team_id && row.away_lg_team_id !== game.away && row.home_lg_team_id !== game.home) {
    return game;
  }
  return {
    ...game,
    away_score: awayScore,
    home_score: homeScore,
    status: row.status || 'final',
    at: game.at || row.game_at || null,
  };
}

function seriesScore(cell, games, teamA, teamB) {
  const fromGames = [0, 0];
  let decided = 0;
  for (const g of games) {
    const win = gameWinner(g);
    if (win === teamA) { fromGames[0] += 1; decided += 1; }
    else if (win === teamB) { fromGames[1] += 1; decided += 1; }
  }
  const bracket = cell?.score;
  const bracketSum = bracket ? bracket[0] + bracket[1] : 0;
  if (!decided) return bracket || [0, 0];
  if (bracketSum > decided) return bracket;
  return fromGames;
}

function winnerId(slot) {
  if (!slot) return null;
  if (slot.winner_id) return slot.winner_id;
  if (slot.kind === 'bye' || slot.kind === 'advanced') return slot.sides?.[0]?.team_id || null;
  const [a, b] = slot.score || [0, 0];
  const need = slot.wins_needed || WINS_DEFAULT;
  const left = slot.sides?.[0]?.team_id;
  const right = slot.sides?.[1]?.team_id;
  if (a >= need && a > b) return left || null;
  if (b >= need && b > a) return right || null;
  return null;
}

function nickOf(teams, id, seed) {
  const t = teams[id];
  const name = t?.nick || t?.name || 'TBD';
  return seed ? `#${seed} ${name}` : name;
}

function matchupLabel(slot, teams) {
  return (slot.sides || []).map((s) => (s.team_id ? nickOf(teams, s.team_id, s.seed) : (s.from || 'TBD'))).join(' / ');
}

function feeder(slot, teams, fallback) {
  const w = winnerId(slot);
  if (w) {
    const side = slot.sides?.find((s) => s.team_id === w);
    return { team_id: w, seed: teams[w]?.seed ?? side?.seed ?? null, from: null };
  }
  if (slot?.kind === 'series' && slot.sides?.every((s) => s.team_id)) {
    return { team_id: null, seed: null, from: matchupLabel(slot, teams) };
  }
  return { team_id: null, seed: null, from: fallback || 'TBD' };
}

function finish(slot) {
  const need = slot.wins_needed || WINS_DEFAULT;
  const [a, b] = slot.score || [0, 0];
  let winner = null;
  if (slot.kind === 'bye' || slot.kind === 'advanced') winner = slot.sides[0]?.team_id || null;
  else if (a >= need && a > b) winner = slot.sides[0]?.team_id || null;
  else if (b >= need && b > a) winner = slot.sides[1]?.team_id || null;
  return { ...slot, winner_id: winner, clinched: !!winner && slot.kind !== 'pending' };
}

function enrich(cell, ctx) {
  const teams = ctx.teams;
  const detail = cell.id ? ctx.matchups[cell.id] : null;
  if (cell.kind === 'bye' || cell.kind === 'advanced') {
    const id = cell.teams[0];
    const meta = teams[id] || {};
    return finish({
      id: cell.id, kind: cell.kind === 'bye' ? 'bye' : 'advanced',
      label: 'R1', title: cell.kind === 'bye' ? 'Bye' : 'Advanced',
      best_of: null, wins_needed: null, score: null,
      sides: [{ team_id: id, seed: meta.seed ?? null, from: null }],
      games: [], url: cell.id ? detailUrl(cell.id) : null,
      group: meta.group || '',
      row: cell.row, col: cell.col, rs: cell.rs,
    });
  }
  const [teamA, teamB] = cell.teams;
  let games = (detail?.games || ctx.priorGames?.get(cell.id) || []).map((g) => applyScore({ ...g }, ctx.scores?.get(g.id)));
  games = games.filter((g) => g.away && g.home);
  const bestOf = games.length || BEST_OF_DEFAULT;
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const score = seriesScore(cell, games, teamA, teamB);
  const side = (id) => ({ team_id: id, seed: teams[id]?.seed ?? null, from: null });
  return finish({
    id: cell.id, kind: 'series', label: 'R1', title: 'Round 1',
    best_of: bestOf, wins_needed: winsNeeded, score,
    sides: [side(teamA), side(teamB)],
    games, url: cell.id ? detailUrl(cell.id) : null,
    group: teams[teamA]?.group || teams[teamB]?.group || '',
    row: cell.row, col: cell.col, rs: cell.rs,
  });
}

function synthesize(a, b, ctx, meta) {
  const fallbacks = meta.fallback || [];
  const sides = [feeder(a, ctx.teams, fallbacks[0]), feeder(b, ctx.teams, fallbacks[1])];
  const known = sides.filter((s) => s.team_id).length;
  const slot = finish({
    id: null,
    kind: known === 2 ? 'series' : 'pending',
    label: meta.label,
    title: meta.title,
    best_of: BEST_OF_DEFAULT,
    wins_needed: WINS_DEFAULT,
    score: known === 2 ? [0, 0] : [0, 0],
    sides,
    games: [],
    url: null,
    group: a.group || b.group || '',
    row: a.row, col: a.col, rs: a.rs,
  });
  const inward = a.col < ctx.finalsCol ? 1 : -1;
  const parent = originAt(ctx.grid, a.row, a.col + inward);
  if (parent && parent.row <= a.row && parent.row + parent.rs > (b.row ?? a.row)) {
    slot.row = parent.row;
    slot.col = parent.col;
    slot.rs = parent.rs;
    if (parent.kind === 'series' || parent.kind === 'advanced' || parent.kind === 'bye') {
      const live = enrich(parent, ctx);
      live.label = meta.label;
      live.title = meta.title;
      live.row = parent.row;
      live.col = parent.col;
      live.rs = parent.rs;
      return live;
    }
  }
  return slot;
}

function nextRound(slots, ctx, meta) {
  const out = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    if (!b) { out.push(a); continue; }
    out.push(synthesize(a, b, ctx, meta));
  }
  return out;
}

function columnOrigins(grid, col, from, to) {
  const out = [];
  for (let r = from; r < to && r < grid.length; r += 1) {
    const cell = grid[r][col];
    if (!cell || cell.span || cell.kind === 'empty') continue;
    out.push(cell);
  }
  return out;
}

function chunkConferences(slots) {
  const groups = [];
  for (const slot of slots) {
    const name = slot.group || 'Playoff';
    const last = groups[groups.length - 1];
    if (!last || last.group !== name) groups.push({ group: name, r1: [slot] });
    else last.r1.push(slot);
  }
  return groups;
}

function conferenceName(group) {
  const parts = String(group || '').split(' ');
  return parts.slice(1).join(' ') || parts[0] || 'Bracket';
}

function buildLeague(r1cells, ctx, sideName) {
  const r1 = r1cells.map((cell) => enrich(cell, ctx));
  const groups = chunkConferences(r1);
  const conferences = groups.map((g) => {
    const r2 = nextRound(g.r1, ctx, { label: 'R2', title: 'Round 2', fallback: ['R1 winner', 'R1 winner'] });
    const r3 = nextRound(r2, ctx, { label: 'R3', title: 'Round 3', fallback: ['R2 winner', 'R2 winner'] });
    return {
      name: conferenceName(g.group),
      group: g.group,
      rounds: [
        { label: 'R1', title: 'Round 1', slots: g.r1 },
        { label: 'R2', title: 'Round 2', slots: r2 },
        { label: 'R3', title: 'Round 3', slots: r3 },
      ],
    };
  });
  const league = (groups[0]?.group || sideName || 'LGCHL').split(' ')[0];
  let leagueFinal = null;
  if (conferences.length >= 2) {
    const east = conferences[0].rounds[2].slots[0];
    const west = conferences[1].rounds[2].slots[0];
    const eastName = `${conferences[0].name} champion`;
    const westName = `${conferences[1].name} champion`;
    leagueFinal = nextRound([east, west], ctx, {
      label: 'QF', title: `${league} final`, fallback: [eastName, westName],
    })[0] || null;
  } else if (conferences.length === 1) {
    leagueFinal = conferences[0].rounds[2].slots[0] || conferences[0].rounds[1].slots[0] || null;
  }
  return { id: league, name: league, conferences, final: leagueFinal };
}

function stripSlot(slot) {
  if (!slot) return null;
  const { row, col, rs, ...rest } = slot;
  return {
    ...rest,
    games: (rest.games || []).map(({ winner, ...g }) => ({
      ...g,
      winner: gameWinner(g) || winner || null,
    })),
  };
}
function stripRound(round) {
  return { ...round, slots: (round.slots || []).map(stripSlot) };
}

export function buildBoard({ bracket, matchups, teams, scores, priorGames, now = Date.now() } = {}) {
  if (!bracket?.grid?.length || bracket.finalsCol < 0) throw new Error('bracket is not a playoff grid');
  const ctx = {
    grid: bracket.grid,
    finalsCol: bracket.finalsCol,
    teams: mergeTeams(teams, matchups),
    matchups: matchups || {},
    scores: scores || new Map(),
    priorGames: priorGames || new Map(),
    now,
  };
  const leftCol = 0;
  const rightCol = bracket.cols - 1;
  const mid = Math.floor(bracket.rows / 2);
  const whl = buildLeague(columnOrigins(bracket.grid, leftCol, 0, mid), ctx, 'WHL');
  const ohl = buildLeague(columnOrigins(bracket.grid, leftCol, mid, bracket.rows), ctx, 'OHL');
  const qmjhl = buildLeague(columnOrigins(bracket.grid, rightCol, 0, mid), ctx, 'QMJHL');
  const leagues = [whl, ohl, qmjhl].filter((l) => l.conferences.some((c) => c.rounds[0].slots.length));

  let semi = null;
  if (whl.final && ohl.final) {
    semi = nextRound([whl.final, ohl.final], ctx, {
      label: 'SF', title: 'Semifinal', fallback: ['WHL champion', 'OHL champion'],
    })[0];
  }
  const finalsCell = originAt(bracket.grid, 0, bracket.finalsCol);
  let finalSlot = null;
  if (finalsCell && finalsCell.kind !== 'empty') {
    finalSlot = enrich(finalsCell, ctx);
    finalSlot.label = 'F';
    finalSlot.title = 'Final';
  } else if (semi && qmjhl.final) {
    finalSlot = {
      ...synthesize(semi, qmjhl.final, ctx, { label: 'F', title: 'Final', fallback: ['Semifinal winner', 'QMJHL champion'] }),
      label: 'F',
      title: 'Final',
    };
    // synthesize() would look for a parent of the semi and might attach the wrong cell.
    // The final is the center. Rebuild the sides explicitly so a passthrough cannot replace them.
    const sides = [
      feeder(semi, ctx.teams, 'Semifinal winner'),
      feeder(qmjhl.final, ctx.teams, 'QMJHL champion'),
    ];
    finalSlot = finish({
      id: null, kind: sides.every((s) => s.team_id) ? 'series' : 'pending',
      label: 'F', title: 'Final', best_of: BEST_OF_DEFAULT, wins_needed: WINS_DEFAULT,
      score: [0, 0], sides, games: [], url: null, group: '',
    });
  }

  const cleanLeague = (league) => ({
    id: league.id,
    name: league.name,
    conferences: league.conferences.map((c) => ({
      name: c.name,
      group: c.group,
      rounds: c.rounds.map(stripRound),
    })),
    final: stripSlot(league.final),
  });

  const championship = {
    semi: stripSlot(semi),
    final: finalSlot ? stripSlot(finalSlot) : null,
  };
  const publicLeagues = leagues.map(cleanLeague);
  const used = new Set();
  const take = (slot) => {
    if (!slot) return;
    for (const side of slot.sides || []) if (side.team_id) used.add(side.team_id);
    for (const game of slot.games || []) {
      if (game.away) used.add(game.away);
      if (game.home) used.add(game.home);
    }
  };
  for (const league of publicLeagues) {
    for (const conf of league.conferences) for (const round of conf.rounds) for (const slot of round.slots) take(slot);
    take(league.final);
  }
  take(championship.semi);
  take(championship.final);
  const playoffTeams = {};
  for (const id of used) if (ctx.teams[id]) playoffTeams[id] = ctx.teams[id];
  return { teams: playoffTeams, leagues: publicLeagues, championship };
}

function matchupIds(bracket, kinds) {
  const ids = [];
  for (const row of bracket.grid) {
    for (const cell of row) {
      if (!cell || cell.span || !cell.id) continue;
      if (!kinds || kinds.has(cell.kind)) ids.push(cell.id);
    }
  }
  return [...new Set(ids)];
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try { out[index] = await fn(items[index], index); }
      catch { out[index] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

function priorFrom(matchups) {
  const map = new Map();
  for (const [id, matchup] of Object.entries(matchups || {})) {
    if (matchup?.games?.length) map.set(Number(id), matchup.games);
  }
  return map;
}

export async function refreshFromSources({ snapshot, fetchHtml, loadTeams, loadScores, now = Date.now() } = {}) {
  const snap = snapshot && snapshot.leagues ? snapshot : null;
  const baseMatchups = { ...(snap?.matchups || {}) };
  const baseTeams = snap?.teams || {};
  try {
    if (!fetchHtml) throw new Error('no fetcher');
    const bracketHtml = await fetchHtml(bracketUrl());
    const bracket = parseBracket(bracketHtml);
    const ids = matchupIds(bracket, new Set(['series', 'bye', 'advanced']));
    const parsed = await pool(ids, 4, async (id) => {
      const html = await fetchHtml(detailUrl(id));
      return [id, parseDetail(html, now)];
    });
    const matchups = { ...baseMatchups };
    for (const row of parsed) {
      if (!row) continue;
      const [id, detail] = row;
      if (detail?.entries?.length) matchups[id] = detail;
    }
    let teams = baseTeams;
    if (loadTeams) {
      try {
        const live = await loadTeams();
        if (live && Object.keys(live).length) teams = { ...baseTeams, ...live };
      } catch { /* names from the snapshot still work */ }
    }
    const gameIds = [...new Set(Object.values(matchups).flatMap((m) => (m.games || []).map((g) => g.id).filter(Boolean)))];
    let scores = new Map();
    if (loadScores && gameIds.length) {
      try { scores = await loadScores(gameIds) || new Map(); }
      catch { scores = new Map(); }
    }
    const board = buildBoard({ bracket, matchups, teams, scores, priorGames: priorFrom(baseMatchups), now });
    return {
      ok: true,
      stale: false,
      season: SEASON,
      league_id: LEAGUE_ID,
      fetched_at: new Date(now).toISOString(),
      source_url: bracketUrl(),
      source: 'LeagueGaming playoff bracket and series pages, with final scores filled from public.lgchl_games when the series page has not posted them yet',
      refresh_seconds: 120,
      teams: board.teams,
      leagues: board.leagues,
      championship: board.championship,
      matchups,
      bracket: bracketSpec(bracket),
    };
  } catch (error) {
    if (!snap?.bracket || !snap.matchups) {
      if (!snap) throw error;
      return { ...snap, ok: true, stale: true, stale_reason: 'lg_unavailable', refresh_seconds: 30 };
    }
    let scores = new Map();
    const gameIds = [...new Set(Object.values(snap.matchups).flatMap((m) => (m.games || []).map((g) => g.id).filter(Boolean)))];
    if (loadScores && gameIds.length) {
      try { scores = await loadScores(gameIds) || new Map(); }
      catch { scores = null; }
    }
    if (!scores) {
      return { ...snap, ok: true, stale: true, stale_reason: 'lg_unavailable', refresh_seconds: 30 };
    }
    try {
      const board = buildBoard({
        bracket: bracketFromSpec(snap.bracket),
        matchups: snap.matchups,
        teams: snap.teams,
        scores,
        now,
      });
      return {
        ok: true,
        stale: false,
        season: SEASON,
        league_id: LEAGUE_ID,
        fetched_at: new Date(now).toISOString(),
        draw_at: snap.fetched_at,
        source_url: bracketUrl(),
        source: 'Saved official bracket, with series scores and advancement taken from public.lgchl_games',
        refresh_seconds: 120,
        teams: board.teams,
        leagues: board.leagues,
        championship: board.championship,
        matchups: snap.matchups,
        bracket: snap.bracket,
      };
    } catch {
      return { ...snap, ok: true, stale: true, stale_reason: 'lg_unavailable', refresh_seconds: 30 };
    }
  }
}

export function toPublic(payload) {
  if (!payload) return { ok: false };
  const { matchups, bracket, ...rest } = payload;
  return rest;
}
