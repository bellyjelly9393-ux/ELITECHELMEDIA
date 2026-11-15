const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {aggregateTeams,verifiedPlayerRows,completedGame,nextSeries}=require('../playoff-stats.js');
const base={teams:{1:{id:1,name:'Alpha',league:'OHL'},2:{id:2,name:'Beta',league:'OHL'}},matchups:{100:{entries:[{team_id:1,seed:1},{team_id:2,seed:3}],games:[
 {id:401,away:1,home:2,away_score:3,home_score:2,status:'final'},
 {id:401,away:1,home:2,away_score:3,home_score:2,status:'final'},
 {id:402,away:2,home:1,away_score:null,home_score:null,status:'scheduled',at:'2099-11-16T02:00:00Z',url:'https://www.leaguegaming.com/forums/index.php?gameid=402'},
 {id:403,away:2,home:1,away_score:5,home_score:4,status:'final'}]}}};
test('Playoff team totals use only scored finals, no duplicates or scheduled games',()=>{
 const a=aggregateTeams(base);const alpha=a.find(t=>t.id===1),beta=a.find(t=>t.id===2);
 assert.deepEqual([alpha.gp,alpha.w,alpha.l,alpha.gf,alpha.ga,alpha.gd],[2,1,1,7,7,0]);
 assert.deepEqual([beta.gp,beta.w,beta.l,beta.gf,beta.ga,beta.gd],[2,1,1,7,7,0]);
 assert.equal(completedGame(base.matchups[100].games[2]),false);
});
test('Playoff player totals must be verified and sourced',()=>{
 const feed={skaters:[
  {lg_user_id:4,lg_team_id:1,gp:2,points:5,verified:false,source_url:'https://www.leaguegaming.com/forums/index.php?gameid=12'},
  {lg_user_id:5,lg_team_id:1,gp:2,points:4,verified:true,source_url:null},
  {lg_user_id:6,lg_team_id:1,gp:2,points:3,verified:true,source_checked_at:'2026-11-15T17:00:00Z',source_url:'https://www.leaguegaming.com/forums/index.php?gameid=12'}
 ],goalies:[]};
 assert.deepEqual(verifiedPlayerRows(feed,'skaters').map(p=>p.lg_user_id),[6]);
 assert.deepEqual(verifiedPlayerRows({skaters:[],goalies:[]},'goalies'),[]);
});
test('Upcoming matchup uses real scheduled dates and actual team IDs',()=>{
 const upcoming=nextSeries(base);assert.equal(upcoming.length,1);assert.equal(upcoming[0].sides[0].team.id,1);
});
test('Full ranking presentation retains same hockey card routes and separates seasons',()=>{
 const js=readFileSync(join(__dirname,'../league-leaderboards.js'),'utf8');
 const full=readFileSync(join(__dirname,'../league-leaderboard.html'),'utf8');
 const css=readFileSync(join(__dirname,'../league-broadcast.css'),'utf8');
 const power=readFileSync(join(__dirname,'../lgchl-power.js'),'utf8');
 assert.match(js,/player-cards\.html\?league=/);
 assert.match(js,/lb-broadcast-row/);
 assert.match(js,/wm_lgchl_s55_player_leaders/);
 assert.match(readFileSync(join(__dirname,'../playoff-stats.js'),'utf8'),/ecm_lgchl_s55_playoff_public_players/);
 assert.match(full,/league-broadcast\.css/);
 assert.match(full,/playoff-stats\.html/);
 assert.match(css,/--lb-crest/);
 assert.match(power,/tid===465&&num\(s\.l\)/);
 assert.match(power,/[Rr]eported 22-loss adjustment/);
});
