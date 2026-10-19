// Deterministic LGCHL night wrap. No AI, no quotes, no adjectives that the numbers cannot carry.
// Every name, score and stat comes from the public sources loaded by load.mjs; anything the data
// cannot support is left out and listed under coverage gaps. Calgary is treated like every other
// club: the writer knows nothing about any team beyond public LG data.
import { localDate, TZ } from './load.mjs';

export const WRITER_VERSION = 'lgchl-night-wrap/1';
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n) => (n >= 0 && n <= 10 ? WORDS[n] : String(n));
const Word = (n) => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };
const dash = (a, b) => a + '–' + b;
const list = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const svp = (sv, sa) => (sa > 0 ? (sv / sa).toFixed(3).replace(/^0/, '') : '—');
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
// Markdown-safe mention, gamertag kept byte-for-byte as LG lists it.
export const mdEscape = (s) => String(s).replace(/([\\`*_{}\[\]<>()#+!|~])/g, '\\$1');
export const mention = (tag) => '**@' + mdEscape(tag) + '**';
const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });

// Same public formula as lgchl-media.js / lgchl-leaders.js (documented on the page).
export function powerScore(s) {
  const gp = Math.max(1, Number(s.gp || 1)), pts = Number(s.pts || 0), gf = Number(s.gf || 0), ga = Number(s.ga || 0);
  return 100 * (0.70 * Math.min(1, pts / (2 * gp)) + 0.20 * Math.max(0, Math.min(1, ((gf - ga) / gp + 3) / 6)) + 0.10 * Math.max(0, Math.min(1, (gf / gp) / 6)));
}
export function rankTeams(rows) {
  return rows.filter((s) => Number(s.gp) >= 5)
    .map((s) => ({ ...s, score: powerScore(s), gdv: Number(s.gf || 0) - Number(s.ga || 0) }))
    .sort((a, b) => b.score - a.score || b.gdv - a.gdv || Number(b.gf) - Number(a.gf) || a.lg_team_id - b.lg_team_id)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
export function parseStreak(s) {
  const m = /^-?(\d+)\s*([WL])/i.exec(String(s || '').trim());
  return m ? { n: Number(m[1]), win: m[2].toUpperCase() === 'W' } : null;
}
const rec = (r) => [r.w, r.l, r.otl].join('-');

// ---------- standings: before/after the night, per-game OT detection ----------
function standingsWindow(ctx) {
  const { snapshots, nightGames, nightStart, nextStart } = ctx;
  const byTeam = new Map();
  for (const s of snapshots) { if (!byTeam.has(s.lg_team_id)) byTeam.set(s.lg_team_id, []); byTeam.get(s.lg_team_id).push(s); }
  for (const arr of byTeam.values()) arr.sort((a, b) => Date.parse(a.taken_at) - Date.parse(b.taken_at));
  const teamGames = new Map();
  for (const g of nightGames) for (const id of [g.away_lg_team_id, g.home_lg_team_id]) {
    if (!teamGames.has(id)) teamGames.set(id, []); teamGames.get(id).push(g);
  }
  for (const arr of teamGames.values()) arr.sort((a, b) => Date.parse(a.game_at) - Date.parse(b.game_at) || a.lg_game_id - b.lg_game_id);
  const out = new Map();
  for (const [id, tg] of teamGames) {
    const snaps = byTeam.get(id) || [];
    const before = [...snaps].reverse().find((s) => Date.parse(s.taken_at) < nightStart) || null;
    const during = snaps.filter((s) => Date.parse(s.taken_at) >= nightStart && (nextStart == null || Date.parse(s.taken_at) < nextStart));
    const after = during.length ? during[during.length - 1] : null;
    const ok = !!(before && after && after.gp - before.gp === tg.length);
    // k-th game of the night -> first snapshot whose gp = before.gp + k
    const perGame = new Map();
    if (ok) tg.forEach((g, k) => {
      const prevs = k === 0 ? [before] : during.filter((s) => s.gp === before.gp + k);
      const prev = prevs[prevs.length - 1];
      const cur = during.find((s) => s.gp === before.gp + k + 1);
      if (prev && cur) perGame.set(g.lg_game_id, { dw: cur.w - prev.w, dl: cur.l - prev.l, dotw: cur.otw - prev.otw, dotl: cur.otl - prev.otl });
    });
    const total = ok ? { dw: after.w - before.w, dl: after.l - before.l, dotw: after.otw - before.otw, dotl: after.otl - before.otl } : null;
    out.set(id, { before, after, ok, perGame, total, games: tg });
  }
  return out;
}

// Regulation or overtime, from LG's own W/L/OTW/OTL columns. Per-game snapshot deltas first; when a
// snapshot was skipped, the night totals still settle it if the team had no (or only) OT results.
// Both clubs' evidence must agree; anything else stays unlabelled.
function decidedIn(g, W, finals) {
  if (g.decided_in) return String(g.decided_in).toUpperCase();
  const side = (id, won) => {
    const t = W.get(id); if (!t?.ok) return null;
    const d = t.perGame.get(g.lg_game_id);
    if (d) {
      if (won && d.dw === 1) return d.dotw === 1 ? 'OT' : d.dotw === 0 ? 'REG' : null;
      if (!won && d.dl + d.dotl === 1 && d.dw === 0) return d.dotl === 1 ? 'OT' : 'REG';
      return null;
    }
    const n = finals.filter((x) => (won ? x.winner : x.loser) === id).length;
    const k = won ? t.total.dotw : t.total.dotl;
    if (won && t.total.dw !== n) return null;
    if (!won && t.total.dl + t.total.dotl !== n) return null;
    return k === 0 ? 'REG' : k === n ? 'OT' : null;
  };
  const a = side(g.winner, true), b = side(g.loser, false);
  if (a && b) return a === b ? a : null;
  return a || b || null;
}

// ---------- box scores: reconcile and attribute lines ----------
function teamShots(teamStats) {
  if (!Array.isArray(teamStats)) return null;
  const shots = [], goals = [];
  teamStats.forEach((v, i) => { if (v === 'shots') shots.push(num(teamStats[i + 1])); if (v === 'goals') goals.push(num(teamStats[i + 1])); });
  return shots.length === 2 && goals.length === 2 ? { away: { shots: shots[0], goals: goals[0] }, home: { shots: shots[1], goals: goals[1] } } : null;
}

function boxNight(ctx, teamName, seasonTeam) {
  const boxes = new Map(ctx.boxes.map((b) => [b.lg_game_id, b]));
  const linesBy = new Map();
  for (const l of ctx.lines) { if (!linesBy.has(l.lg_game_id)) linesBy.set(l.lg_game_id, []); linesBy.get(l.lg_game_id).push(l); }
  const games = new Map();
  for (const g of ctx.games.filter((x) => x.status === 'final' && boxes.has(x.lg_game_id))) {
    const b = boxes.get(g.lg_game_id), ls = linesBy.get(g.lg_game_id) || [];
    if (b.away_score !== g.away_score || b.home_score !== g.home_score || b.away_lg_team_id !== g.away_lg_team_id || b.home_lg_team_id !== g.home_lg_team_id) continue;
    const sideTeam = { away: g.away_lg_team_id, home: g.home_lg_team_id };
    const players = ls.map((l) => {
      let team = l.side && sideTeam[l.side] ? sideTeam[l.side] : null;
      if (!team && l.team_name) team = [g.away_lg_team_id, g.home_lg_team_id].find((id) => teamName(id) === l.team_name) || null;
      // Unlabelled line: attribute only if the player's public season team is one of the two clubs.
      if (!team) { const st = seasonTeam(l.gamertag); if ([g.away_lg_team_id, g.home_lg_team_id].includes(st)) team = st; }
      const goalie = l.position === 'G' || (num(l.shots_against) || 0) > 0;
      return { ...l, team, goalie, goals: num(l.goals) || 0, assists: num(l.assists) || 0, points: num(l.points) ?? ((num(l.goals) || 0) + (num(l.assists) || 0)),
        saves: num(l.saves) || 0, shots_against: num(l.shots_against) || 0, goals_against: num(l.goals_against) || 0, gwg: num(l.gwg) || 0, ppg: num(l.ppg) || 0, shg: num(l.shg) || 0 };
    });
    // A side is usable when its lines are complete (5+ players incl. a goalie) and its goals equal the official final.
    const sideOk = {};
    for (const [id, score] of [[g.away_lg_team_id, g.away_score], [g.home_lg_team_id, g.home_score]]) {
      const ps = players.filter((p) => p.team === id);
      sideOk[id] = ps.length >= 5 && ps.some((p) => p.goalie) && ps.reduce((a, p) => a + p.goals, 0) === score;
    }
    const reconciled = players.every((p) => p.team) && sideOk[g.away_lg_team_id] && sideOk[g.home_lg_team_id];
    games.set(g.lg_game_id, { game: g, players: players.filter((p) => p.team && sideOk[p.team]), sideOk, reconciled, shots: teamShots(b.team_stats) });
  }
  return games;
}

// ---------- main ----------
export function composeNightWrap(ctx, opts = {}) {
  const T = new Map(ctx.teams.map((t) => [t.lg_team_id, t]));
  const name = (id) => T.get(id)?.name || 'Team ' + id;
  const city = (id) => { const t = T.get(id); return t && t.nickname && t.name.endsWith(' ' + t.nickname) ? t.name.slice(0, -t.nickname.length - 1) : name(id); };
  const nick = (id) => T.get(id)?.nickname || name(id);
  const pending = ctx.nightGames.filter((g) => g.status !== 'final' || g.away_score == null || g.home_score == null);
  if (pending.length && !opts.allowPartial) return { ok: false, reason: pending.length + ' of ' + ctx.nightGames.length + ' games are not final yet', pending: pending.map((g) => g.lg_game_id) };
  // Partial nights: write the finals we have, but only when enough of the night is in (default 80%).
  const minFinalShare = opts.minFinalShare ?? 0.8;
  const finalShare = (ctx.nightGames.length - pending.length) / ctx.nightGames.length;
  if (pending.length && finalShare < minFinalShare) return { ok: false, reason: 'only ' + (ctx.nightGames.length - pending.length) + ' of ' + ctx.nightGames.length + ' games are final (' + Math.round(finalShare * 100) + '%, need ' + Math.round(minFinalShare * 100) + '%)', pending: pending.map((g) => g.lg_game_id) };
  const finals = ctx.nightGames.filter((g) => !pending.includes(g)).map((g) => {
    const awayWin = g.away_score > g.home_score;
    return { ...g, winner: awayWin ? g.away_lg_team_id : g.home_lg_team_id, loser: awayWin ? g.home_lg_team_id : g.away_lg_team_id, ws: Math.max(g.away_score, g.home_score), ls: Math.min(g.away_score, g.home_score) };
  });
  const nightEnd = ctx.lastStart + 3 * 3600e3;

  // Season stats (public view) — gamertag lookup. Freshness: only "as of the night" if fetched
  // after the last game and before the next game night started.
  const leaders = ctx.leaders || [];
  const skaterRows = leaders.filter((p) => p.player_kind === 'skater');
  const goalieRows = leaders.filter((p) => p.player_kind === 'goalie');
  const byTag = new Map();
  for (const p of leaders) { const k = p.player_kind + '|' + p.gamertag; if (!byTag.has(k)) byTag.set(k, []); byTag.get(k).push(p); }
  const one = (kind, tag) => { const r = byTag.get(kind + '|' + tag); return r && r.length === 1 ? r[0] : null; };
  const seasonTeam = (tag) => { const rows = [...(byTag.get('skater|' + tag) || []), ...(byTag.get('goalie|' + tag) || [])]; const ids = [...new Set(rows.map((r) => r.lg_team_id))]; return ids.length === 1 ? ids[0] : null; };
  const fresh = (p) => p && Date.parse(p.fetched_at) > nightEnd && (ctx.nextStart == null || Date.parse(p.fetched_at) < ctx.nextStart);
  const compRank = (rows, key, v) => 1 + rows.filter((x) => Number(x[key]) > v).length;
  const goalieSeason = new Map((ctx.goalieSeason || []).map((g) => [g.gamertag + '|' + g.lg_team_id, g]));

  const W = standingsWindow(ctx);
  const box = boxNight(ctx, name, seasonTeam);
  for (const g of finals) g.dec = decidedIn(g, W, finals);

  // Power index before / after the night (same formula as the LG Media page).
  const beforeRows = [...W.entries()].filter(([, v]) => v.before).map(([id, v]) => ({ ...v.before, lg_team_id: id }));
  const afterRows = [...W.entries()].filter(([, v]) => v.after && v.ok).map(([id, v]) => ({ ...v.after, lg_team_id: id }));
  const pBefore = new Map(rankTeams(beforeRows).map((t) => [t.lg_team_id, t]));
  const pAfter = new Map(rankTeams(afterRows).map((t) => [t.lg_team_id, t]));

  // Per-team night record.
  const night = new Map();
  for (const g of finals) for (const id of [g.winner, g.loser]) {
    if (!night.has(id)) night.set(id, { w: 0, l: 0, otl: 0, gf: 0, ga: 0, games: 0 });
    const r = night.get(id); r.games++;
    if (id === g.winner) { r.w++; r.gf += g.ws; r.ga += g.ls; } else { if (g.dec === 'OT') r.otl++; else r.l++; r.gf += g.ls; r.ga += g.ws; }
  }
  const teamNightGames = (id) => night.get(id)?.games || 0;
  // Losses with unknown decision count as L; flag so the record text can say so.
  const otUnknown = finals.filter((g) => !g.dec).length;

  // Upsets: winner sat 15+ spots below the loser in the pre-night index.
  const upsets = finals.map((g) => ({ g, wr: pBefore.get(g.winner)?.rank, lr: pBefore.get(g.loser)?.rank }))
    .filter((x) => x.wr && x.lr && x.wr - x.lr >= 15).sort((a, b) => (b.wr - b.lr) - (a.wr - a.lr) || a.g.lg_game_id - b.g.lg_game_id);

  // Conference top-4 (by points, before the night) for headline weighting.
  const confKey = (id) => (T.get(id)?.league || '') + ' ' + (T.get(id)?.conference || '');
  const confRankBefore = new Map();
  { const groups = new Map(); for (const r of beforeRows) { const k = confKey(r.lg_team_id); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    for (const arr of groups.values()) arr.sort((a, b) => b.pts - a.pts || a.gp - b.gp || b.w - a.w).forEach((r) => confRankBefore.set(r.lg_team_id, 1 + arr.filter((x) => x.pts > r.pts).length)); }

  // ---------- player nights from box scores (and stat history when available) ----------
  const nightIds = new Set(finals.map((g) => g.lg_game_id));
  const nightBoxes = [...box.values()].filter((b) => nightIds.has(b.game.lg_game_id) && b.players.length);
  const perf = new Map();
  for (const b of nightBoxes) for (const p of b.players) {
    const k = p.gamertag + '|' + p.team;
    if (!perf.has(k)) perf.set(k, { gamertag: p.gamertag, team: p.team, position: p.position, goalie: p.goalie, gp: 0, goals: 0, assists: 0, points: 0, saves: 0, sa: 0, ga: 0, gwg: 0, ppg: 0, shutouts: 0, hatTricks: 0, games: [] });
    const a = perf.get(k); a.gp++; a.goals += p.goals; a.assists += p.assists; a.points += p.points; a.gwg += p.gwg; a.ppg += p.ppg;
    if (p.goals >= 3) a.hatTricks++;
    if (p.goalie) { a.saves += p.saves; a.sa += p.shots_against; a.ga += p.goals_against;
      const opp = p.team === b.game.away_lg_team_id ? b.game.home_score : b.game.away_score;
      if (opp === 0 && p.goals_against === 0 && p.shots_against > 0) a.shutouts++; }
    a.games.push({ g: b.game, line: p });
  }
  // League-wide deltas from stat history (optional source).
  let historyNight = null;
  if (Array.isArray(ctx.history) && ctx.history.length) {
    const key = (h) => h.player_kind + '|' + h.gamertag; // season totals follow the player across trades
    const before = new Map(), after = new Map();
    for (const h of [...ctx.history].sort((a, b) => Date.parse(a.taken_at) - Date.parse(b.taken_at))) {
      const t = Date.parse(h.taken_at);
      if (t < ctx.nightStart) before.set(key(h), h);
      else if (ctx.nextStart == null || t < ctx.nextStart) after.set(key(h), h);
    }
    historyNight = [];
    for (const [k, a] of after) { const b = before.get(k); if (!b || a.gp <= b.gp) continue;
      historyNight.push({ gamertag: a.gamertag, team: a.lg_team_id, goalie: a.player_kind === 'goalie', gp: a.gp - b.gp, goals: a.goals - b.goals, assists: a.assists - b.assists, points: a.points - b.points,
        saves: (a.goalie_saves ?? 0) - (b.goalie_saves ?? 0), sa: (a.goalie_shots_against ?? 0) - (b.goalie_shots_against ?? 0), ga: (a.goalie_goals_against ?? 0) - (b.goalie_goals_against ?? 0), source: 'history' }); }
    if (!historyNight.length) historyNight = null;
  }
  // Prefer complete league-wide deltas when present; box lines still supply hat tricks/shutouts per game.
  const pool = historyNight ? historyNight.map((h) => ({ ...(perf.get(h.gamertag + '|' + h.team) || {}), ...h, hatTricks: perf.get(h.gamertag + '|' + h.team)?.hatTricks || 0, shutouts: perf.get(h.gamertag + '|' + h.team)?.shutouts || 0, games: perf.get(h.gamertag + '|' + h.team)?.games || [] })) : [...perf.values()];
  const skaterNight = pool.filter((p) => !p.goalie).sort((a, b) => b.points - a.points || b.goals - a.goals || b.gwg - a.gwg || a.gamertag.localeCompare(b.gamertag));
  const goalieNight = pool.filter((p) => p.goalie && p.sa >= 10).sort((a, b) => b.shutouts - a.shutouts || (b.saves / b.sa) - (a.saves / a.sa) || b.saves - a.saves || a.gamertag.localeCompare(b.gamertag));

  // Point streaks: consecutive team games, every one box-scored, player with a point in each.
  const teamSeq = new Map();
  for (const g of ctx.games.filter((x) => x.status === 'final' && Date.parse(x.game_at) <= ctx.lastStart)) for (const id of [g.away_lg_team_id, g.home_lg_team_id]) {
    if (!teamSeq.has(id)) teamSeq.set(id, []); teamSeq.get(id).push(g);
  }
  for (const a of teamSeq.values()) a.sort((x, y) => Date.parse(x.game_at) - Date.parse(y.game_at) || x.lg_game_id - y.lg_game_id);
  function pointStreak(tag, team) {
    const seq = teamSeq.get(team) || []; let n = 0;
    for (let i = seq.length - 1; i >= 0; i--) {
      const b = box.get(seq[i].lg_game_id);
      if (!b || !b.sideOk[team]) return { n, open: true };        // coverage gap: streak length is a floor
      const p = b.players.find((x) => x.gamertag === tag && x.team === team);
      if (!p || p.goalie || p.points === 0) return { n, open: false };
      n++;
    }
    return { n, open: false };
  }

  // ---------- story picks ----------
  const hatTricks = pool.filter((p) => p.hatTricks > 0 || (!p.goalie && p.games.some((x) => x.line.goals >= 3)));
  const shutouts = [];
  for (const b of nightBoxes) for (const p of b.players) if (p.goalie && p.goals_against === 0 && p.shots_against > 0 && (p.team === b.game.away_lg_team_id ? b.game.home_score : b.game.away_score) === 0) shutouts.push({ p, g: b.game });
  const teamShutouts = finals.filter((g) => g.ls === 0);

  const headlineScore = (g) => {
    let s = 0; const why = [];
    const u = upsets.find((x) => x.g === g); if (u) { s += 10 + (u.wr - u.lr) / 3; why.push('upset'); }
    if (g.dec === 'OT') { s += 5; why.push('overtime'); }
    const a = confRankBefore.get(g.winner), b = confRankBefore.get(g.loser);
    if (a && b && a <= 4 && b <= 4 && confKey(g.winner) === confKey(g.loser)) { s += 8; why.push('top-four clash'); }
    if (g.ws + g.ls >= 12) { s += 4; why.push('goal total'); }
    if (g.ls === 0) { s += 3; why.push('shutout'); }
    const bx = box.get(g.lg_game_id); if (bx?.reconciled && bx.players.some((p) => p.goals >= 3)) { s += 3; why.push('hat trick'); }
    return { s, why };
  };
  const ranked = finals.map((g) => ({ g, ...headlineScore(g) })).sort((a, b) => b.s - a.s || (b.g.ws + b.g.ls) - (a.g.ws + a.g.ls) || Date.parse(a.g.game_at) - Date.parse(b.g.game_at) || a.g.lg_game_id - b.g.lg_game_id);
  const headline = ranked[0];

  const sweeps = [...night.entries()].filter(([, r]) => r.games >= 3 && r.w === r.games).map(([id]) => id).sort((a, b) => name(a).localeCompare(name(b)));
  const zeroes = [...night.entries()].filter(([, r]) => r.games >= 3 && r.w === 0).map(([id]) => id).sort((a, b) => name(a).localeCompare(name(b)));
  const totalGoals = finals.reduce((a, g) => a + g.ws + g.ls, 0);
  const otGames = finals.filter((g) => g.dec === 'OT');

  // Streaks from LG standings strings after the night.
  const streakAfter = [...W.entries()].filter(([, v]) => v.ok).map(([id, v]) => ({ id, now: parseStreak(v.after.streak), was: parseStreak(v.before.streak) }));
  const heaters = streakAfter.filter((x) => x.now?.win && x.now.n >= 4).sort((a, b) => b.now.n - a.now.n || name(a.id).localeCompare(name(b.id)));
  const skids = streakAfter.filter((x) => x.now && !x.now.win && x.now.n >= 5).sort((a, b) => b.now.n - a.now.n || name(a.id).localeCompare(name(b.id)));
  const snapped = streakAfter.filter((x) => x.was?.win && x.was.n >= 4 && !(x.now?.win)).sort((a, b) => b.was.n - a.was.n);

  // Conference races: leader by points before vs after (ties shown as ties).
  const races = [];
  { const groups = new Map(); for (const [id, v] of W) if (v.ok) { const k = confKey(id); if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ id, b: v.before, a: v.after }); }
    for (const [k, arr] of [...groups.entries()].sort()) {
      const top = (key) => { const m = Math.max(...arr.map((x) => x[key].pts)); return arr.filter((x) => x[key].pts === m); };
      const ta = top('a'), tb = top('b');
      const sortedA = [...arr].sort((x, y) => y.a.pts - x.a.pts || x.a.gp - y.a.gp);
      races.push({ conf: k, leaders: ta.map((x) => x.id), leaderPts: ta[0].a.pts, newLeader: ta.length === 1 && !(tb.length === 1 && tb[0].id === ta[0].id) ? ta[0].id : null,
        gapToFifth: sortedA[4] ? ta[0].a.pts - sortedA[4].a.pts : null, top4: sortedA.slice(0, 4).map((x) => ({ id: x.id, pts: x.a.pts, rec: rec(x.a) })) });
    }
  }
  const movers = [...pAfter.values()].filter((t) => pBefore.has(t.lg_team_id)).map((t) => ({ id: t.lg_team_id, to: t.rank, from: pBefore.get(t.lg_team_id).rank, move: pBefore.get(t.lg_team_id).rank - t.rank, score: t.score }));
  const climbers = movers.filter((m) => m.move > 0 && m.to <= 25).sort((a, b) => b.move - a.move || a.to - b.to).slice(0, 3);
  const fallers = movers.filter((m) => m.move < 0 && m.from <= 25).sort((a, b) => a.move - b.move || a.from - b.from).slice(0, 3);
  const newNo1 = movers.find((m) => m.to === 1 && m.from !== 1);

  // ---------- spotlights ----------
  const seasonLine = (p) => {
    if (p.goalie) {
      const s = one('goalie', p.gamertag); if (!s || s.lg_team_id !== p.team) return null;
      const gs = goalieSeason.get(p.gamertag + '|' + p.team);
      const r = gs?.stats?.record, so = num(gs?.stats?.gso);
      const qual = goalieRows.filter((x) => Number(x.gp) >= 8 && x.save_pct != null);
      const rk = Number(s.gp) >= 8 && s.save_pct != null ? compRank(qual, 'save_pct', Number(s.save_pct)) : null;
      return { text: 'Season: ' + s.gp + ' GP, ' + svp(Number(s.save_pct) * 1000, 1000) + ' SV%, ' + Number(s.gaa).toFixed(2) + ' GAA' + (r ? ', ' + r + ' record' : '') + (so ? ', ' + plural(so, 'shutout') : '') +
        (rk ? ' — ' + ordinal(rk) + ' in LGCHL save percentage (8+ GP)' : '') + '.', fresh: fresh(s), row: s };
    }
    const s = one('skater', p.gamertag); if (!s || s.lg_team_id !== p.team) return null;
    const rk = compRank(skaterRows, 'points', Number(s.points)), gk = compRank(skaterRows, 'goals', Number(s.goals));
    return { text: 'Season: ' + s.goals + ' G, ' + s.assists + ' A, ' + s.points + ' PTS in ' + s.gp + ' GP — ' +
      ordinal(rk) + ' in LGCHL points, ' + ordinal(gk) + ' in goals.', fresh: fresh(s), row: s, rk, gk };
  };
  const covNote = (p) => (p.source !== 'history' && p.gp < teamNightGames(p.team) ? ' (' + p.gp + ' of ' + teamNightGames(p.team) + ' games box-scored)' : '');
  const nightLine = (p) => (p.goalie
    ? p.saves + ' saves on ' + p.sa + ' shots, ' + svp(p.saves, p.sa) + (p.gp > 1 ? ' across ' + word(p.gp) + ' games' : '') + (p.shutouts ? ', ' + (p.shutouts === 1 ? 'a shutout' : word(p.shutouts) + ' shutouts') : '')
    : p.goals + ' G, ' + p.assists + ' A, ' + p.points + ' PTS' + (p.gp > 1 ? ' in ' + word(p.gp) + ' games' : '') + (p.hatTricks ? (p.hatTricks === 1 ? ', including a hat trick' : ', ' + word(p.hatTricks) + ' hat tricks') : '') + (p.gwg ? ', ' + plural(p.gwg, 'game-winner') : '')) + covNote(p);
  const spot = [];
  const used = new Set();
  const pushSpot = (p, why) => { if (!p) return; const k = p.gamertag + '|' + p.team; if (used.has(k)) return; used.add(k); spot.push({ p, why, season: seasonLine(p), streak: p.goalie ? null : pointStreak(p.gamertag, p.team) }); };
  // Spread spotlights across clubs when the data allows it.
  const fresher = (arr) => arr.find((p) => !used.has(p.gamertag + '|' + p.team) && !spot.some((s) => s.p.team === p.team)) || arr.find((p) => !used.has(p.gamertag + '|' + p.team));
  pushSpot(skaterNight[0], 'Top scorer of the night');
  pushSpot(fresher(hatTricks), 'Hat trick');
  pushSpot(fresher(goalieNight), 'Goalie of the night');
  if (spot.length < 3) pushSpot(fresher(skaterNight.filter((p) => p.points >= 3)), 'Standout');

  // Milestones reached tonight: season total crossed a round number, with fresh season stats.
  const MARKS = { points: [10, 20, 25, 30, 40, 50, 60, 75, 100], goals: [10, 15, 20, 25, 30, 40, 50], assists: [10, 20, 25, 30, 40, 50, 75] };
  const milestones = [];
  // Only when every one of the player's team games tonight is covered, so "before" is exact.
  for (const p of skaterNight) { const s = one('skater', p.gamertag); if (!s || s.lg_team_id !== p.team || !fresh(s)) continue;
    if (p.source !== 'history' && p.gp < teamNightGames(p.team)) continue;
    let best = null;
    for (const [k, marks] of Object.entries(MARKS)) for (const m of marks) if (Number(s[k]) - p[k] < m && Number(s[k]) >= m && (!best || m > best.m || (m === best.m && k === 'goals'))) best = { p, k, m, total: Number(s[k]) };
    if (best) milestones.push(best); }
  milestones.sort((a, b) => b.m - a.m || a.p.gamertag.localeCompare(b.p.gamertag));

  // ---------- headline + dek ----------
  const H = headline.g;
  const scoreText = (g) => name(g.winner) + ' ' + g.ws + ', ' + name(g.loser) + ' ' + g.ls + (g.dec === 'OT' ? ' (OT)' : '');
  const hBox = box.get(H.lg_game_id);
  const hStar = hBox?.reconciled ? [...hBox.players].filter((p) => !p.goalie && p.team === H.winner).sort((a, b) => b.points - a.points || b.goals - a.goals)[0] : null;
  const hU = upsets.find((x) => x.g === H);
  let title;
  if (hU) title = city(H.winner) + ' Stun ' + city(H.loser) + ' ' + dash(H.ws, H.ls) + (H.dec === 'OT' ? ' in Overtime' : '');
  else if (H.ls === 0) title = city(H.winner) + ' Blank ' + city(H.loser) + ' ' + dash(H.ws, 0);
  else title = city(H.winner) + ' Edge ' + city(H.loser) + ' ' + dash(H.ws, H.ls) + (H.dec === 'OT' ? ' in Overtime' : '');
  if (H.ws - H.ls >= 4 && !hU && H.ls !== 0) title = city(H.winner) + ' Rout ' + city(H.loser) + ' ' + dash(H.ws, H.ls);
  title += sweeps.length ? '; ' + Word(sweeps.length) + (sweeps.length === 1 ? ' Club Sweeps' : ' Clubs Sweep') + ' the Night' : '';
  const dayMs = ctx.nightStart;
  const dekText = finals.length + ' LGCHL finals on ' + fmtDay(dayMs) + (finals[0]?.week ? ' (Week ' + finals[0].week + ')' : '') + ': ' + totalGoals + ' goals, ' +
    plural(otGames.length, 'overtime game') + (otUnknown ? ' identified' : '') + ', ' + plural(teamShutouts.length, 'shutout') + '. ' +
    (sweeps.length ? list(sweeps.map(name)) + (sweeps.length === 1 ? ' went ' : ' each went ') + '3-0.' : 'No club swept the night.');

  // ---------- markdown ----------
  const md = [];
  const raceMentions = [];
  const leagueOrder = ['WHL', 'OHL', 'QMJHL'];
  md.push('---', 'status: draft', 'desk: LGCHL Media', 'kind: night-wrap', 'night: ' + ctx.night, 'season: ' + ctx.season, 'week: ' + (finals[0]?.week ?? ''), 'generator: ' + WRITER_VERSION, 'published: false', '---', '');
  md.push('*LGCHL Media · Night wrap · ' + fmtDay(dayMs) + '*', '', '# ' + title, '', dekText, '');

  md.push('## Game of the night', '');
  md.push('**' + scoreText(H) + '** · ' + (T.get(H.winner)?.league || '') + ' · ' + fmtTime(Date.parse(H.game_at)) + ' ET', '');
  { const bits = [];
    if (hU) bits.push('The ' + name(H.winner) + ' entered the night ' + ordinal(hU.wr) + ' in the Elitechel power index; the ' + name(H.loser) + ' were ' + ordinal(hU.lr) + '.');
    const a = confRankBefore.get(H.winner), b = confRankBefore.get(H.loser);
    if (a && b && confKey(H.winner) === confKey(H.loser)) bits.push('Both play in the ' + confKey(H.winner).trim() + ' conference; they started the night ' + ordinal(a) + ' and ' + ordinal(b) + ' on points.');
    if (H.dec === 'OT') bits.push('It needed overtime.');
    if (hBox?.reconciled && hBox.shots) { const ws = H.winner === H.away_lg_team_id ? hBox.shots.away.shots : hBox.shots.home.shots, ls = H.winner === H.away_lg_team_id ? hBox.shots.home.shots : hBox.shots.away.shots; if (ws != null && ls != null) bits.push('Shots were ' + dash(ws, ls) + ' ' + (ws >= ls ? 'for' : 'against') + ' the winners.'); }
    if (hStar && hStar.points) bits.push(mention(hStar.gamertag) + ' led the ' + nick(H.winner) + ' with ' + hStar.goals + ' G and ' + hStar.assists + ' A.');
    const wa = W.get(H.winner), la = W.get(H.loser);
    if (wa?.ok && la?.ok) bits.push(name(H.winner) + ' finished the night ' + rec(wa.after) + ' (' + wa.after.pts + ' pts); ' + name(H.loser) + ' ' + rec(la.after) + ' (' + la.after.pts + ' pts).');
    md.push(bits.join(' ') || 'Picked by rule: upsets, overtime, conference top-four meetings, goal totals and shutouts.', '');
    if (H.source_url) md.push('[Box score on LeagueGaming](' + H.source_url + ')', ''); }

  md.push('## Top performers', '');
  const coverage = nightBoxes.length;
  const fullCoverage = nightBoxes.filter((b) => b.reconciled).length;
  if (!historyNight) md.push('_Player lines are available for ' + coverage + ' of ' + finals.length + ' games tonight (published LG box scores imported so far). Leaders below are from those games only._', '');
  if (skaterNight.length) {
    md.push('| Player | Team | Night | ', '|---|---|---|');
    skaterNight.filter((p) => p.points > 0).slice(0, 8).forEach((p) => md.push('| ' + mention(p.gamertag) + ' | ' + name(p.team) + ' | ' + nightLine(p) + ' |'));
    md.push('');
  } else md.push('No player lines are available for tonight\'s games yet.', '');
  const multi = skaterNight.filter((p) => p.points >= 3);
  if (multi.length) md.push('**Three-point nights or better:** ' + list(multi.map((p) => mention(p.gamertag) + ' (' + p.points + ')')) + '.', '');
  if (hatTricks.length) md.push('**Hat tricks:** ' + list(hatTricks.map((p) => mention(p.gamertag) + ' (' + name(p.team) + ')')) + '.', '');
  if (goalieNight.length) md.push('**In goal (10+ shots):** ' + list(goalieNight.slice(0, 4).map((p) => mention(p.gamertag) + ' ' + p.saves + '/' + p.sa + ' (' + svp(p.saves, p.sa) + ')')) + '.', '');
  if (teamShutouts.length) md.push('**Shutouts (' + teamShutouts.length + '):** ' + list(teamShutouts.map((g) => { const s = shutouts.find((x) => x.g.lg_game_id === g.lg_game_id); return name(g.winner) + ' ' + dash(g.ws, 0) + ' over ' + name(g.loser) + (s ? ' (' + mention(s.p.gamertag) + ', ' + plural(s.p.saves, 'save') + ')' : ''); })) + '.', '');

  // Players of the Night: same rule as the LG Media page (lgchl-media-segments.js).
  md.push('## Players of the Night', '');
  { const stars = skaterNight.filter((p) => p.points > 0).slice(0, 3);
    const gotn = pool.filter((p) => p.goalie && p.sa >= 50).sort((a, b) => (b.saves / b.sa) - (a.saves / a.sa) || b.saves - a.saves || a.gamertag.localeCompare(b.gamertag))[0];
    if (!stars.length && !gotn) md.push('No player totals are available for this night yet.', '');
    else {
      stars.forEach((p, i) => md.push('**' + ['First', 'Second', 'Third'][i] + ' star:** ' + mention(p.gamertag) + ' (' + name(p.team) + ') — ' + nightLine(p) + '.'));
      if (gotn) md.push('**Goalie of the night:** ' + mention(gotn.gamertag) + ' (' + name(gotn.team) + ') — ' + gotn.saves + ' saves on ' + gotn.sa + ' shots, ' + svp(gotn.saves, gotn.sa) + (gotn.gp > 1 ? ' across ' + word(gotn.gp) + ' games' : '') + ' (50+ shots faced).');
      md.push('');
      if (historyNight) { const g = historyNight.filter((p) => !p.goalie).reduce((a, p) => a + p.goals, 0), fg = finals.reduce((a, x) => a + x.ws + x.ls, 0);
        md.push('_From LG season totals saved before and after the night: ' + g + ' of ' + fg + ' goals accounted for' + (fg ? ' (' + Math.round(100 * g / fg) + '%)' : '') + '; players without a saved pre-night total are not ranked._', ''); }
    } }

  md.push('## Player spotlights', '');
  if (!spot.length) md.push('No spotlight tonight: no player lines are available yet.', '');
  else if (!historyNight && coverage < finals.length) md.push('_Picked from the ' + coverage + ' box-scored games._', '');
  for (const s of spot) {
    const p = s.p;
    md.push('### ' + mention(p.gamertag) + ' · ' + (p.goalie ? 'G' : p.position || 'Skater') + ' · ' + name(p.team), '', '*' + s.why + '*', '');
    const games = p.games.map((x) => { const g = x.g, opp = g.away_lg_team_id === p.team ? g.home_lg_team_id : g.away_lg_team_id, us = g.away_lg_team_id === p.team ? g.away_score : g.home_score, them = g.away_lg_team_id === p.team ? g.home_score : g.away_score;
      const l = x.line, dec = finals.find((f) => f.lg_game_id === g.lg_game_id)?.dec; return (us > them ? 'W ' : 'L ') + dash(us, them) + (dec === 'OT' ? ' (OT)' : '') + ' vs ' + city(opp) + ': ' + (p.goalie ? l.saves + '/' + l.shots_against : l.goals + 'G ' + l.assists + 'A'); });
    md.push('**Tonight:** ' + nightLine(p) + '.' + (games.length ? ' ' + games.join(' · ') + '.' : ''), '');
    if (s.season) md.push('**' + (s.season.fresh ? 'After tonight' : 'Season (LG stats as of ' + new Date(s.season.row.fetched_at).toLocaleDateString('en-CA', { timeZone: TZ }) + ')') + ':** ' + s.season.text.replace(/^Season: /, ''), '');
    if (s.streak && s.streak.n >= 3) md.push('**Streak:** points in ' + (s.streak.open ? 'at least ' : '') + s.streak.n + ' straight box-scored games.', '');
  }

  md.push('## The scoring race', '');
  { const asOf = leaders.map((p) => p.fetched_at).filter(Boolean).sort().pop();
    const fr = asOf && Date.parse(asOf) > nightEnd && (ctx.nextStart == null || Date.parse(asOf) < ctx.nextStart);
    const topBy = (rows, k, n) => [...rows].filter((x) => x[k] != null).sort((a, b) => Number(b[k]) - Number(a[k]) || Number(a.gp) - Number(b.gp) || a.gamertag.localeCompare(b.gamertag)).slice(0, n);
    const row = (p, k) => mention(p.gamertag) + ' (' + (T.get(p.lg_team_id)?.abbr || p.team_name || '') + ') ' + p[k];
    md.push('_LG Season 55 player stats ' + (fr ? 'after tonight' : 'as of ' + (asOf ? new Date(asOf).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : 'the latest sync')) + '._', '');
    md.push('- **Points:** ' + topBy(skaterRows, 'points', 3).map((p) => row(p, 'points') + ' in ' + p.gp + ' GP').join(' · '));
    md.push('- **Goals:** ' + topBy(skaterRows, 'goals', 3).map((p) => row(p, 'goals')).join(' · '));
    md.push('- **Assists:** ' + topBy(skaterRows, 'assists', 3).map((p) => row(p, 'assists')).join(' · '));
    const gq = goalieRows.filter((x) => Number(x.gp) >= 8 && x.save_pct != null);
    md.push('- **Save % (8+ GP):** ' + topBy(gq, 'save_pct', 3).map((p) => mention(p.gamertag) + ' (' + (T.get(p.lg_team_id)?.abbr || '') + ') ' + svp(Number(p.save_pct) * 1000, 1000) + ', ' + Number(p.gaa).toFixed(2) + ' GAA').join(' · '), '');
    for (const p of topBy(skaterRows, 'points', 3)) raceMentions.push(p.gamertag);
  }

  md.push('## Streaks & milestones', '');
  const sl = [];
  if (heaters.length) sl.push('**Win streaks:** ' + list(heaters.slice(0, 5).map((x) => name(x.id) + ' ' + x.now.n)) + '.');
  if (snapped.length) sl.push('**Snapped:** ' + list(snapped.slice(0, 4).map((x) => name(x.id) + ' (had won ' + x.was.n + ' straight)')) + '.');
  if (skids.length) sl.push('**Skids:** ' + list(skids.slice(0, 4).map((x) => name(x.id) + ' ' + x.now.n + ' straight losses')) + '.');
  for (const m of milestones.slice(0, 6)) sl.push(mention(m.p.gamertag) + ' (' + name(m.p.team) + ') reached ' + m.m + ' ' + m.k + ' tonight; ' + m.total + ' on the season.');
  for (const s of spot) if (s.streak && s.streak.n >= 5) sl.push(mention(s.p.gamertag) + ' has a point in ' + (s.streak.open ? 'at least ' : '') + s.streak.n + ' straight box-scored games.');
  md.push(sl.length ? sl.join('\n\n') : 'No team streak of four wins or more after tonight.', '');

  md.push('## Standings movers', '');
  const ml = [];
  if (newNo1) ml.push('**New No. 1:** the ' + name(newNo1.id) + ' move up from ' + ordinal(newNo1.from) + ' to the top of the Elitechel power index.');
  if (climbers.length) ml.push('**Climbing:** ' + list(climbers.map((m) => name(m.id) + ' ' + ordinal(m.from) + '→' + ordinal(m.to) + ' (' + rec(night.get(m.id) || { w: 0, l: 0, otl: 0 }) + ' tonight)')) + '.');
  if (fallers.length) ml.push('**Sliding:** ' + list(fallers.map((m) => name(m.id) + ' ' + ordinal(m.from) + '→' + ordinal(m.to) + ' (' + rec(night.get(m.id) || { w: 0, l: 0, otl: 0 }) + ' tonight)')) + '.');
  if (zeroes.length) ml.push('**Winless tonight:** ' + list(zeroes.map(name)) + '.');
  md.push(ml.join('\n\n') || 'No power-index movement to report.', '');
  md.push('### The races', '');
  md.push('| Conference | Leader | Pts | Top four | Lead over 5th |', '|---|---|---|---|---|');
  for (const r of races) md.push('| ' + r.conf.trim() + ' | ' + (r.leaders.length > 1 ? 'Tie: ' + list(r.leaders.map(nick)) : nick(r.leaders[0]) + (r.newLeader ? ' (new)' : '')) + ' | ' + r.leaderPts + ' | ' + r.top4.map((x) => T.get(x.id)?.abbr || nick(x.id)).join(', ') + ' | ' + (r.gapToFifth ?? '—') + ' |');
  md.push('', '_Races ranked by points after the night (LG tiebreakers not applied). Power index = 70% points percentage + 20% goal differential per game + 10% goals per game, minimum 5 GP, same formula as the LG Media page._', '');

  md.push('## Upset alert', '');
  if (upsets.length) md.push(plural(upsets.length, 'game') + ' met the upset rule (winner 15+ spots lower in the pre-night power index). The biggest gaps:', '');
  md.push(upsets.length ? upsets.slice(0, 5).map((u) => '- ' + name(u.g.winner) + ' (' + ordinal(u.wr) + ') beat ' + name(u.g.loser) + ' (' + ordinal(u.lr) + ') ' + dash(u.g.ws, u.g.ls) + (u.g.dec === 'OT' ? ' in OT' : '')).join('\n') : 'No winner sat 15 or more spots below its opponent in the power index tonight.', '');

  md.push('## All finals', '');
  for (const lg of leagueOrder) {
    const gs = finals.filter((g) => T.get(g.home_lg_team_id)?.league === lg || (T.get(g.home_lg_team_id)?.league !== lg && T.get(g.away_lg_team_id)?.league === lg && !leagueOrder.includes(T.get(g.home_lg_team_id)?.league)));
    if (!gs.length) continue;
    md.push('### ' + lg, '', '| Time (ET) | Away | | Home | |', '|---|---|---|---|---|');
    for (const g of gs.sort((a, b) => Date.parse(a.game_at) - Date.parse(b.game_at) || name(a.away_lg_team_id).localeCompare(name(b.away_lg_team_id)))) {
      const bold = (id, s) => (id === g.winner ? '**' + name(id) + ' ' + s + '**' : name(id) + ' ' + s);
      const notes = [g.dec === 'OT' ? 'OT' : null, upsets.some((u) => u.g === g) ? 'upset' : null, g.ls === 0 ? 'shutout' : null, box.get(g.lg_game_id)?.reconciled ? 'box score' : null].filter(Boolean).join(', ');
      md.push('| ' + fmtTime(Date.parse(g.game_at)) + ' | ' + bold(g.away_lg_team_id, g.away_score) + ' | @ | ' + bold(g.home_lg_team_id, g.home_score) + ' | ' + notes + ' |');
    }
    md.push('');
  }
  const crossLeague = finals.filter((g) => !leagueOrder.includes(T.get(g.home_lg_team_id)?.league) && !leagueOrder.includes(T.get(g.away_lg_team_id)?.league));
  if (crossLeague.length) md.push('Other: ' + crossLeague.map(scoreText).join('; ') + '.', '');

  const mentions = [...new Set([...skaterNight.filter((p) => p.points > 0).slice(0, 8), ...goalieNight.slice(0, 4), ...spot.map((s) => s.p)].map((p) => p.gamertag), ...raceMentions)];
  md.push('## Mentions', '', mentions.length ? mentions.map(mention).join(' · ') : '—', '');

  const gaps = [];
  if (!historyNight) gaps.push('Player lines cover ' + coverage + ' of ' + finals.length + ' games (' + fullCoverage + ' with both teams); the rest of the league has finals only until league-wide box scores or stat history are imported.');
  if (otUnknown) gaps.push(otUnknown + ' game(s) could not be confirmed as regulation or overtime from the standings snapshots, so they carry no OT label.');
  // Unreported games are listed by schedule only; no result is ever inferred for them.
  if (pending.length) gaps.push('Not yet reported (' + pending.length + '): ' + pending.slice().sort((a, b) => Date.parse(a.game_at) - Date.parse(b.game_at) || a.lg_game_id - b.lg_game_id)
    .map((g) => name(g.away_lg_team_id) + ' at ' + name(g.home_lg_team_id) + ', scheduled ' + fmtTime(Date.parse(g.game_at)) + ' ET (LG game ' + g.lg_game_id + ')').join('; ') + '. ' + (pending.length === 1 ? 'This game is' : 'These games are') + ' left out of every total, streak and standings line above until LG posts a final.');
  const stale = [...W.values()].filter((v) => !v.ok).length; if (stale) gaps.push(stale + ' team(s) lacked before/after standings snapshots and are left out of movers and races.');
  md.push('## Sources & coverage', '', '- Finals and schedule: official LG LGCHL schedule (lgchl_games).', '- Standings, streaks and records: LG standings snapshots before and after the night.',
    '- Player lines: published LG box scores' + (historyNight ? ' plus LG season-stat deltas across the night' : '') + '.', '- Season context: LG LGCHL Season 55 player stats.', ...gaps.map((g) => '- Gap: ' + g), '', '_Draft generated ' + (opts.generatedAt || new Date().toISOString()) + ' by ' + WRITER_VERSION + '. Not published._', '');

  // ---------- LG Media page cards (same shape as lgchl-media.js story cards) ----------
  const cards = [];
  cards.push({ slot: 'lead', tag: 'Night wrap', lg_team_id: H.winner, league: T.get(H.winner)?.league || 'LGCHL', title, text: dekText });
  for (const s of spot) cards.push({ slot: 'spotlight', tag: s.why, lg_team_id: s.p.team, league: T.get(s.p.team)?.league || 'LGCHL', title: '@' + s.p.gamertag + ': ' + nightLine(s.p), text: s.season ? s.season.text : '', mention: s.p.gamertag });
  if (heaters[0]) cards.push({ slot: 'streak', tag: 'Streak', lg_team_id: heaters[0].id, league: T.get(heaters[0].id)?.league, title: name(heaters[0].id) + ': ' + heaters[0].now.n + ' straight wins', text: rec(W.get(heaters[0].id).after) + ' overall after tonight.' });
  if (climbers[0]) cards.push({ slot: 'mover', tag: 'Power index', lg_team_id: climbers[0].id, league: T.get(climbers[0].id)?.league, title: name(climbers[0].id) + ' jump ' + climbers[0].move + ' spots', text: 'From ' + ordinal(climbers[0].from) + ' to ' + ordinal(climbers[0].to) + ' after going ' + rec(night.get(climbers[0].id)) + ' tonight.' });
  const scores = finals.map((g) => ({ lg_game_id: g.lg_game_id, game_at: g.game_at, league: T.get(g.home_lg_team_id)?.league, away_lg_team_id: g.away_lg_team_id, away_score: g.away_score, home_lg_team_id: g.home_lg_team_id, home_score: g.home_score, decided_in: g.dec, upset: upsets.some((u) => u.g === g), source_url: g.source_url }));

  return {
    ok: true, kind: 'night-wrap', night: ctx.night, season: ctx.season, title, dek: dekText, markdown: md.join('\n'), cards, scores, mentions,
    metrics: { finals: finals.length, goals: totalGoals, ot_games: otGames.length, ot_unknown: otUnknown, shutouts: teamShutouts.length, sweeps: sweeps.map(name), box_scored_games: coverage, box_scored_both_sides: fullCoverage,
      history_deltas: !!historyNight, scheduled_games: ctx.nightGames.length, not_reported: pending.map((g) => g.lg_game_id), headline_game: H.lg_game_id, headline_reasons: headline.why, upsets: upsets.length, generator: WRITER_VERSION },
  };
}
