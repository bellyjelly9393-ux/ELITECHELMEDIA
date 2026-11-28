/* EliteChel Media · Elite Live Hub · This Week board.
 *
 * One box per Memorial Cup series and one per World Juniors and LG Threes game this week.
 * Public reads only:
 *   /api/lgchl-playoffs                 Road to the Memorial Cup bracket (current round)
 *   /data/live/wjhc-week.json           LG World Juniors games for the week (all 8 nations)
 *   Supabase lg3s_public_games (view)   LG Threes games and scores, publishable key
 * Stream links come from the hub (elite-live-hub.js → `elh:links`): a public
 * tournament_automation_sources row whose metadata names `lg_game_id`, `lg_game_ids` or
 * `series_key` ("413-377") lights up the Watch button on that box. Watch and + Multi reuse the
 * hub's own buttons (data-feature / data-mv-add), so the stream plays on the hub's stage.
 */
(() => {
  'use strict';
  const root = document.getElementById('elhWeek');
  if (!root) return;
  const seg = document.getElementById('elhWeekSeg');
  const range = document.getElementById('elhWeekRange');

  const SB_URL = 'https://lrgllzvwgvqagcpiyvfd.supabase.co';
  const SB_KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const ET = 'America/Toronto';
  const GAME_WINDOW = 35 * 60e3;
  const WEEK = 7 * 864e5;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[c]);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('elh:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('elh:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const dayKey = new Intl.DateTimeFormat('en-CA', {timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit'});
  const dayFmt = new Intl.DateTimeFormat('en-CA', {timeZone: ET, weekday: 'long', month: 'short', day: 'numeric'});
  const shortDay = new Intl.DateTimeFormat('en-CA', {timeZone: ET, month: 'short', day: 'numeric'});
  const timeFmt = new Intl.DateTimeFormat('en-US', {timeZone: ET, hour: 'numeric', minute: '2-digit'});
  const etTime = d => timeFmt.format(d) + ' ET';
  // LG posts World Juniors times in Eastern Standard Time (UTC-5) for the whole tournament.
  const estStart = (date, hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return Date.parse(date + 'T00:00:00Z') + ((h + 5) * 60 + m) * 60e3;
  };

  const SVG_FLAGS = new Set(['ca', 'ch', 'cz', 'de', 'fi', 'gb', 'se', 'us']);
  const NATIONS = {canada: 'ca', czechia: 'cz', finland: 'fi', germany: 'de', sweden: 'se', usa: 'us', switzerland: 'ch',
    'great britain': 'gb', slovakia: 'sk', latvia: 'lv', japan: 'jp', kazakhstan: 'kz', italy: 'it', poland: 'pl'};
  const flag = name => {
    const c = NATIONS[String(name || '').toLowerCase()];
    return !c ? '' : SVG_FLAGS.has(c) ? `/assets/lg3s-world/flags/${c}.svg` : `/assets/lg3s/flags/${c}.png`;
  };
  window.ECMNationFlag = flag;

  const W = {
    filter: store.get('week-filter', 'all'),
    cup: null, wj: null, lg3s: null, links: window.ELHLinks?.() || [],
    feeds: {cup: 'loading', wj: 'loading', lg3s: 'loading'},
  };

  /* ---------- Feeds ---------- */
  async function json(url, opts = {}, ms = 8000) {
    const r = await fetch(url, {...opts, signal: AbortSignal.timeout(ms), headers: {accept: 'application/json', ...(opts.headers || {})}});
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }
  async function loadCup() {
    try {
      const d = await json('/api/lgchl-playoffs');
      if (!d?.ok || !Array.isArray(d.leagues)) throw new Error('playoffs');
      W.cup = d; W.feeds.cup = 'ok';
    } catch { W.feeds.cup = W.cup ? 'ok' : 'down'; }
  }
  async function loadWj() {
    try {
      const d = await json('/data/live/wjhc-week.json', {cache: 'no-cache'});
      if (d?.schema !== 'ecm-wjhc-week-v1' || !Array.isArray(d.games)) throw new Error('wj');
      W.wj = d; W.feeds.wj = 'ok';
    } catch { W.feeds.wj = 'down'; }
  }
  async function loadLg3s() {
    const from = new Date(startOfToday()).toISOString();
    const to = new Date(startOfToday() + WEEK).toISOString();
    const q = new URLSearchParams({
      select: 'lg_game_id,scheduled_at,away_lg_team_id,away_nation,home_lg_team_id,home_nation,status,status_label,away_score,home_score,decided_in,is_forfeit',
      order: 'scheduled_at.asc,lg_game_id.asc',
    });
    try {
      const rows = await json(`${SB_URL}/rest/v1/lg3s_public_games?${q}&scheduled_at=gte.${encodeURIComponent(from)}&scheduled_at=lt.${encodeURIComponent(to)}`,
        {headers: {apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY}});
      if (!Array.isArray(rows)) throw new Error('lg3s');
      W.lg3s = rows; W.feeds.lg3s = 'ok';
    } catch { W.feeds.lg3s = W.lg3s ? 'ok' : 'down'; }
  }
  function startOfToday() {
    const key = dayKey.format(new Date());
    // Midnight Eastern: try EST then EDT so the window is right all year.
    for (const off of [5, 4]) {
      const t = Date.parse(key + 'T00:00:00Z') + off * 3600e3;
      if (dayKey.format(new Date(t)) === key && dayKey.format(new Date(t - 1)) !== key) return t;
    }
    return Date.parse(key + 'T05:00:00Z');
  }

  /* ---------- Stream links ---------- */
  const gameLink = id => W.links.find(l => l.gameIds.includes(Number(id)));
  const seriesLink = (a, b, gameIds) => {
    const key = [a, b].map(Number).sort((x, y) => x - y).join('-');
    return W.links.find(l => l.seriesKey === key) || gameIds.map(gameLink).find(Boolean);
  };
  function watch(link, label) {
    if (!link) return '<p class="elh-wk-nolink"><span aria-hidden="true">◉</span> Stream link posted on game night</p>';
    return `<div class="elh-wk-watch"><button type="button" class="elh-btn elh-btn-sm" data-feature="${esc(link.channel)}" aria-label="Watch ${esc(label)}">▶ Watch</button><button type="button" class="elh-btn elh-btn-sm elh-btn-ghost" data-mv-add="${esc(link.channel)}" aria-label="Add ${esc(label)} to multiview">+ Multi</button></div>`;
  }

  /* ---------- Memorial Cup: current round, one box per series ---------- */
  function cupStages(d) {
    const teams = d.teams || {};
    const team = id => id ? teams[String(id)] || null : null;
    const winner = s => s?.winner_id || (s?.kind === 'bye' ? s.sides?.[0]?.team_id : null) || null;
    const stages = [];
    const put = (i, s) => { (stages[i] ||= []).push(s); };
    const champs = {};
    for (const L of d.leagues) {
      const confWinners = {};
      for (const c of L.conferences || []) {
        const rounds = c.rounds || [];
        rounds.forEach((r, ri) => r.slots.forEach((s, k) => {
          let sides = s.sides.map(x => x.team_id);
          if (ri > 0 && sides.some(x => !x)) {
            const prev = rounds[ri - 1].slots;
            sides = sides.map((x, j) => x || winner(prev[2 * k + j]) || null);
          }
          if (s.kind === 'bye') return;
          put(ri, {...s, league: L.id, conf: c.name, round: ri + 1, rounds: rounds.length, sides, from: s.sides.map(x => x.from)});
        }));
        confWinners[c.name] = winner(rounds.at(-1)?.slots?.[0]);
      }
      if (L.final) {
        const sides = L.final.sides.map(x => x.team_id || (/eastern/i.test(x.from || '') ? confWinners.Eastern : /western/i.test(x.from || '') ? confWinners.Western : null));
        const f = {...L.final, league: L.id, sides, from: L.final.sides.map(x => x.from), leagueFinal: true};
        put(10, f);
        champs[L.id] = winner(L.final);
      }
    }
    const ch = d.championship || {};
    const fromChamp = x => x.team_id || (x.from?.match(/^(WHL|OHL|QMJHL) champion$/)?.[1] && champs[x.from.split(' ')[0]]) || null;
    if (ch.semi) put(11, {...ch.semi, cup: true, sides: ch.semi.sides.map(fromChamp), from: ch.semi.sides.map(x => x.from)});
    if (ch.final) {
      const semiW = winner(ch.semi);
      put(11, {...ch.final, cup: true, from: ch.final.sides.map(x => x.from), sides: ch.final.sides.map(x => x.team_id || (/semifinal winner/i.test(x.from || '') ? semiW : fromChamp(x)))});
    }
    // Current stage: the first one with a series that is not yet decided.
    const current = stages.filter(Boolean).find(list => list.some(s => !s.clinched && s.kind !== 'bye')) || stages.filter(Boolean).at(-1) || [];
    return {current, team};
  }
  function seriesTitle(s) {
    if (s.cup) return /final/i.test(s.title) && !/semi/i.test(s.title) ? 'Memorial Cup Final' : 'Memorial Cup Semifinal';
    if (s.leagueFinal) return s.league + ' Final';
    if (s.round === s.rounds) return `${s.league} ${s.conf} Final`;
    return `${s.league} ${s.conf} · Round ${s.round}`;
  }
  function pucks(wins, need) {
    return `<span class="elh-wk-pucks" aria-hidden="true">${Array.from({length: need}, (_, i) => `<i class="${i < wins ? 'is-won' : ''}"></i>`).join('')}</span>`;
  }
  function seriesBox(s, team) {
    const [a, b] = s.sides.map(team);
    const score = s.score || [0, 0];
    const need = s.wins_needed || 4;
    const games = (s.games || []).filter(g => g.at);
    const next = games.find(g => g.status !== 'final');
    const lead = score[0] === score[1] ? (score[0] ? `Series tied ${score[0]}–${score[1]}` : 'Series starts 0–0')
      : `${(score[0] > score[1] ? a : b)?.nick || 'Leader'} lead ${Math.max(...score)}–${Math.min(...score)}`;
    const status = s.clinched ? `${team(s.winner_id)?.nick || 'Winner'} win ${Math.max(...score)}–${Math.min(...score)}` : lead;
    const side = (t, i) => t ? `<div class="elh-wk-team${s.clinched && s.winner_id === t.id ? ' is-win' : ''}">
        <img src="/${esc(String(t.logo || '').replace(/^\//, ''))}" width="40" height="40" alt="" loading="lazy">
        <span><b>${esc(t.name)}</b><small>#${esc(t.seed)} seed · ${esc(t.group || t.league)}</small></span>
        <strong class="elh-wk-wins">${esc(score[i] ?? 0)}</strong>${pucks(score[i] || 0, need)}</div>`
      : `<div class="elh-wk-team is-tbd"><span class="elh-wk-tbd-crest">?</span><span><b>To be decided</b><small>${esc(s.from?.[i] || 'Previous round winner')}</small></span></div>`;
    const label = `${a?.name || 'TBD'} vs ${b?.name || 'TBD'}`;
    const sched = games.length
      ? `<ol class="elh-wk-games">${games.map(g => `<li class="${g.status === 'final' ? 'is-final' : ''}"><span>G${esc(g.n)}</span><span>${esc(shortDay.format(new Date(g.at)))} · ${esc(etTime(new Date(g.at)))}</span><span>${g.status === 'final' ? `${esc(team(g.away)?.abbr)} ${esc(g.away_score)} – ${esc(g.home_score)} ${esc(team(g.home)?.abbr)}${g.decided_in && g.decided_in !== 'REG' ? ' ' + esc(g.decided_in) : ''}` : 'Scheduled'}</span></li>`).join('')}</ol>`
      : '<p class="elh-wk-tba">Game times TBA · posted before game night</p>';
    return `<article class="elh-wk-box elh-wk-series" data-event="cup">
      <header class="elh-wk-head"><span class="elh-wk-tag">${esc(seriesTitle(s))}</span><span class="elh-wk-bo">Best of ${esc(s.best_of || 7)}</span></header>
      <div class="elh-wk-matchup">${side(a, 0)}<span class="elh-wk-vs" aria-hidden="true">VS</span>${side(b, 1)}</div>
      <p class="elh-wk-status">${esc(status)}${next ? ` · Next: G${esc(next.n)} ${esc(shortDay.format(new Date(next.at)))}` : ''}</p>
      ${sched}
      ${watch(seriesLink(s.sides[0], s.sides[1], games.map(g => g.id)), label)}
    </article>`;
  }
  function cupGroup() {
    if (!W.cup) return group('cup', 'Road to the Memorial Cup', 'LGCHL playoffs', W.feeds.cup === 'down'
      ? '<p class="elh-empty">The playoff bracket is unavailable right now. Refresh to try again.</p>' : '<p class="elh-empty">Loading the bracket…</p>');
    const {current, team} = cupStages(W.cup);
    const sub = current[0] ? (current[0].cup ? 'Memorial Cup' : current[0].leagueFinal ? 'League finals' : current[0].round === current[0].rounds ? 'Conference finals' : 'Round ' + current[0].round) : '';
    const order = ['WHL', 'OHL', 'QMJHL'];
    const list = [...current].sort((x, y) => order.indexOf(x.league) - order.indexOf(y.league) || String(x.conf).localeCompare(String(y.conf)));
    return group('cup', 'Road to the Memorial Cup', `LGCHL playoffs · ${sub}`,
      list.length ? `<div class="elh-wk-grid">${list.map(s => seriesBox(s, team)).join('')}</div>` : '<p class="elh-empty">No series this week.</p>');
  }

  /* ---------- Game boxes (World Juniors, LG Threes) ---------- */
  function gameState(start, status) {
    const now = Date.now();
    if (status === 'final') return 'final';
    if (status === 'live' || (now >= start && now < start + GAME_WINDOW)) return 'live';
    if (now >= start + GAME_WINDOW) return 'played';
    return 'upcoming';
  }
  const STATE = {upcoming: 'Upcoming', live: 'On now', played: 'Played', final: 'Final'};
  function nationRow(name, score, won) {
    const f = flag(name);
    return `<div class="elh-wk-nation${won ? ' is-win' : ''}">${f ? `<img src="${esc(f)}" width="30" height="20" alt="" loading="lazy">` : '<span class="elh-wk-noflag"></span>'}<b>${esc(name)}</b>${score == null ? '' : `<strong>${esc(score)}</strong>`}</div>`;
  }
  function gameBox(event, g) {
    const state = gameState(g.start, g.status);
    const showScore = state === 'final' && g.awayScore != null;
    const label = `${g.away} at ${g.home}`;
    const carbon = event === 'wj' && (g.away === 'Czechia' || g.home === 'Czechia')
      ? `<button type="button" class="elh-btn elh-btn-sm elh-btn-ghost elh-wk-carbon" data-week-arena="lg-${esc(g.id)}">Carbon pregame</button>` : '';
    return `<article class="elh-wk-box elh-wk-game is-${state}" data-event="${event}">
      <header class="elh-wk-head"><span class="elh-wk-clock">${esc(etTime(new Date(g.start)))}</span><span class="elh-wk-state">${state === 'live' ? '<i class="elh-dot"></i>' : ''}${esc(g.statusLabel && state === 'final' ? g.statusLabel : STATE[state])}</span></header>
      <div class="elh-wk-pair">${nationRow(g.away, showScore ? g.awayScore : null, showScore && g.awayScore > g.homeScore)}<span class="elh-wk-dot" aria-hidden="true"></span>${nationRow(g.home, showScore ? g.homeScore : null, showScore && g.homeScore > g.awayScore)}</div>
      ${carbon}${watch(gameLink(g.id), label)}
    </article>`;
  }
  function nights(event, games) {
    const byDay = new Map();
    games.forEach(g => { const k = dayKey.format(new Date(g.start)); (byDay.get(k) || byDay.set(k, []).get(k)).push(g); });
    const today = dayKey.format(new Date());
    const keys = [...byDay.keys()].sort();
    const openKey = keys.find(k => k >= today) || keys.at(-1);
    return keys.map(k => {
      const list = byDay.get(k);
      const live = list.some(g => gameState(g.start, g.status) === 'live');
      return `<details class="elh-wk-night"${k === openKey || live ? ' open' : ''}><summary><b>${esc(dayFmt.format(new Date(list[0].start)))}</b><small>${list.length} games · ${esc(etTime(new Date(list[0].start)))} start</small></summary>
        <div class="elh-wk-grid elh-wk-grid-games">${list.map(g => gameBox(event, g)).join('')}</div></details>`;
    }).join('');
  }
  function wjGroup() {
    if (!W.wj) return group('wj', 'World Juniors', 'LG World Junior Championships', W.feeds.wj === 'down'
      ? '<p class="elh-empty">The World Juniors schedule is unavailable right now.</p>' : '<p class="elh-empty">Loading games…</p>');
    const from = startOfToday() - 864e5;
    const games = W.wj.games.map(g => ({id: g.id, start: estStart(g.date, g.time), away: g.away.name, home: g.home.name}))
      .filter(g => g.start >= from).sort((a, b) => a.start - b.start || a.id - b.id);
    return group('wj', 'World Juniors', 'LG World Junior Championships · 8 nations',
      games.length ? nights('wj', games) : '<p class="elh-empty">The next World Juniors games appear here when the schedule is posted.</p>');
  }
  function lg3sGroup() {
    if (!W.lg3s) return group('lg3s', 'LG Threes', 'LG3s International', W.feeds.lg3s === 'down'
      ? '<p class="elh-empty">LG Threes games are unavailable right now.</p>' : '<p class="elh-empty">Loading games…</p>');
    const games = W.lg3s.map(r => ({id: r.lg_game_id, start: Date.parse(r.scheduled_at), away: r.away_nation, home: r.home_nation,
      status: /final/i.test(r.status) ? 'final' : /live|progress/i.test(r.status) ? 'live' : 'scheduled',
      statusLabel: r.is_forfeit ? 'Forfeit' : r.decided_in && r.decided_in !== 'REG' ? 'Final/' + r.decided_in : null,
      awayScore: r.away_score, homeScore: r.home_score}));
    return group('lg3s', 'LG Threes', 'LG3s International · 12 nations',
      games.length ? nights('lg3s', games) : '<p class="elh-empty">No LG Threes games in the next 7 days.</p>');
  }

  /* ---------- Render ---------- */
  function group(id, title, sub, body) {
    return `<section class="elh-wk-group" data-group="${id}" aria-labelledby="elhWk-${id}"${W.filter !== 'all' && W.filter !== id ? ' hidden' : ''}>
      <header class="elh-wk-ghead"><h3 class="elh-3d elh-3d-sm" id="elhWk-${id}" data-text="${esc(title)}">${esc(title)}</h3><small>${esc(sub)}</small></header>${body}</section>`;
  }
  let sig = '';
  function render() {
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.week === W.filter)));
    const html = cupGroup() + wjGroup() + lg3sGroup();
    if (html === sig) return;
    // Keep the viewer's open/closed nights across refreshes.
    const open = new Map([...root.querySelectorAll('details.elh-wk-night')].map(d => [d.closest('[data-group]').dataset.group + ':' + d.querySelector('summary b').textContent, d.open]));
    sig = html;
    root.innerHTML = html;
    root.querySelectorAll('details.elh-wk-night').forEach(d => {
      const k = d.closest('[data-group]').dataset.group + ':' + d.querySelector('summary b').textContent;
      if (open.has(k)) d.open = open.get(k);
    });
    const t0 = startOfToday();
    range.textContent = shortDay.format(new Date(t0)) + ' – ' + shortDay.format(new Date(t0 + WEEK - 864e5));
  }

  seg.addEventListener('click', e => {
    const b = e.target.closest('button[data-week]'); if (!b) return;
    W.filter = b.dataset.week; store.set('week-filter', W.filter); sig = ''; render();
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-week-arena]'); if (!b) return;
    window.dispatchEvent(new CustomEvent('elh:arena-select', {detail: {key: b.dataset.weekArena}}));
    document.getElementById('arena')?.scrollIntoView({behavior: 'smooth'});
  });
  window.addEventListener('elh:links', e => { W.links = e.detail || []; render(); });

  render();
  Promise.allSettled([loadCup(), loadWj(), loadLg3s()]).then(render);
  setInterval(() => { if (!document.hidden) Promise.allSettled([loadCup(), loadLg3s()]).then(render); }, 120e3);
  setInterval(() => { if (!document.hidden) render(); }, 60e3);
})();
