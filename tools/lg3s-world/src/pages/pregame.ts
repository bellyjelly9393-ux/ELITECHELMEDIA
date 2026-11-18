import { createClient } from '@supabase/supabase-js';
import { demoMatch, type CameraAngle } from '../utils/match';
import { greatBritain, makeBoard, makePlayer, rinkSlots, type PregameGame, type PregamePlayer, type PregameUnit, type SeasonStats } from '../utils/pregame';
import './pregame.css';

const params = new URLSearchParams(location.search);
const onAir = params.get('mode') === 'obs';
document.body.classList.toggle('on-air', onAir);
function trustedCompanion() {
  try {
    const origin = new URL(params.get('arenaParent') ?? '');
    if (!onAir || origin.origin !== new URL(document.referrer).origin || origin.protocol !== 'http:'
        || !['localhost','127.0.0.1'].includes(origin.hostname) || window.parent === window) return '';
    return origin.origin;
  } catch { return ''; }
}
const companionOrigin = trustedCompanion();
const db = createClient(import.meta.env.VITE_SUPABASE_URL || 'http://localhost', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'preview', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'lg3s-pregame-public' },
});
const rosterPath = '/data/lg3s/season1-active-roster-2026-11-14.json';
const postedPath = '/data/lg3s/pregame-lineups.json';
const syncedPath = 'https://raw.githubusercontent.com/bellyjelly9393-ux/ELITECHELMEDIA/lg3s-pregame-data/data/lg3s/pregame-lineups.json';
const fixtureFields = 'lg_game_id,game_night_date,scheduled_at,home_lg_team_id,away_lg_team_id,home_nation,away_nation';
const interval = 8500;
const time = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Toronto', weekday:'short', month:'short', day:'numeric' });
const puckDrop = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Toronto', hour:'numeric', minute:'2-digit', timeZoneName:'short' });
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const unique = (players: PregamePlayer[]) => [...new Map(players.map((p) => [p.id,p])).values()];
const noSide: PregameUnit = { players:[], basis:'roster' };

interface Matchup {
  fixture?: PregameGame;
  opponentId: number;
  opponent: string;
  gb: PregameUnit;
  away: PregameUnit;
}
interface Review {
  games: Matchup[];
  stats: Map<string, SeasonStats>;
}
interface RosterFile {
  teams: { lgTeamId: number | string; players: { lgUserId: unknown; gamertag: unknown; position: unknown; jerseyNumber?: unknown; rosterStatus: string }[] }[];
}
interface PostedFile {
  schema: string;
  games: { lg_game_id: number; teams: Record<string, { lg_user_id: unknown; gamertag: unknown; position: unknown; jersey_number?: unknown }[]> }[];
}

