import { createClient } from '@supabase/supabase-js';
import { GBR_ROSTER, jerseyImage } from '../utils/gbrRoyalBlueJersey';
import { cameras, defaultCrop, demoFormations, demoMatch, demoVotes, formations, matchId,
  type Match, type TacticalFormation, type Vote } from '../utils/match';
import './lg3s.css';

const assetBase = import.meta.env.BASE_URL;
const studioChannel = 'lg3s-gbr';
const params = new URLSearchParams(location.search);
const obs = params.get('mode') === 'obs';
const preview = params.get('preview') === 'true';
const muteHorn = params.get('audio') === 'off';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db = supabaseUrl && supabaseKey && !preview ? createClient(supabaseUrl, supabaseKey, obs ? {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'lg3s-obs-public' },
} : undefined) : null;
const demo = !db;
if (obs) document.body.style.background = 'transparent';
let match = demo ? { ...demoMatch } : { ...demoMatch, home_score: 0, away_score: 0, home_sog: 0, away_sog: 0, period: '—', clock: '—', whiparound: [], boxscore: [] };
let votes = demo ? demoVotes.map((v) => ({ ...v })) : [];
let tactical = demoFormations;
let local: Partial<Pick<Match, 'camera_angle' | 'highlighted_player' | 'active_formation' | 'jersey_side'>> = {};
let activeFeed = 'main';
let studioStream = '';
let loadedFeedURL = '';
let voterSelection = 0;
let pendingVote = false;
let ready = false;
let cropVisible = false;
let lowerPreviewUntil = 0;
let lastGoal: string | null = null;
let goalTimer: number | undefined;
let lowerTimer: number | undefined;
let audio: AudioContext | undefined;
let director = false;
let haveMatch = false;
let studioState: StudioState | null = null;
let studioStarsUntil = 0;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const set = (id: string, value: string | number) => { const el = $(id); if (el) el.textContent = String(value); };
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
const flagFiles: Record<string, string> = { GBR:'gb', SWE:'se', FIN:'fi', CAN:'ca', USA:'us', CZE:'cz', SUI:'ch', GER:'de' };
const flag = (team: string) => flagFiles[team] ? `<img class="flag" src="${assetBase}flags/${flagFiles[team]}.svg" alt="">` : '';
const water = (team: string) => flagFiles[team] ? `--flag:url(${assetBase}flags/${flagFiles[team]}.svg)` : '';
const icon = (name: 'play' | 'expand' | 'crop' | 'sound' | 'grid' | 'star' | 'rink' | 'shirt' | 'chart') => {
  const paths = {
    play:'<path d="m9 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
    expand:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
    crop:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M8 12h8m-4-4v8"/>',
    sound:'<path d="M4 10h4l4-4v12l-4-4H4zm11-1a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/>',
    grid:'<path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z"/>',
    star:'<path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L3 9.5l6.3-.9z"/>',
    rink:'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="M12 5v14m-5-9v4m10-4v4"/><circle cx="12" cy="12" r="2.5"/>',
    shirt:'<path d="m9 4-6 4 2 4 3-1v9h8v-9l3 1 2-4-6-4c0 4-6 4-6 0z"/>',
    chart:'<path d="M4 4v16h17m-13-4v-4m4 4V8m4 8V5m4 11v-6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};
const cameraLabels = { ice:'Ice level', overhead:'Overhead', jumbotron:'Jumbotron', goalie:'Goalie', orbit:'Orbit' };
const playerNames = ['L. Kirk','B. Lake','D. Clements','B. Bowns'];

const graphics = `
  <div class="scorebug" id="scorebug" aria-label="Match score" aria-live="polite">
    <span class="score-tag">LG3s</span>
    <div class="team-score home" id="home-score-cell"><span id="home-flag"></span><span id="home-team"></span><b id="home-score"></b></div>
    <div class="team-score away" id="away-score-cell"><b id="away-score"></b><span id="away-team"></span><span id="away-flag"></span></div>
    <div class="score-time"><span id="score-period"></span><b id="score-clock"></b></div>
  </div>
  ${obs ? `<div id="studio-scene" class="studio-scene" hidden style="${water('GBR')}">
      <div class="studio-scene-content">
        <span id="studio-event">TEAM GREAT BRITAIN</span>
        <strong id="studio-scene-title"></strong>
        <p id="studio-scene-detail"></p>
      </div>
    </div>` : ''}
  <div id="goal" class="goal" hidden><div><small>TEAM GREAT BRITAIN</small><strong>GOAL!</strong></div></div>
  <aside id="lower" class="lower" aria-label="Three stars of the game" hidden>
    <div class="lower-title"><span>★ ★ ★</span><strong>THREE STARS</strong><small>FAN BALLOT</small></div><div id="lower-players"></div>
  </aside>`;
const rink = `<iframe id="rink" title="IceVision 3D tactical rink"></iframe>`;
$('app')!.innerHTML = obs ? `<main class="obs-stage" aria-label="OBS broadcast graphics">${graphics}<iframe id="studio-pregame" class="studio-pregame" title="LG3s pregame matchup loop" hidden></iframe><div class="rink-pip" id="rink-pip">${rink}</div></main>` : `
<header class="site-header">
  <div class="nav-shell">
    <a class="brand" href="/lg3s-gb" aria-label="Elite Chel Media live hub"><span class="brand-mark"><i></i><i></i><i></i></span><span>ELITE CHEL<small>MEDIA</small></span></a>
    <nav aria-label="Hub sections"><a href="#broadcast" class="selected">Live hub</a><a href="/lg3s-gb/pregame">Pregame</a><a href="#tactics">Tactical rink</a><a href="#match-data">Match centre</a></nav>
    <a class="obs-link" href="?mode=obs${preview ? '&amp;preview=true' : ''}" target="_blank" rel="noopener">${icon('expand')} OBS overlay</a>
  </div>
</header>
<main class="shell">
  <section id="broadcast" aria-labelledby="hub-title">
    <div class="intro">
      <div><div class="eyebrow"><span></span> LG3S <b>/</b> GROUP A</div><h1 id="hub-title">TEAM GREAT <em>BRITAIN</em></h1><p>Live broadcast hub</p></div>
      <div class="fixture"><span id="fixture-home"></span><small>VS</small><span id="fixture-away"></span></div>
    </div>
    <div class="broadcast panel" id="stage" style="${water('GBR')}">
      <div id="video-frame" class="video-frame"></div>
      <div class="stage-top"><span id="feed-badge" class="feed-badge"></span><span class="stage-network">ELITE CHEL MEDIA</span></div>
      <div id="cover" class="cover">
        <button id="play" aria-label="Play broadcast">${icon('play')}</button>
        <span id="play-caption"></span>
      </div>
      <div class="crop" id="reticle" hidden><span>GEMINI OCR CROP</span></div>
      ${graphics}
      <div class="stage-bottom"><span id="stage-caption"></span><span>ICE HOCKEY <b>/</b> GROUP A</span></div>
    </div>
    <div class="stage-controls">
      <span id="feed-status" class="feed-status"></span>
      <div><button id="main-feed" hidden>Main broadcast</button><button id="audio" ${demo ? '' : 'aria-pressed="false"'}>${icon('sound')} ${demo ? 'Test goal horn' : 'Goal horn'}</button><button id="crop" aria-pressed="false">${icon('crop')} OCR reticle</button><button id="fullscreen" aria-label="Fullscreen broadcast">${icon('expand')}</button></div>
    </div>
    <pre id="ocr-json" class="ocr-json" hidden></pre>
  </section>
  <div id="tactics" class="row upper">
    <section class="panel tactical" style="${water('GBR')}" aria-labelledby="rink-heading">
      <header class="panel-header"><div><span>${icon('rink')} ELITE LABS</span><h2 id="rink-heading">ICEVISION CARBON ARENA</h2></div><span class="pill"><i></i> 3D VIEW</span></header>
      <div class="rink-frame">${rink}</div>
      <div class="tactical-controls"><label>Camera <select id="camera">${cameras.map((c) => `<option value="${c}">${cameraLabels[c]}</option>`).join('')}</select></label><label>Formation <select id="formation">${formations.map((f) => `<option>${f}</option>`).join('')}</select></label></div>
    </section>
    <section class="panel locker" style="${water('GBR')}" aria-labelledby="locker-heading">
      <header class="panel-header"><div><span>${icon('shirt')} ROYAL BLUE KIT</span><h2 id="locker-heading">GBR LOCKER ROOM</h2></div><div class="switch" aria-label="Jersey view"><button id="front" aria-pressed="true">Front</button><button id="back" aria-pressed="false">Back</button></div></header>
      <div class="stalls">${GBR_ROSTER.map((p, i) => `<button class="stall" data-player="${p.num}" aria-label="Select ${playerNames[i]} for the tactical rink" aria-pressed="false"><span class="stall-light"></span><span class="jersey"><span class="jersey-front"><img alt=""></span><span class="jersey-back"><img alt=""></span></span><span class="stall-label"><b>#${p.num}</b> ${playerNames[i]}<small>${p.pos}</small></span></button>`).join('')}</div>
    </section>
  </div>
  <div id="match-data" class="row lower-row">
    <section class="panel ballot" style="${water('GBR')}" aria-labelledby="ballot-heading">
      <header class="panel-header"><div><span>${icon('star')} FAN BALLOT</span><h2 id="ballot-heading">THREE STARS</h2></div><span id="ballot-label" class="pill"></span></header>
      <div id="ballot-rows"></div>
      <p id="ballot-status" class="panel-notice" role="status"></p>
      <button id="push" class="panel-action"></button>
    </section>
    <section class="panel boxscore" style="${water('GBR')}" aria-labelledby="stats-heading">
      <header class="panel-header"><div><span>${icon('chart')} IIHF MATCH STATS</span><h2 id="stats-heading">BOXSCORE</h2></div></header>
      <div id="shots" class="shots"></div>
      <div class="table-scroll"><table><thead><tr><th>Player</th><th>G</th><th>A</th><th>PTS</th><th>+/−</th></tr></thead><tbody id="stats"></tbody></table></div>
      <details class="telemetry"><summary>Player build telemetry</summary><dl>${GBR_ROSTER.map((p) => `<dt>#${p.num} ${p.name}</dt><dd>${p.build} · ${p.archetype} · ${p.xfactor}</dd>`).join('')}</dl></details>
    </section>
    <section class="panel whip" style="${water('SWE')}" aria-labelledby="whip-heading">
      <header class="panel-header"><div><span>${icon('grid')} GROUP A MULTIVIEW</span><h2 id="whip-heading">WHIP-AROUND</h2></div></header>
      <div id="feeds" class="feeds"></div>
    </section>
  </div>
  <footer><span>ELITE CHEL MEDIA</span><span>LG3s · GROUP A</span></footer>
</main>`;

const frame = $<HTMLIFrameElement>('rink')!;
const rinkURL = new URL(import.meta.env.VITE_LG3S_RINK_URL || assetBase + 'rink-preview.html', location.origin);
if (rinkURL.origin !== location.origin) throw new Error('The rink iframe must be same-origin');
rinkURL.searchParams.set('embed', 'true');
if (obs) rinkURL.searchParams.set('mode', 'obs');
function send(type: string, payload?: unknown) {
  frame.contentWindow?.postMessage({ protocol: 'lg3s:1', type, payload }, rinkURL.origin);
}
function rinkState() {
  if (!ready) return;
  const state = { ...match, ...local };
  send('state', { ...state, positions: tactical.find((f) => f.slug === state.active_formation)?.positions });
}
frame.addEventListener('load', () => send('hello'));
window.addEventListener('message', (event) => {
  if (event.origin !== rinkURL.origin || event.source !== frame.contentWindow || event.data?.protocol !== 'lg3s:1') return;
  if (event.data.type === 'ready') { ready = true; send('alpha', obs); rinkState(); }
  if (event.data.type === 'player-selected' && GBR_ROSTER.some((p) => p.num === event.data.payload)) {
    local.highlighted_player = event.data.payload;
    renderCards();
  }
});
frame.src = rinkURL.href;

function sortedVotes() { return [...votes].sort((a, b) => b.votes - a.votes || a.player_number - b.player_number); }
function renderLower() {
  clearTimeout(lowerTimer);
  const lower = $('lower')!;
  const expires = Math.max(studioStarsUntil, lowerPreviewUntil, match.lower_third_visible ? (match.lower_third_until ? Date.parse(match.lower_third_until) : Infinity) : 0);
  const remaining = expires - Date.now();
  const leaders = sortedVotes().slice(0, 3);
  lower.hidden = remaining <= 0 || !leaders.length;
  $('lower-players')!.innerHTML = leaders.map((v, i) => `<div><b>0${i + 1}</b><span>${escape(v.player_name)}</span><small>${v.votes} votes</small></div>`).join('');
  if (Number.isFinite(remaining) && remaining > 0) lowerTimer = window.setTimeout(renderLower, remaining + 20);
}
function playHorn() {
  if (!obs && !demo && $('audio')?.getAttribute('aria-pressed') !== 'true') return;
  if (muteHorn) return;
  try {
    const context = audio ??= new AudioContext();
    void context.resume().catch(console.warn);
    const now = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.17, now + .12);
    gain.gain.setValueAtTime(.17, now + 1.05);
    gain.gain.exponentialRampToValueAtTime(.001, now + 1.65);
    for (const freq of [113, 151, 191]) {
      const tone = context.createOscillator();
      tone.type = 'sawtooth';
      tone.frequency.value = freq;
      const filter = context.createBiquadFilter();
      filter.frequency.value = 380;
      tone.connect(filter).connect(gain);
      tone.start(now);
      tone.stop(now + 1.7);
    }
  } catch (error) { console.warn(error); }
}
function showGoal() {
  clearTimeout(goalTimer);
  const goal = $('goal')!;
  goal.hidden = false;
  playHorn();
  goalTimer = window.setTimeout(() => { goal.hidden = true; }, 2900);
}

function renderCards() {
  const side = local.jersey_side ?? match.jersey_side;
  for (const button of document.querySelectorAll<HTMLButtonElement>('.stall')) {
    const player = GBR_ROSTER.find((p) => p.num === Number(button.dataset.player))!;
    button.setAttribute('aria-pressed', String((local.highlighted_player ?? match.highlighted_player) === player.num));
    button.classList.toggle('flipped', side === 'back');
    for (const face of ['front','back'] as const) {
      const img = button.querySelector<HTMLImageElement>(`.jersey-${face} img`)!;
      if (img.dataset.kit !== match.kit_variant) {
        img.src = jerseyImage(player, match.kit_variant, face);
        img.dataset.kit = match.kit_variant;
      }
    }
  }
  for (const face of ['front','back']) $(face)?.setAttribute('aria-pressed', String(face === side));
}
function renderStats() {
  $('shots')!.innerHTML = `<span>${flag(match.home_team)} <b>${match.home_sog}</b></span><small>SHOTS ON GOAL</small><span><b>${match.away_sog}</b> ${flag(match.away_team)}</span>`;
  const stats = match.boxscore ?? [];
  $('stats')!.innerHTML = stats.length ? stats.map((s) => {
    const i = GBR_ROSTER.findIndex((p) => p.num === s.num);
    return `<tr><th scope="row"><small>#${escape(s.num)}</small> ${escape(playerNames[i] ?? 'Player')}</th><td>${escape(s.g)}</td><td>${escape(s.a)}</td><td>${escape(s.pts)}</td><td>${escape(s.plusMinus)}</td></tr>`;
  }).join('') : '<tr><td colspan="5">Boxscore pending</td></tr>';
}
function renderVotes() {
  renderLower();
  if (obs) return;
  const target = $('ballot-rows')!;
  const focused = (document.activeElement as HTMLElement | null)?.dataset.vote;
  const max = Math.max(1, ...votes.map((v) => v.votes));
  target.innerHTML = sortedVotes().map((v) => `
    <button class="vote" data-vote="${v.player_number}" ${pendingVote || voterSelection ? 'aria-disabled="true"' : ''} aria-label="Vote for ${escape(v.player_name)}">
      <span class="vote-num">${v.player_number}</span><span class="vote-player"><b>${escape(v.player_name)}</b><small>${escape(v.position)} · ${escape(v.gamertag)}</small><i style="--bar:${100 * v.votes / max}%"></i></span><span class="vote-count">${v.votes}</span>
    </button>`).join('') || '<p class="panel-notice">Ballot not open</p>';
  if (focused) target.querySelector<HTMLElement>(`[data-vote="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  set('ballot-label', demo ? 'DEMO' : votes.length ? 'LIVE BALLOT' : 'STANDBY');
  const push = $<HTMLButtonElement>('push')!;
  push.hidden = !demo && !director;
  push.textContent = demo ? 'Preview OBS lower-third' : 'Auto-push to OBS lower-third';
}
function streamURL(provider?: string, stream?: string) {
  if (provider === 'youtube' && stream && /^[\w-]{11}$/.test(stream)) return `https://www.youtube-nocookie.com/embed/${stream}?autoplay=1&playsinline=1&mute=1`;
  if (provider === 'twitch' && stream && /^[a-zA-Z0-9_]{1,25}$/.test(stream)) return `https://player.twitch.tv/?channel=${stream}&parent=${encodeURIComponent(location.hostname)}&autoplay=true&muted=true`;
  return '';
}
function currentFeed() { return (match.whiparound ?? []).find((f) => f.id === activeFeed); }
function renderFeeds() {
  const target = $('feeds')!;
  const feeds = (match.whiparound ?? []).slice(0, 4);
  const signature = JSON.stringify([feeds, activeFeed, match.red_zone_active, match.home_score, match.away_score, match.clock, match.period]);
  if (target.dataset.signature === signature) return;
  target.dataset.signature = signature;
  if (!feeds.length) {
    target.innerHTML = '<p class="panel-notice">Group A feeds pending</p>';
    return;
  }
  target.querySelector('.panel-notice')?.remove();
  for (const card of target.querySelectorAll<HTMLButtonElement>('button')) {
    if (!feeds.some((feed) => feed.id === card.dataset.feed)) card.remove();
  }
  for (const [index, f] of feeds.entries()) {
    const redZone = f.overtime || (f.id === 'gb' && match.red_zone_active);
    const url = streamURL(f.provider, f.stream) || (f.id === 'gb' ? studioStream || configuredStream : '');
    let card = target.querySelector<HTMLButtonElement>(`[data-feed="${CSS.escape(f.id)}"]`);
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.dataset.feed = f.id;
      card.innerHTML = '<span class="feed-data"></span>';
      target.append(card);
    }
    card.style.cssText = `order:${index};${water(f.home)}`;
    card.className = redZone ? 'feed red-zone' : 'feed';
    card.setAttribute('aria-pressed', String(f.id === activeFeed));
    card.setAttribute('aria-label', `${f.home} versus ${f.away}${redZone ? ', red zone' : ''}`);
    const player = card.querySelector('iframe');
    if (player?.getAttribute('src') !== url) {
      player?.remove();
      if (url) {
        const video = document.createElement('iframe');
        video.src = url;
        video.title = `${f.home} vs ${f.away}`;
        video.allow = 'autoplay; encrypted-media';
        video.inert = true;
        video.tabIndex = -1;
        video.loading = 'lazy';
        card.prepend(video);
      }
    }
    const score = f.id === 'gb' ? `${match.home_score} – ${match.away_score}` : f.score;
    const status = f.id === 'gb' ? `${match.period} · ${match.clock}` : f.status;
    card.querySelector('.feed-data')!.innerHTML = `
      <span class="feed-teams">${flag(f.home)} ${escape(f.home)} <small>VS</small> ${escape(f.away)} ${flag(f.away)}</span>
      <b>${escape(score)}</b><small>${escape(status)}</small>${redZone ? '<em>RED ZONE</em>' : ''}`;
  }
}
function renderCrop() {
  const crop = match.ocr_crop ?? defaultCrop;
  const reticle = $('reticle')!;
  reticle.hidden = !cropVisible || (!!currentFeed() && currentFeed()!.id !== 'gb');
  for (const [name, value] of Object.entries(crop)) if (typeof value === 'number') reticle.style.setProperty(`--crop-${name}`, `${100 * value}%`);
  $('ocr-json')!.hidden = !cropVisible;
  set('ocr-json', JSON.stringify(match.ocr_result ?? { crop, ...(demo ? { status: 'Preview' } : { status: 'Waiting for OCR' }) }, null, 2));
}
const configuredStream = streamURL(import.meta.env.VITE_LG3S_STREAM_PROVIDER, import.meta.env.VITE_LG3S_STREAM_ID);
function renderFeed() {
  const mainStream = studioStream || configuredStream;
  const feed = currentFeed();
  const url = feed ? streamURL(feed.provider, feed.stream) || (feed.id === 'gb' ? mainStream : '') : mainStream;
  if (url === loadedFeedURL && $('video-frame')!.firstChild) return;
  loadedFeedURL = url;
  $('video-frame')!.replaceChildren();
  $('cover')!.hidden = false;
  const play = $<HTMLButtonElement>('play')!;
  play.hidden = !url;
  set('play-caption', url ? 'WATCH BROADCAST' : demo ? 'BROADCAST PREVIEW' : 'FEED UNAVAILABLE');
  play.onclick = () => {
    if (!url) return;
    const player = document.createElement('iframe');
    player.src = url;
    player.title = 'Live ice hockey broadcast';
    player.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    player.allowFullscreen = true;
    $('video-frame')!.append(player);
    $('cover')!.hidden = true;
  };
  set('feed-badge', demo ? 'PREVIEW' : url ? 'BROADCAST' : 'STANDBY');
  $('main-feed')!.hidden = activeFeed === 'main';
}
function renderStudioGraphics() {
  if (!obs) return;
  const scene = studioState?.scene ?? 'game';
  const pregame = scene === 'starting' && studioState?.payload?.presetId === 'pregame-gbr';
  const world = $<HTMLIFrameElement>('studio-pregame')!;
  world.hidden = !pregame;
  if (pregame && !world.hasAttribute('src')) world.src = '/lg3s-gb/pregame?mode=obs';
  if (!pregame) world.removeAttribute('src');
  const titles: Record<string, string> = { starting: 'Starting soon', intermission: 'Intermission', final: 'Final', brb: 'Back shortly' };
  const title = titles[scene];
  $('studio-scene')!.hidden = pregame || !title;
  $('rink-pip')!.hidden = studioState?.payload?.rinkVisible === false || !!title;
  if (!title) return;
  set('studio-event', studioState?.payload?.event || 'TEAM GREAT BRITAIN');
  set('studio-scene-title', title);
  const score = scene === 'intermission' || scene === 'final'
    ? `${match.home_team} ${match.home_score} – ${match.away_score} ${match.away_team}` : '';
  set('studio-scene-detail', [score, studioState?.payload?.message].filter(Boolean).join(' · '));
}

