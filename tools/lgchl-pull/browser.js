/*
 * LGCHL game-night pull: helpers pasted into a signed-in LeagueGaming tab (Claude in Chrome
 * javascript_tool). Nothing here reads or sends cookies, passwords or tokens: pages are fetched
 * same-origin inside the user's own tab and parsed in place. See README.md for the runbook.
 *
 *   __pace(items, fn)      one page every 20-25 s; stops at the first Cloudflare check or non-200
 *   __parseLU(doc, gid)    pre-game lineup page -> lgchl-pregame-lineups-v1 game object
 *   __boxx(doc, gid)       final game page -> raw box score (input of convert.py)
 *   __memberstats()        LG Stats Client analyzer: every row of the member-stats DataTables
 *   __pack(obj, tag)       gzip + base64 into "TAG|i|n|<b64>|END" chunks (window.__pk_TAG)
 */
window.__log = window.__log || []; window.__stop = null;
window.__isCF = s => /Just a moment|cf-chl|challenge-platform|Attention Required/i.test(s.slice(0, 20000));
window.__pace = async (items, fn) => {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]; if (window.__stop) break;
    try {
      const r = await fetch(it.url, { credentials: 'include', cache: 'no-store' });
      const h = await r.text();
      if (r.status !== 200 || __isCF(h)) { window.__stop = 'blocked ' + r.status + ' at ' + it.key; __log.push(window.__stop); break; }
      await fn(it, h); __log.push('ok ' + it.key);
    } catch (e) { __log.push('err ' + it.key + ' ' + e.message); }
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 20000 + Math.random() * 5000));
  }
  __log.push('done ' + new Date().toISOString());
};
window.__gameUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' + id;

window.__parseLU = (doc, gid) => {
  const W = s => (s || '').replace(/\s+/g, ' ').trim();
  const txt = doc.body.innerText || doc.body.textContent;
  const teams = [...txt.matchAll(/^(.+?) \((\d+-\d+-\d+)\)\s*$/gm)].slice(0, 2).map(m => ({ name: m[1].trim(), record: m[2] }));
  const tids = []; doc.querySelectorAll('a[href*="page=team_page"]').forEach(a => { const m = a.getAttribute('href').match(/teamid=(\d+)/); if (m && !tids.includes(+m[1])) tids.push(+m[1]); });
  const T = [...doc.querySelectorAll('table')];
  const rows = [...T[0].rows].map(r => W(r.textContent));
  const rat = {}; rows.forEach(s => { const m = s.match(/^(\d+) ?(Tot|Off|Def|Goalie) ?(\d+)$/); if (m) rat[m[2].toLowerCase()] = { away: +m[1], home: +m[3] }; });
  const num = s => { s = (s || '').trim(); if (s === '' || s === '-') return 0; return /^[+-]?\d+(\.\d+)?$/.test(s) ? +s : s; };
  const cells = r => [...r.cells].map(x => W(x.textContent));
  const uid = r => { const a = r.querySelector('a[href*="iuserid"]'); return a ? +(a.getAttribute('href').match(/iuserid=(\d+)/) || [])[1] : null; };
  const nm = c => c.match(/^(\d+)\s+(.*)$/) || [null, '0', c];
  const sides = [0, 1].map(() => ({ skaters: [], goalies: [], offense_breakdown: [], defense_breakdown: [] }));
  let side = -1;
  T.slice(1).forEach(t => {
    const h = cells(t.rows[0]).join(' ');
    if (/^User \$M/.test(h)) {
      side++; [...t.rows].slice(1).forEach(r => { const c = cells(r), m = nm(c[2]);
        sides[side].skaters.push({ position: c[0], player: m[2].trim(), lg_user_id: uid(r), overall: +m[1], salary_m: c[3], rec: num(c[4]), gp: num(c[5]), pts: num(c[6]), goals: num(c[7]), ast: num(c[8]), plus_minus: num(c[9]), gwg: num(c[10]) }); });
    } else if (/^Goalie \$M/.test(h)) {
      [...t.rows].slice(1).forEach(r => { const c = cells(r), m = nm(c[2]);
        sides[side].goalies.push({ position: c[0], player: m[2].trim(), lg_user_id: uid(r), overall: +m[1], salary_m: c[3], ggp: num(c[4]), gwin: num(c[5]), gloss: num(c[6]), gaa: num(c[7]), savep: num(c[8]) }); });
    } else if (/^(Offense|Defense) Break Down/.test(h)) {
      const k = /^Off/.test(h) ? 'offense_breakdown' : 'defense_breakdown';
      [...t.rows].slice(2).forEach(r => { const c = cells(r);
        sides[side][k].push({ players: c[0].split(/(?=(?:C|LW|RW|LD|RD)\) )/).map(s => s.trim()).filter(Boolean), salary_m: c[1], rec: num(c[2]), gp: num(c[3]), pts: num(c[4]), goals: num(c[5]), ast: num(c[6]), plus_minus: num(c[7]), gwg: num(c[8]) }); });
    }
  });
  return { lg_game_id: gid, when: rows[1], teams, tids, team_ratings: rat,
    away: Object.assign({ team: teams[0] && teams[0].name, lg_team_id: tids[0] }, sides[0]),
    home: Object.assign({ team: teams[1] && teams[1].name, lg_team_id: tids[1] }, sides[1]) };
};