$('pregame').innerHTML = `
<div class="world">
  <header class="world-header">
    <div><p class="world-kicker">EliteChel Media / LG3s Pregame</p><h1>Great Britain <em id="opponent"></em></h1></div>
    <div class="kickoff"><span id="game-day"></span><span id="game-time"></span><small id="queue"></small></div>
  </header>
  <div class="world-board">
    <section class="world-rink" aria-label="3D tactical rink">
      <iframe id="world-rink" title="LG3s pregame tactical rink"></iframe>
      <p class="rink-label" id="rink-label">Loading matchup…</p>
    </section>
    <section class="world-players" id="world-players" aria-label="Featured players"></section>
  </div>
  <footer class="world-footer">
    <span>LG3s season stats · LeagueGaming</span>
    <div class="world-controls" aria-label="Pregame playback">
      <button id="previous" type="button">Previous</button><button id="pause" type="button" aria-pressed="false">Pause</button><button id="next" type="button">Next</button>
    </div>
    <a id="fixture-link" href="/lg3s-media.html" target="_blank" rel="noopener">Schedule and game sheets ↗</a>
  </footer>
</div>`;
const rink = $<HTMLIFrameElement>('world-rink');
let review: Review | null = null;
let current = 0;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches || onAir;
let rinkReady = false;
let latestBoard: ReturnType<typeof makeBoard> = { markers:[], highlighted:[] };
let latestCamera: CameraAngle = 'ice';
function sendBoard() {
  if (companionOrigin) {
    const box = rink.parentElement!.getBoundingClientRect();
    window.parent.postMessage({
      protocol:'icevision:pregame:1', type:'board', board:latestBoard, camera:latestCamera,
      viewport:{ x:box.x, y:box.y, width:box.width, height:box.height },
    },companionOrigin);
    return;
  }
  if (rinkReady) rink.contentWindow?.postMessage({
    protocol:'lg3s:1', type:'state', payload:{ ...demoMatch, camera_angle:latestCamera, pregame:latestBoard },
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
if (companionOrigin) new ResizeObserver(sendBoard).observe(document.querySelector('.world')!);
rink.src = import.meta.env.BASE_URL + 'rink-preview.html?embed=true&mode=obs&pregame=1';

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
function postedUnit(source: PostedFile | undefined, fixture: PregameGame, teamId: number): PregameUnit | undefined {
  if (source?.schema !== 'lg3s-pregame-lineups-v1') return;
  const rows = source.games.find((game) => Number(game.lg_game_id) === fixture.lg_game_id)?.teams[String(teamId)];
  if (!rows) return;
  const players = unique(rows.flatMap((p) => makePlayer(p.lg_user_id,p.gamertag,p.position,p.jersey_number) ?? []));
  return players.length ? { players, basis:'posted', sourceGame:fixture.lg_game_id } : noSide;
}
function opponentFor(fixture: PregameGame) {
  return fixture.home_lg_team_id === greatBritain ? {
    id:fixture.away_lg_team_id, name:fixture.away_nation,
  } : { id:fixture.home_lg_team_id, name:fixture.home_nation };
}
async function loadReview(): Promise<Review> {
  const signal = AbortSignal.timeout(12000);
  const now = new Date();
  const [schedule, roster, posted, synced] = await Promise.allSettled([
    db.from('lg3s_public_games').select(fixtureFields).eq('status','scheduled').eq('season',1)
      .or('home_lg_team_id.eq.1446,away_lg_team_id.eq.1446').gte('scheduled_at',now.toISOString())
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
    const unit = (team: number) => postedUnit(synced.status === 'fulfilled' ? synced.value : undefined,fixture,team)
      ?? postedUnit(posted.status === 'fulfilled' ? posted.value : undefined,fixture,team)
      ?? { players:rosters.get(team) ?? [], basis:'roster' as const };
    return { fixture, opponentId:opponent.id, opponent:opponent.name, gb:unit(greatBritain), away:unit(opponent.id) };
  });
  if (!matches.length) matches.push({ opponentId:0, opponent:'', gb:{ players:rosters.get(greatBritain) ?? [], basis:'roster' }, away:noSide });

  const all = unique(matches.flatMap((m) => [...m.gb.players,...m.away.players]));
  const stats = new Map<string, SeasonStats>();
  await Promise.all((['skater','goalie'] as const).map(async (kind) => {
    const ids = all.filter((p) => (p.slot === 'G') === (kind === 'goalie')).map((p) => p.id);
    if (!ids.length) return;
    const fields = kind === 'goalie' ? 'lg_user_id,gp,sv_pct,sv,sa' : 'lg_user_id,gp,g,a,p,plus_minus';
    const result = await db.from(`lg3s_public_${kind}_leaders`).select(fields).in('lg_user_id',ids).abortSignal(signal);
    if (result.error) {
      for (const id of ids) {
        const record = review?.stats.get(`${kind}:${id}`);
        if (record) stats.set(`${kind}:${id}`,record);
      }
      return;
    }
    for (const row of (result.data ?? []) as unknown as SeasonStats[]) stats.set(`${kind}:${row.lg_user_id}`,row);
  }));
  return { games:matches,stats };
}

function formatStat(value: unknown) { return value === null || value === undefined ? '—' : String(value); }
function playerCard(player: PregamePlayer | undefined, unit: PregameUnit, teamId: number, team: string, gb: boolean) {
  const badge = teamId ? `<img class="team-crest" src="/assets/lg3s/team${teamId}.svg" alt="">` : '';
  const proof = unit.basis === 'posted' ? 'Posted lineup' : 'Roster spotlight · lineup pending';
  if (!player) return `<article class="player" data-gb="${gb}">${badge}<div class="player-content"><p class="player-meta">${esc(team)}</p><h2 class="player-title">${unit.basis==='posted'?'Slot not posted':'Lineup pending'}</h2></div></article>`;
  const kind = player.slot === 'G' ? 'goalie' : 'skater';
  const stat = review?.stats.get(`${kind}:${player.id}`);
  const sv = stat?.sv_pct == null ? null : `${(Number(stat.sv_pct) * 100).toFixed(1)}%`;
  const fields = kind === 'goalie'
    ? [['GP',stat?.gp],['SV%',sv],['SAVES',stat?.sv],['SA',stat?.sa]]
    : [['GP',stat?.gp],['G',stat?.g],['A',stat?.a],['PTS',stat?.p],['+/−',stat?.plus_minus]];
  const href = `/player-cards.html?league=lg3s&id=${player.id}&kind=${kind}`;
  const jerseyArt = gb ? '/assets/lg3s/scene/gb-kit.webp' : `/assets/lg3s/jerseys/${teamId}.webp`;
  return `<article class="player card-motion" data-gb="${gb}">
    <div class="card-art">
      ${badge}<img class="card-jersey" src="${jerseyArt}" alt="">
      ${player.jersey ? `<b class="card-number">#${esc(player.jersey)}</b>` : ''}
    </div>
    <div class="player-content">
      <p class="player-meta">${esc(team)} <span>${esc(player.position)}</span></p>
      <h2 class="player-title"><a href="${href}" target="_blank" rel="noopener">${esc(player.name)}</a></h2>
      <p class="player-source">${proof}</p>
      <dl class="stats">${fields.map(([label,value]) => `<div><dt>${label}</dt><dd>${esc(formatStat(value))}</dd></div>`).join('')}</dl>
    </div></article>`;
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
  $('opponent').textContent = game.opponent ? `vs ${game.opponent}` : '';
  $('game-day').textContent = fixture ? time.format(new Date(fixture.scheduled_at)) : '';
  $('game-time').textContent = fixture ? puckDrop.format(new Date(fixture.scheduled_at)) : 'Roster spotlight';
  $('queue').textContent = fixture && review ? `Game ${review.games.indexOf(game)+1} of ${review.games.length}` : '';
  $<HTMLAnchorElement>('fixture-link').href = fixture ? `/lg3s-media.html#game/${fixture.lg_game_id}` : '/lg3s-media.html#nation/1446';
  $('world-players').innerHTML = playerCard(a,game.gb,greatBritain,'Great Britain',true)
    + playerCard(b,game.away,game.opponentId,game.opponent || 'Opponent',false);
  enableCardTilt();
  const view: Record<string,CameraAngle> = { O:'ice', C:'orbit', D:'overhead', G:'goalie' };
  latestCamera = playing ? view[slot] : 'ice';
  latestBoard = makeBoard(game.gb,game.away,[a,b]);
  $('rink-label').textContent = ({O:'Wing',C:'Center',D:'Defense',G:'Goaltending'})[slot] + ' matchup';
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
