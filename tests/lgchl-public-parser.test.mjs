import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePublicGame} from '../supabase/functions/lgchl-league-sync/public-box-score.mjs';
import {parseStandings,parseTeamSchedule,isChallenge} from '../supabase/functions/lgchl-league-sync/lib.ts';
const html=fs.readFileSync(new URL('./fixtures/lgchl/public-game.example.html',import.meta.url),'utf8');
const game=JSON.parse(fs.readFileSync(new URL('./fixtures/lgchl/public-game.example.json',import.meta.url)));
test('saved offline HTML extracts canonical identities, both teams and extended public stats',()=>{
 const p=parsePublicGame(html,game);assert.equal(p.players.length,12);
 const s=p.players.find(x=>x.lg_user_id===1001);
 assert.equal(s.gamertag,'Example & Skater');assert.equal(s.lg_team_id,413);assert.equal(s.points,3);
 assert.equal(s.toi_seconds,1200);assert.equal(s.twp_seconds,153);assert.equal(s.passing_pct,83.3);assert.equal(s.giveaways,5);
 assert.equal(p.players.find(x=>x.lg_user_id===1002).save_pct,.8);
 assert.equal(p.team_stats[413].possession_seconds,630);assert.equal(p.period_scoring.length,2);
 assert.ok(!JSON.stringify(p).includes('DO_NOT_PUBLISH'));
});
test('missing, contradictory and challenge pages never become published lines',()=>{
 assert.throws(()=>parsePublicGame('<h1>Just a moment</h1>',game),/challenge/);
 assert.throws(()=>parsePublicGame('<input type="password">',game),/Login/);
 assert.throws(()=>parsePublicGame(html,{...game,status:'scheduled'}),/official/);
 assert.throws(()=>parsePublicGame(html,{...game,away_score:9}),/reconcile/);
 assert.throws(()=>parsePublicGame(html.replaceAll('teamid=413','teamid=9999'),game),/team|teams/);
 assert.throws(()=>parsePublicGame('<table><tr><td>No box score yet</td></tr></table>',game),/identity|not found/);
 const withoutGoalies=html.replace(/<table><tr><th colspan="8">[\s\S]*?<\/table>/g,'');
 assert.throws(()=>parsePublicGame(withoutGoalies,game),/goalie/);
});
test('existing league parsers remain callable and detect challenge responses',()=>{
 assert.deepEqual(parseStandings('<html></html>'),[]);assert.deepEqual(parseTeamSchedule('<html></html>'),[]);
 assert.equal(isChallenge(403,'Just a moment',new Headers()),true);
});

test('partial sixes, missing stats/periods and wrong canonical games fail closed',()=>{
 assert.throws(()=>parsePublicGame(html.replace(/<link rel="canonical"[^>]*>/,''),game),/identity/);
 assert.throws(()=>parsePublicGame(html,{...game,lg_game_id:999998}),/identity mismatch/);
 assert.throws(()=>parsePublicGame(html.replace('seasonid=55','seasonid=54'),game),/season mismatch/);
 assert.throws(()=>parsePublicGame(html.replace('leagueid=39','leagueid=38'),game),/league mismatch/);
 const missingSkater=html.replace(/<tr><td><a href="[^"]*userid=1003"[\s\S]*?<\/tr>/,'');
 assert.throws(()=>parsePublicGame(missingSkater,game),/five skaters/);
 assert.throws(()=>parsePublicGame(html.replace(/<table>[\s\S]*?<\/table>/,''),game),/period/);
 assert.throws(()=>parsePublicGame(html.replace(/<tr><td>Puck Possession<\/td>[\s\S]*?<\/tr>/,''),game),/team statistics/);
 assert.throws(()=>parsePublicGame(html.replaceAll('<th>TwP</th>','<th>Unknown field</th>'),game),/required player statistics/);
 assert.throws(()=>parsePublicGame(html.replace('<td>1</td><td>1</td><td>1</td><td>3</td>','<td>1</td><td>1</td><td>2</td><td>3</td>'),game),/Period scoring/);
});