window.__boxx = (doc, gid) => {
  const W = s => (s || '').replace(/\s+/g, ' ').trim();
  const cells = r => [...r.cells].map(c => W(c.textContent));
  const T = [...doc.querySelectorAll('table')];
  const find = re => T.find(t => t.rows[0] && re.test(W(t.rows[0].textContent)));
  const txt = W(doc.body.textContent);
  const tids = []; doc.querySelectorAll('a[href*="teamid="]').forEach(a => { const m = a.getAttribute('href').match(/teamid=(\d+)/); if (m && !tids.includes(m[1])) tids.push(m[1]); });
  const per = find(/^Period Stats/), ps = find(/^Player Stats/), gs = find(/^Goalie Stats/), ea = find(/^EA Sports API Results/);
  const ts = T.find(t => [...t.rows].some(r => /Total Shots/.test(r.textContent)));
  if (!per || !ps) return { gid, error: 'no box score (not final?)' };
  const sc = [...doc.querySelectorAll('span.lg_game_header')].map(e => W(e.textContent));
  const st = (txt.match(/\b(FINAL|F\/OT|F\/SO)\b/) || [])[1];
  const dt = (txt.match(/\w+day \w+ \d+\w\w \d{4}, \d\d:\d\d [AP]M/) || [])[0];
  const pa = cells(per.rows[2]), ph = cells(per.rows[3]);
  const header = [['align-middle', pa[0].replace(/ \(.*$/, '')], ['lg_game_header', sc[0]], ['', st], ['', dt], ['lg_game_header', sc[1]], ['', ph[0].replace(/ \(.*$/, '')]];
  const uidOf = r => { const a = r.querySelector('a[href*="userid="]'); return a ? (a.getAttribute('href').match(/userid=(\d+)/) || [])[1] : null; };
  const rowsOf = t => [...t.rows].map(r => { const c = cells(r), u = uidOf(r); return { uid: u, rat: u ? (c[0] + ' ' + c[1]).split(' ').filter(Boolean) : [], c }; });
  const players = rowsOf(ps), goalies = gs ? rowsOf(gs) : [];
  const em = txt.match(/This game has been Edited \d+ time\(s\) The Last edit was by .*? on \w+ \w+ \d+\w\w \d{4}, \d\d:\d\d [AP]M/);
  const team = {}, tn = []; let cur = null;
  players.forEach(p => { if (p.c.length === 1) { cur = p.c[0]; if (cur !== 'Player Stats') tn.push(cur); } else if (p.uid) team[p.c[2].replace(/ \((LW|C|RW|LD|RD|G)\).*$/, '')] = cur; });
  const pbt = {};
  T.filter(t => t.rows[0] && cells(t.rows[0]).join(' ') === 'Position Time Player').forEach(t => {
    const rows = [...t.rows].slice(1).map(cells); const n = rows.map(r => team[r[2]]).find(Boolean);
    pbt[n === tn[0] ? tids[0] : n === tn[1] ? tids[1] : 'unk' + Object.keys(pbt).length] = rows; });
  return { gid, captured_at: new Date().toISOString(), header, tids: tids.slice(0, 2), period: [...per.rows].map(cells),
    teamstats: ts ? [...ts.rows].map(cells) : [], players, goalies, edit: em ? em[0] : null, ea: ea ? [...ea.rows].map(cells) : [], poss_by_team: pbt };
};

// Same requests as the LG Stats Client's ANALYZER_SCRIPT (lg_client.py). Run on the
// page=team_memberstats&leagueid=39&seasonid=55 page after it has loaded.
window.__memberstats = async () => {
  const out = [];
  const tables = [...document.querySelectorAll('table[id^="lgtable_memberstats"]')].filter(el => window.jQuery && jQuery.fn.DataTable.isDataTable(el));
  for (const el of tables) {
    const st = jQuery(el).DataTable().settings()[0]; if (!st.oFeatures.bServerSide) continue;
    const url = typeof st.ajax === 'string' ? st.ajax : (st.ajax && st.ajax.url ? st.ajax.url : st.sAjaxSource); if (!url) continue;
    const req = structuredClone(st.oAjaxData || {}); req.start = 0; req.length = st._iRecordsTotal || 100000; req.draw = (req.draw || 1) + 1;
    const body = new URLSearchParams();
    const add = (p, v) => { if (Array.isArray(v)) v.forEach((x, i) => add(`${p}[${i}]`, x)); else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => add(p ? `${p}[${k}]` : k, x)); else body.append(p, v == null ? '' : String(v)); };
    Object.entries(req).forEach(([k, v]) => add(k, v));
    const r = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }, body: body.toString() });
    if (!r.ok) { out.push({ id: el.id, error: 'HTTP ' + r.status }); continue; }
    const d = await r.json(); const rows = Array.isArray(d.data) ? d.data : (Array.isArray(d.aaData) ? d.aaData : []);
    const norm = row => row.map((c, i) => { if (typeof c !== 'string' || !/</.test(c)) return c; const x = document.createElement('div'); x.innerHTML = c;
      if (i === 1) { const ua = x.querySelector('a[href*="userid"]'), ta = x.querySelector('a[href*="teamid"]');
        return { uid: +(ua && ua.getAttribute('href').match(/userid=(\d+)/) || [])[1], tid: +(ta && ta.getAttribute('href').match(/teamid=(\d+)/) || [])[1], name: ua && ua.textContent.trim(), extra: x.textContent.replace(/\s+/g, ' ').trim() }; }
      return x.textContent.trim(); });
    out.push({ id: el.id, type: url.includes('type_user=goalie') ? 'goalie' : 'skater', headers: [...el.querySelectorAll('thead th')].map(th => th.textContent.trim()), rows: rows.map(norm) });
    await new Promise(r => setTimeout(r, 3000));
  }
  return { captured_at: new Date().toISOString(), tables: out };
};

window.__pack = async (obj, tag, size = 60000) => {
  const s = JSON.stringify(obj);
  const cs = new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const b = btoa(bin), out = []; for (let i = 0; i < b.length; i += size) out.push(b.slice(i, i + size));
  window['__pk_' + tag] = out.map((c, i) => tag + '|' + i + '|' + out.length + '|' + c + '|END');
  return { raw: s.length, b64: b.length, chunks: out.length };
};
// Show one chunk as the page's only text, for get_page_text:
window.__show = (tag, i) => { document.body.innerHTML = ''; const p = document.createElement('pre'); p.textContent = window['__pk_' + tag][i]; document.body.appendChild(p); return p.textContent.length; };
