/* EliteChel Media · Elite Live Hub.
 * Public page. Reads only public feeds the rest of the site already uses:
 *   /api/lgchl-scores (LGCHL scores), /api/live-ticker (Hitmen games),
 *   /api/czechia-pregame via czechia-pregame-feed.js (World Juniors fixtures + lineups),
 *   Supabase tournament_automation_sources (public, active listings) and obs_broadcast_state
 *   (public Czechia stream URL) with the publishable key.
 * Never writes anything remote. Viewer preferences (favourites, multiview, picks, reminders)
 * live in localStorage only. Anything not backed by a real feed is labelled DEMO.
 */
(() => {
  'use strict';
  const SB_URL = 'https://lrgllzvwgvqagcpiyvfd.supabase.co';
  const SB_KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const db = window.supabase?.createClient(SB_URL, SB_KEY, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'elite-live-hub-public'}});

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[c]);
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('elh:' + k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('elh:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const timeFmt = new Intl.DateTimeFormat([], {hour: 'numeric', minute: '2-digit'});
  const dayFmt = new Intl.DateTimeFormat([], {weekday: 'short', month: 'short', day: 'numeric'});
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const when = d => !d ? 'TBD' : (sameDay(d, new Date()) ? 'Tonight ' : dayFmt.format(d) + ' · ') + timeFmt.format(d);
  const host = location.hostname || 'localhost';
  const GAME_WINDOW = 35 * 60e3;

  const LEAGUES = [
    {id: 'ALL', label: 'All'},
    {id: 'LGCHL', label: 'LGCHL'},
    {id: 'HITMEN', label: 'Hitmen'},
    {id: 'WJC', label: 'World Juniors'},
    {id: 'LG3S', label: 'LG Threes'},
  ];
  const LEAGUE_NAME = {LGCHL: 'LGCHL', HITMEN: 'Hitmen Live', WJC: 'LG World Juniors', LG3S: 'LG Threes'};
  const logo = id => `/assets/lgchl/s55/48/team${id}.webp`;
  const flag = code => `/assets/lg3s-world/flags/${code}.svg`;
  const NATION_FLAGS = {canada: 'ca', czechia: 'cz', finland: 'fi', germany: 'de', sweden: 'se', usa: 'us', switzerland: 'ch', 'great britain': 'gb'};

  /* ---------- Demo slate (clearly labelled DEMO everywhere it appears) ---------- */
  const demoTeam = (abbr, city, name, crest, extra) => ({abbr, city, name, crest, ...extra});
  const lineup = (abbr, names) => ['C', 'LW', 'RW', 'LD', 'RD', 'G'].map((pos, i) => ({position: pos, name: names[i], team: abbr}));
  const DEMO = [
    {
      id: 'demo-ecm1', name: 'ECM Network 1', league: 'LGCHL', kind: 'official', demo: true, status: 'live',
      title: 'Western Final · Game 6', story: 'Spokane leads the series 3–2. Medicine Hat has won four straight elimination games.',
      period: '3RD', clock: '06:42', pp: {team: 'MHT', left: '1:14'}, viewers: 4820, crew: 'Demo PxP · Demo Analyst',
      away: demoTeam('MHT', 'Medicine Hat', 'Tigers', logo(416), {score: 3, shots: 29, hits: 22, fo: 54, toa: '08:44', ppText: '2/4'}),
      home: demoTeam('SPO', 'Spokane', 'Chiefs', logo(420), {score: 4, shots: 31, hits: 27, fo: 46, toa: '09:19', ppText: '1/3'}),
      win: 64,
      pulse: [[2, 28], [6, 55, 'SPO goal 1–0'], [12, -40, 'MHT PP goal 1–1'], [18, 35], [25, -65, 'MHT breakaway 2–2'], [32, 72, 'SPO one-timer 3–2'], [39, 84, 'SPO goal 4–2'], [48, -52, 'MHT wrister 4–3'], [53, -38]],
      events: [['3RD', '11:08', 'MHT', 'Demo_Vortex91', 'PP'], ['2ND', '18:41', 'SPO', 'Demo_McTavish23', 'EV'], ['2ND', '04:12', 'SPO', 'Demo_Dangle7', 'EV']],
      lineup: [...lineup('SPO', ['Demo_Dangle7', 'Demo_McTavish23', 'Demo_Mercer44', 'Demo_Ryder5', 'Demo_Stone2', 'Demo_Wall31']), ...lineup('MHT', ['Demo_Vortex91', 'Demo_Keller88', 'Demo_Snipe14', 'Demo_Byers4', 'Demo_Hale6', 'Demo_Brick30'])],
      stars: ['Demo_McTavish23 · 1G 2A', 'Demo_Vortex91 · 2G', 'Demo_Wall31 · 28 SV'],
    },
    {
      id: 'demo-ecm2', name: 'ECM Network 2', league: 'LGCHL', kind: 'official', demo: true, status: 'live',
      title: 'OHL Central · Rivalry Night', story: 'Barrie can clinch top spot in the Central with a regulation win.',
      period: '2ND', clock: '12:05', viewers: 2210, crew: 'Demo PxP',
      away: demoTeam('SBY', 'Sudbury', 'Wolves', logo(447), {score: 1, shots: 14, hits: 18, fo: 48, toa: '05:10', ppText: '0/2'}),
      home: demoTeam('BAR', 'Barrie', 'Colts', logo(449), {score: 2, shots: 19, hits: 12, fo: 52, toa: '06:02', ppText: '1/1'}),
      win: 71, pulse: [[3, 20], [8, 48, 'BAR goal 1–0'], [14, -30], [19, -58, 'SBY goal 1–1'], [26, 40, 'BAR PP goal 2–1'], [31, 15]],
      events: [['2ND', '06:44', 'BAR', 'Demo_Colt19', 'PP'], ['1ST', '19:02', 'SBY', 'Demo_Howl12', 'EV'], ['1ST', '07:51', 'BAR', 'Demo_Rook8', 'EV']],
      lineup: [...lineup('BAR', ['Demo_Colt19', 'Demo_Rook8', 'Demo_Maple3', 'Demo_Iron55', 'Demo_Pike27', 'Demo_Glove1']), ...lineup('SBY', ['Demo_Howl12', 'Demo_Lupo9', 'Demo_North17', 'Demo_Basalt2', 'Demo_Ridge44', 'Demo_Den35'])],
      stars: ['Demo_Colt19 · 1G', 'Demo_Glove1 · 13 SV', 'Demo_Howl12 · 1G'],
    },
    {
      id: 'demo-threes', name: 'LG Threes Cam', league: 'LG3S', kind: 'community', demo: true, status: 'intermission',
      title: 'Threes Showcase · Canada vs Finland', story: '3-on-3 open ice. Finland has scored first in five straight.',
      period: 'INT 1', clock: '11:45', viewers: 960, crew: 'Demo community cast',
      away: demoTeam('FIN', 'Team', 'Finland', flag('fi'), {score: 2, shots: 11, hits: 3, fo: 41, toa: '03:58', ppText: '0/0'}),
      home: demoTeam('CAN', 'Team', 'Canada', flag('ca'), {score: 2, shots: 12, hits: 5, fo: 59, toa: '04:20', ppText: '1/1'}),
      win: 55, pulse: [[2, -35, 'FIN goal 0–1'], [5, 10], [8, 44, 'CAN goal 1–1'], [11, -20, 'FIN goal 1–2'], [14, 52, 'CAN PP goal 2–2']],
      events: [['1ST', '13:40', 'CAN', 'Demo_Maple91', 'PP'], ['1ST', '10:12', 'FIN', 'Demo_Sisu8', 'EV']],
      lineup: [...lineup('CAN', ['Demo_Maple91', 'Demo_Toque2', '', 'Demo_Puckd4', '', 'Demo_Zam30']).filter(p => p.name), ...lineup('FIN', ['Demo_Sisu8', 'Demo_Lumi7', '', 'Demo_Kivi5', '', 'Demo_Talvi33']).filter(p => p.name)],
      stars: ['Demo_Maple91 · 1G 1A', 'Demo_Sisu8 · 1G', 'Demo_Zam30 · 10 SV'],
    },
    {
      id: 'demo-qmjhl', name: 'Maritime Community Cast', league: 'LGCHL', kind: 'community', demo: true, status: 'pregame',
      title: 'QMJHL · Battle of the Maritimes', story: 'First place in the Eastern conference is on the line.',
      period: 'PRE', clock: '—', viewers: 410, crew: 'Demo community cast',
      away: demoTeam('HFX', 'Halifax', 'Mooseheads', logo(364), {score: 0, shots: 0, hits: 0, fo: 50, toa: '00:00', ppText: '0/0'}),
      home: demoTeam('MON', 'Moncton', 'Wildcats', logo(365), {score: 0, shots: 0, hits: 0, fo: 50, toa: '00:00', ppText: '0/0'}),
      win: 58, pulse: [], events: [],
      lineup: [...lineup('MON', ['Demo_Tide10', 'Demo_Salt21', 'Demo_Fog6', 'Demo_Anchor3', 'Demo_Keel22', 'Demo_Light40']), ...lineup('HFX', ['Demo_Moose15', 'Demo_Harbor9', 'Demo_Pier18', 'Demo_Gale5', 'Demo_Bluenose4', 'Demo_Citadel1'])],
      stars: [],
    },
    {
      id: 'demo-final', name: 'ECM Postgame Desk', league: 'LGCHL', kind: 'official', demo: true, status: 'final',
      title: 'WHL East · Final', story: 'Penticton scored three in the third to pull away.',
      period: 'FINAL', clock: '00:00', viewers: 0, crew: 'Demo desk',
      away: demoTeam('PEN', 'Penticton', 'Vees', logo(2981), {score: 5, shots: 34, hits: 19, fo: 51, toa: '10:02', ppText: '2/3'}),
      home: demoTeam('PAR', 'Prince Albert', 'Raiders', logo(413), {score: 2, shots: 25, hits: 24, fo: 49, toa: '08:31', ppText: '0/4'}),
      win: 0, pulse: [[5, -20], [15, 30, 'PAR goal 0–1'], [28, -45, 'PEN goal 1–1'], [41, -60, 'PEN goal 2–1'], [50, -75, 'PEN goals 4–1'], [58, 20, 'PAR goal 4–2']],
      events: [['3RD', '18:10', 'PEN', 'Demo_Vee11', 'EN'], ['3RD', '09:44', 'PEN', 'Demo_Orchard7', 'PP']],
      lineup: [], stars: ['Demo_Vee11 · 2G 1A', 'Demo_Orchard7 · 1G 2A', 'Demo_Raider3 · 2A'],
    },
  ];
  const DEMO_RUNDOWN = [
    {offset: -50, title: 'EliteChel Pregame Show', sub: 'Desk preview of the night', channel: 'demo-ecm1', kind: 'show'},
    {offset: -20, title: 'Puck drop · MHT at SPO', sub: 'ECM Network 1', channel: 'demo-ecm1', kind: 'game'},
    {offset: 10, title: 'First intermission report', sub: 'Goals, chances, three questions', channel: 'demo-ecm1', kind: 'show'},
    {offset: 35, title: 'Puck drop · HFX at MON', sub: 'Maritime Community Cast', channel: 'demo-qmjhl', kind: 'game'},
    {offset: 95, title: 'Postgame Desk', sub: 'Three stars and highlights', channel: 'demo-final', kind: 'show'},
  ];

  /* ---------- State ---------- */
  const S = {
    mode: 'auto', view: 'network', theatre: false, companion: 'scores',
    featured: null, kind: 'all', find: '', tickerLeague: 'ALL',
    channels: [], ticker: [], rundown: [], realRundown: false,
    hitmen: null, lgchl: null, czechia: [], czechiaUrl: 'https://www.twitch.tv/lbubbzzl', czechiaView: 'pregame',
    favs: store.get('favs', []), reminders: store.get('reminders', []), picks: store.get('picks', {}),
    mv: store.get('mv', {layout: 4, slots: ['hitmen', 'czechia', 'demo-ecm1', 'demo-ecm2'], low: false, focus: 0}),
    custom: store.get('custom', []), goal: null, feeds: {scores: 'loading', hitmen: 'loading', czechia: 'loading', listings: 'loading'},
  };

  /* ---------- URLs and embeds ---------- */
  function canonical(raw) {
    try {
      const u = new URL(String(raw || '').trim());
      if (u.protocol !== 'https:') return null;
      const h = u.hostname.toLowerCase().replace(/^www\./, '');
      const p = u.pathname.split('/').filter(Boolean);
      if (['twitch.tv', 'm.twitch.tv'].includes(h) && p[0] && /^[a-z0-9_]{3,25}$/i.test(p[0]) && !['videos', 'search', 'directory', 'downloads', 'clip', 'settings'].includes(p[0].toLowerCase())) return 'https://www.twitch.tv/' + p[0].toLowerCase();
      if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(h)) {
        const id = h === 'youtu.be' ? p[0] : u.searchParams.get('v') || (['live', 'embed'].includes(p[0]) ? p[1] : '');
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return 'https://www.youtube.com/watch?v=' + id;
      }
    } catch { /* invalid */ }
    return null;
  }
  function playerSrc(url, muted) {
    const u = new URL(url);
    if (u.hostname === 'www.twitch.tv') return 'https://player.twitch.tv/?' + new URLSearchParams({channel: u.pathname.slice(1), parent: host, autoplay: 'false', muted: String(!!muted)});
    return 'https://www.youtube.com/embed/' + encodeURIComponent(u.searchParams.get('v')) + (muted ? '?mute=1' : '');
  }
  const urlLabel = url => { try { const u = new URL(url); return u.hostname === 'www.twitch.tv' ? u.pathname.slice(1) : 'YouTube'; } catch { return 'stream'; } };

  // What a channel plays in a frame: {src} for an iframe, or null for a poster (demo / off-air).
  function source(ch, opts = {}) {
    if (ch.demo) return null;
    if (ch.id === 'hitmen') return {src: 'public-broadcast-stage.html?channel=hitmen-main', title: 'Calgary Hitmen live broadcast'};
    if (ch.id === 'czechia') {
      const next = nextCzechia();
      if ((opts.view || S.czechiaView) === 'pregame' && next) return {src: '/czechia-obs.html?' + new URLSearchParams({game: next.key, view: 'live-hub'}), title: 'Czechia vs ' + next.opponent + ' pregame'};
      return {src: playerSrc(S.czechiaUrl, opts.muted), title: 'Czechia gameplay from ' + urlLabel(S.czechiaUrl)};
    }
    if (ch.url) return {src: playerSrc(ch.url, opts.muted), title: ch.name};
    return null;
  }

  /* ---------- Channels ---------- */
  function houseChannels() {
    const h = S.hitmen, live = h?.live, next = h?.next;
    const g = live || next;
    const hitmen = {
      id: 'hitmen', name: 'Hitmen Live', league: 'HITMEN', kind: 'official', real: true,
      status: live ? 'live' : next ? 'upcoming' : 'offair',
      title: g ? `Calgary Hitmen ${g.home ? 'vs' : 'at'} ${g.opponent.name}` : 'Calgary Hitmen broadcast',
      story: h ? `Season ${h.season} · ${h.record?.label || ''} · ${h.record?.division || 'LGCHL'}${h.streak ? ' · Streak ' + h.streak.label : ''}` : 'The official Calgary Hitmen broadcast stage.',
      start: g?.at ? new Date(g.at) : null, crest: '/assets/lgchl/s55/48/team412.webp',
      link: 'game-center.html?channel=hitmen', external: 'https://www.twitch.tv/ctbli',
      away: g ? (g.home ? {abbr: g.opponent.abbr, name: g.opponent.name, crest: g.opponent.logo} : {abbr: 'CGY', name: 'Hitmen', crest: '/assets/lgchl/s55/48/team412.webp'}) : null,
      home: g ? (g.home ? {abbr: 'CGY', name: 'Hitmen', crest: '/assets/lgchl/s55/48/team412.webp'} : {abbr: g.opponent.abbr, name: g.opponent.name, crest: g.opponent.logo}) : null,
    };
    const c = nextCzechia(), now = Date.now();
    const cs = c ? (now >= c.start - 60 * 60e3 && now < c.start ? 'pregame' : now >= c.start && now < c.start + GAME_WINDOW ? 'live' : 'upcoming') : 'offair';
    const opp = c ? (NATION_FLAGS[c.opponent.toLowerCase()] ? flag(NATION_FLAGS[c.opponent.toLowerCase()]) : null) : null;
    const czechia = {
      id: 'czechia', name: 'Czechia · World Juniors', league: 'WJC', kind: 'official', real: true, status: cs,
      title: c ? 'Czechia vs ' + c.opponent : 'Czechia World Juniors',
      story: c ? 'LG World Junior Championships. Carbon Arena pregame with lineups, then the gameplay feed.' : 'The next Czechia matchup appears when the schedule is posted.',
      start: c ? new Date(c.start) : null, crest: flag('cz'), link: 'esports-hub.html#czechia', external: S.czechiaUrl,
      away: c ? {abbr: c.opponent.slice(0, 3).toUpperCase(), name: c.opponent, crest: opp} : null,
      home: c ? {abbr: 'CZE', name: 'Czechia', crest: flag('cz')} : null,
      lineup: c ? [...c.czech.map(p => ({...p, team: 'CZE'})), ...c.away.map(p => ({...p, team: c.opponent.slice(0, 3).toUpperCase()}))] : [],
    };
    return [hitmen, czechia];
  }
  function nextCzechia() {
    const now = Date.now();
    const list = S.czechia.map(g => ({...g, start: Date.parse(g.date + 'T' + toUtcTime(g) + 'Z')})).filter(g => Number.isFinite(g.start)).sort((a, b) => a.start - b.start);
    return list.find(g => g.start + GAME_WINDOW > now) || null;
  }
  // The feed gives an ET display time; the raw UTC time is kept on the game as `utc`.
  const toUtcTime = g => g.utc || '00:00';

  function allChannels() {
    const custom = S.custom.map((url, i) => ({id: 'custom-' + i, name: urlLabel(url), league: 'ALL', kind: 'community', real: true, custom: true, status: 'listed', url, title: 'Your added stream', story: 'Added by you on this device. Live status not checked.', external: url}));
    return [...houseChannels(), ...S.channels, ...custom, ...DEMO];
  }
  const channel = id => allChannels().find(c => c.id === id);
  const onAirReal = () => allChannels().some(c => c.real && c.status === 'live');
  const isOnAir = () => S.mode === 'on' || (S.mode === 'auto' && onAirReal());

  const STATUS = {live: 'Live', pregame: 'Pregame', intermission: 'Intermission', final: 'Final', upcoming: 'Up next', listed: 'Listed', offair: 'Off air'};
  const statusPill = c => `<span class="elh-pill elh-st-${c.status}">${c.status === 'live' ? '<i class="elh-dot"></i>' : ''}${STATUS[c.status] || c.status}</span>`;
  const badge = c => c.demo ? '<span class="elh-pill elh-pill-demo">Demo</span>' : c.custom ? '<span class="elh-pill elh-pill-line">Yours</span>' : '<span class="elh-pill elh-pill-real">Live data</span>';
  const crest = (t, size = 40) => t?.crest ? `<img class="elh-crest" src="${esc(t.crest)}" width="${size}" height="${size}" alt="" loading="lazy">` : `<span class="elh-crest elh-crest-txt" style="width:${size}px;height:${size}px">${esc((t?.abbr || '?').slice(0, 3))}</span>`;

  /* ---------- Feeds ---------- */
  async function getJSON(url, ms = 7000) {
    const r = await fetch(url, {signal: AbortSignal.timeout(ms), headers: {accept: 'application/json'}});
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }
  async function loadScores() {
    try {
      const d = await getJSON('/api/lgchl-scores?view=ticker&scope=featured');
      if (!d?.ok) throw new Error('scores');
      S.lgchl = d; S.feeds.scores = 'ok';
    } catch { S.feeds.scores = 'down'; }
  }
  async function loadHitmen() {
    try {
      const d = await getJSON('/api/live-ticker');
      if (!d?.ok) throw new Error('hitmen');
      S.hitmen = d; S.feeds.hitmen = 'ok';
    } catch { S.feeds.hitmen = 'down'; }
  }
  async function loadCzechia() {
    try {
      const feed = window.ECMCzechiaPregame;
      if (!feed) throw new Error('feed');
      // The shared feed formats ET for display; re-read the raw UTC times for countdowns.
      const [{games}, raw] = await Promise.all([feed.load(), getJSON('/api/czechia-pregame', 6500)]);
      const utc = new Map((raw.games || []).map(g => ['lg-' + g.id, g.time]));
      S.czechia = games.map(g => ({...g, utc: utc.get(g.key)}));
      S.feeds.czechia = 'ok';
    } catch { S.feeds.czechia = 'down'; }
    if (!db) return;
    try {
      const r = await db.from('obs_broadcast_state').select('url:payload->>streamUrl').eq('channel', 'wjhc-czechia').eq('is_public', true).maybeSingle();
      const url = canonical(r.data?.url);
      if (!r.error && url && !/twitch\.tv\/ctbli\b/i.test(url)) S.czechiaUrl = url;
    } catch { /* keep default */ }
  }
  async function loadListings() {
    if (!db) { S.feeds.listings = 'down'; return; }
    try {
      const {data, error} = await db.from('tournament_automation_sources').select('id,url,provider,display_label,metadata').eq('active', true).eq('public_visible', true).limit(200);
      if (error) throw error;
      const seen = new Set();
      S.channels = (data || []).flatMap(s => {
        const url = canonical(s.url);
        if (!url || /twitch\.tv\/ctbli\b/i.test(url) || seen.has(url)) return [];
        const m = s.metadata || {};
        const tag = [m.league, m.league_key, m.competition, m.category, m.title, s.display_label].filter(Boolean).join(' ').toLowerCase();
        const league = /\blg\s*3s\b|\blg\s*threes\b|leaguegaming\s*3s/.test(tag) ? 'LG3S' : /\blgchl\b|\bcalgary hitmen\b/.test(tag) ? 'LGCHL' : null;
        if (!league) return [];
        seen.add(url);
        return [{id: 'src-' + s.id, sourceId: s.id, name: s.display_label || m.title || urlLabel(url), league, kind: 'community', real: true, status: 'listed', url, external: url, title: m.title || s.display_label || 'Public broadcast', story: 'Public ' + LEAGUE_NAME[league] + ' listing. Live status is not independently checked.'}];
      });
      S.feeds.listings = 'ok';
    } catch { S.feeds.listings = 'down'; }
  }

  /* ---------- Ticker ---------- */
  function buildTicker() {
    const items = [];
    const d = S.lgchl;
    if (d) {
      const team = id => d.teams?.[id] || {abbr: '?', name: 'TBD'};
      const push = (g, night) => {
        const a = team(g.away), h = team(g.home);
        const final = g.state === 'final' && g.away_score != null;
        items.push({league: 'LGCHL', tag: g.league || 'LGCHL', real: true,
          away: {abbr: a.abbr, score: final || g.state === 'live' ? g.away_score : null, crest: a.logo},
          home: {abbr: h.abbr, score: final || g.state === 'live' ? g.home_score : null, crest: h.logo},
          state: g.state === 'live' ? 'LIVE' : final ? 'FINAL' : g.state === 'pending' ? 'AWAITING' : timeFmt.format(new Date(g.at)),
          live: g.state === 'live', href: g.url, night});
      };
      (d.today?.games || []).forEach(g => push(g, 'today'));
      (d.last_night?.games || []).forEach(g => push(g, 'last'));
      (d.next_night?.games || []).slice(0, 8).forEach(g => push(g, 'next'));
    }
    const h = S.hitmen;
    if (h) {
      const cg = {abbr: 'CGY', crest: '/assets/lgchl/s55/48/team412.webp'};
      const row = (g, state) => {
        const opp = {abbr: g.opponent.abbr, crest: g.opponent.logo};
        const us = {...cg, score: g.gf}, them = {...opp, score: g.ga};
        items.unshift({league: 'HITMEN', tag: 'HITMEN', real: true, away: g.home ? them : us, home: g.home ? us : them, state, live: state === 'LIVE', channel: 'hitmen'});
      };
      (h.recent || []).slice(0, 2).reverse().forEach(g => row(g, 'FINAL'));
      if (h.next) row({...h.next, gf: null, ga: null}, when(new Date(h.next.at)).replace('Tonight ', ''));
      if (h.live) row(h.live, 'LIVE');
    }
    const c = nextCzechia();
    if (c) items.unshift({league: 'WJC', tag: 'WJC', real: true, away: {abbr: c.opponent.slice(0, 3).toUpperCase(), crest: NATION_FLAGS[c.opponent.toLowerCase()] ? flag(NATION_FLAGS[c.opponent.toLowerCase()]) : null}, home: {abbr: 'CZE', crest: flag('cz')}, state: when(new Date(c.start)).replace('Tonight ', ''), channel: 'czechia'});
    const demoOn = S.mode === 'on' && !onAirReal();
    if (!items.length || demoOn) {
      DEMO.forEach(m => items.push({league: m.league, tag: 'DEMO', demo: true, away: m.away, home: m.home, state: m.status === 'final' ? 'FINAL' : m.period + (m.status === 'live' ? ' ' + m.clock : ''), live: m.status === 'live', channel: m.id}));
    }
    S.ticker = items;
  }
  function renderTicker() {
    const f = $('#elhTickerFilter');
    f.innerHTML = LEAGUES.filter(l => l.id === 'ALL' || S.ticker.some(t => t.league === l.id)).map(l => `<button type="button" data-league="${l.id}" aria-pressed="${S.tickerLeague === l.id}">${esc(l.label)}</button>`).join('');
    const rows = S.ticker.filter(t => S.tickerLeague === 'ALL' || t.league === S.tickerLeague);
    const cell = t => {
      const side = s => `<span class="elh-tk-team">${s.crest ? `<img src="${esc(s.crest)}" width="20" height="20" alt="" loading="lazy">` : ''}<b>${esc(s.abbr)}</b><em>${s.score ?? ''}</em></span>`;
      const tagName = t.channel ? 'button' : t.href ? 'a' : 'div';
      const attrs = t.channel ? `type="button" data-feature="${esc(t.channel)}"` : t.href ? `href="${esc(t.href)}" target="_blank" rel="noopener noreferrer"` : '';
      return `<${tagName} class="elh-tk${t.live ? ' is-live' : ''}${t.demo ? ' is-demo' : ''}" ${attrs}><small>${esc(t.tag)}</small>${side(t.away)}${side(t.home)}<span class="elh-tk-state">${t.live ? '<i class="elh-dot"></i>' : ''}${esc(t.state)}</span></${tagName}>`;
    };
    const html = rows.map(cell).join('') || '<div class="elh-tk is-empty">No games in this window</div>';
    const track = $('#elhTicker');
    track.innerHTML = `<div class="elh-tk-run">${html}</div><div class="elh-tk-run" aria-hidden="true">${html}</div>`;
    $$('[aria-hidden="true"] a, [aria-hidden="true"] button', track).forEach(el => el.tabIndex = -1);
    track.style.setProperty('--elh-tk-dur', Math.max(30, rows.length * 4.5) + 's');
    const parts = [];
    if (S.feeds.scores === 'ok') parts.push('LGCHL'); if (S.feeds.hitmen === 'ok') parts.push('Hitmen'); if (S.feeds.czechia === 'ok') parts.push('WJC');
    $('#elhTickerSrc').textContent = S.ticker.some(t => t.demo) && !parts.length ? 'Demo' : parts.length ? parts.join(' · ') : 'Offline';
  }

  /* ---------- Air state ---------- */
  function renderAir() {
    const on = isOnAir(), real = onAirReal();
    const el = $('#elhAir');
    el.dataset.air = on ? 'on' : 'off';
    $('#elhAirLabel').textContent = on ? 'On air' : 'Off air';
    const live = allChannels().filter(c => c.real && c.status === 'live').length;
    const next = S.rundown.find(r => r.at && r.at > Date.now() && r.real);
    $('#elhAirSub').textContent = on ? (real ? live + ' live now' : 'Demo game night') : next ? 'Next: ' + when(new Date(next.at)) : 'No broadcasts scheduled';
    $$('.elh-seg [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
    document.body.dataset.air = on ? 'on' : 'off';
  }

  /* ---------- Stage ---------- */
  function pickFeatured() {
    const q = new URLSearchParams(location.search).get('feature');
    const list = allChannels();
    if (q && !S.featured && list.some(c => c.id === q)) S.picked = true;
    if (S.featured && list.some(c => c.id === S.featured)) return;
    S.featured = (q && list.some(c => c.id === q) ? q : null) ||
      list.find(c => c.real && c.status === 'live')?.id ||
      (S.mode === 'on' ? DEMO[0].id : null) ||
      list.find(c => c.real && ['pregame', 'upcoming'].includes(c.status))?.id || 'hitmen';
  }
  let stageSig = '';
  function renderStage() {
    const on = isOnAir();
    const ch = channel(S.featured) || channel('hitmen');
    const stage = $('#elhStage');
    stage.classList.toggle('is-theatre', S.theatre);
    $('.elh-stage-row').classList.toggle('is-theatre', S.theatre);
    stage.dataset.view = S.view;
    $$('#elhViewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));

    if (!on && !S.picked) {
      $('#elhStageStatus').outerHTML = '<span class="elh-pill elh-st-offair" id="elhStageStatus">Off air</span>';
      $('#elhStageLeague').textContent = 'EliteChel Media';
      $('#elhStageDemo').hidden = true;
      setTitle('Between broadcasts');
      $('#elhStageSub').textContent = 'Nothing is live right now. Here is what is coming up next.';
      const sig = 'off|' + S.rundown.map(r => r.id).join(',');
      if (sig !== stageSig) { stageSig = sig; $('#elhScreen').innerHTML = offAirScreen(); }
      $('#elhStageActions').innerHTML = `<button type="button" class="elh-btn" data-mode-set="on">Preview a game night</button><a class="elh-btn elh-btn-ghost" href="#arena">Explore Carbon Arena</a>`;
      $('#elhPulse').innerHTML = '';
      tickCountdown();
      return;
    }
    $('#elhStageStatus').outerHTML = statusPill(ch).replace('<span class="elh-pill', '<span id="elhStageStatus" class="elh-pill');
    $('#elhStageLeague').textContent = LEAGUE_NAME[ch.league] || 'Community';
    $('#elhStageDemo').hidden = !ch.demo;
    setTitle(ch.demo ? `${ch.away.city} ${ch.away.name} at ${ch.home.city} ${ch.home.name}` : ch.title);
    $('#elhStageSub').textContent = (ch.name + ' · ') + (ch.story || '');
    const src = source(ch);
    const sig = ch.id + '|' + (src?.src || 'poster') + '|' + S.view + '|' + (ch.demo ? ch.away.score + '-' + ch.home.score : '');
    if (sig !== stageSig) {
      stageSig = sig;
      $('#elhScreen').innerHTML = (ch.demo || ch.away ? scorebug(ch) : '') + (src
        ? `<div class="elh-frame"><iframe src="${esc(src.src)}" title="${esc(src.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`
        : poster(ch, true)) + (S.view === 'hud' ? hud(ch) : '');
    }
    const inMv = S.mv.slots.includes(ch.id);
    $('#elhStageActions').innerHTML = [
      ch.id === 'czechia' ? `<div class="elh-seg elh-seg-sm" role="group" aria-label="Czechia feed"><button type="button" data-czv="pregame" aria-pressed="${S.czechiaView === 'pregame'}">Carbon pregame</button><button type="button" data-czv="game" aria-pressed="${S.czechiaView === 'game'}">Gameplay</button></div>` : '',
      `<button type="button" class="elh-btn elh-btn-ghost" data-theatre>${S.theatre ? 'Exit theatre' : 'Theatre'}</button>`,
      `<button type="button" class="elh-btn${inMv ? ' elh-btn-ghost' : ''}" data-mv-add="${esc(ch.id)}" ${inMv ? 'disabled' : ''}>${inMv ? 'In multiview' : '+ Multiview'}</button>`,
      `<button type="button" class="elh-btn elh-btn-ghost" data-open-channel="${esc(ch.id)}">Channel view</button>`,
      ch.demo && ch.status === 'live' ? `<button type="button" class="elh-btn elh-btn-red" data-goal="${esc(ch.id)}">Test goal alert</button>` : '',
      ch.external ? `<a class="elh-btn elh-btn-ghost" href="${esc(ch.external)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : '',
    ].join('');
    $('#elhPulse').innerHTML = pulse(ch);
  }
  function setTitle(t) { const h = $('#elhStageTitle'); h.textContent = t; h.dataset.text = t; }
  function scorebug(ch) {
    if (!ch.away || !ch.home) return '';
    const s = t => `<div class="elh-sb-team">${crest(t, 34)}<b>${esc(t.abbr)}</b>${t.score != null ? `<em>${t.score}</em>` : ''}</div>`;
    const mid = ch.demo ? `${esc(ch.period)}${ch.status === 'live' ? ' · ' + esc(ch.clock) : ''}` : ch.start ? esc(when(ch.start)) : '';
    return `<div class="elh-scorebug">${s(ch.away)}<div class="elh-sb-mid"><span>${mid}</span>${ch.pp ? `<small class="elh-sb-pp">PP ${esc(ch.pp.team)} ${esc(ch.pp.left)}</small>` : ''}</div>${s(ch.home)}</div>`;
  }
  function poster(ch, big) {
    const label = ch.demo ? 'Demo feed · no video' : ch.status === 'offair' ? 'Off air' : 'Opens on the source';
    return `<div class="elh-poster${big ? ' is-big' : ''}${ch.status === 'live' ? ' is-live' : ''}"><i class="elh-poster-photo" aria-hidden="true"></i>
      <div class="elh-poster-teams">${ch.away ? crest(ch.away, big ? 120 : 56) : crest({crest: ch.crest, abbr: ch.name}, big ? 120 : 56)}${ch.home ? `<span class="elh-vs">VS</span>${crest(ch.home, big ? 120 : 56)}` : ''}</div>
      <span class="elh-poster-tag">${esc(label)}</span></div>`;
  }
  function hud(ch) {
    if (!ch.demo) {
      const h = S.hitmen;
      const rows = ch.id === 'hitmen' && h ? [['Record', h.record?.label], ['Points', h.record?.pts], ['Goal diff', (h.record?.diff > 0 ? '+' : '') + h.record?.diff], ['Last 5', h.last5]] :
        ch.id === 'czechia' ? [['Event', 'LG World Juniors'], ['Next', ch.start ? when(ch.start) : 'TBD'], ['Lineup', ch.lineup?.length ? ch.lineup.length + ' players' : 'Not posted']] : [['Source', urlLabel(ch.url || '')], ['Status', 'Listed']];
      return `<div class="elh-hud"><h4>Broadcast HUD <small class="elh-chip elh-chip-real">Live data</small></h4>${rows.map(([k, v]) => `<div class="elh-hud-row"><span>${esc(k)}</span><b>${esc(v ?? '—')}</b></div>`).join('')}</div>`;
    }
    const bar = (k, a, b, fmt = v => v) => { const t = (+a || 0) + (+b || 0) || 1; return `<div class="elh-hud-bar"><span>${esc(k)}</span><div><b>${fmt(a)}</b><i style="--a:${(a / t * 100).toFixed(1)}%"></i><b>${fmt(b)}</b></div></div>`; };
    return `<div class="elh-hud"><h4>Pro telemetry <small class="elh-chip elh-chip-demo">Demo</small></h4>
      ${bar('Shots', ch.away.shots, ch.home.shots)}${bar('Hits', ch.away.hits, ch.home.hits)}${bar('Faceoffs %', ch.away.fo, ch.home.fo)}
      <div class="elh-hud-row"><span>Time on attack</span><b>${esc(ch.away.toa)} · ${esc(ch.home.toa)}</b></div>
      <div class="elh-hud-row"><span>Power play</span><b>${esc(ch.away.ppText)} · ${esc(ch.home.ppText)}</b></div></div>`;
  }
  function pulse(ch) {
    if (!ch.demo || !ch.pulse?.length) {
      return ch.demo ? '' : `<div class="elh-pulse-empty"><b>Live Ice Pulse</b><span>Momentum and win probability appear for games with live tracking. This feed does not have tracking data yet.</span></div>`;
    }
    const W = 600, H = 90, mid = H / 2, max = Math.max(60, ...ch.pulse.map(p => p[0]));
    const pts = [[0, 0], ...ch.pulse].map(([m, v]) => [m / max * W, mid - v / 100 * (mid - 6)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const marks = ch.pulse.filter(p => p[2]).map(([m, v, l]) => `<circle cx="${(m / max * W).toFixed(1)}" cy="${(mid - v / 100 * (mid - 6)).toFixed(1)}" r="4"><title>${esc(l)}</title></circle>`).join('');
    const winHome = ch.status === 'final' ? (ch.home.score > ch.away.score ? 100 : 0) : ch.win;
    return `<div class="elh-pulse-in"><div class="elh-pulse-head"><b>Live Ice Pulse</b><small class="elh-chip elh-chip-demo">Demo</small><span>${esc(ch.away.abbr)} pressure ↓ · ↑ ${esc(ch.home.abbr)} pressure</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Momentum through the game"><defs><linearGradient id="elhPg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f98a01" stop-opacity=".65"/><stop offset=".5" stop-color="#f98a01" stop-opacity="0"/><stop offset=".5" stop-color="#dcdcde" stop-opacity="0"/><stop offset="1" stop-color="#dcdcde" stop-opacity=".45"/></linearGradient></defs>
      <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="elh-pulse-axis"/><path d="${line} L${pts.at(-1)[0].toFixed(1)} ${mid} L0 ${mid} Z" fill="url(#elhPg)"/><path d="${line}" class="elh-pulse-line"/>${marks}</svg>
      <div class="elh-win"><span>${esc(ch.away.abbr)} ${100 - winHome}%</span><div class="elh-win-bar"><i style="width:${100 - winHome}%"></i></div><span>${winHome}% ${esc(ch.home.abbr)}</span></div>
      <p class="elh-win-label">${ch.status === 'final' ? 'Final result' : 'Win probability'}</p></div>`;
  }
  function offAirScreen() {
    const next = S.rundown.find(r => r.at && r.at > Date.now());
    const ch = next && channel(next.channel);
    return `<div class="elh-offair"><i class="elh-poster-photo" aria-hidden="true"></i>
      <div class="elh-offair-in">
        <p class="elh-eyebrow">Next on EliteChel Media</p>
        <h3 class="elh-3d elh-3d-lg" data-text="${esc(next ? next.title : 'Stay tuned')}">${esc(next ? next.title : 'Stay tuned')}</h3>
        <p>${esc(next ? next.sub + ' · ' + when(new Date(next.at)) : 'The next broadcast appears here as soon as it is scheduled.')}</p>
        ${next ? `<div class="elh-count3d" data-countdown="${next.at}" aria-label="Countdown"><span><b>--</b><small>Days</small></span><span><b>--</b><small>Hrs</small></span><span><b>--</b><small>Min</small></span><span><b>--</b><small>Sec</small></span></div>` : ''}
        <div class="elh-offair-actions">${next ? `<button type="button" class="elh-btn elh-btn-gold" data-remind="${esc(next.id)}">${S.reminders.includes(next.id) ? 'Reminder set ✓' : 'Remind me'}</button>` : ''}${ch ? `<button type="button" class="elh-btn elh-btn-ghost" data-open-channel="${esc(ch.id)}">${esc(ch.name)}</button>` : ''}
          <a class="elh-btn elh-btn-ghost" href="lgchl-media.html">Recaps &amp; media</a><a class="elh-btn elh-btn-ghost" href="league-leaderboards.html?league=lgchl">Leaders</a></div>
      </div></div>`;
  }
  function tickCountdown() {
    $$('[data-countdown]').forEach(el => {
      let s = Math.max(0, Math.floor((+el.dataset.countdown - Date.now()) / 1000));
      const parts = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
      $$('b', el).forEach((b, i) => { b.textContent = String(parts[i]).padStart(2, '0'); });
    });
  }

  /* ---------- Companion ---------- */
  function renderCompanion() {
    $$('.elh-comp-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.companion)));
    $('#elhCompanion').hidden = S.theatre;
    const ch = channel(S.featured) || channel('hitmen');
    const body = $('#elhCompBody');
    if (S.companion === 'scores') {
      const rows = S.ticker.filter(t => !t.demo || isOnAir()).slice(0, 14);
      body.innerHTML = rows.length ? `<ul class="elh-scores">${rows.map(t => {
        const fav = S.favs.includes(t.home.abbr) || S.favs.includes(t.away.abbr);
        return `<li class="${t.live ? 'is-live' : ''}${fav ? ' is-fav' : ''}"><small>${esc(t.tag)}</small>
          <span class="elh-sc-team">${t.away.crest ? `<img src="${esc(t.away.crest)}" width="22" height="22" alt="">` : ''}<b>${esc(t.away.abbr)}</b><em>${t.away.score ?? ''}</em></span>
          <span class="elh-sc-team">${t.home.crest ? `<img src="${esc(t.home.crest)}" width="22" height="22" alt="">` : ''}<b>${esc(t.home.abbr)}</b><em>${t.home.score ?? ''}</em></span>
          <span class="elh-sc-state">${esc(t.state)}</span>
          <button type="button" class="elh-icon" data-fav-team="${esc(t.home.abbr)}" aria-pressed="${S.favs.includes(t.home.abbr)}" aria-label="Follow ${esc(t.home.abbr)}">★</button>
          ${t.channel ? `<button type="button" class="elh-icon" data-feature="${esc(t.channel)}" aria-label="Watch on stage">▶</button>` : ''}</li>`;
      }).join('')}</ul><p class="elh-note">${S.feeds.scores === 'ok' ? 'LGCHL scores from leaguegaming.com via the site feed.' : 'Live scores are unavailable right now.'} ★ follows a team on this device.</p>` : '<p class="elh-empty">No scores to show yet.</p>';
    } else if (S.companion === 'stats') {
      if (ch.demo) {
        const row = (k, a, b) => `<tr><td>${esc(a)}</td><th>${esc(k)}</th><td>${esc(b)}</td></tr>`;
        body.innerHTML = `<div class="elh-comp-match">${crest(ch.away, 40)}<b>${ch.away.score}</b><span>${esc(ch.period)}</span><b>${ch.home.score}</b>${crest(ch.home, 40)}</div>
          <table class="elh-stat-table"><thead><tr><th>${esc(ch.away.abbr)}</th><th></th><th>${esc(ch.home.abbr)}</th></tr></thead><tbody>
          ${row('Shots', ch.away.shots, ch.home.shots)}${row('Hits', ch.away.hits, ch.home.hits)}${row('Faceoff %', ch.away.fo, ch.home.fo)}${row('Time on attack', ch.away.toa, ch.home.toa)}${row('Power play', ch.away.ppText, ch.home.ppText)}</tbody></table>
          ${ch.events.length ? `<h4 class="elh-mini-title">Scoring</h4><ul class="elh-events">${ch.events.map(e => `<li><small>${esc(e[0])} ${esc(e[1])}</small><b>${esc(e[2])}</b><span>${esc(e[3])}</span><em>${esc(e[4])}</em></li>`).join('')}</ul>` : ''}
          ${ch.stars.length ? `<h4 class="elh-mini-title">Three stars</h4><ol class="elh-stars">${ch.stars.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
          <p class="elh-note"><span class="elh-chip elh-chip-demo">Demo</span> Sample stats for a demo matchup.</p>`;
      } else if (ch.id === 'hitmen' && S.hitmen) {
        const h = S.hitmen, r = h.record || {};
        body.innerHTML = `<div class="elh-kpis">${[['Record', r.label], ['Points', r.pts], ['GF–GA', `${r.gf}–${r.ga}`], ['Streak', h.streak?.label], ['Last 5', h.last5], ['Division', r.division_rank ? '#' + r.division_rank : '—']].map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v ?? '—')}</b></div>`).join('')}</div>
          <h4 class="elh-mini-title">Recent results</h4><ul class="elh-events">${(h.recent || []).map(g => `<li><small>${esc(dayFmt.format(new Date(g.at)))}</small><b>${esc(g.result)}</b><span>${g.home ? 'vs' : 'at'} ${esc(g.opponent.name)}</span><em>${g.gf}–${g.ga}</em></li>`).join('')}</ul>
          <p class="elh-note"><span class="elh-chip elh-chip-real">Live data</span> Season ${esc(h.season)} standings from leaguegaming.com.</p>`;
      } else {
        body.innerHTML = `<p class="elh-empty">Live game stats are not tracked for ${esc(ch.name)} yet.</p><p class="elh-note">Switch to a demo feed to see the full stats panel, or check <a href="league-leaderboards.html?league=lgchl">LGCHL leaders</a>.</p>`;
      }
    } else if (S.companion === 'lineups') {
      const players = ch.demo ? ch.lineup : ch.lineup || [];
      if (!players.length) {
        body.innerHTML = `<p class="elh-empty">${ch.id === 'czechia' ? 'Czechia lineups appear here once they are posted for the next game.' : 'No lineup has been posted for this broadcast.'}</p>`;
      } else {
        const teams = [...new Set(players.map(p => p.team))];
        body.innerHTML = teams.map(t => `<h4 class="elh-mini-title">${esc(t)}</h4><ul class="elh-lineup">${players.filter(p => p.team === t).map(p => `<li><span class="elh-pos">${esc(p.position)}</span><b>${esc(p.name)}</b>${p.jersey ? `<small>#${esc(p.jersey)}</small>` : ''}</li>`).join('')}</ul>`).join('') +
          `<button type="button" class="elh-btn elh-btn-gold elh-btn-block" data-arena-lineup="${esc(ch.id)}">Open in Carbon Arena</button><p class="elh-note">${ch.demo ? '<span class="elh-chip elh-chip-demo">Demo</span> Sample lineup.' : '<span class="elh-chip elh-chip-real">Live data</span> Lineup from the LG World Juniors feed.'}</p>`;
      }
    } else {
      const m = ch.away && ch.home ? ch : null;
      if (!m) { body.innerHTML = '<p class="elh-empty">Picks open when a matchup is on the stage.</p>'; return; }
      const key = ch.id + ':' + (ch.start ? +ch.start : ch.title);
      const pick = S.picks[key];
      const streak = Object.values(S.picks).length;
      body.innerHTML = `<p class="elh-eyebrow">Who takes it?</p><div class="elh-picks">${[m.away, m.home].map(t => `<button type="button" class="elh-pick${pick === t.abbr ? ' is-picked' : ''}" data-pick="${esc(key)}" data-team="${esc(t.abbr)}">${crest(t, 56)}<b>${esc(t.abbr)}</b><small>${esc(t.name || '')}</small></button>`).join('')}</div>
        <p class="elh-pick-msg">${pick ? `You picked <b>${esc(pick)}</b>. Good luck.` : 'Tap a team to make your pick.'}</p>
        <div class="elh-kpis"><div><small>Picks made</small><b>${streak}</b></div><div><small>Following</small><b>${S.favs.length}</b></div></div>
        <p class="elh-note">Just for fun. Picks are saved on this device only and are not scored.</p>`;
    }
  }

  /* ---------- Rundown ---------- */
  function buildRundown() {
    const out = [], now = Date.now();
    const h = S.hitmen;
    if (h?.live) out.push({id: 'hit-' + h.live.id, at: Date.parse(h.live.at), title: `Hitmen ${h.live.home ? 'vs' : 'at'} ${h.live.opponent.abbr}`, sub: 'Hitmen Live · on air', channel: 'hitmen', kind: 'game', real: true, live: true});
    (h?.upcoming || []).slice(0, 3).forEach(g => out.push({id: 'hit-' + g.id, at: Date.parse(g.at), title: `Hitmen ${g.home ? 'vs' : 'at'} ${g.opponent.name}`, sub: 'Hitmen Live', channel: 'hitmen', kind: 'game', real: true}));
    S.czechia.map(g => ({g, at: Date.parse(g.date + 'T' + toUtcTime(g) + 'Z')})).filter(x => x.at + GAME_WINDOW > now).slice(0, 4).forEach(({g, at}, i) => {
      if (!i) out.push({id: 'cz-pre-' + g.key, at: at - 30 * 60e3, title: 'Carbon pregame · Czechia vs ' + g.opponent, sub: 'World Juniors · lineups and 3D rink', channel: 'czechia', kind: 'show', real: true});
      out.push({id: 'cz-' + g.key, at, title: 'Czechia vs ' + g.opponent, sub: 'LG World Juniors', channel: 'czechia', kind: 'game', real: true, live: now >= at && now < at + GAME_WINDOW});
    });
    const today = S.lgchl?.today?.games || [];
    if (today.length) {
      const first = Math.min(...today.map(g => Date.parse(g.at)));
      out.push({id: 'lgchl-' + S.lgchl.today.day, at: first, title: `LGCHL slate · ${today.length} featured games`, sub: 'Scores update in the ticker', channel: null, kind: 'game', real: true, live: today.some(g => g.state === 'live')});
    }
    S.realRundown = out.length > 0;
    if (!out.length || (S.mode === 'on' && !onAirReal())) {
      const base = Math.floor(now / 60e3) * 60e3;
      DEMO_RUNDOWN.forEach((r, i) => out.push({...r, id: 'demo-r' + i, at: base + r.offset * 60e3, demo: true, live: r.offset <= 0 && r.offset > -45}));
    }
    S.rundown = out.filter(r => Number.isFinite(r.at)).sort((a, b) => a.at - b.at).slice(0, 10);
  }
  function renderRundown() {
    const now = Date.now();
    $('#elhRundown').innerHTML = S.rundown.length ? S.rundown.map(r => {
      const past = !r.live && r.at + (r.kind === 'game' ? GAME_WINDOW : 25 * 60e3) < now;
      const state = r.live ? '<span class="elh-pill elh-st-live"><i class="elh-dot"></i>On air</span>' : past ? '<span class="elh-pill elh-st-final">Done</span>' : '<span class="elh-pill elh-st-upcoming">Up next</span>';
      return `<li class="elh-rd${r.live ? ' is-live' : ''}${past ? ' is-past' : ''}"><time datetime="${new Date(r.at).toISOString()}">${esc(timeFmt.format(new Date(r.at)))}<small>${esc(sameDay(new Date(r.at), new Date()) ? 'Today' : dayFmt.format(new Date(r.at)))}</small></time>
        <div><b>${esc(r.title)}</b><span>${esc(r.sub)}</span><div class="elh-rd-tags">${state}${r.demo ? '<span class="elh-pill elh-pill-demo">Demo</span>' : ''}<span class="elh-pill elh-pill-line">${r.kind === 'show' ? 'Studio' : 'Game'}</span></div></div>
        <div class="elh-rd-act">${r.channel ? `<button type="button" class="elh-icon" data-feature="${esc(r.channel)}" aria-label="Watch ${esc(r.title)}">▶</button>` : ''}${!past && !r.live ? `<button type="button" class="elh-icon" data-remind="${esc(r.id)}" aria-pressed="${S.reminders.includes(r.id)}" aria-label="Remind me about ${esc(r.title)}">🔔</button>` : ''}</div></li>`;
    }).join('') : '<li class="elh-empty">Nothing scheduled yet.</li>';
    $('#elhRundownNote').innerHTML = S.realRundown ? '<span class="elh-chip elh-chip-real">Live data</span>' : '<span class="elh-chip elh-chip-demo">Demo</span>';
  }

  /* ---------- Channels shelf ---------- */
  function renderShelf() {
    $$('#elhKindSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === S.kind)));
    const q = S.find.trim().toLowerCase();
    const list = allChannels().filter(c => (S.kind === 'all' || (S.kind === 'fav' ? S.favs.includes(c.id) : c.kind === S.kind)) &&
      (!q || [c.name, c.title, c.away?.name, c.home?.name, c.away?.abbr, c.home?.abbr].filter(Boolean).join(' ').toLowerCase().includes(q)));
    $('#elhShelf').innerHTML = list.length ? list.map(c => `<article class="elh-card${c.id === S.featured ? ' is-featured' : ''}${c.status === 'live' ? ' is-live' : ''}">
      <button type="button" class="elh-card-hit" data-open-channel="${esc(c.id)}" aria-label="Open ${esc(c.name)} channel view">${poster(c, false)}</button>
      <div class="elh-card-body"><div class="elh-card-tags">${statusPill(c)}${badge(c)}</div><h3>${esc(c.name)}</h3><p>${esc(c.demo ? `${c.away.abbr} ${c.away.score} · ${c.home.abbr} ${c.home.score} · ${c.period}` : c.title)}</p>
      <small>${esc(LEAGUE_NAME[c.league] || 'Community')} · ${c.kind === 'official' ? 'Official' : 'Community'}${c.start ? ' · ' + esc(when(c.start)) : ''}</small></div>
      <div class="elh-card-act"><button type="button" class="elh-btn elh-btn-sm" data-feature="${esc(c.id)}">${c.id === S.featured ? 'On stage' : 'Watch'}</button><button type="button" class="elh-btn elh-btn-sm elh-btn-ghost" data-mv-add="${esc(c.id)}" ${S.mv.slots.includes(c.id) ? 'disabled' : ''}>${S.mv.slots.includes(c.id) ? 'In multi' : '+ Multi'}</button><button type="button" class="elh-icon" data-fav="${esc(c.id)}" aria-pressed="${S.favs.includes(c.id)}" aria-label="Favourite ${esc(c.name)}">★</button></div></article>`).join('')
      : `<p class="elh-empty">${S.kind === 'fav' ? 'Star a channel to keep it here.' : 'No channels match.'}</p>`;
  }

  /* ---------- Multiview ---------- */
  const mvSave = () => store.set('mv', S.mv);
  let mvSig = '';
  function renderMultiview(force) {
    const {layout, low} = S.mv;
    S.mv.slots = S.mv.slots.filter(id => channel(id)).slice(0, 8);
    $$('#elhLayoutSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.layout === layout)));
    $('#elhLowRes').checked = !!low;
    $('#elhMvCount').textContent = S.mv.slots.length;
    const grid = $('#elhMvGrid');
    grid.dataset.layout = layout;
    const slots = Array.from({length: layout}, (_, i) => S.mv.slots[i] || null);
    const sig = layout + '|' + low + '|' + S.mv.focus + '|' + slots.join(',') + '|' + (S.goal?.id || '');
    if (sig !== mvSig || force) {
      mvSig = sig;
      grid.innerHTML = slots.map((id, i) => {
        if (!id) return `<div class="elh-tile is-empty"><span>Screen ${i + 1}</span><small>Pick a channel to fill this screen</small></div>`;
        const c = channel(id), src = source(c, {muted: i !== S.mv.focus, view: 'game'});
        const media = src && !low ? `<iframe src="${esc(src.src)}" title="${esc(src.title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` :
          src && low ? `<button type="button" class="elh-tile-load" data-mv-load="${i}">${poster(c, false)}<span>Tap to load video</span></button>` : poster(c, false);
        return `<div class="elh-tile${i === S.mv.focus ? ' is-focus' : ''}${S.goal?.id === id ? ' is-goal' : ''}" data-slot="${i}">
          <div class="elh-tile-head"><span class="elh-tile-n">${i + 1}</span><b>${esc(c.name)}</b>${statusPill(c)}${c.demo ? '<span class="elh-pill elh-pill-demo">Demo</span>' : ''}</div>
          <div class="elh-tile-media">${c.demo || c.away ? `<div class="elh-tile-bug">${c.away ? `${esc(c.away.abbr)} <b>${c.away.score ?? ''}</b> · ${esc(c.home.abbr)} <b>${c.home.score ?? ''}</b>` : ''}</div>` : ''}${media}</div>
          <div class="elh-tile-act">
            <button type="button" data-mv-focus="${i}" aria-pressed="${i === S.mv.focus}" title="Audio focus: this screen starts unmuted">${i === S.mv.focus ? '🔊 Focus' : '🔈 Focus'}</button>
            <button type="button" data-mv-swap="${i}" ${i === 0 ? 'disabled' : ''} title="Move one screen earlier">⇠ Swap</button>
            <button type="button" data-feature="${esc(id)}" title="Show on the main stage">Stage</button>
            ${c.demo && c.status === 'live' ? `<button type="button" data-goal="${esc(id)}" title="Demo red-light goal alert">🚨</button>` : ''}
            <button type="button" data-mv-remove="${i}" aria-label="Remove ${esc(c.name)}">✕</button></div></div>`;
      }).join('');
    }
    $('#elhMvPick').innerHTML = allChannels().map(c => `<button type="button" class="elh-mv-chip" data-mv-add="${esc(c.id)}" ${S.mv.slots.includes(c.id) ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${c.status === 'live' ? '<i class="elh-dot"></i>' : ''}<span>${esc(c.name)}</span>${c.demo ? '<small>Demo</small>' : ''}</button>`).join('');
    const real = S.mv.slots.map(channel).filter(c => c?.sourceId).map(c => 'source:' + c.sourceId);
    $('#elhFullMv').href = 'multiview.html?hub=1' + (real.length ? '&streams=' + encodeURIComponent(real.join(',')) : '');
  }
  function mvAdd(id) {
    if (S.mv.slots.includes(id)) { toast('Already in your multiview'); return; }
    if (S.mv.slots.length >= 8) { toast('Multiview is full (8 screens). Remove one first.'); return; }
    S.mv.slots.push(id);
    if (S.mv.slots.length > S.mv.layout) S.mv.layout = [1, 2, 4, 6, 8].find(n => n >= S.mv.slots.length);
    mvSave(); renderMultiview(); renderShelf(); renderStage();
    toast((channel(id)?.name || 'Channel') + ' added to multiview');
  }

  /* ---------- Channel view ---------- */
  function openChannel(id) {
    const c = channel(id); if (!c) return;
    const dlg = $('#elhChannel');
    const src = source(c, {view: 'game'});
    const sched = S.rundown.filter(r => r.channel === c.id);
    $('#elhChannelBody').innerHTML = `<header class="elh-dlg-head">${crest(c.away ? c.home : {crest: c.crest, abbr: c.name}, 56)}<div><div class="elh-card-tags">${statusPill(c)}${badge(c)}<span class="elh-pill elh-pill-line">${c.kind === 'official' ? 'Official' : 'Community'}</span></div>
        <h2 class="elh-3d elh-3d-md" id="elhChannelName" data-text="${esc(c.name)}">${esc(c.name)}</h2><p>${esc(LEAGUE_NAME[c.league] || 'Community')} · ${esc(c.title)}</p></div>
        <button type="button" class="elh-icon elh-dlg-close" data-close aria-label="Close channel view">✕</button></header>
      <div class="elh-dlg-screen">${src ? `<div class="elh-frame"><iframe src="${esc(src.src)}" title="${esc(src.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>` : poster(c, true)}</div>
      <p class="elh-dlg-story">${esc(c.story || '')}</p>
      <div class="elh-dlg-grid"><div><h3 class="elh-mini-title">On this channel</h3>${sched.length ? `<ul class="elh-events">${sched.map(r => `<li><small>${esc(when(new Date(r.at)))}</small><span>${esc(r.title)}</span></li>`).join('')}</ul>` : '<p class="elh-note">No scheduled programmes listed.</p>'}</div>
        <div class="elh-dlg-actions"><button type="button" class="elh-btn" data-feature="${esc(c.id)}" data-close>Watch on stage</button><button type="button" class="elh-btn elh-btn-ghost" data-mv-add="${esc(c.id)}">+ Multiview</button><button type="button" class="elh-btn elh-btn-ghost" data-fav="${esc(c.id)}" aria-pressed="${S.favs.includes(c.id)}">★ Favourite</button>
        ${c.link ? `<a class="elh-btn elh-btn-ghost" href="${esc(c.link)}">Channel page</a>` : ''}${c.external ? `<a class="elh-btn elh-btn-ghost" href="${esc(c.external)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ''}</div></div>`;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const u = new URL(location.href); u.searchParams.set('channel', c.id); history.replaceState(null, '', u);
  }
  function closeChannel() {
    const dlg = $('#elhChannel');
    $('#elhChannelBody').innerHTML = '';
    if (dlg.open) dlg.close();
    const u = new URL(location.href); u.searchParams.delete('channel'); history.replaceState(null, '', u);
  }

  /* ---------- Goal alert (demo only) ---------- */
  function goalAlert(id) {
    const c = channel(id); if (!c?.demo) return;
    c.home.score += 1;
    S.goal = {id, team: c.home, scorer: c.lineup.find(p => p.team === c.home.abbr && p.position !== 'G')?.name || 'Demo skater'};
    const g = $('#elhGoal');
    g.hidden = false;
    g.innerHTML = `<div class="elh-wrap elh-goal-in"><span class="elh-goal-lamp" aria-hidden="true"></span><div><small>Red light · ${esc(c.name)} · Demo</small><b>${esc(c.home.city)} ${esc(c.home.name)} goal!</b><span>${esc(S.goal.scorer)} · ${esc(c.away.abbr)} ${c.away.score} – ${c.home.score} ${esc(c.home.abbr)}</span></div>
      <div class="elh-goal-act"><button type="button" class="elh-btn" data-feature="${esc(id)}" data-goal-done>Watch on stage</button><button type="button" class="elh-btn elh-btn-ghost" data-mv-focus-ch="${esc(id)}">Focus in multiview</button><button type="button" class="elh-icon" data-goal-done aria-label="Dismiss goal alert">✕</button></div></div>`;
    stageSig = ''; renderStage(); renderMultiview(true); buildTicker(); renderTicker(); renderShelf();
    clearTimeout(goalAlert.t); goalAlert.t = setTimeout(() => { S.goal = null; renderMultiview(true); }, 6000);
  }

  /* ---------- Toast + reminders ---------- */
  function toast(msg) {
    const t = $('#elhToast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function toggleReminder(id) {
    const on = !S.reminders.includes(id);
    S.reminders = on ? [...S.reminders, id] : S.reminders.filter(x => x !== id);
    store.set('reminders', S.reminders);
    toast(on ? 'Reminder set. Keep this tab open and we will flag it here.' : 'Reminder removed');
    renderRundown(); stageSig = ''; renderStage();
  }
  function checkReminders() {
    const now = Date.now();
    S.rundown.filter(r => S.reminders.includes(r.id) && r.at <= now && r.at > now - 60e3).forEach(r => toast('Starting now: ' + r.title));
  }

  /* ---------- Render all + events ---------- */
  function renderAll() {
    buildRundown(); buildTicker(); pickFeatured();
    renderAir(); renderTicker(); renderStage(); renderCompanion(); renderRundown(); renderShelf(); renderMultiview();
    sendArena();
  }
  function sendArena(id) {
    const ch = channel(id || S.featured);
    const fallback = DEMO[0];
    const src = ch?.lineup?.length ? ch : fallback;
    window.dispatchEvent(new CustomEvent('elh:lineup', {detail: {label: (src.demo ? 'Demo · ' : '') + (src.away ? `${src.away.abbr} at ${src.home.abbr}` : src.name), home: src.home?.abbr, players: src.lineup}}));
  }
  window.ELHLastLineup = () => sendArena();

  document.addEventListener('click', e => {
    const t = e.target.closest('button, a'); if (!t) return;
    const d = t.dataset;
    if (d.mode) { S.mode = d.mode; S.featured = null; S.picked = false; stageSig = ''; renderAll(); return; }
    if (d.modeSet) { S.mode = d.modeSet; S.featured = null; S.picked = false; stageSig = ''; renderAll(); document.getElementById('stage').scrollIntoView({behavior: 'smooth', block: 'start'}); return; }
    if (d.view) { S.view = d.view; stageSig = ''; renderStage(); return; }
    if (d.czv) { S.czechiaView = d.czv; stageSig = ''; renderStage(); return; }
    if ('theatre' in d) { S.theatre = !S.theatre; renderStage(); renderCompanion(); return; }
    if (d.tab) { S.companion = d.tab; renderCompanion(); return; }
    if (d.league) { S.tickerLeague = d.league; renderTicker(); return; }
    if (d.kind) { S.kind = d.kind; renderShelf(); return; }
    if (d.feature) {
      const c = channel(d.feature);
      if (c) {
        if (c.demo && !isOnAir()) S.mode = 'on';
        S.featured = c.id; S.picked = true; stageSig = '';
        renderAll();
        if (!t.closest('#stage')) document.getElementById('stage').scrollIntoView({behavior: 'smooth', block: 'start'});
      }
      if ('goalDone' in d) $('#elhGoal').hidden = true;
      if ('close' in d) closeChannel();
      return;
    }
    if ('goalDone' in d) { $('#elhGoal').hidden = true; S.goal = null; renderMultiview(true); return; }
    if (d.mvAdd) { mvAdd(d.mvAdd); return; }
    if (d.mvFocusCh) { if (!S.mv.slots.includes(d.mvFocusCh)) mvAdd(d.mvFocusCh); S.mv.focus = S.mv.slots.indexOf(d.mvFocusCh); mvSave(); renderMultiview(true); $('#elhGoal').hidden = true; document.getElementById('multiview').scrollIntoView({behavior: 'smooth'}); return; }
    if (d.mvFocus) { S.mv.focus = +d.mvFocus; mvSave(); renderMultiview(true); return; }
    if (d.mvSwap) { const i = +d.mvSwap; const s = S.mv.slots; if (i > 0 && s[i]) { [s[i - 1], s[i]] = [s[i], s[i - 1]]; if (S.mv.focus === i) S.mv.focus = i - 1; else if (S.mv.focus === i - 1) S.mv.focus = i; } mvSave(); renderMultiview(true); return; }
    if (d.mvRemove) { S.mv.slots.splice(+d.mvRemove, 1); if (S.mv.focus >= S.mv.slots.length) S.mv.focus = 0; mvSave(); renderMultiview(); renderShelf(); renderStage(); return; }
    if (d.mvLoad) { const tile = t.closest('.elh-tile'); const c = channel(S.mv.slots[+d.mvLoad]); const src = c && source(c, {muted: true, view: 'game'}); if (src) t.outerHTML = `<iframe src="${esc(src.src)}" title="${esc(src.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`; tile?.classList.add('is-loaded'); return; }
    if (d.layout) { S.mv.layout = +d.layout; mvSave(); renderMultiview(); return; }
    if (d.cam) { $$('#elhCamSeg button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); window.dispatchEvent(new CustomEvent('elh:camera', {detail: d.cam})); return; }
    if (d.goal) { goalAlert(d.goal); return; }
    if (d.fav) { const id = d.fav; S.favs = S.favs.includes(id) ? S.favs.filter(x => x !== id) : [...S.favs, id]; store.set('favs', S.favs); t.setAttribute('aria-pressed', String(S.favs.includes(id))); renderShelf(); return; }
    if (d.favTeam) { const id = d.favTeam; S.favs = S.favs.includes(id) ? S.favs.filter(x => x !== id) : [...S.favs, id]; store.set('favs', S.favs); renderCompanion(); return; }
    if (d.pick) { S.picks[d.pick] = d.team; store.set('picks', S.picks); renderCompanion(); return; }
    if (d.remind) { toggleReminder(d.remind); return; }
    if (d.arenaLineup) { sendArena(d.arenaLineup); document.getElementById('arena').scrollIntoView({behavior: 'smooth'}); return; }
    if (d.openChannel) { openChannel(d.openChannel); return; }
    if ('close' in d) { closeChannel(); }
  });
  $('#elhChannel').addEventListener('close', () => { $('#elhChannelBody').innerHTML = ''; const u = new URL(location.href); u.searchParams.delete('channel'); history.replaceState(null, '', u); });
  $('#elhChannel').addEventListener('click', e => { if (e.target === e.currentTarget) closeChannel(); });
  $('#elhChannelFind').addEventListener('input', e => { S.find = e.target.value; renderShelf(); });
  $('#elhLowRes').addEventListener('change', e => { S.mv.low = e.target.checked; mvSave(); renderMultiview(true); });
  $('#elhMvClear').addEventListener('click', () => { S.mv.slots = []; S.mv.focus = 0; mvSave(); renderMultiview(); renderShelf(); renderStage(); });
  $('#elhMvAdd').addEventListener('submit', e => {
    e.preventDefault();
    const url = canonical($('#elhMvUrl').value), msg = $('#elhMvMsg');
    if (!url) { msg.textContent = 'Enter a public Twitch channel or YouTube video/live link.'; return; }
    if (!S.custom.includes(url)) { S.custom.push(url); store.set('custom', S.custom); }
    msg.textContent = '';
    $('#elhMvUrl').value = '';
    mvAdd('custom-' + S.custom.indexOf(url));
  });

  /* ---------- Boot ---------- */
  renderAll();
  Promise.allSettled([loadScores(), loadHitmen(), loadCzechia(), loadListings()]).then(() => {
    renderAll();
    const q = new URLSearchParams(location.search).get('channel');
    if (q && channel(q)) openChannel(q);
  });
  setInterval(tickCountdown, 1000);
  setInterval(checkReminders, 30e3);
  setInterval(() => { if (document.hidden) return; Promise.allSettled([loadScores(), loadHitmen()]).then(renderAll); }, 120e3);
})();
