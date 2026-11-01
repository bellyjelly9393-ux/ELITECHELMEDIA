const {test}=require('node:test');
const assert=require('node:assert/strict');
const {prepareNight}=require('./lib/vod-lineup-preflight.cjs');
const options={league:'LGCHL',season:55};
const saved=require('./lgchl-drops/lineups/2026-10-27/hitmen-lineups-2026-10-27.json');
test('saved parser file prepares both teams for all three games without inventing participation',()=>{
 const result=prepareNight(saved,options);
 assert.equal(result.games.length,3);assert.equal(result.games.flatMap(g=>g.teams).length,6);
 assert.ok(result.nightly_players.length>12);
 assert.ok(result.games.every(g=>g.teams.every(t=>t.players.every(p=>!p.scouting_eligible&&p.participation_status==='candidate_only'))));
 assert.equal(result.ready_for_scouting,false);
 assert.ok(result.issues.some(x=>Object.values(x.position_counts||{}).some(n=>n>1)));
});
test('nightly canonical list consolidates the same account across games without grouping similar names',()=>{
 const result=prepareNight(saved,options);
 const setty=result.nightly_players.filter(p=>p.lg_user_id==='73707');
 assert.equal(setty.length,1);assert.ok(setty[0].appearances.length>1);
 assert.equal(new Set(result.nightly_players.map(p=>p.canonical_key)).size,result.nightly_players.length);
});
test('missing, unsafe and repeated IDs remain unresolved',()=>{
 const changed=structuredClone(saved),rows=changed.games[0].away.skaters;
 rows[0].lg_user_id=null;rows[1].lg_user_id=Number.MAX_SAFE_INTEGER+1;rows[2].lg_user_id=rows[3].lg_user_id;
 const result=prepareNight(changed,options),players=result.games[0].teams[0].players;
 assert.equal(players[0].reason,'missing_or_unsafe_lg_id');assert.equal(players[1].reason,'missing_or_unsafe_lg_id');
 assert.equal(players[2].reason,'duplicate_lg_id_in_game');assert.equal(players[3].reason,'duplicate_lg_id_in_game');
});
test('requires explicit scope, rejects duplicate games and does not accept names-only posted lineups',()=>{
 assert.throws(()=>prepareNight(saved),/Explicit league and season/);
 const changed=structuredClone(saved);changed.games.push(changed.games[0]);
 assert.throws(()=>prepareNight(changed,options),/duplicate LG game ID/);
 assert.throws(()=>prepareNight(require('./data/hitmen/season-55-week-3-posted-lineups.json'),options),/Unsupported parser file/);
});
test('rejects unrelated league games instead of expanding collection',()=>{
 const changed=structuredClone(saved);changed.games[0].away.team='Unrelated club';changed.games[0].home.team='Another unrelated club';
 assert.throws(()=>prepareNight(changed,options),/Only Hitmen games/);
});