function renderMatch() {
  for (const side of ['home','away'] as const) {
    const team = match[`${side}_team`];
    set(`${side}-team`, team);
    set(`${side}-score`, match[`${side}_score`]);
    $(`${side}-flag`)!.innerHTML = flag(team);
    $(`${side}-score-cell`)!.setAttribute('style', water(team));
    const fixture = $(`fixture-${side}`);
    if (fixture) fixture.innerHTML = flag(team) + escape(team);
  }
  set('score-period', match.period);
  set('score-clock', match.clock);
  const feed = currentFeed();
  $('scorebug')!.hidden = (!demo && !haveMatch) || (!!feed && feed.id !== 'gb');
  $('scorebug')!.classList.toggle('red-zone', match.red_zone_active);
  const goal = match.goal_horn_trigger;
  if (goal && goal !== lastGoal && Math.abs(Date.now() - Date.parse(goal)) < 3500) showGoal();
  lastGoal = goal;
  rinkState();
  renderLower();
  renderStudioGraphics();
  if (obs) return;
  $<HTMLSelectElement>('camera')!.value = local.camera_angle ?? match.camera_angle;
  $<HTMLSelectElement>('formation')!.value = local.active_formation ?? match.active_formation;
  set('stage-caption', currentFeed() ? `${currentFeed()!.home} vs ${currentFeed()!.away}` : `${match.home_team} vs ${match.away_team}`);
  renderCards();
  renderStats();
  renderFeeds();
  renderCrop();
}

