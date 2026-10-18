// Evidence layer for the Hitmen recap writer. Pure and deterministic: every sentence below is built
// from (a) the EA NHL club match record(s) linked to the LG game (hitmen_opponent_ea_games, matched
// by lg_game_id and reconciled to the official final), and (b) the management-approved VOD Scout
// review published for that game (vod_game_publications.report, active = true).
// Any section whose data is missing, or EA data that does not reconcile with the LG final, is omitted.

const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.round(s) % 60).padStart(2, '0');
const dash = (a, b) => a + '–' + b;
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : null);
const list = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
// Stable phrase choice per game so the same game always renders the same text, but games vary.
const pick = (seed, salt, opts) => opts[Math.abs(hash(seed + ':' + salt)) % opts.length];
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

const isCalgaryClub = (club) => /calgary hitmen/i.test(String(club?.details?.name || ''));

/**
 * Merge one or more EA match rows (a disconnect can split one LG game into several EA matches)
 * into per-side totals. Returns null when the Calgary club cannot be identified or the summed
 * EA score does not equal the official LG final.
 */
export function mergeEaMatches(rows, final) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const sides = { C: blank(), O: blank() };
  const matchIds = [];
  for (const r of rows) {
    const raw = r?.raw_payload; if (!raw?.clubs || !raw?.players) return null;
    const ids = Object.keys(raw.clubs); const cId = ids.find((id) => isCalgaryClub(raw.clubs[id]));
    const oId = ids.find((id) => id !== cId); if (!cId || !oId) return null;
    matchIds.push(String(raw.matchId || r.source_game_id));
    for (const [key, id] of [['C', cId], ['O', oId]]) {
      const club = raw.clubs[id], side = sides[key];
      side.goals += n(club.goals); side.shots += n(club.shots); side.toa += n(club.toa);
      side.passa += n(club.passa); side.passc += n(club.passc); side.ppg += n(club.ppg); side.ppo += n(club.ppo);
      for (const p of Object.values(raw.players[id] || {})) addPlayer(side, p);
    }
  }
  if (sides.C.goals !== final.cs || sides.O.goals !== final.os) return null;
  return { ...sides, matchIds, split: rows.length > 1 };
}
function blank() { return { goals: 0, shots: 0, toa: 0, passa: 0, passc: 0, ppg: 0, ppo: 0, hits: 0, tk: 0, gv: 0, int: 0, att: 0, sog: 0, bs: 0, fow: 0, fol: 0, poss: 0, defl: 0, players: {} }; }
function addPlayer(side, p) {
  const name = String(p.playername || '').trim(); if (!name) return;
  const goalie = p.position === 'goalie';
  const q = side.players[name] ||= { name, goalie, hits: 0, tk: 0, gv: 0, int: 0, att: 0, sog: 0, bs: 0, fow: 0, fol: 0, poss: 0, defl: 0, saves: 0, sa: 0, brk: 0, brkS: 0 };
  if (goalie) { q.saves += n(p.glsaves); q.sa += n(p.glshots); q.brk += n(p.glbrksaves); q.brkS += n(p.glbrkshots); return; }
  const add = { hits: p.skhits, tk: p.sktakeaways, gv: p.skgiveaways, int: p.skinterceptions, att: p.skshotattempts, sog: p.skshots, bs: p.skbs, fow: p.skfow, fol: p.skfol, poss: p.skpossession, defl: p.skdeflections };
  for (const [k, v] of Object.entries(add)) { q[k] += n(v); side[k] += n(v); }
}

const leader = (side, k, min = 1) => Object.values(side.players).filter((p) => !p.goalie && p[k] >= min).sort((a, b) => (b[k] - a[k]) || a.name.localeCompare(b.name))[0] || null;

