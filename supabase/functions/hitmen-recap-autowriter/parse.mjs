// Strict parser for a public LeagueGaming LGCHL game page (page=game&gameid=N).
// Reads only what the page shows: period scoring, the team stats table, skater and goalie tables.
// Every total is reconciled against the official final from lgchl_games; anything that does not
// add up throws, so a recap is never written from a partial or unexpected page.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const clean = (s) => String(s ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#'
    ? String.fromCodePoint(parseInt(e.slice(e[1].toLowerCase() === 'x' ? 2 : 1), e[1].toLowerCase() === 'x' ? 16 : 10))
    : ENT[e.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim();
const int = (s) => { const t = clean(s).replace(/^\+/, ''); return /^-?\d+$/.test(t) ? Number(t) : null; };
const secs = (s) => { const m = /^(\d+):([0-5]\d)$/.exec(clean(s)); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const pct = (s) => { const m = /^(\d+(?:\.\d+)?)%?$/.exec(clean(s)); return m ? Number(m[1]) : null; };
const frac = (s) => { const m = /^(\d+)\s*\/\s*(\d+)$/.exec(clean(s)); return m ? [Number(m[1]), Number(m[2])] : null; };

function tables(html) {
  const out = [], stack = []; let t = null, row = null, cell = null;
  const src = String(html).replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  for (const tok of src.match(/<[^>]+>|[^<]+/g) || []) {
    if (/^<table\b/i.test(tok)) { stack.push({ t, row, cell }); t = { rows: [] }; row = null; cell = null; continue; }
    if (/^<\/table/i.test(tok)) { if (t) out.push(t); ({ t, row, cell } = stack.pop() || { t: null, row: null, cell: null }); continue; }
    if (!t) continue;
    if (/^<tr\b/i.test(tok)) { row = []; t.rows.push(row); cell = null; continue; }
    if (/^<\/tr/i.test(tok)) { row = null; cell = null; continue; }
    if (/^<(td|th)\b/i.test(tok)) { if (!row) { row = []; t.rows.push(row); } cell = { html: '' }; row.push(cell); continue; }
    if (/^<\/(td|th)/i.test(tok)) { cell = null; continue; }
    if (cell) cell.html += tok;
  }
  return out;
}
const teamIdIn = (h) => { const m = /teamid=(\d+)/i.exec(h) || /team(\d+)\.png/i.exec(h); return m ? Number(m[1]) : null; };
const userIn = (h) => { const m = /<a\b[^>]*href=["'][^"']*page=team_user&(?:amp;)?userid=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(h); return m ? { lg_user_id: Number(m[1]), gamertag: clean(m[2]) } : null; };

export function parseLgGamePage(html, game) {
  if (!game || !Number.isSafeInteger(game.lg_game_id) || game.status !== 'final') throw new Error('Expected an official final');
  const H = String(html || '');
  if (!H.includes('Period Stats') && /<title>\s*Just a moment|cf-chl-|cf_chl_opt/i.test(H)) throw new Error('Cloudflare challenge page');
  if (!new RegExp('gameid=' + game.lg_game_id + '\\b').test(H) && !H.includes('View EA Game ' + game.lg_game_id)) throw new Error('Page does not reference this LG game id');
  const ids = [game.away_lg_team_id, game.home_lg_team_id];
  const official = { [game.away_lg_team_id]: game.away_score, [game.home_lg_team_id]: game.home_score };
  const head = clean(H.slice(0, H.indexOf('Period Stats') > 0 ? H.indexOf('Period Stats') : 0));
  const status = /\bF\/SO\b/.test(head) ? 'SO' : /\bF\/OT\b/.test(head) ? 'OT' : /\bFINAL\b/.test(head) ? 'REG' : null;
  if (!status) throw new Error('Game page is not marked final');

  const T = tables(H);
  // Period scoring
  const pt = T.find((t) => t.rows.length && clean(t.rows[0].map((c) => c.html).join(' ')) === 'Period Stats');
  if (!pt) throw new Error('Period Stats table missing');
  const labels = (pt.rows.find((r) => clean(r[0]?.html) === 'Team') || []).slice(1).map((c) => clean(c.html));
  if (labels.slice(0, 3).join(',') !== '1,2,3') throw new Error('Unexpected period labels');
  const periods = {}, records = {};
  for (const r of pt.rows) {
    const id = teamIdIn(r[0]?.html || '');
    if (!ids.includes(id)) continue;
    if (r.length !== labels.length + 1) throw new Error('Period row width mismatch');
    const g = r.slice(1).map((c) => int(c.html));
    if (g.some((x) => x == null || x < 0)) throw new Error('Unreadable period goals');
    periods[id] = g;
    const rec = /\((\d+-\d+-\d+)\)/.exec(clean(r[0].html)); records[id] = rec ? rec[1] : null;
  }
  for (const id of ids) {
    if (!periods[id]) throw new Error('Period row missing for team ' + id);
    if (periods[id].reduce((a, b) => a + b, 0) !== official[id]) throw new Error('Period goals do not reconcile with the official final');
  }
  const regA = periods[ids[0]].slice(0, 3).reduce((a, b) => a + b, 0), regH = periods[ids[1]].slice(0, 3).reduce((a, b) => a + b, 0);
  if (status === 'REG' && (labels.length !== 3 || regA === regH)) throw new Error('Regulation final with tied or extra periods');
  if (status !== 'REG' && (labels.length < 4 || regA !== regH)) throw new Error('Overtime final not tied after regulation');

  // Team stats: rows of [left value, label, right value]. Orientation is fixed by the Goals row.
  const st = T.find((t) => t.rows.some((r) => r.length === 3 && clean(r[1].html) === 'Total Shots'));
  if (!st) throw new Error('Team stats table missing');
  const raw = {};
  for (const r of st.rows) if (r.length === 3 && clean(r[1].html)) raw[clean(r[1].html)] = [clean(r[0].html), clean(r[2].html)];
  if (!raw.Goals) throw new Error('Team goals row missing');
  const [gl, gr] = raw.Goals.map(int);
  let left;
  if (gl === official[ids[0]] && gr === official[ids[1]]) left = ids[0];
  else if (gl === official[ids[1]] && gr === official[ids[0]]) left = ids[1];
  else throw new Error('Team goals do not match the official final');
  const right = left === ids[0] ? ids[1] : ids[0];
  const team = { [left]: {}, [right]: {} };
  const map = { 'Total Shots': ['shots', int], Hits: ['hits', int], 'Time on Attack': ['toa_seconds', secs], 'Passing%': ['passing_pct', pct],
    'Face offs won': ['faceoffs_won', int], 'Penalty Minutes': ['pim_seconds', secs], Blocks: ['blocks', int], 'Shorthanded Goals': ['sh_goals', int] };
  for (const [label, [k, fn]] of Object.entries(map)) if (raw[label]) { team[left][k] = fn(raw[label][0]); team[right][k] = fn(raw[label][1]); }
  if (raw['Power Plays']) { team[left].pp = frac(raw['Power Plays'][0]); team[right].pp = frac(raw['Power Plays'][1]); }
  team[left].goals = official[left]; team[right].goals = official[right];
  for (const id of ids) if (team[id].shots == null || team[id].toa_seconds == null || !team[id].pp) throw new Error('Incomplete team stats');

  // Skaters
  const sk = T.find((t) => t.rows.some((r) => r.some((c) => clean(c.html) === 'Players')) && t.rows.some((r) => r.some((c) => clean(c.html) === 'TOI')));
  if (!sk) throw new Error('Player Stats table missing');
  const hdr = sk.rows.find((r) => r.some((c) => clean(c.html) === 'Players')).map((c) => clean(c.html));
  const want = ['G', 'A', 'P', '+/-', 'TOI', 'TwP', 'Shots', 'D', 'PAS%', 'SP', 'H', 'TA', 'GA', 'BK', 'INT', 'PIM'];
  const at = hdr.indexOf('Players');
  if (hdr.slice(at + 1, at + 1 + want.length).join('|') !== want.join('|')) throw new Error('Unexpected Player Stats columns');
  const skaters = [];
  for (const r of sk.rows) {
    const nameCell = r.findIndex((c) => userIn(c.html));
    if (nameCell < 0) continue;
    const u = userIn(r[nameCell].html), tid = teamIdIn(r[nameCell].html), v = r.slice(nameCell + 1).map((c) => c.html);
    if (!ids.includes(tid)) throw new Error('Skater row without a team in this game');
    const pos = /\((LW|C|RW|LD|RD)\)/.exec(clean(r[nameCell].html));
    const sh = /^(\d+)\s*\/\s*(\d+)$/.exec(clean(v[6]));
    const p = { ...u, lg_team_id: tid, position: pos ? pos[1] : null, gwg: /\bGWG\b/.test(clean(r[nameCell].html)),
      goals: int(v[0]), assists: int(v[1]), points: int(v[2]), plus_minus: int(v[3]), toi_seconds: secs(v[4]),
      shots: sh ? Number(sh[1]) : null, shot_attempts: sh ? Number(sh[2]) : null, hits: int(v[10]), takeaways: int(v[11]),
      giveaways: int(v[12]), blocks: int(v[13]), interceptions: int(v[14]), pim_seconds: secs(v[15]) };
    if ([p.goals, p.assists, p.points].some((x) => x == null || x < 0) || p.points !== p.goals + p.assists) throw new Error('Invalid skater totals for ' + p.gamertag);
    skaters.push(p);
  }
  // Goalies
  const gt = T.find((t) => t.rows.length && clean(t.rows[0].map((c) => c.html).join(' ')) === 'Goalie Stats');
  if (!gt) throw new Error('Goalie Stats table missing');
  const ghdr = gt.rows.find((r) => r.some((c) => clean(c.html) === 'Player')).map((c) => clean(c.html));
  if (ghdr.slice(1, 6).join('|') !== 'S|Sv%|GA|Sv|GAA') throw new Error('Unexpected Goalie Stats columns');
  const goalies = [];
  for (const r of gt.rows) {
    const nameCell = r.findIndex((c) => userIn(c.html));
    if (nameCell < 0) continue;
    const u = userIn(r[nameCell].html), tid = teamIdIn(r[nameCell].html), v = r.slice(nameCell + 1).map((c) => c.html);
    if (!ids.includes(tid)) throw new Error('Goalie row without a team in this game');
    const g = { ...u, lg_team_id: tid, position: 'G', shots_against: int(v[0]), goals_against: int(v[2]), saves: int(v[3]) };
    if ([g.shots_against, g.goals_against, g.saves].some((x) => x == null || x < 0) || g.saves + g.goals_against !== g.shots_against) throw new Error('Goalie totals do not add up for ' + g.gamertag);
    goalies.push(g);
  }
  const seen = new Set();
  for (const p of [...skaters, ...goalies]) { const k = p.lg_user_id + p.position; if (seen.has(k)) throw new Error('Duplicate player row'); seen.add(k); }
  for (const id of ids) {
    const s = skaters.filter((p) => p.lg_team_id === id), g = goalies.filter((p) => p.lg_team_id === id);
    if (s.length < 4 || !g.length) throw new Error('Incomplete lineup for team ' + id);
    if (s.reduce((a, p) => a + p.goals, 0) !== official[id]) throw new Error('Skater goals do not reconcile with the official final');
    const other = id === ids[0] ? ids[1] : ids[0];
    if (g.reduce((a, p) => a + p.goals_against, 0) !== official[other]) throw new Error('Goalie goals against do not reconcile with the official final');
  }
  return { lg_game_id: game.lg_game_id, status, period_labels: labels, periods, records, team, skaters, goalies,
    away_lg_team_id: ids[0], home_lg_team_id: ids[1], away_score: game.away_score, home_score: game.home_score };
}