if (!obs) {
  set('feed-status', demo ? 'Demo feed' : 'Connecting to match data');
  renderFeed();
  $('audio')!.onclick = async () => {
    if (demo) {
      audio ??= new AudioContext();
      await audio.resume().catch(console.warn);
      showGoal();
      return;
    }
    const enabled = $('audio')!.getAttribute('aria-pressed') === 'true';
    if (!enabled) {
      audio ??= new AudioContext();
      await audio.resume().catch(console.warn);
    }
    $('audio')!.setAttribute('aria-pressed', String(!enabled));
  };
  for (const link of document.querySelectorAll('nav a')) {
    link.addEventListener('click', () => {
      document.querySelector('nav .selected')?.classList.remove('selected');
      link.classList.add('selected');
    });
  }
  $('crop')!.onclick = () => { cropVisible = !cropVisible; $('crop')!.setAttribute('aria-pressed', String(cropVisible)); renderCrop(); };
  $('fullscreen')!.onclick = () => { void (document.fullscreenElement ? document.exitFullscreen() : $('stage')!.requestFullscreen()).catch(console.warn); };
  $('main-feed')!.onclick = () => { activeFeed = 'main'; renderFeed(); renderMatch(); };
  $('feeds')!.onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-feed]');
    if (button) {
      activeFeed = button.dataset.feed!;
      renderFeed(); renderMatch();
      $('play')?.focus({ preventScroll: true });
      $('broadcast')!.scrollIntoView({ behavior: 'smooth' });
    }
  };
  for (const face of ['front','back'] as const) $(face)!.onclick = () => { local.jersey_side = face; renderCards(); rinkState(); };
  $<HTMLSelectElement>('camera')!.onchange = (event) => { local.camera_angle = (event.target as HTMLSelectElement).value as Match['camera_angle']; send('camera', local.camera_angle); rinkState(); };
  $<HTMLSelectElement>('formation')!.onchange = (event) => { local.active_formation = (event.target as HTMLSelectElement).value as Match['active_formation']; rinkState(); };
  $('ballot-rows')!.onclick = async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-vote]');
    if (!button || pendingVote || voterSelection) return;
    const num = Number(button.dataset.vote);
    pendingVote = true;
    renderVotes();
    try {
      if (db) {
        const { data, error } = await db.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          const { error } = await db.auth.signInAnonymously();
          if (error) throw error;
        }
        const { error: voteError } = await db.rpc('increment_gbr_star_vote', { p_num: num });
        if (voteError) throw voteError;
        void refresh();
      } else {
        votes = votes.map((p) => p.player_number === num ? { ...p, votes: p.votes + 1 } : p);
      }
      voterSelection = num;
      set('ballot-status', demo ? 'Preview vote counted' : 'Your vote was counted');
    } catch (error) {
      set('ballot-status', (error as { code?: string }).code === '23505' ? 'You already voted.' : 'Could not record your vote. Try again.');
      console.warn(error);
    } finally { pendingVote = false; renderVotes(); }
  };
  $('push')!.onclick = async () => {
    if (demo) {
      lowerPreviewUntil = Date.now() + 15000;
      renderLower();
      $('broadcast')!.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!db || !director) return;
    const { data, error } = await db.from('lg3s_match_state').update({
      lower_third_visible: true, lower_third_until: new Date(Date.now() + 15000).toISOString(),
    }).eq('id', matchId).select('id').maybeSingle();
    set('ballot-status', error || !data ? 'Lower-third update failed' : 'Lower-third sent to OBS');
    if (!error && data) void refresh();
  };
  for (const card of document.querySelectorAll<HTMLButtonElement>('.stall')) {
    card.onclick = () => { local.highlighted_player = Number(card.dataset.player); renderCards(); send('highlight', local.highlighted_player); rinkState(); };
    card.onpointermove = (event) => {
      if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const b = card.getBoundingClientRect();
      card.style.setProperty('--tx', `${(0.5 - (event.clientY - b.top) / b.height) * 14}deg`);
      card.style.setProperty('--ty', `${((event.clientX - b.left) / b.width - .5) * 16}deg`);
    };
    card.onpointerleave = () => { card.style.removeProperty('--tx'); card.style.removeProperty('--ty'); };
  }
}
renderMatch();
renderVotes();

