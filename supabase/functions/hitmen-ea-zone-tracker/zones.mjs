// Pure helpers for the EA zone tracker (unit-testable without Deno or the network).
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Normalise /members/stats into { name: { gp, skshots, skgoals, shots[16], goals[16] } }. */
export function parseMembers(payload) {
  const list = Array.isArray(payload?.members) ? payload.members : Array.isArray(payload) ? payload : [];
  const out = {};
  for (const m of list) {
    const name = String(m?.name || m?.playername || '').trim(); if (!name) continue;
    const shots = Array(16).fill(0), goals = Array(16).fill(0);
    for (const [k, v] of Object.entries(m)) {
      const s = /^(?:sk)?shotslocationonice(\d{1,2})$/i.exec(k), g = /^(?:sk)?goalslocationonice(\d{1,2})$/i.exec(k);
      if (s && +s[1] >= 1 && +s[1] <= 16) shots[+s[1] - 1] = num(v);
      if (g && +g[1] >= 1 && +g[1] <= 16) goals[+g[1] - 1] = num(v);
    }
    out[name] = { gp: num(m.skgp ?? m.gamesplayed), skshots: num(m.skshots), skgoals: num(m.skgoals), shots, goals };
  }
  return out;
}

/**
 * Derive one match's zone counts for one club from a before/after snapshot pair.
 * matchPlayers = raw_payload.players[clubId] from the EA match. A player's delta is kept only when
 * games played went up by exactly 1 and the zone deltas sum to that player's shots/goals in the match.
 */
export function zoneDelta(before, after, matchPlayers) {
  const rows = [], rejected = [];
  for (const p of Object.values(matchPlayers || {})) {
    if (p.position === 'goalie') continue;
    const name = String(p.playername || '').trim(), b = before[name], a = after[name];
    if (!b || !a) { rejected.push({ name, why: 'missing snapshot' }); continue; }
    if (a.gp - b.gp !== 1) { rejected.push({ name, why: 'gp delta ' + (a.gp - b.gp) }); continue; }
    const ds = a.shots.map((v, i) => v - b.shots[i]), dg = a.goals.map((v, i) => v - b.goals[i]);
    if (ds.some((v) => v < 0) || dg.some((v) => v < 0)) { rejected.push({ name, why: 'negative delta' }); continue; }
    const sumS = ds.reduce((x, y) => x + y, 0), sumG = dg.reduce((x, y) => x + y, 0);
    if (sumS !== num(p.skshots) || sumG !== num(p.skgoals)) { rejected.push({ name, why: `zone sums ${sumS}/${sumG} vs match ${p.skshots}/${p.skgoals}` }); continue; }
    ds.forEach((c, i) => c > 0 && rows.push({ player: name, event_type: 'shot_zone', ice_zone: i + 1, event_count: c }));
    dg.forEach((c, i) => c > 0 && rows.push({ player: name, event_type: 'goal_zone', ice_zone: i + 1, event_count: c }));
  }
  return { rows, rejected };
}

/** A snapshot pair is usable only if the club played exactly this match between the two captures. */
export function windowHasOnlyMatch(matches, matchId, fromIso, toIso) {
  const from = Date.parse(fromIso) / 1000, to = Date.parse(toIso) / 1000;
  const inWin = (matches || []).filter((m) => num(m.timestamp) > from && num(m.timestamp) <= to);
  return inWin.length === 1 && String(inWin[0].matchId) === String(matchId);
}
