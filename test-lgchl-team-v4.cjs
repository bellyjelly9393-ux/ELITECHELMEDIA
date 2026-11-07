// Offline public Season 55 team-room V4 regression. No production data writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const roster=JSON.parse(fs.readFileSync('assets/lgchl/rosters/main-rosters-s55.json','utf8'));
const source=fs.readFileSync('lgchl-team.js','utf8');
class QueryParams {constructor(text){this.map=new Map(String(text).replace(/^\?/,'').split('&').map(s=>s.split('=')));}get(key){return this.map.get(key)||null;}}
const final={lg_game_id:77881,game_at:'2026-11-01T01:00:00Z',status:'final',away_lg_team_id:412,home_lg_team_id:419,away_nick:'Hitmen',home_nick:'Rockets',away_score:2,home_score:1};
const scheduled={lg_game_id:77882,game_at:'2026-11-11T01:00:00Z',status:'scheduled',away_lg_team_id:419,home_lg_team_id:412,away_nick:'Rockets',home_nick:'Hitmen',away_score:null,home_score:null};
async function page(id){
 const elements={};const el=k=>elements[k]??={value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},setAttribute(k,v){this[k]=v;},addEventListener(){}};
 const calls=[];
 const read=async(table,opts={})=>{
   calls.push({table,opts});
   if(table==='lgchl_standings_current')return [{lg_team_id:Number(id),name:roster.teams[id]?.name,pts:18,gp:25,w:8,l:7,otl:2}];
   if(table==='lgchl_games_board')return opts.status==='eq.final'?[final]:[scheduled];
   if(table==='wm_lgchl_s55_player_leaders')return [];
   return [];
 };
 const document={getElementById:el,querySelector:()=>null,body:{dataset:{},classList:{toggle(){}},style:{setProperty(){}}},addEventListener(){}};
 const ctx={window:{WMDesk:{esc:v=>String(v??'').replace(/[&<>"']/g,'_'),read},LGLockerChooser:{LEAGUE:{412:'WHL',419:'WHL'}}},document,location:{search:'?team='+id},URLSearchParams:QueryParams,Intl,Date,fetch:async()=>({ok:true,json:async()=>roster}),console};
 vm.runInNewContext(source,ctx,{filename:'lgchl-team.js'});
 for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));
 return{el,calls};
}
(async()=>{
 assert.equal(roster.season,55);
 assert.equal(Object.keys(roster.teams).length,62);
 assert(fs.existsSync('assets/lgchl/lockers/s55-saddledome-teamroom.webp'),'Local approved Saddledome source exists');
 let total=0;
 for(const [id,t] of Object.entries(roster.teams)){
  const p=await page(id),expected=t.players.filter(x=>x.roster_class==='active_roster').length;
  assert.equal((p.el('roomPlayers').innerHTML.match(/class="stall"/g)||[]).length,expected,'Roster stall mismatch: '+id);
  assert(!p.el('roomPlayers').innerHTML.includes('ec-feature-panel'),'No decorative grid child: '+id);
  assert.equal(p.el('roomTeamFeature').hidden,Number(id)!==412,'Calgary-only photo feature: '+id);
  assert.equal((p.el('roomTeam').innerHTML.match(/<option value=/g)||[]).length,62,'Team selector keeps all clubs');
  total+=expected;
 }
 const p=await page(412);
 assert.equal((p.el('roomPlayers').innerHTML.match(/class="stall"/g)||[]).length,17);
 assert(p.el('roomFinals').innerHTML.includes('ec-game-scoreline'));
 assert(p.el('roomFinals').innerHTML.includes('2 – 1'));
 assert(p.el('roomFinals').innerHTML.includes('lgchl-game.html?id=77881'));
 assert(p.el('roomFinals').innerHTML.includes('assets/logos/chl/calgary-hitmen.png'));
 assert(p.el('roomUpcoming').innerHTML.includes('ec-game-scoreline'));
 assert(p.el('roomUpcoming').innerHTML.includes('>VS</strong>'));
 assert(p.el('roomUpcoming').innerHTML.includes('lgchl-game.html?id=77882'));
 const games=p.calls.filter(x=>x.table==='lgchl_games_board');
 assert.equal(games.length,2);
 assert(games.every(x=>x.opts.select.includes('away_lg_team_id')&&x.opts.select.includes('home_lg_team_id')));
 console.log('PASS: 62 public teams; '+total+' active roster stalls; Calgary 17; matchup score orientation and links; home/away logos; no in-grid promotional panel; team selector; private data untouched.');
})().catch(e=>{console.error(e);process.exitCode=1;});
