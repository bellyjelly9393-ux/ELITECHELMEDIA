/* Elitechel Media — Three Stars generator.
 * Layers: background (assets/three-stars/background.*) → jerseys (assets/three-stars/jerseys/team<lg_team_id>.*)
 * → live text (title, nameplates, stat cards). Exports a 1200×1312 PNG.
 * Data: game-night skater lines from Supabase (lgchl_public_box_scores + lgchl_public_player_lines),
 * falling back to the repo's lgchl-drops CSV for that night. Nothing loads until "Suggest top 3" is pressed.
 */
(() => {
  'use strict';

  const W = 1200, H = 1312, SEASON = 55;
  const ASSET_DIR = 'assets/three-stars';
  const IMG_EXTS = ['png', 'webp'];
  const LAYOUT_KEY = 'ecm-three-stars-layout-v2';
  const TEXT_KEY = 'ecm-three-stars-text-v1';

  // Podium order on the graphic: left = 3rd, centre = 1st, right = 2nd.
  const SLOTS = [
    { rank: 3, cx: 268, card: 222, label: 'THIRD STAR' },
    { rank: 1, cx: 600, card: 600, label: 'FIRST STAR' },
    { rank: 2, cx: 932, card: 978, label: 'SECOND STAR' },
  ];
  const RANK_WORD = { 1: 'First', 2: 'Second', 3: 'Third' };
  const DEFAULT_NUDGE = { dx: 0, dy: 0, scale: 1 };

  const $ = (id) => document.getElementById(id);
  const canvas = $('tsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const state = {
    night: '',
    stars: {
      1: blankStar(), 2: blankStar(), 3: blankStar(),
    },
    teams: new Map(),          // lg_team_id -> { id, name, abbr }
    teamsLoaded: false,
    suggestions: [],
    nudges: loadJSON(LAYOUT_KEY, { 1: { ...DEFAULT_NUDGE }, 2: { ...DEFAULT_NUDGE }, 3: { ...DEFAULT_NUDGE } }),
    bgOverride: null,
    bgMode: 'auto',
    jerseyOverride: { 1: null, 2: null, 3: null },
  };

  function blankStar() {
    return { gamertag: '', teamId: '', teamName: '', position: 'RW', gp: 3, g: 0, a: 0, pm: 0 };
  }

  function loadJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? { ...fallback, ...v } : fallback; }
    catch { return fallback; }
  }
  function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage off */ } }

  const db = () => window.VVHLBackend?.db || null;

  /* ---------------- images ---------------- */
  const imgCache = new Map();
  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imgCache.set(src, p);
    return p;
  }
  async function firstImage(base) {
    for (const ext of IMG_EXTS) {
      const img = await loadImage(`${base}.${ext}`);
      if (img) return img;
    }
    return null;
  }
  const jerseyBase = (teamId) => `${ASSET_DIR}/jerseys/team${teamId}`;
  const logoSrc = (teamId) => `assets/lgchl/s55/team${teamId}.png`;

  /* ---------------- fonts ---------------- */
  const fontsReady = (async () => {
    const faces = [
      new FontFace('TS Shoulders', 'url(assets/fonts/BigShouldersDisplay.woff2)', { weight: '100 900' }),
      new FontFace('TS Anton', 'url(assets/fonts/Anton.woff)'),
      new FontFace('TS Barlow', 'url(assets/fonts/BarlowSemiCondensed-Bold.woff)', { weight: '700' }),
      new FontFace('TS Barlow', 'url(assets/fonts/BarlowSemiCondensed-SemiBold.woff)', { weight: '600' }),
    ];
    await Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)).catch(() => null)));
  })();

  /* ---------------- dates ---------------- */
  function etParts(d = new Date()) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' });
    const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
    return { date: `${o.year}-${o.month}-${o.day}`, hour: Number(o.hour), weekday: o.weekday };
  }
  function addDays(iso, n) {
    const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
  }
  function weekdayOf(iso) { return new Date(`${iso}T12:00:00Z`).getUTCDay(); }
  // Latest Sun/Mon/Tue night whose games are finished (after ~midnight ET counts as done).
  function defaultNight() {
    const now = etParts();
    let d = now.hour < 6 ? addDays(now.date, -1) : now.date;
    if (now.hour >= 6 && [0, 1, 2].includes(weekdayOf(d))) d = addDays(d, -1); // tonight not played yet
    for (let i = 0; i < 7; i++) { if ([0, 1, 2].includes(weekdayOf(d))) return d; d = addDays(d, -1); }
    return d;
  }
  // Sun, Mon, Tue of the LG week containing iso (Wed–Sat map back to the Sun–Tue just played).
  function weekNights(iso) {
    const wd = weekdayOf(iso);
    const sun = addDays(iso, -wd);
    return [sun, addDays(sun, 1), addDays(sun, 2)];
  }
  const scope = () => ($('tsScope')?.value === 'week' ? 'week' : 'night');
  function kickerFor(iso) {
    if (!iso) return 'GAME NIGHT';
    if (scope() === 'week') {
      const [sun, , tue] = weekNights(iso);
      const f = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
      const a = f(sun), b = f(tue);
      return `GAME WEEK • ${a}–${a.split(' ')[0] === b.split(' ')[0] ? b.split(' ')[1] : b}`;
    }
    const d = new Date(`${iso}T12:00:00Z`);
    const wd = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
    const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
    return `GAME NIGHT • ${wd} ${md}`;
  }

  /* ---------------- data ---------------- */
  async function loadTeams() {
    if (state.teamsLoaded) return;
    const client = db();
    if (client) {
      try {
        const { data, error } = await client.from('lgchl_teams').select('lg_team_id,name,abbr').eq('season', SEASON);
        if (!error && data?.length) {
          data.forEach((t) => state.teams.set(String(t.lg_team_id), { id: String(t.lg_team_id), name: t.name, abbr: t.abbr }));
          state.teamsLoaded = true;
        }
      } catch { /* fall through */ }
    }
    renderTeamOptions();
  }

  async function linesFromDb(nights) {
    const client = db();
    if (!client) return null;
    // Sun/Mon/Tue nights are consecutive, so one window covers them: 9pm–late ET in EDT or EST.
    const from = `${nights[0]}T20:00:00Z`, to = `${addDays(nights[nights.length - 1], 1)}T12:00:00Z`;
    const { data: games, error } = await client.from('lgchl_public_box_scores')
      .select('lg_game_id').gte('game_at', from).lt('game_at', to).limit(400);
    if (error || !games?.length) return null;
    const ids = games.map((g) => g.lg_game_id);
    const rows = [];
    for (let i = 0; i < ids.length; i += 50) {
      const { data, error: e2 } = await client.from('lgchl_public_player_lines')
        .select('lg_game_id,player_id,gamertag,lg_team_id,position,goals,assists,plus_minus')
        .eq('player_kind', 'skater').in('lg_game_id', ids.slice(i, i + 50)).range(0, 999);
      if (e2) return null;
      (data || []).forEach((r) => rows.push({
        game: String(r.lg_game_id), key: r.player_id, gamertag: r.gamertag, teamId: String(r.lg_team_id),
        teamName: '', position: r.position, g: +r.goals || 0, a: +r.assists || 0, pm: +r.plus_minus || 0,
      }));
    }
    return rows.length ? { rows, games: ids.length, source: 'Elitechel database' } : null;
  }

  function parseCSV(text) {
    const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = ''; if (row.length > 1 || row[0] !== '') out.push(row); row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row); }
    const [head, ...body] = out;
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }

  async function linesFromDrop(nights) {
    const byName = new Map([...state.teams.values()].map((t) => [t.name.toLowerCase(), t.id]));
    const rows = [], missing = [];
    for (const night of nights) {
      let res = null;
      try { res = await fetch(`lgchl-drops/games/s${SEASON}/${night}/skater_game_lines.csv`, { cache: 'no-store' }); } catch { res = null; }
      if (!res?.ok) { missing.push(night); continue; }
      parseCSV(await res.text()).filter((r) => r.lg_game_id && r.player).forEach((r) => rows.push({
        game: r.lg_game_id, night, key: `lg:${r.lg_user_id || r.player.toLowerCase()}`, gamertag: r.player,
        teamId: byName.get(String(r.team).toLowerCase()) || '', teamName: r.team, position: r.position,
        g: +r.goals || 0, a: +r.ast || 0, pm: +r.plus_minus || 0,
      }));
    }
    const games = new Set(rows.map((r) => r.game)).size;
    return rows.length ? { rows, games, missing, source: 'LGCHL drop files' } : null;
  }

  function aggregate(rows) {
    const map = new Map();
    for (const r of rows) {
      let p = map.get(r.key);
      if (!p) { p = { key: r.key, gamertag: r.gamertag, teamId: r.teamId, teamName: r.teamName, games: new Set(), g: 0, a: 0, pm: 0, pos: {} }; map.set(r.key, p); }
      p.games.add(r.game); p.lastGame = r.game; if (r.night) p.lastNight = r.night; p.g += r.g; p.a += r.a; p.pm += r.pm;
      if (r.position) p.pos[r.position] = (p.pos[r.position] || 0) + 1;
      if (r.teamId) p.teamId = r.teamId;
      if (r.teamName) p.teamName = r.teamName;
    }
    return [...map.values()].map((p) => ({
      gamertag: p.gamertag, teamId: p.teamId, teamName: teamName(p.teamId, p.teamName), lastGame: p.lastGame, lastNight: p.lastNight,
      position: Object.entries(p.pos).sort((a, b) => b[1] - a[1])[0]?.[0] || 'F',
      gp: p.games.size, g: p.g, a: p.a, pm: p.pm, pts: p.g + p.a,
    })).sort((x, y) => y.pts - x.pts || y.g - x.g || y.pm - x.pm || x.gp - y.gp || x.gamertag.localeCompare(y.gamertag));
  }

  function teamName(id, fallback = '') { return state.teams.get(String(id))?.name || fallback || ''; }

  // Drop files list teams by name only. When the team table isn't reachable, read the LG team IDs
  // from one game file per unmatched team near the top of the list (a dozen small fetches at most).
  async function fillTeamIdsFromDrop(list) {
    const need = new Map();
    list.slice(0, 12).forEach((s) => { if (!s.teamId && s.teamName && !need.has(s.teamName)) need.set(s.teamName, [s.lastNight, s.lastGame]); });
    for (const [, [night, game]] of need) {
      try {
        const r = await fetch(`lgchl-drops/games/s${SEASON}/${night}/game_${game}.json`);
        if (!r.ok) continue;
        const j = await r.json();
        [j.away, j.home].forEach((t) => {
          const nm = t?.full_name || t?.name;
          if (t?.lg_team_id && nm && !state.teams.has(String(t.lg_team_id))) state.teams.set(String(t.lg_team_id), { id: String(t.lg_team_id), name: nm, abbr: '' });
        });
      } catch { /* leave unmatched */ }
    }
    const byName = new Map([...state.teams.values()].map((t) => [t.name.toLowerCase(), t.id]));
    list.forEach((s) => { if (!s.teamId) s.teamId = byName.get(String(s.teamName).toLowerCase()) || ''; });
    if (need.size) renderStarEditors();
  }

  async function suggest() {
    const night = $('tsNight').value;
    if (!night) { setStatus('Pick a night first.'); return; }
    state.night = night;
    const nights = scope() === 'week' ? weekNights(night) : [night];
    $('tsLoad').disabled = true;
    setStatus(`Loading ${kickerFor(night).split('• ')[1] || night}…`);
    try {
      await loadTeams();
      let found = null;
      try { found = await linesFromDb(nights); } catch { found = null; }
      if (!found) found = await linesFromDrop(nights);
      if (!found) { setStatus(`No finished games found for ${scope() === 'week' ? 'that week' : 'that night'} yet. Fill the stars in by hand, or try again after the stats sync.`); return; }
      state.suggestions = aggregate(found.rows);
      if (found.source === 'LGCHL drop files') await fillTeamIdsFromDrop(state.suggestions);
      renderSuggestions();
      [1, 2, 3].forEach((rank, i) => { const s = state.suggestions[i]; if (s) assign(rank, s, false); });
      if (!$('tsKicker').dataset.touched) $('tsKicker').value = kickerFor(night);
      renderStarEditors(); draw();
      const tie = state.suggestions[2] && state.suggestions[3] && state.suggestions[2].pts === state.suggestions[3].pts;
      const gap = found.missing?.length ? ` No data yet for ${found.missing.join(', ')}.` : '';
      setStatus(`${found.games} games · ${state.suggestions.length} skaters · from the ${found.source}. Ranked by points, then goals, then +/-.${tie ? ' Heads up: 3rd place is tied on points, check the tiebreak.' : ''}${gap}`);
    } finally { $('tsLoad').disabled = false; }
  }

  function assign(rank, s, redraw = true) {
    state.stars[rank] = { gamertag: s.gamertag, teamId: s.teamId, teamName: s.teamName, position: s.position, gp: s.gp, g: s.g, a: s.a, pm: s.pm };
    state.jerseyOverride[rank] = null;
    if (redraw) { renderStarEditors(); draw(); }
  }

  /* ---------------- UI ---------------- */
  function setStatus(t) { $('tsStatus').textContent = t; }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const signed = (n) => (n > 0 ? `+${n}` : n === 0 ? 'E' : String(n));

  function renderSuggestions() {
    const body = $('tsSuggestBody');
    body.innerHTML = state.suggestions.slice(0, 12).map((s, i) => `
      <tr>
        <td>${i + 1}</td><td><b>${esc(s.gamertag)}</b></td><td>${esc(state.teams.get(s.teamId)?.abbr || s.teamName)}</td>
        <td>${esc(s.position)}</td><td>${s.gp}</td><td>${s.g}</td><td>${s.a}</td><td><b>${s.pts}</b></td><td>${signed(s.pm)}</td>
        <td class="ts-use">${[1, 2, 3].map((r) => `<button type="button" data-use="${i}" data-rank="${r}">${r}</button>`).join('')}</td>
      </tr>`).join('');
    $('tsSuggest').hidden = !state.suggestions.length;
  }

  function teamOptionsHtml(selected) {
    const teams = [...state.teams.values()].sort((a, b) => a.name.localeCompare(b.name));
    const opts = teams.map((t) => `<option value="${t.id}"${t.id === String(selected) ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    return `<option value="">— team —</option>${opts}`;
  }
  function renderTeamOptions() { renderStarEditors(); }

  function renderStarEditors() {
    const wrap = $('tsStars');
    wrap.innerHTML = [1, 2, 3].map((rank) => {
      const s = state.stars[rank];
      const teamField = state.teams.size
        ? `<select data-f="teamId">${teamOptionsHtml(s.teamId)}</select>`
        : `<input data-f="teamName" type="text" value="${esc(s.teamName)}" placeholder="Team name">`;
      return `
      <fieldset class="ts-star" data-rank="${rank}">
        <legend><span class="ts-rank r${rank}">${rank}</span>${RANK_WORD[rank]} star</legend>
        <div class="ts-star-grid">
          <label class="ts-field ts-span2"><span>Gamertag</span><input data-f="gamertag" type="text" maxlength="24" value="${esc(s.gamertag)}"></label>
          <label class="ts-field ts-span2"><span>Team</span>${teamField}</label>
          <label class="ts-field"><span>Pos</span><select data-f="position">${['C', 'LW', 'RW', 'LD', 'RD', 'F', 'D'].map((p) => `<option${p === s.position ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
          <label class="ts-field"><span>GP</span><input data-f="gp" type="number" min="0" max="9" value="${s.gp}"></label>
          <label class="ts-field"><span>G</span><input data-f="g" type="number" min="0" max="99" value="${s.g}"></label>
          <label class="ts-field"><span>A</span><input data-f="a" type="number" min="0" max="99" value="${s.a}"></label>
          <label class="ts-field"><span>+/-</span><input data-f="pm" type="number" min="-99" max="99" value="${s.pm}"></label>
          <label class="ts-field"><span>PTS</span><output>${s.g + s.a}</output></label>
          <label class="ts-field ts-span2"><span>Jersey (one-off)</span><input data-f="jersey" type="file" accept="image/*"></label>
        </div>
      </fieldset>`;
    }).join('');
  }

  function renderNudges() {
    $('tsNudges').innerHTML = SLOTS.map(({ rank }) => {
      const n = state.nudges[rank] || DEFAULT_NUDGE;
      const slider = (k, min, max, step) => `<label class="ts-field"><span>${k === 'dx' ? 'Left/right' : k === 'dy' ? 'Up/down' : 'Size'}</span><input type="range" data-rank="${rank}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${n[k]}"></label>`;
      return `<div class="ts-nudge"><b>${RANK_WORD[rank]} star stall</b>${slider('dx', -120, 120, 1)}${slider('dy', -150, 150, 1)}${slider('scale', 0.6, 1.5, 0.01)}</div>`;
    }).join('');
  }

  function fileToImage(file) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function bind() {
    $('tsNight').value = defaultNight();
    $('tsKicker').value = kickerFor($('tsNight').value);
    const savedText = loadJSON(TEXT_KEY, {});
    ['tsTitle1', 'tsTitle2', 'tsLeague'].forEach((id) => { if (savedText[id]) $(id).value = savedText[id]; });

    $('tsLoad').addEventListener('click', suggest);
    $('tsScope').addEventListener('change', () => {
      const t1 = $('tsTitle1');
      if (scope() === 'week' && t1.value.toUpperCase() === "TONIGHT'S") t1.value = "THIS WEEK'S";
      if (scope() === 'night' && t1.value.toUpperCase() === "THIS WEEK'S") t1.value = "TONIGHT'S";
      if (!$('tsKicker').dataset.touched) $('tsKicker').value = kickerFor($('tsNight').value);
      draw();
    });
    $('tsNight').addEventListener('change', () => { if (!$('tsKicker').dataset.touched) $('tsKicker').value = kickerFor($('tsNight').value); draw(); });
    ['tsTitle1', 'tsTitle2', 'tsKicker', 'tsLeague'].forEach((id) => $(id).addEventListener('input', () => {
      if (id === 'tsKicker') $('tsKicker').dataset.touched = '1';
      saveJSON(TEXT_KEY, { tsTitle1: $('tsTitle1').value, tsTitle2: $('tsTitle2').value, tsLeague: $('tsLeague').value });
      draw();
    }));

    $('tsSuggestBody').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-use]'); if (!b) return;
      assign(Number(b.dataset.rank), state.suggestions[Number(b.dataset.use)]);
    });

    const onStar = async (e) => {
      const box = e.target.closest('.ts-star'); if (!box) return;
      const rank = Number(box.dataset.rank), f = e.target.dataset.f, s = state.stars[rank];
      if (!f) return;
      if (f === 'jersey') { state.jerseyOverride[rank] = await fileToImage(e.target.files?.[0]); draw(); return; }
      if (['gp', 'g', 'a', 'pm'].includes(f)) s[f] = parseInt(e.target.value, 10) || 0;
      else s[f] = e.target.value;
      if (f === 'teamId') { s.teamName = teamName(s.teamId); state.jerseyOverride[rank] = null; }
      const out = box.querySelector('output'); if (out) out.textContent = s.g + s.a;
      draw();
    };
    $('tsStars').addEventListener('input', onStar);
    $('tsStars').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'file') onStar(e); });

    $('tsNudges').addEventListener('input', (e) => {
      const r = e.target.dataset.rank, k = e.target.dataset.k; if (!r) return;
      state.nudges[r] = { ...(state.nudges[r] || DEFAULT_NUDGE), [k]: parseFloat(e.target.value) };
      saveJSON(LAYOUT_KEY, state.nudges); draw();
    });
    $('tsNudgeReset').addEventListener('click', () => {
      state.nudges = { 1: { ...DEFAULT_NUDGE }, 2: { ...DEFAULT_NUDGE }, 3: { ...DEFAULT_NUDGE } };
      saveJSON(LAYOUT_KEY, state.nudges); renderNudges(); draw();
    });
    $('tsBgFile').addEventListener('change', async (e) => { state.bgOverride = await fileToImage(e.target.files?.[0]); draw(); });
    $('tsBgMode').addEventListener('change', (e) => { state.bgMode = e.target.value; draw(); });

    $('tsDownload').addEventListener('click', async () => {
      await draw();
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `three-stars-${$('tsNight').value || 'night'}.png`;
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, 'image/png');
    });
    $('tsCopy').addEventListener('click', async () => {
      await draw();
      try {
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        $('tsCopy').textContent = 'Copied ✓'; setTimeout(() => { $('tsCopy').textContent = 'Copy image'; }, 1800);
      } catch { $('tsCopy').textContent = 'Copy not allowed here, use Download'; }
    });
  }

  /* ---------------- drawing ---------------- */
  function goldGradient(y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#fff4c8'); g.addColorStop(0.35, '#f1c45a'); g.addColorStop(0.62, '#b07a22'); g.addColorStop(1, '#f6d47c');
    return g;
  }
  function silverGradient(y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#d6d8dc'); g.addColorStop(0.7, '#8e9299'); g.addColorStop(1, '#f2f3f5');
    return g;
  }
  function setSpacing(px) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; }
  function fitFont(text, weight, family, size, maxW, min = 14) {
    let s = size;
    for (; s > min; s -= 1) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; }
    return s;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    ctx.closePath();
  }

  function drawBuiltInBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d0b09'); bg.addColorStop(0.55, '#14100b'); bg.addColorStop(1, '#050505');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // stalls
    SLOTS.forEach(({ cx }) => {
      const x = cx - 168, w = 336, top = 200, bottom = 900;
      const wood = ctx.createLinearGradient(x, 0, x + w, 0);
      wood.addColorStop(0, '#1c140c'); wood.addColorStop(0.5, '#2a1d11'); wood.addColorStop(1, '#1a120a');
      ctx.fillStyle = wood; ctx.fillRect(x, top, w, bottom - top);
      const glow = ctx.createRadialGradient(cx, top + 30, 10, cx, top + 160, 330);
      glow.addColorStop(0, 'rgba(255,214,140,.38)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = glow; ctx.fillRect(x, top, w, bottom - top);
      // light strips
      [x + 6, x + w - 10].forEach((lx) => {
        const strip = ctx.createLinearGradient(0, top, 0, bottom);
        strip.addColorStop(0, '#ffd58a'); strip.addColorStop(1, '#a8701f');
        ctx.shadowColor = '#ffb84d'; ctx.shadowBlur = 22; ctx.fillStyle = strip; ctx.fillRect(lx, top, 4, bottom - top); ctx.shadowBlur = 0;
      });
      // shelf + bench
      ctx.fillStyle = '#3a2915'; ctx.fillRect(x + 10, top + 105, w - 20, 8);
      ctx.fillStyle = '#0b0b0b'; ctx.fillRect(x + 10, 728, w - 20, 44);
      ctx.fillStyle = '#c99a4a'; ctx.fillRect(x + 10, 772, w - 20, 3);
      // top spotlight
      ctx.fillStyle = '#fff1cf'; ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.ellipse(cx, top + 10, 26, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    });
    // floor sheen
    const floor = ctx.createLinearGradient(0, 900, 0, H);
    floor.addColorStop(0, 'rgba(255,200,110,.10)'); floor.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = floor; ctx.fillRect(0, 900, W, H - 900);
  }

  function drawCover(img) {
    const s = Math.max(W / img.width, H / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }

  /* ---------------- layout ----------------
   * Where each piece goes, and which pieces the background art already contains ("baked").
   * The built-in lockers use BUILTIN_LAYOUT; real art is described by assets/three-stars/layout.json,
   * so new art only needs new numbers, not code. All coordinates are on the 1200×1312 canvas.
   */
  const BUILTIN_LAYOUT = {
    baked: { header: false, nameplateFrames: false, cardFrames: false, benchStars: false },
    kicker: { y: 66, size: 30 },
    slots: {
      3: { plate: { cx: 268, y: 244, w: 246, h: 50 }, jersey: { cx: 268, top: 312, w: 330, h: 400 }, card: { x: 46, y: 930, w: 352, h: 320 } },
      1: { plate: { cx: 600, y: 244, w: 262, h: 50 }, jersey: { cx: 600, top: 312, w: 330, h: 400 }, card: { x: 414, y: 918, w: 372, h: 338 } },
      2: { plate: { cx: 932, y: 244, w: 246, h: 50 }, jersey: { cx: 932, top: 312, w: 330, h: 400 }, card: { x: 802, y: 930, w: 352, h: 320 } },
    },
  };
  let artLayoutPromise = null;
  function artLayout() {
    if (!artLayoutPromise) {
      artLayoutPromise = fetch(`${ASSET_DIR}/layout.json`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        .then((j) => (j ? {
          baked: { ...BUILTIN_LAYOUT.baked, ...(j.baked || {}) },
          kicker: { ...BUILTIN_LAYOUT.kicker, ...(j.kicker || {}) },
          slots: Object.fromEntries([1, 2, 3].map((r) => [r, {
            plate: { ...BUILTIN_LAYOUT.slots[r].plate, ...(j.slots?.[r]?.plate || {}) },
            jersey: { ...BUILTIN_LAYOUT.slots[r].jersey, ...(j.slots?.[r]?.jersey || {}) },
            card: { ...BUILTIN_LAYOUT.slots[r].card, ...(j.slots?.[r]?.card || {}) },
          }])),
        } : null));
    }
    return artLayoutPromise;
  }

  function drawKicker(L) {
    const kicker = ($('tsKicker').value || kickerFor($('tsNight').value)).toUpperCase();
    if (!kicker) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${L.kicker.size}px "TS Barlow", sans-serif`; setSpacing(Math.round(L.kicker.size / 5));
    ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ecebe6'; ctx.fillText(kicker, W / 2 + 3, L.kicker.y);
    ctx.restore(); setSpacing(0);
  }

  function drawHeader(crest) {
    // top bar shade so text reads on any background
    const shade = ctx.createLinearGradient(0, 0, 0, 200);
    shade.addColorStop(0, 'rgba(0,0,0,.78)'); shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, 200);

    if (crest) ctx.drawImage(crest, 52, 22, 156, 159);

    const t1 = ($('tsTitle1').value || '').toUpperCase().trim();
    const t2 = ($('tsTitle2').value || 'THREE STARS').toUpperCase().trim();
    let size = 118;
    const measure = () => {
      ctx.font = `900 ${size}px "TS Shoulders", "Arial Narrow", sans-serif`;
      const gap = t1 ? size * 0.22 : 0;
      return { w1: t1 ? ctx.measureText(t1).width : 0, w2: ctx.measureText(t2).width, gap };
    };
    let m = measure();
    while (m.w1 + m.w2 + m.gap > 760 && size > 60) { size -= 2; m = measure(); }
    const total = m.w1 + m.w2 + m.gap, left = W / 2 - total / 2 + 8, base = 172;
    ctx.save();
    ctx.translate(left, base); ctx.transform(1, 0, -0.16, 1, 0, 0);
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    if (t1) { ctx.fillStyle = silverGradient(-size * 0.8, 0); ctx.fillText(t1, 0, 0); }
    ctx.fillStyle = goldGradient(-size * 0.8, 0); ctx.fillText(t2, m.w1 + m.gap, 0);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,240,200,.35)'; ctx.strokeText(t2, m.w1 + m.gap, 0);
    ctx.restore();

    const league = ($('tsLeague').value || '').toUpperCase().trim();
    if (league) {
      ctx.font = '900 46px "TS Shoulders", sans-serif'; setSpacing(2);
      const lw = ctx.measureText(league).width + 34;
      const lx = W - 52 - lw, ly = 66;
      roundRect(lx, ly, lw, 72, 4); ctx.fillStyle = 'rgba(8,8,8,.82)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = goldGradient(ly, ly + 72); ctx.stroke();
      ctx.fillStyle = goldGradient(ly + 10, ly + 60); ctx.textAlign = 'left'; ctx.fillText(league, lx + 17, ly + 55);
      setSpacing(0);
    }
  }

  function drawNameplate(P, s, rank, L) {
    const name = (s.gamertag || 'PLAYER').toUpperCase();
    const { cx, y, w, h } = P, x = cx - w / 2;
    ctx.save();
    if (!L.baked.nameplateFrames) {
      ctx.shadowColor = rank === 1 ? 'rgba(255,200,90,.6)' : 'rgba(0,0,0,.6)'; ctx.shadowBlur = 16;
      roundRect(x, y, w, h, 4); ctx.fillStyle = '#0b0a09'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5; ctx.strokeStyle = rank === 1 ? goldGradient(y, y + h) : silverGradient(y, y + h); ctx.stroke();
      roundRect(x + 5, y + 5, w - 10, h - 10, 3); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.stroke();
    }
    const starsN = L.baked.benchStars ? 0 : (rank === 1 ? 3 : rank === 2 ? 2 : 1);
    const starArea = starsN ? starsN * 24 + 8 : 0;
    const fs = fitFont(name, 800, '"TS Shoulders", sans-serif', Math.round(h * 0.72), w - starArea - 24, 14);
    ctx.font = `800 ${fs}px "TS Shoulders", sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const nameW = ctx.measureText(name).width, sx = cx - (nameW + starArea) / 2;
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#f4f2ec'; ctx.fillText(name, sx, y + h / 2 + 2); ctx.shadowBlur = 0;
    ctx.fillStyle = goldGradient(y + 12, y + h - 12);
    for (let i = 0; i < starsN; i++) { star(sx + nameW + 20 + i * 24, y + h / 2, 10); ctx.fill(); }
    ctx.restore();
  }

  function drawJerseyPlaceholder(J, s) {
    const k = Math.min(J.w / 330, J.h / 400);
    ctx.save();
    ctx.translate(J.cx, J.top + 18 * k); ctx.scale(k, k);
    ctx.strokeStyle = 'rgba(232,194,110,.6)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-55, 40); ctx.lineTo(-140, 80); ctx.lineTo(-165, 230); ctx.lineTo(-115, 240); ctx.lineTo(-105, 150);
    ctx.lineTo(-108, 330); ctx.lineTo(108, 330); ctx.lineTo(105, 150); ctx.lineTo(115, 240); ctx.lineTo(165, 230);
    ctx.lineTo(140, 80); ctx.lineTo(55, 40); ctx.quadraticCurveTo(0, 78, -55, 40); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(244,240,230,.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 22px "TS Barlow", sans-serif';
    ctx.fillText('ADD JERSEY', 0, 180);
    ctx.font = '600 17px "TS Barlow", sans-serif'; ctx.fillStyle = 'rgba(240,205,130,.95)';
    ctx.fillText(s.teamId ? `jerseys/team${s.teamId}.png` : 'pick a team', 0, 210);
    ctx.restore();
  }

  function drawJersey(J, img, rank) {
    const n = state.nudges[rank] || DEFAULT_NUDGE;
    const boxW = J.w * n.scale, boxH = J.h * n.scale;
    const s = Math.min(boxW / img.width, boxH / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
    ctx.drawImage(img, J.cx - w / 2 + n.dx, J.top + n.dy, w, h);
    ctx.restore();
  }

  function drawCard(slot, C, s, logo, L) {
    const first = slot.rank === 1;
    const { x, y, w, h } = C, cx0 = x + w / 2;
    ctx.save();
    if (!L.baked.cardFrames) {
      ctx.shadowColor = first ? 'rgba(255,196,80,.55)' : 'rgba(255,196,80,.25)'; ctx.shadowBlur = first ? 34 : 20;
      roundRect(x, y, w, h, 6);
      const panel = ctx.createLinearGradient(0, y, 0, y + h);
      panel.addColorStop(0, 'rgba(14,12,10,.96)'); panel.addColorStop(1, 'rgba(4,4,4,.97)');
      ctx.fillStyle = panel; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = first ? 4 : 3; ctx.strokeStyle = goldGradient(y, y + h); ctx.stroke();
      roundRect(x + 8, y + 8, w - 16, h - 16, 4); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(241,196,90,.35)'; ctx.stroke();
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // label
    ctx.font = '700 30px "TS Barlow", sans-serif'; setSpacing(5);
    ctx.fillStyle = first ? goldGradient(y + 20, y + 52) : (slot.rank === 2 ? silverGradient(y + 20, y + 52) : '#e2a35b');
    ctx.fillText(slot.label, cx0 + 2, y + 48); setSpacing(0);
    const line = (yy) => {
      const g = ctx.createLinearGradient(x + 20, 0, x + w - 20, 0);
      g.addColorStop(0, 'rgba(241,196,90,0)'); g.addColorStop(0.5, 'rgba(241,196,90,.8)'); g.addColorStop(1, 'rgba(241,196,90,0)');
      ctx.fillStyle = g; ctx.fillRect(x + 20, yy, w - 40, 1.5);
    };
    line(y + 62);

    // name + team + position
    const name = (s.gamertag || 'PLAYER').toUpperCase();
    const ns = fitFont(name, 800, '"TS Shoulders", sans-serif', 50, w - 40, 22);
    ctx.font = `800 ${ns}px "TS Shoulders", sans-serif`; ctx.fillStyle = '#f7f5f0'; ctx.fillText(name, cx0, y + 106);
    const team = (teamName(s.teamId, s.teamName) || 'TEAM').toUpperCase();
    const ts = fitFont(team, 600, '"TS Barlow", sans-serif', 28, w - 40, 14);
    ctx.font = `600 ${ts}px "TS Barlow", sans-serif`; ctx.fillStyle = '#9fd3e6'; ctx.fillText(team, cx0, y + 138);
    line(y + 152);
    ctx.font = '700 24px "TS Barlow", sans-serif'; ctx.fillStyle = '#f2f0ea'; ctx.fillText((s.position || '').toUpperCase(), cx0, y + 176);

    // logo watermark + points
    const pts = (Number(s.g) || 0) + (Number(s.a) || 0);
    if (logo) {
      ctx.save(); ctx.globalAlpha = 0.42; if ('filter' in ctx) ctx.filter = 'grayscale(1) brightness(1.1)';
      ctx.drawImage(logo, x + 26, y + h - 132, 72, 72); ctx.restore();
    }
    const ptsText = `${pts} PTS`;
    const ps = fitFont(ptsText, 400, '"TS Anton", Impact, sans-serif', first ? 70 : 64, w - (logo ? 140 : 50), 30);
    ctx.font = `400 ${ps}px "TS Anton", Impact, sans-serif`;
    const pb = y + h - 56;
    ctx.fillStyle = goldGradient(pb - ps * 0.8, pb);
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 8;
    ctx.fillText(ptsText, cx0 + (logo ? 44 : 0), pb); ctx.shadowBlur = 0;

    // stat row (always shows +/- so all three cards match)
    const parts = [`${s.gp} GP`, `${s.g} G`, `${s.a} A`, signed(Number(s.pm) || 0)];
    ctx.font = '700 27px "TS Barlow", sans-serif';
    const sep = 26, widths = parts.map((p) => ctx.measureText(p).width);
    const total = widths.reduce((a, b) => a + b, 0) + sep * (parts.length - 1);
    const scale = Math.min(1, (w - 36) / total);
    ctx.save(); ctx.translate(cx0, y + h - 20); ctx.scale(scale, scale);
    let cx = -total / 2;
    parts.forEach((p, i) => {
      ctx.textAlign = 'left'; ctx.fillStyle = '#f4f2ec'; ctx.fillText(p, cx, 0); cx += widths[i];
      if (i < parts.length - 1) { ctx.fillStyle = 'rgba(241,196,90,.85)'; ctx.fillRect(cx + sep / 2 - 1, -22, 2, 24); cx += sep; }
    });
    ctx.restore();
    ctx.restore();
  }

  let drawSeq = 0;
  async function draw() {
    const seq = ++drawSeq;
    await fontsReady;
    const savedBg = state.bgMode === 'auto' ? await firstImage(`${ASSET_DIR}/background`) : null;
    const crest = await loadImage('assets/brand/ecm-crest.webp');
    const jerseys = {}, logos = {};
    await Promise.all([1, 2, 3].map(async (rank) => {
      const s = state.stars[rank];
      jerseys[rank] = state.jerseyOverride[rank] || (s.teamId ? await firstImage(jerseyBase(s.teamId)) : null);
      logos[rank] = s.teamId ? await loadImage(logoSrc(s.teamId)) : null;
    }));
    const bg = state.bgOverride || savedBg;
    const L = (bg && await artLayout()) || BUILTIN_LAYOUT;
    if (seq !== drawSeq) return; // a newer draw started

    ctx.clearRect(0, 0, W, H);
    if (bg) drawCover(bg); else drawBuiltInBackground();
    if (!L.baked.header) drawHeader(crest);
    drawKicker(L);
    SLOTS.forEach((slot) => {
      const s = state.stars[slot.rank], S = L.slots[slot.rank];
      if (jerseys[slot.rank]) drawJersey(S.jersey, jerseys[slot.rank], slot.rank);
      else drawJerseyPlaceholder(S.jersey, s);
      drawNameplate(S.plate, s, slot.rank, L);
      drawCard(slot, S.card, s, logos[slot.rank], L);
    });

    document.querySelectorAll('[data-title-field]').forEach((el) => { el.hidden = L.baked.header; });
    const missing = [1, 2, 3].filter((r) => state.stars[r].teamId && !jerseys[r]).map((r) => `team${state.stars[r].teamId}`);
    const note = [];
    if (!bg) note.push('Using the built-in lockers until assets/three-stars/background.png is added.');
    if (L.baked.header && scope() === 'week') note.push('The title "TONIGHT\'S THREE STARS" is part of the background art; add a week version of the art for week posts.');
    if (missing.length) note.push(`Missing jerseys: ${missing.join(', ')}.`);
    $('tsAssetNote').textContent = note.join(' ');
  }

  // Exposed for tests / console use.
  window.ECMThreeStars = { state, draw, suggest, aggregate, parseCSV, defaultNight };

  bind();
  renderStarEditors();
  renderNudges();
  loadTeams().then(draw);
  draw();
})();
