import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

const leagueOrigin = 'https://www.leaguegaming.com';
const gbr = 1446;
const leagueDay = new Intl.DateTimeFormat('sv-SE', { timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit' });
const positionCodes = new Set(['LW','RW','W','C','LD','RD','D','G']);
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const text = node => node?.textContent.replace(/\s+/g,' ').trim() ?? '';

export function parseLineupSheet(html, fixture) {
  const { document } = parseHTML(html);
  const ids = [...document.querySelectorAll('.lg_game_header_txt_header a[href*="page=team_page"]')]
    .map(link => Number(new URL(link.getAttribute('href'),leagueOrigin).searchParams.get('teamid')));
  const teams = [...new Set(ids)];
  const { lg_game_id, away_lg_team_id, home_lg_team_id } = fixture;
  if (teams.length !== 2 || teams[0] !== away_lg_team_id || teams[1] !== home_lg_team_id) {
    throw new Error(`LeagueGaming did not provide the expected game sheet for ${lg_game_id}`);
  }

  const lineups = [];
  let goalies = 0;
  for (const table of document.querySelectorAll('table')) {
    const rows = [...table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr')];
    const header = [...rows.shift()?.children ?? []].map(text).join(' ');
    const skaters = /^User ?\$M\b/i.test(header) && /\bGP\b.*\bPts\b/i.test(header);
    const goalieTable = /^Goalie ?\$M\b/i.test(header) && /\bGGP\b/i.test(header);
    if (!skaters && !goalieTable) continue;
    if (skaters) lineups.push([]);
    else goalies++;
    const lineup = lineups.at(-1);
    if (!lineup) throw new Error(`Unexpected lineup table order for ${lg_game_id}`);
    for (const row of rows) {
      const position = text(row.children[0]).toUpperCase();
      if (!positionCodes.has(position) || row.matches('.lgtempgame_sub,[hidden]') || /display\s*:\s*none/i.test(row.getAttribute('style') || '')) continue;
      const player = row.querySelector('a[href*="page=team_user"][href*="userid="],a[href*="members/"]');
      const profile = player && new URL(player.getAttribute('href'),leagueOrigin);
      const id = Number(profile?.searchParams.get('userid') ?? profile?.pathname.match(/members\/(?:[^/]*\.)?(\d+)\/?$/)?.[1]);
      const gamertag = text(player);
      if (!positiveId(id) || !gamertag || profile.origin !== leagueOrigin) {
        throw new Error(`Unverified player on LeagueGaming game ${lg_game_id}`);
      }
      const jersey = row.getAttribute('data-jersey-number');
      lineup.push({ lg_user_id:id, gamertag, position,...(/^\d{1,2}$/.test(jersey ?? '') ? { jersey_number:jersey } : {}) });
    }
  }
  if (lineups.length !== 2 || goalies !== 2) throw new Error(`Incomplete lineup tables for ${lg_game_id}`);
  return { lg_game_id, teams:Object.fromEntries(teams.map((team,index)=>[team,lineups[index]])) };
}

async function get(url, options) {
  const response = await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
  return response;
}

async function run() {
  const [output] = process.argv.slice(2);
  if (!output) throw new Error('Pass a path for the public lineup export');
  const backend = await readFile(new URL('../../backend.js',import.meta.url),'utf8');
  const database = /const VVHL_SUPABASE_URL = "([^"]+)"/.exec(backend)?.[1];
  const key = /const VVHL_SUPABASE_KEY = "([^"]+)"/.exec(backend)?.[1];
  if (!database || !key) throw new Error('Public fixture API configuration is missing');
  const night = leagueDay.format(new Date());
  const query = new URLSearchParams({ select:'lg_game_id,away_lg_team_id,home_lg_team_id', season:'eq.1',
    game_night_date:`eq.${night}`, status:'eq.scheduled', or:`(home_lg_team_id.eq.${gbr},away_lg_team_id.eq.${gbr})`, order:'scheduled_at.asc' });
  const fixtures = await (await get(`${database}/rest/v1/lg3s_public_games?${query}`,{headers:{apikey:key}})).json();
  if (!Array.isArray(fixtures) || fixtures.length > 10) throw new Error('Unexpected GBR game-night schedule');
  if (!fixtures.length) {
    console.log(`No scheduled GBR games for ${night} (Toronto time).`);
    return;
  }
  const games = [];
  for (const fixture of fixtures) {
    if (![fixture.lg_game_id,fixture.away_lg_team_id,fixture.home_lg_team_id].every(positiveId) ||
      ![fixture.away_lg_team_id,fixture.home_lg_team_id].includes(gbr) || fixture.away_lg_team_id === fixture.home_lg_team_id) {
      throw new Error('Invalid GBR fixture');
    }
    if (games.length) await delay(20000);
    const url = `${leagueOrigin}/forums/index.php?leaguegaming/league&action=league&page=game&gameid=${fixture.lg_game_id}`;
    const html = await (await get(url)).text();
    games.push(parseLineupSheet(html,fixture));
  }
  await writeFile(output,JSON.stringify({schema:'lg3s-pregame-lineups-v1',games}));
  console.log(`Verified ${games.length} public GBR game sheets for ${night} (Toronto time).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run().catch(error=>{ console.error(error.message);process.exitCode=1; });
}
