import { createClient } from '@supabase/supabase-js';
import { demoMatch, type CameraAngle } from '../utils/match';
import { greatBritain, makeBoard, makePlayer, rinkSlots, type PregameGame, type PregamePlayer, type PregameUnit, type SeasonStats } from '../utils/pregame';
import { localIceVisionParent } from '../utils/icevision';
import './pregame.css';

interface CardLayout {
  background?: string;
  imageScale?: number;
  imageX?: number;
  imageY?: number;
}
interface CardPublication {
  lg_user_id: number;
  player_kind: 'skater' | 'goalie';
  object_path: string;
  layout: CardLayout;
}
interface RenderCard extends CardLayout {
  player: { tag: string; team: string; pos: string };
  league: 'lg3s';
  season: string;
  ratingKind: 'pending';
  edition: 'season';
  finish: 'ice';
  readOnly: true;
  jersey?: string;
  portrait?: HTMLImageElement;
  teamJersey?: string;
  logo: string;
  labels: string[];
  values: string[];
}
declare global {
  interface Window {
    ECMCardRenderer?: { draw(canvas: HTMLCanvasElement, card: RenderCard): Promise<boolean> };
  }
}

const params = new URLSearchParams(location.search);
const cardRendererUrl = '/player-card-renderer.js?v=20261118-locker-jerseys';
const cardRenderer = import(/* @vite-ignore */ cardRendererUrl).then(() => window.ECMCardRenderer).catch(() => undefined);
const onAir = params.get('mode') === 'obs';
document.body.classList.toggle('on-air', onAir);
const companionOrigin = onAir ? localIceVisionParent('arenaParent') : '';
const expectsArena = onAir && params.has('arenaParent');
const cardsOnly = onAir && !expectsArena && params.get('layout') === 'cards';
document.body.classList.toggle('cards-only',cardsOnly);
const db = createClient(import.meta.env.VITE_SUPABASE_URL || 'http://localhost', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'preview', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'lg3s-pregame-public' },
});
const rosterPath = '/data/lg3s/season1-active-roster-2026-11-14.json';
const postedPath = '/data/lg3s/pregame-lineups.json';
const syncedPath = 'https://raw.githubusercontent.com/bellyjelly9393-ux/ELITECHELMEDIA/lg3s-pregame-data/data/lg3s/pregame-lineups.json';
const fixtureFields = 'lg_game_id,game_night_date,scheduled_at,home_lg_team_id,away_lg_team_id,home_nation,away_nation,status,home_score,away_score';
const interval = 8500;
const leagueDate = new Intl.DateTimeFormat('sv-SE', { timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit' });
const time = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Toronto', weekday:'short', month:'short', day:'numeric' });
const puckDrop = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Toronto', hour:'numeric', minute:'2-digit', timeZoneName:'short' });
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const unique = (players: PregamePlayer[]) => [...new Map(players.map((p) => [p.id,p])).values()];
const noSide: PregameUnit = { players:[], basis:'roster' };
const flagCodes: Record<number, string> = { 341:'ca',532:'de',1446:'gb',822:'it',591:'jp',531:'kz',1439:'lv',1444:'pl',1079:'sk',343:'se',404:'ch',342:'us' };
const intelIcon = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;

interface BroadcastCrew {
  play_by_play?: string;
  analyst?: string;
}

interface Matchup {
  fixture?: PregameGame;
  opponentId: number;
  opponent: string;
  gb: PregameUnit;
  away: PregameUnit;
  forfeitBy?: string;
  crew?: BroadcastCrew;
}
interface Review {
  games: Matchup[];
  stats: Map<string, SeasonStats>;
  publications: Map<string, CardPublication>;
}
interface RosterFile {
  teams: { lgTeamId: number | string; players: { lgUserId: unknown; gamertag: unknown; position: unknown; jerseyNumber?: unknown; rosterStatus: string }[] }[];
}
interface PostedGame {
  lg_game_id: number;
  forfeit_by_team_id?: number;
  broadcast_crew?: BroadcastCrew;
  teams: Record<string, { lg_user_id: unknown; gamertag: unknown; position: unknown; jersey_number?: unknown }[]>;
}
interface PostedFile {
  schema: string;
  games: PostedGame[];
}

$('pregame').innerHTML = `
<div class="world">
  <header class="world-header">
    <div class="match-heading">
      <p class="world-kicker">EliteChel Media <span aria-hidden="true"></span> LG3s Pregame</p>
      <h1><span class="match-team match-gb"><span class="match-flag" aria-hidden="true"></span><img src="/assets/lg3s/team1446.svg" alt=""><span>Great Britain</span></span>
        <span class="match-opponent" id="opponent" hidden><span class="versus">vs</span>
          <span class="match-team"><span class="match-flag" id="opponent-flag" aria-hidden="true"></span><img id="opponent-mark" alt=""><span id="opponent-name"></span></span>
        </span>
      </h1>
    </div>
    <div class="kickoff" id="kickoff" hidden><span id="game-day"></span><strong id="game-time"></strong><small id="queue"></small></div>
  </header>
  <div class="world-board">
    <section class="world-rink" aria-label="3D warmup rink" ${cardsOnly ? 'hidden' : ''}>
      <iframe id="world-rink" title="LG3s 3D pregame warmup"></iframe>
      <p class="rink-label" id="rink-label">Loading matchup…</p>
    </section>
    <section class="world-players" id="world-players" aria-label="Featured players"></section>
  </div>
  <footer class="world-footer">
    <span>LG3s season stats · LeagueGaming</span>
    <div class="world-controls" aria-label="Pregame playback">
      <button id="previous" type="button">Previous</button><button id="pause" type="button" aria-pressed="false">Pause</button><button id="next" type="button">Next</button>
    </div>
    <a id="fixture-link" href="/lg3s-media.html" target="_blank" rel="noopener">Schedule and game sheets</a>
  </footer>
  <section class="world-intel" aria-labelledby="intel-title" hidden>
    <h2 id="intel-title">Pregame Intel</h2>
    <div class="intel-frame">
      <article class="intel-panel intel-keys">
        <h3>${intelIcon('M9 5H5v16h14V5h-4 M9 5V3h6v4H9V5 M8 11l3 3m-3 0 3-3m3 7 3-4m-3 0h3v3')}Keys to the game</h3>
        <ul id="intel-keys"><li>Win the special teams battle.</li><li>Limit high-danger chances in front.</li><li>Stay disciplined and control the pace.</li></ul>
        <p class="intel-empty" id="intel-forfeit" hidden>Result decided by forfeit.</p>
      </article>
      <article class="intel-panel intel-watch">
        <h3>${intelIcon('M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m19 0v-2a4 4 0 0 0-3-3.87M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-8a4 4 0 0 1 0 8')}Players to watch</h3>
        <div class="intel-watch-list" id="intel-watch"></div>
      </article>
      <div class="intel-side">
        <article class="intel-panel intel-crew">
          <h3>${intelIcon('M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 10v1a7 7 0 0 0 14 0v-1m-7 8v4m-4 0h8')}Broadcast team</h3>
          <dl><div><dt>Play-by-play</dt><dd id="intel-play-by-play">—</dd></div><div><dt>Analyst</dt><dd id="intel-analyst">—</dd></div></dl>
        </article>
        <article class="intel-panel intel-notes">
          <h3>${intelIcon('M6 3h9l3 3v15H6V3zm8 0v5h4M9 12h6m-6 4h6')}Game notes</h3>
          <p><span id="intel-game"></span><span id="intel-note"></span></p>
        </article>
      </div>
    </div>
  </section>
</div>`;
const rink = $<HTMLIFrameElement>('world-rink');
let review: Review | null = null;
let current = 0;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches || onAir;
let rinkReady = false;
let latestBoard: ReturnType<typeof makeBoard> = { markers:[], highlighted:[] };
let latestCamera: CameraAngle = 'ice';
let latestOpponent = '';
let latestForfeit = false;
function sendBoard() {
  const board = { ...latestBoard, skating:playing && !latestForfeit };
  if (companionOrigin) {
    const box = rink.parentElement!.getBoundingClientRect();
    window.parent.postMessage({
      protocol:'icevision:pregame:1', type:'board', board, camera:latestCamera, opponent:latestOpponent,
      viewport:{ x:box.x, y:box.y, width:box.width, height:box.height },
    },companionOrigin);
    return;
  }
  if (rinkReady) rink.contentWindow?.postMessage({
    protocol:'lg3s:1', type:'state', payload:{ ...demoMatch, camera_angle:latestCamera, pregame:board },
  }, location.origin);
}
window.addEventListener('message', (event) => {
  if (companionOrigin && event.origin === companionOrigin && event.source === window.parent
      && event.data?.protocol === 'icevision:pregame:1' && event.data.type === 'ready') {
    document.body.classList.add('companion');
    if (rink.getAttribute('src') !== 'about:blank') rink.src = 'about:blank';
    return;
  }
  if (event.origin !== location.origin || event.source !== rink.contentWindow) return;
  if (event.data?.protocol === 'lg3s:1' && event.data.type === 'ready') {
    rinkReady = true;
    sendBoard();
  }
});
rink.addEventListener('load', () => rink.contentWindow?.postMessage({ protocol:'lg3s:1', type:'hello' }, location.origin));
if (companionOrigin) new ResizeObserver(sendBoard).observe(rink.parentElement!);
if (!expectsArena && !cardsOnly) rink.src = import.meta.env.BASE_URL + 'rink-preview.html?embed=true&mode=obs&pregame=1';

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache:'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function playersFromRoster(data: RosterFile | undefined) {
  return new Map((data?.teams ?? []).map((team) => [
    Number(team.lgTeamId),
    unique(team.players.flatMap((p) => {
      const player = p.rosterStatus === 'active' && makePlayer(p.lgUserId,p.gamertag,p.position,p.jerseyNumber);
      return player ? [player] : [];
    })),
  ]));
}
function postedGame(source: PostedFile | undefined, gameId: number): PostedGame | undefined {
  if (source?.schema === 'lg3s-pregame-lineups-v1') return source.games.find((game) => Number(game.lg_game_id) === gameId);
}
function postedUnit(posted: PostedGame | undefined, teamId: number): PregameUnit | undefined {
  if (!posted) return;
  const rows = posted.teams[String(teamId)];
  if (!rows) return;
  const players = unique(rows.flatMap((p) => makePlayer(p.lg_user_id,p.gamertag,p.position,p.jersey_number) ?? []));
  return players.length ? { players, basis:'posted', sourceGame:posted.lg_game_id } : noSide;
}
function opponentFor(fixture: PregameGame) {
  return fixture.home_lg_team_id === greatBritain ? {
    id:fixture.away_lg_team_id, name:fixture.away_nation,
  } : { id:fixture.home_lg_team_id, name:fixture.home_nation };
}
async function loadReview(): Promise<Review> {
  const signal = AbortSignal.timeout(12000);
  const today = leagueDate.format(new Date());
  const [schedule, roster, posted, synced] = await Promise.allSettled([
    db.from('lg3s_public_games').select(fixtureFields).eq('season',1).gte('game_night_date',today)
      .in('status',['scheduled','in_progress','final']).or('home_lg_team_id.eq.1446,away_lg_team_id.eq.1446')
      .order('scheduled_at',{ ascending:true }).limit(10).abortSignal(signal),
    readJson<RosterFile>(rosterPath,signal),
    readJson<PostedFile>(postedPath,signal),
    readJson<PostedFile>(syncedPath,signal),
  ]);
  if (schedule.status === 'rejected' || schedule.value.error) {
    if (review) throw new Error('Schedule temporarily unavailable');
  }
  const fixtures = schedule.status === 'fulfilled' ? (schedule.value.data ?? []) as PregameGame[] : [];
  const firstNight = fixtures[0]?.game_night_date;
  const gameNight = fixtures.filter((game) => game.game_night_date === firstNight);
  const rosters = playersFromRoster(roster.status === 'fulfilled' ? roster.value : undefined);
  const matches: Matchup[] = gameNight.map((fixture) => {
    const opponent = opponentFor(fixture);
    const latest = postedGame(synced.status === 'fulfilled' ? synced.value : undefined,fixture.lg_game_id);
    const fallback = postedGame(posted.status === 'fulfilled' ? posted.value : undefined,fixture.lg_game_id);
    const forfeitTeam = latest?.forfeit_by_team_id ?? fallback?.forfeit_by_team_id;
    const forfeitBy = forfeitTeam === opponent.id ? opponent.name : forfeitTeam === greatBritain ? 'Great Britain' : undefined;
    const crew = latest?.broadcast_crew ?? fallback?.broadcast_crew;
    const unit = (team: number) => postedUnit(latest,team)
      ?? postedUnit(fallback,team)
      ?? { players:rosters.get(team) ?? [], basis:'roster' as const };
    return { fixture, opponentId:opponent.id, opponent:opponent.name, gb:unit(greatBritain), away:unit(opponent.id), forfeitBy, crew };
  });
  if (!matches.length) matches.push({ opponentId:0, opponent:'', gb:{ players:rosters.get(greatBritain) ?? [], basis:'roster' }, away:noSide });

  const all = unique(matches.flatMap((m) => [...m.gb.players,...m.away.players]));
  const stats = new Map<string, SeasonStats>();
  const artwork = all.length ? db.from('ecm_card_publications')
    .select('lg_user_id,player_kind,object_path,layout').eq('league','lg3s')
    .in('lg_user_id',all.map((player) => player.id)).abortSignal(signal) : undefined;
  const [published] = await Promise.all([artwork, ...(['skater','goalie'] as const).map(async (kind) => {
    const ids = all.filter((p) => (p.slot === 'G') === (kind === 'goalie')).map((p) => p.id);
    if (!ids.length) return;
    const fields = kind === 'goalie' ? 'lg_user_id,gp,sv,sv_pct,gaa_per_game' : 'lg_user_id,gp,g,a,p';
    const result = await db.from(`lg3s_public_${kind}_leaders`).select(fields).in('lg_user_id',ids).abortSignal(signal);
    if (result.error) {
      for (const id of ids) {
        const record = review?.stats.get(`${kind}:${id}`);
        if (record) stats.set(`${kind}:${id}`,record);
      }
      return;
    }
    for (const row of (result.data ?? []) as unknown as SeasonStats[]) stats.set(`${kind}:${row.lg_user_id}`,row);
  })]);
  const publications = new Map<string, CardPublication>();
  for (const row of (published?.data ?? []) as CardPublication[]) {
    publications.set(`${row.player_kind}:${row.lg_user_id}`,row);
  }
  return { games:matches,stats,publications };
}

function formatStat(value: unknown) { return value === null || value === undefined ? '—' : String(value); }
const portraits = new WeakMap<CardPublication,Promise<HTMLImageElement | undefined>>();
function loadApprovedPortrait(publication: CardPublication) {
  const previous = portraits.get(publication);
  if (previous) return previous;
  const loaded = (async () => {
    const bucket = db.storage.from('ecm-card-artwork-review');
    const { data, error } = await bucket.download(publication.object_path, {}, { signal:AbortSignal.timeout(6500) });
    if (error || !data?.type.startsWith('image/')) return;
    const url = URL.createObjectURL(data);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  })().catch(() => undefined);
  portraits.set(publication,loaded);
  return loaded;
}

function playerStats(player: PregamePlayer) {
  const kind = player.slot === 'G' ? 'goalie' : 'skater';
  const stat = review?.stats.get(`${kind}:${player.id}`);
  const sv = stat?.sv_pct == null ? null : `${(stat.sv_pct <= 1 ? stat.sv_pct * 100 : stat.sv_pct).toFixed(1)}%`;
  const labels = kind === 'goalie' ? ['GP','SV','SV%','GAA'] : ['GP','G','A','PTS'];
  const values = (kind === 'goalie'
    ? [stat?.gp,stat?.sv,sv,stat?.gaa_per_game?.toFixed(2)]
    : [stat?.gp,stat?.g,stat?.a,stat?.p]).map(formatStat);
  return { kind, labels, values };
}

function playerCard(player: PregamePlayer | undefined, unit: PregameUnit, teamId: number, team: string, gb: boolean, forfeit: boolean) {
  const article = document.createElement('article');
  article.className = 'player';
  article.dataset.gb = String(gb);
  const badge = teamId ? `<img class="team-crest" src="/assets/lg3s/team${teamId}.svg" alt="">` : '';
  const proof = unit.basis === 'posted' ? (forfeit ? 'Listed lineup' : 'Posted lineup') : 'Roster spotlight · lineup pending';
  if (!player) {
    article.innerHTML = `<div class="player-placeholder">${badge}<p class="player-meta">${esc(team)}</p><h2 class="player-title">${unit.basis==='posted'?'Slot not posted':'Lineup pending'}</h2></div>`;
    return article;
  }
  const { kind, labels, values } = playerStats(player);
  const href = `/player-cards.html?league=lg3s&id=${player.id}&kind=${kind}`;
  article.innerHTML = `<a class="card-motion" href="${href}" target="_blank" rel="noopener" aria-label="${esc(player.name)}">
    <canvas class="player-card-canvas" role="img" hidden></canvas>
    <div class="player-placeholder">${badge}<p class="player-meta">${esc(team)} · ${esc(player.position)}</p><h2 class="player-title">${esc(player.name)}</h2></div>
  </a><p class="player-source">${proof}</p>
  <dl class="player-stats">${labels.map((label,i) => `<div><dt>${label}</dt><dd>${esc(values[i])}</dd></div>`).join('')}</dl>`;
  const card: RenderCard = {
    player:{ tag:player.name, team, pos:player.position }, league:'lg3s', season:'LG3S · SEASON 1',
    ratingKind:'pending', edition:'season', finish:'ice', readOnly:true, jersey:player.jersey,
    teamJersey:gb ? '/assets/lg3s/scene/gb-royal-blue.webp' : teamId ? `/assets/lg3s/jerseys/${teamId}.webp` : undefined,
    background:'arena', logo:teamId ? `/assets/lg3s/team${teamId}.svg` : '', labels, values,
  };
  const canvas = article.querySelector('canvas')!;
  const placeholder = article.querySelector<HTMLElement>('.player-placeholder')!;
  const publication = review?.publications.get(`${kind}:${player.id}`);
  async function draw() {
    const renderer = await cardRenderer;
    if (!renderer || !article.isConnected) return;
    if (await renderer.draw(canvas,card) && article.isConnected) {
      canvas.hidden = false;
      placeholder.hidden = true;
    }
    if (!publication || !article.isConnected) return;
    const portrait = await loadApprovedPortrait(publication);
    if (portrait && article.isConnected) {
      const { background, imageScale, imageX, imageY } = publication.layout;
      await renderer.draw(canvas,{ ...card, background, imageScale, imageX, imageY, portrait });
    }
  }
  void Promise.all([document.fonts.load('46px CardDisplay'),document.fonts.load('36px CardLabel')])
    .then(draw,draw).catch(console.warn);
  return article;
}

const pointerTilt = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
function enableCardTilt() {
  if (onAir || !pointerTilt.matches) return;
  document.querySelectorAll<HTMLElement>('.card-motion').forEach((card) => {
    card.onpointermove = (event) => {
      const box = card.getBoundingClientRect();
      card.style.setProperty('--pitch', `${(0.5 - (event.clientY - box.top) / box.height) * 7}deg`);
      card.style.setProperty('--yaw', `${((event.clientX - box.left) / box.width - 0.5) * 8}deg`);
    };
    card.onpointerleave = () => {
      card.style.removeProperty('--pitch');
      card.style.removeProperty('--yaw');
    };
  });
}
function framesFor(game: Matchup) {
  return rinkSlots.flatMap((slot) => {
    const a = game.gb.players.filter((p) => p.slot === slot);
    const b = game.away.players.filter((p) => p.slot === slot);
    // On a posted lineup, keep every listed player. A fallback roster shows one spotlight per role for the matchup.
    const count = Math.max(game.gb.basis==='posted'?a.length:Math.min(a.length,1),game.away.basis==='posted'?b.length:Math.min(b.length,1));
    return Array.from({ length:count }, (_, i) => ({ game, slot, a:a[i], b:b[i] }));
  });
}
function watchRow(unit: PregameUnit, teamId: number, team: string, gb: boolean) {
  if (!teamId) return '';
  const points = (player: PregamePlayer) => review?.stats.get(`skater:${player.id}`)?.p ?? -1;
  const skaters = unit.players.filter(player => player.slot !== 'G');
  const player = skaters.reduce<PregamePlayer | undefined>((pick, candidate) =>
    !pick || points(candidate) > points(pick) ? candidate : pick, undefined) ?? unit.players[0];
  const crest = `<img src="/assets/lg3s/team${teamId}.svg" alt="">`;
  if (!player) return `<div class="intel-player empty-row" data-gb="${gb}">${crest}<span class="intel-player-name"><strong>${esc(team)}</strong><small>Lineup pending</small></span></div>`;
  const { kind, labels, values } = playerStats(player);
  const jersey = player.jersey ? `<span class="intel-number">#${player.jersey}</span> ` : '';
  return `<a class="intel-player" data-gb="${gb}" href="/player-cards.html?league=lg3s&id=${player.id}&kind=${kind}" target="_blank" rel="noopener">
    ${crest}<span class="intel-player-name"><strong>${jersey}${esc(player.name)}</strong><small>${esc(team)} · ${esc(player.position)}${unit.basis === 'roster' ? ' · Roster spotlight' : ''}</small></span>
    <dl>${labels.map((label, i) => `<div><dt>${label}</dt><dd>${esc(values[i])}</dd></div>`).join('')}</dl>
  </a>`;
}

function renderIntel(game: Matchup, gameNumber: string) {
  const fixture = game.fixture;
  const gbIsHome = fixture?.home_lg_team_id === greatBritain;
  const homeScore = fixture?.home_score;
  const awayScore = fixture?.away_score;
  const score = Number.isInteger(homeScore) && Number.isInteger(awayScore)
    ? `${gbIsHome ? homeScore : awayScore}–${gbIsHome ? awayScore : homeScore}` : '';
  document.querySelector<HTMLElement>('.world-intel')!.hidden = false;
  $('intel-keys').hidden = Boolean(game.forfeitBy);
  $('intel-forfeit').hidden = !game.forfeitBy;
  $('intel-watch').innerHTML = watchRow(game.gb,greatBritain,'Great Britain',true) + watchRow(game.away,game.opponentId,game.opponent,false);
  const crewName = (name: unknown) => typeof name === 'string' && name.trim() || 'To be announced';
  $('intel-play-by-play').textContent = crewName(game.crew?.play_by_play);
  $('intel-analyst').textContent = crewName(game.crew?.analyst);
  $('intel-game').textContent = gameNumber || 'Roster spotlight';
  $('intel-note').textContent = game.forfeitBy ? `${game.forfeitBy} forfeited`
    : fixture?.status === 'final' ? (score ? `Final · GBR ${score}` : 'Final')
    : fixture?.status === 'in_progress' ? 'In progress'
    : fixture ? (gbIsHome ? 'GBR home' : 'GBR away') : 'Schedule pending';
}

let intelGame: Matchup | undefined;
function render() {
  const all = review?.games.flatMap(framesFor) ?? [];
  if (!all.length) {
    $('rink-label').textContent = 'Awaiting matchup data';
    $('world-players').innerHTML = '<p class="world-empty">Pregame lineup data is unavailable.</p>';
    return;
  }
  current = (current % all.length + all.length) % all.length;
  const {game,slot,a,b} = all[current];
  const fixture = game.fixture;
  $('opponent').hidden = !game.opponent;
  $('opponent-name').textContent = game.opponent;
  const opponentMark = $<HTMLImageElement>('opponent-mark');
  const flag = flagCodes[game.opponentId];
  $('opponent-flag').style.backgroundImage = flag ? `url(/assets/lg3s/flags/${flag}.png)` : '';
  if (game.opponentId) opponentMark.src = `/assets/lg3s/team${game.opponentId}.svg`;
  else opponentMark.removeAttribute('src');
  $('kickoff').hidden = false;
  $('game-day').textContent = fixture ? time.format(new Date(fixture.scheduled_at)) : '';
  $('game-time').textContent = fixture ? puckDrop.format(new Date(fixture.scheduled_at)) : 'Roster spotlight';
  const gameNumber = fixture && review ? `Game ${review.games.indexOf(game)+1} of ${review.games.length}` : '';
  $('queue').textContent = game.forfeitBy ? `${gameNumber} · ${game.forfeitBy} forfeited` : gameNumber;
  if (intelGame !== game) {
    renderIntel(game,gameNumber);
    intelGame = game;
  }
  $<HTMLAnchorElement>('fixture-link').href = fixture ? `/lg3s-media.html#game/${fixture.lg_game_id}` : '/lg3s-media.html#nation/1446';
  latestForfeit = Boolean(game.forfeitBy);
  $('world-players').replaceChildren(playerCard(a,game.gb,greatBritain,'Great Britain',true,latestForfeit),
    playerCard(b,game.away,game.opponentId,game.opponent || 'Opponent',false,latestForfeit));
  enableCardTilt();
  const view: Record<string,CameraAngle> = { O:'ice', C:'orbit', D:'overhead', G:'goalie' };
  latestCamera = playing ? view[slot] : 'ice';
  latestBoard = makeBoard(game.gb,game.away,[a,b]);
  latestOpponent = game.opponent;
  $('rink-label').textContent = game.forfeitBy ? `${game.forfeitBy} forfeited` : 'Pregame warmup · ' + ({O:'Wing',C:'Center',D:'Defense',G:'Goaltending'})[slot] + ' matchup';
  sendBoard();
}
async function refresh() {
  try {
    review = await loadReview();
    render();
  } catch (error) {
    console.warn('Pregame update unavailable',error);
    if (!review) render();
  }
}
function playButton() {
  $('pause').textContent = playing ? 'Pause' : 'Play';
  $('pause').setAttribute('aria-pressed',String(!playing));
}
$('previous').onclick = () => { current--; render(); };
$('next').onclick = () => { current++; render(); };
$('pause').onclick = () => { playing = !playing; playButton(); render(); };
playButton();
void refresh();
window.setInterval(() => { if (playing && review) { current++; render(); } },interval);
window.setInterval(() => void refresh(),5 * 60 * 1000);