function eaSections(ea, ctx) {
  const { C, O } = ea, o = ctx.oNick, seed = ctx.lgGameId, out = [];
  // Shot quality proxy: attempts vs on goal vs blocked. (EA club data has no x/y shot locations.)
  // EA's per-player shot fields do not always sum to the club shot total, so only attempts and blocks
  // are quoted here; shots on goal stay with the official LG line in "By the numbers".
  const shotLines = [];
  if (C.att + O.att > 0) {
    shotLines.push(pick(seed, 'att', [
      `EA credited Calgary with ${C.att} shot attempts to ${O.att} for ${o}.`,
      `The attempt count read ${dash(C.att, O.att)} ${C.att >= O.att ? 'in Calgary\'s favour' : 'for ' + o}.`,
    ]));
    if (O.bs + C.bs > 0) shotLines.push(`${o} blocked ${O.bs} Calgary shot${O.bs === 1 ? '' : 's'}; Calgary blocked ${C.bs}.`);
    if (C.defl + O.defl) shotLines.push(`Deflections: Calgary ${C.defl}, ${o} ${O.defl}.`);
  }
  if (shotLines.length) out.push('## Shot profile\n' + shotLines.join(' '));

  // Puck control: TOA, passing, possession leaders.
  const ctl = [];
  if (C.toa + O.toa > 0) {
    const share = pct(C.toa, C.toa + O.toa);
    ctl.push(pick(seed, 'toa', [
      `Calgary owned ${share}% of the time on attack (${mmss(C.toa)} to ${mmss(O.toa)}).`,
      `Time on attack split ${mmss(C.toa)} to ${mmss(O.toa)}, ${share >= 50 ? 'a ' + share + '% share for Calgary' : 'leaving Calgary with just ' + share + '% of it'}.`,
    ]));
  }
  if (C.passa && O.passa) ctl.push(`Calgary completed ${C.passc} of ${C.passa} passes (${pct(C.passc, C.passa)}%), ${o} ${O.passc} of ${O.passa} (${pct(O.passc, O.passa)}%).`);
  const pl = leader(C, 'poss', 30);
  if (pl) ctl.push(`${pl.name} carried the puck longest for Calgary at ${mmss(pl.poss)} of possession.`);
  if (ctl.length) out.push('## Puck control\n' + ctl.join(' '));

  // Battle stats.
  const bat = [];
  if (C.hits + O.hits) bat.push(`Hits ${dash(C.hits, O.hits)}, takeaways ${dash(C.tk, O.tk)}, giveaways ${dash(C.gv, O.gv)} and interceptions ${dash(C.int, O.int)}, Calgary first.`);
  // One clause per player so a name never repeats in the same sentence.
  const byName = new Map();
  for (const [k, min, txt] of [['hits', 2, (v) => v + ' hits'], ['tk', 2, (v) => v + ' takeaways'], ['int', 2, (v) => v + ' interceptions']]) {
    const p = leader(C, k, min); if (p) (byName.get(p.name) || byName.set(p.name, []).get(p.name)).push(txt(p[k]));
  }
  if (byName.size) bat.push('For Calgary, ' + list([...byName].map(([nm, xs]) => nm + ' had ' + list(xs))) + '.');
  const g = leader(C, 'gv', 3); if (g) bat.push(`On the other side of the ledger, ${g.name} was charged with ${g.gv} giveaways.`);
  const fTot = C.fow + C.fol;
  if (fTot) {
    const fc = leader(C, 'fow', 1);
    bat.push(`Calgary won ${C.fow} of ${fTot} draws (${pct(C.fow, fTot)}%)${fc ? `, ${fc.name} taking ${fc.fow} of ${fc.fow + fc.fol}` : ''}.`);
  }
  if (bat.length) out.push('## Battles\n' + bat.join(' '));

  // Goaltending detail EA has but LG does not: breakaway saves.
  const gl = Object.values(C.players).filter((p) => p.goalie && p.sa > 0);
  const brk = gl.filter((p) => p.brkS > 0).map((p) => `${p.name} stopped ${p.brk} of ${p.brkS} breakaway${p.brkS === 1 ? '' : 's'}`);
  if (brk.length) out.push('## In the crease\n' + list(brk) + ' according to the EA match data.');
  return out;
}

const stripTimecodes = (s) => String(s || '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+(at|in|on|during|around|by|from)(?=\s*[.,;)]|\s*$)/gi, '').replace(/\s+([.,;])/g, '$1').replace(/\s{2,}/g, ' ').trim();
const sentence = (s) => { const t = stripTimecodes(s); return t && !/[.!?]$/.test(t) ? t + '.' : t; };

function filmSections(vod, ctx) {
  const r = vod?.report; if (!r) return [];
  const ts = r.team_systems || {};
  const notes = [];
  if (r.process) notes.push(sentence(r.process));
  const picks = [['What worked', ts.repeatable_strengths], ['What broke down', ts.repeatable_problems], ['Special teams', ts.special_teams], ['Next time', ts.next_game_adjustments]]
    .filter(([, v]) => v && String(v).trim());
  if (!notes.length && !picks.length) return [];
  const rating = Number.isFinite(Number(r.game_rating?.score)) ? ` The film staff graded the performance ${Number(r.game_rating.score)}/100.` : '';
  const head = pick(ctx.lgGameId, 'film', ['## Film room', '## From the film room', '## On the tape']);
  return [head + '\n' + (notes.join(' ') + rating).trim() + (picks.length ? '\n\n' + picks.map(([k, v]) => `- ${k}: ${sentence(v)}`).join('\n') : '') +
    '\n\n_Film notes come from the approved Wildman VOD Scout review of this game; clips stay in the private VOD room._'];
}

/** Returns extra markdown sections plus metrics to merge. Never throws on missing data. */
export function buildEvidence({ eaRows, vod, final, oNick, lgGameId }) {
  const ctx = { oNick, lgGameId };
  const ea = mergeEaMatches(eaRows, final);
  const sections = [...(ea ? eaSections(ea, ctx) : []), ...filmSections(vod, ctx)];
  const metrics = {};
  if (ea) {
    metrics.ea_match_ids = ea.matchIds;
    metrics.ea_key_stats = { shot_attempts: ea.C.att + '-' + ea.O.att, hits: ea.C.hits + '-' + ea.O.hits, takeaways: ea.C.tk + '-' + ea.O.tk, giveaways: ea.C.gv + '-' + ea.O.gv };
  }
  if (vod?.report) { metrics.vod_available = true; metrics.vod_review_id = vod.id; }
  const sources = [ea ? 'EA NHL club match' + (ea.matchIds.length > 1 ? 'es ' : ' ') + ea.matchIds.join(' + ') + (ea.split ? ' (game split across reconnects; totals combined)' : '') : null, vod?.report ? 'approved VOD Scout film review' : null].filter(Boolean);
  return { sections, metrics, sourceNote: sources.length ? 'Also: ' + sources.join('; ') + '.' : '', eaReconciled: !!ea, eaPresent: Array.isArray(eaRows) && eaRows.length > 0 };
}
