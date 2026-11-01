const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const script=fs.readFileSync(__dirname+'/lib/lg-platform-capture-dom.js','utf8');
const base='https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&leagueid=39&seasonid=55&';
function parse(html,page){const dom=new JSDOM(html,{url:base+page,runScripts:'outside-only'});try{return JSON.parse(JSON.stringify(dom.window.eval(script)));}finally{dom.window.close();}}
test('reads only explicit console labels in Career Info, ignoring unrelated header details',()=>{
 const d=parse('<dl>Xbox GamerTag: Wrong Header</dl><h3>Career Info</h3><dl><dt>Xbox GamerTag:</dt><dd>l Setty l</dd></dl><dl><dt>Discord:</dt><dd>Unrelated</dd></dl><h3>Weekly Report</h3><dl>PSN ID: Wrong Footer</dl>','page=team_user&userid=73707&token=secret');
 assert.equal(d.lg_user_id,'73707');assert.deepEqual(d.accounts,[{platform:'xbox',account_gamertag:'l Setty l',evidence:'Xbox GamerTag: l Setty l'}]);assert.ok(!JSON.stringify(d).includes('secret'));
 assert.ok(d.source_url.includes('?leaguegaming/league&'),'Preserves LG routing while stripping unrelated parameters');
});
test('missing account stays empty and PS labels preserve their own namespace',()=>{
 assert.deepEqual(parse('<h3>Career Info</h3><dl>Xbox GamerTag: N/A</dl><h3>Weekly Report</h3>','page=team_user&userid=1').accounts,[]);
 assert.equal(parse('<h3>Career Info</h3><dl>PSN ID: ExactPS</dl><h3>Weekly Report</h3>','page=team_user&userid=1').accounts[0].platform,'playstation');
});
test('roster extracts exact LG IDs only within the roster section',()=>{
 const d=parse('<a href="?page=team_user&userid=99">Signed in user</a><h3>Roster</h3><a href="?page=team_user&userid=1">Kells</a><a href="?page=team_user&userid=2">Bad News Kells</a><h3>Schedule</h3><a href="?page=team_user&userid=3">Other</a>','page=team_page&teamid=412');
 assert.deepEqual(d.players.map(x=>x.lg_user_id),['1','2']);
});
test('schedule retains opponent IDs and stops at visible site verification',()=>{
 const d=parse('<table><tr><td><a href="?page=team_page&teamid=412">Calgary Hitmen</a></td><td><a href="?page=game&gameid=123">vs</a> Sun Nov 01 09:00pm</td><td><a href="?page=team_page&teamid=400">Opponent</a></td></tr></table>','page=team_page_schedule&teamid=412');
 assert.equal(d.games[0].lg_game_id,'123');assert.equal(d.games[0].teams[1].lg_team_id,'400');
 assert.equal(parse('<title>Just a moment...</title>','page=team_user&userid=1').blocked,true);
});
