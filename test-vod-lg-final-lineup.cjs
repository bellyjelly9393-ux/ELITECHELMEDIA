const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),{JSDOM}=require('jsdom');
const script=fs.readFileSync(__dirname+'/lib/lg-final-lineup-dom.js','utf8');
const url='https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=918200&leagueid=39&seasonid=55';
const row=(id,team,pos)=>`<tr><td><a href="?page=game_user_power_ranking_detail&userid=${id}&gameid=918200">50</a></td><td><img src="/images/team/p16/team${team}.png"><a href="?page=team_user&userid=${id}&leagueid=39&seasonid=55">Synthetic-${id}-</a> (${pos})</td></tr>`;
const bar=(id,name)=>`<tr><td class="team_bar team_bar${id}">${name}</td></tr>`;
function html(){return '<p>FINAL</p><table><tr><th>Player Stats</th><th>Offense</th></tr>'+bar(999,'Test Opponent')+['LW','C','RW','LD','RD'].map((p,i)=>row(i+1,999,p)).join('')+bar(412,'Calgary Hitmen')+['LW','C','RW','LD','RD'].map((p,i)=>row(i+7,412,p)).join('')+'</table><table><tr><th>Goalie Stats</th></tr>'+row(6,999,'G')+row(12,412,'G')+'</table>';}
function parse(body=html(),page=url){const dom=new JSDOM(body,{url:page,runScripts:'outside-only'});try{return JSON.parse(JSON.stringify(dom.window.eval(script)));}finally{dom.window.close();}}
test('final LG sheets preserve 12 exact IDs, punctuation and explicit goalie team logos',()=>{
 const r=parse();assert.equal(r.players.length,12);assert.equal(r.players[0].player,'Synthetic-1-');assert.equal(r.players.find(p=>p.lg_user_id==='12').team,'Calgary Hitmen');assert.equal(r.players.find(p=>p.lg_user_id==='12').position,'G');
});
test('game identity on each statistics row must match the requested game',()=>{assert.equal(parse(html().replace('gameid=918200','gameid=918201')).error,'game_row_identity_mismatch');});
test('duplicate LG IDs and incomplete teams remain unusable',()=>{
 assert.equal(parse(html().replaceAll('userid=12&','userid=6&')).error,'incomplete_or_ambiguous_game_roster');
 assert.equal(parse(html().replace(row(12,412,'G'),'')).error,'incomplete_or_ambiguous_game_roster');
});
test('team identity and final status must be explicit',()=>{
 assert.equal(parse(html().replace('/team999.png','/team412.png')).error,'missing_player_team_identity');
 assert.equal(parse(html().replace('FINAL','Scheduled')).error,'game_not_explicitly_final');
});
test('verification challenges and other league seasons are rejected',()=>{
 assert.equal(parse('<title>Just a moment</title>').blocked,true);
 assert.equal(parse(html(),url.replace('seasonid=55','seasonid=56')).error,'unexpected_game_scope');
});