interface StudioState {
  scene: string;
  payload?: {
    streamUrl?: string; homeScore?: number; awayScore?: number;
    clock?: string; clockRunning?: boolean; clockBaseSeconds?: number; clockStartedAt?: string; clockRate?: number;
    period?: string; awayName?: string; goalHornTrigger?: string | null;
    event?: string; message?: string; presetId?: string; threeStarsUntil?: string | null;
    rinkCamera?: Match['camera_angle']; rinkFormation?: Match['active_formation'];
    rinkHighlight?: number; rinkVisible?: boolean;
  };
}
let ocrMatch: Match | null = null;
let request = 0;
function studioEmbed(raw?: string) {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'twitch.tv') {
      const vod = /^\/videos\/(\d+)\/?$/.exec(url.pathname);
      if (vod) return `https://player.twitch.tv/?video=v${vod[1]}&parent=${encodeURIComponent(location.hostname)}&autoplay=true&muted=true`;
      return streamURL('twitch', url.pathname.split('/')[1]);
    }
    if (host === 'youtube.com' || host === 'youtu.be') {
      const id = host === 'youtu.be' ? url.pathname.split('/')[1]
        : url.searchParams.get('v') || /^\/(?:live|embed)\/([\w-]{11})/.exec(url.pathname)?.[1];
      return streamURL('youtube', id ?? undefined);
    }
  } catch { return ''; }
  return '';
}
function applyBroadcastState(previous = match) {
  const p = studioState?.payload;
  const studioOwnsScore = p && !(ocrMatch?.ocr_result && Date.now() - Date.parse(ocrMatch.updated_at) < 20000);
  if (studioOwnsScore) {
    let clock = /^\d{1,2}:[0-5]\d$/.test(p.clock ?? '') ? p.clock!.padStart(5, '0') : '—';
    if (p.clockRunning && Number.isFinite(p.clockBaseSeconds) && Number.isFinite(Date.parse(p.clockStartedAt ?? ''))) {
      const seconds = Math.max(0, Math.ceil(p.clockBaseSeconds! - Math.max(0, Date.now() - Date.parse(p.clockStartedAt!)) / 1000 * (p.clockRate || 1)));
      clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    const period = String(p.period || '—');
    const opponent = String(p.awayName || '').trim().toUpperCase();
    match = { ...(ocrMatch ?? match), home_team: 'GBR', away_team: /^[A-Z]{3}$/.test(opponent) ? opponent : 'OPP',
      home_score: Number(p.homeScore) || 0, away_score: Number(p.awayScore) || 0, clock, period,
      red_zone_active: period === 'OT' || (period === '3RD' && clock !== '—' && Number(clock.slice(0, 2)) < 5) };
  } else if (ocrMatch) {
    match = { ...ocrMatch };
  }
  const validGoalTimes = [ocrMatch?.goal_horn_trigger, p?.goalHornTrigger]
    .filter((time): time is string => !!time && Number.isFinite(Date.parse(time)));
  match = { ...match, goal_horn_trigger: validGoalTimes.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null };
  if (p?.rinkCamera && cameras.includes(p.rinkCamera)) {
    match.camera_angle = p.rinkCamera;
  }
  if (p?.rinkFormation && formations.includes(p.rinkFormation)) {
    match.active_formation = p.rinkFormation;
  }
  if (p?.rinkHighlight && GBR_ROSTER.some((player) => player.num === p.rinkHighlight)) {
    match.highlighted_player = p.rinkHighlight;
  }
  if (match.camera_angle !== previous.camera_angle) delete local.camera_angle;
  if (match.active_formation !== previous.active_formation) delete local.active_formation;
  if (match.jersey_side !== previous.jersey_side) delete local.jersey_side;
  if (match.highlighted_player !== previous.highlighted_player) delete local.highlighted_player;
  studioStarsUntil = Date.parse(p?.threeStarsUntil ?? '') || 0;
  haveMatch = !!(ocrMatch || p);
  const stream = studioEmbed(p?.streamUrl);
  if (stream !== studioStream) {
    studioStream = stream;
    if (!obs) renderFeed();
  }
}

async function refresh() {
  if (!db) return;
  const version = ++request;
  const results = await Promise.all([
    db.from('lg3s_match_state').select('*').eq('id', matchId).single(),
    db.from('lg3s_three_stars_votes').select('*'),
    db.from('lg3s_tactical_formations').select('*'),
    db.from('obs_broadcast_state').select('scene,payload').eq('channel', studioChannel).eq('is_public', true).maybeSingle(),
  ]);
  if (version !== request) return;
  const [state, ballot, positions, studio] = results;
  if (!studio.error) studioState = studio.data as StudioState | null;
  if (state.data && Number.isInteger(state.data.home_score) && Number.isInteger(state.data.away_score)) {
    ocrMatch = state.data as Match;
  }
  if (ballot.data) votes = ballot.data as Vote[];
  if (positions.data) tactical = positions.data as TacticalFormation[];
  applyBroadcastState();
  renderMatch();
  renderVotes();
  set('feed-status', haveMatch ? 'Broadcast data connected' : 'Awaiting Broadcast Studio');
}
if (db) {
  db.auth.onAuthStateChange((_event, session) => {
    director = session?.user.app_metadata.lg3s_director === true;
    if (!obs) renderVotes();
  });
  db.channel('lg3s-world')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lg3s_match_state', filter: `id=eq.${matchId}` }, () => void refresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lg3s_three_stars_votes' }, () => void refresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lg3s_tactical_formations' }, () => void refresh())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void refresh();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') set('feed-status', 'Live sync reconnecting');
    });
  void refresh();
  db.channel('lg3s-studio')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'obs_broadcast_state', filter: `channel=eq.${studioChannel}` }, () => void refresh())
    .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh(); });
  // The existing OBS Studio also polls its state to recover missed Realtime events.
  window.setInterval(() => void refresh(), 2500);
  window.setInterval(() => {
    if (!studioState?.payload?.clockRunning) return;
    const previousClock = match.clock;
    applyBroadcastState();
    if (match.clock !== previousClock) renderMatch();
  }, 250);
}
