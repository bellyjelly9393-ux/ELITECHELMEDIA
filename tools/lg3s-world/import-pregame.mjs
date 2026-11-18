import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const schema = 'lg3s-pregame-lineups-v1';
const positions = new Set(['LW','RW','W','C','LD','RD','D','G']);
const idOf = (value) => /^[1-9]\d{0,9}$/.test(String(value)) ? Number(value) : 0;

export function mergeExport(incoming, previous, allowedTeamIds) {
  if (![schema,'lgchl-pregame-lineups-v1'].includes(incoming?.schema) || !Array.isArray(incoming.games) || !incoming.games.length) {
    throw new Error('Expected a nonempty LG lineup export');
  }
  const games = new Map((previous?.games || []).map((game) => [game.lg_game_id,game]));
  for (const game of incoming.games) {
    const gameId = idOf(game.lg_game_id);
    if (!gameId) throw new Error('Missing LeagueGaming game ID');
    const sides = game.teams ?? Object.fromEntries([game.away,game.home].filter(Boolean).map((team) => [
      team.lg_team_id,[...team.skaters,...team.goalies],
    ]));
    if (!Object.keys(sides).length || Object.keys(sides).length > 2) throw new Error('Expected one or two teams per game');
    const teams = { ...games.get(gameId)?.teams };
    for (const [id, rows] of Object.entries(sides)) {
      if (!allowedTeamIds.has(idOf(id)) || !Array.isArray(rows) || rows.length > 16) throw new Error('Invalid LG3s team or lineup');
      const players = rows.map((row) => {
        const lg_user_id = idOf(row.lg_user_id);
        const position = String(row.position || '').toUpperCase();
        const gamertag = String(row.gamertag ?? row.player ?? '').trim();
        if (!lg_user_id || !positions.has(position) || !gamertag || gamertag.length > 80) throw new Error('Invalid lineup identity or position');
        return { lg_user_id,gamertag,position };
      });
      teams[id] = [...new Map(players.map((player)=>[player.lg_user_id,player])).values()];
    }
    games.set(gameId,{ lg_game_id:gameId,teams });
  }
  return { schema, games:[...games.values()].sort((a,b)=>a.lg_game_id-b.lg_game_id).slice(-150) };
}

async function run() {
  const [input,output='data/lg3s/pregame-lineups.json'] = process.argv.slice(2);
  const roster = JSON.parse(await readFile('data/lg3s/season1-active-roster-2026-11-14.json','utf8'));
  const allowed = new Set(roster.teams.map((team)=>idOf(team.lgTeamId)));
  let raw;
  if (input) raw = await readFile(input,'utf8');
  else {
    const url = process.env.LG3S_LINEUP_FEED_URL;
    if (!url) throw new Error('LG3S_LINEUP_FEED_URL is unset');
    if (new URL(url).protocol !== 'https:') throw new Error('The export feed must use HTTPS');
    const response = await fetch(url,{ redirect:'error',signal:AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Lineup export returned HTTP ${response.status}`);
    raw = await response.text();
  }
  if (raw.length > 2_000_000) throw new Error('Lineup export too large');
  const existing = await readFile(output,'utf8').catch((error)=> {
    if (error.code !== 'ENOENT') throw error;
    return '{"games":[]}';
  });
  const snapshot = mergeExport(JSON.parse(raw),JSON.parse(existing),allowed);
  await writeFile(output,JSON.stringify(snapshot,null,2)+'\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run().catch((error)=>{ console.error(error.name === 'TypeError' ? 'Unable to read the lineup export' : error.message); process.exitCode=1; });
}
