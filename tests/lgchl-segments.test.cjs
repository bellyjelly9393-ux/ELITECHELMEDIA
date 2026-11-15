const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const C=require('../lgchl-segments-core.js');
const root=join(__dirname,'..');
const snapshot=JSON.parse(readFileSync(join(root,'assets/lgchl/playoffs/s55.json'),'utf8'));
function synthetic(score=[2,3],winner=null){
 const slot={id:110,kind:'series',title:'Round One',label:'R1',best_of:7,wins_needed:4,score,
  sides:[{team_id:1,seed:2},{team_id:2,seed:5}],games:[],clinched:!!winner,winner_id:winner,url:null};
 return{ok:true,teams:{1:{id:1,name:'Alpha Club',league:'OHL',nick:'Alpha'},2:{id:2,name:'Beta Club',league:'OHL',nick:'Beta'}},
 leagues:[{name:'OHL',conferences:[{name:'Eastern',rounds:[{label:'R1',slots:[slot]}]}],final:null}],
 championship:{semi:null,final:null},matchups:{110:{entries:[{team_id:1},{team_id:2}],games:[]}}};
}
test('Current real bracket retains canonical team IDs and distinct confirmed series IDs',()=>{
 assert.ok(Object.keys(snapshot.teams).length>10);
 const s=C.allSeries(snapshot);
 assert.ok(s.length>=10);
 assert.equal(new Set(s.map(x=>x.id)).size,s.length);
 for(const slot of s)assert.equal(C.slotTeams(slot).length,2);
});
test('No invented playoff momentum before the first verified final',()=>{
 const s=synthetic([0,0]);
 assert.equal(C.pressure(s,1).label,'AWAITING FIRST PUCK');
 assert.equal(C.teamState(s,1).status,'ALIVE');
 assert.equal(C.finalGames(C.allSeries(s)[0]).length,0);
});
test('Exactly one series loss from elimination is ON THE BRINK',()=>{
 const s=synthetic([2,3]);
 assert.equal(C.teamState(s,1).status,'ON THE BRINK');
 assert.equal(C.pressure(s,1).label,'ON THE BRINK');
 assert.equal(C.pressure(s,2).label!=='ON THE BRINK',true);
});
test('A confirmed series winner eliminates only the actual losing team',()=>{
 const s=synthetic([2,4],2);
 assert.equal(C.teamState(s,1).status,'ELIMINATED');
 assert.equal(C.pressure(s,1).active,false);
 assert.equal(C.teamState(s,2).status,'ADVANCING');
 assert.equal(C.allSeries(s)[0].winner_id,2);
});
test('No elimination from an inconsistent or unconfirmed clinch signal',()=>{
 let s=synthetic([2,3],2);
 assert.equal(C.teamState(s,1).status,'ON THE BRINK');
 s=synthetic([2,4],null);
 assert.equal(C.teamState(s,1).status,'PENDING REVIEW');
 assert.equal(C.pressure(s,1).label,'AWAITING VERIFIED SCORE');
});
test('Confirmed byes count as advancement, not guessed wins',()=>{
 const s=synthetic([0,0]);
 s.leagues[0].conferences[0].rounds[0].slots[0]={kind:'bye',id:111,label:'R1',sides:[{team_id:1}],clinched:true,winner_id:1,games:[]};
 assert.equal(C.teamState(s,1).status,'ADVANCING');
 assert.equal(C.journey(s,1)[0].state,'BYE');
 assert.equal(C.journey(s,1)[1].state,'PENDING');
});
test('A championship only appears after confirmed final clinch',()=>{
 const s=synthetic([4,2],1);
 s.championship.final={kind:'series',id:999,label:'F',sides:[{team_id:1},{team_id:2}],best_of:7,wins_needed:4,score:[4,2],winner_id:1,clinched:true,games:[]};
 assert.equal(C.teamState(s,1).status,'CHAMPION');
 assert.equal(C.teamState(s,2).status,'ELIMINATED');
});
test('Scheduled or partial results do not become completed games',()=>{
 const slot=C.allSeries(synthetic())[0];
 slot.games=[{id:1,status:'scheduled',away:1,home:2,away_score:2,home_score:0},
  {id:2,status:'final',away:1,home:2,away_score:null,home_score:1},
  {id:3,status:'final',away:1,home:2,away_score:3,home_score:2},
  {id:3,status:'final',away:1,home:2,away_score:3,home_score:2}];
 assert.deepEqual(C.finalGames(slot).map(g=>g.id),[3]);
});
test('Editorial cannot conceal an objectively confirmed elimination-danger designation',()=>{
 const s=synthetic([0,3]);
 assert.equal(C.pressure(s,1,{published:true,label:'BUILT DIFFERENT',reason:'Outstanding work'}).label,'ON THE BRINK');
});
test('Every team journey uses official league-specific rounds and keeps future opponents pending',()=>{
 const whl=Object.values(snapshot.teams).find(t=>t.league==='WHL');
 const qmjhl=Object.values(snapshot.teams).find(t=>t.league==='QMJHL');
 assert.equal(C.journey(snapshot,whl.id).length,6);
 assert.equal(C.journey(snapshot,qmjhl.id).length,5);
 assert.ok(C.journey(snapshot,whl.id).some(x=>x.state==='PENDING'));
});
test('Homepage, Predictor, bracket, management and existing scoring scripts remain intact',()=>{
 const h=readFileSync(join(root,'index.html'),'utf8');
 const nav=h.match(/<header class="nav">[\s\S]*?<\/header>/)?.[0]||'';
 for(const t of ['id="predictor"','id="bracket"','id="scores"','s55-home.js','lgchl-segments-home.js','rivalry-report.html','pressure-cooker.html','road-to-cup.html'])assert.ok(h.includes(t),'Missing '+t);
 assert.ok(h.includes('href="management.html">Management</a>'));
 assert.ok(!nav.includes('management.html'));
 for(const page of ['pressure-cooker.html','rivalry-report.html','road-to-cup.html'])
  assert.ok(readFileSync(join(root,page),'utf8').includes('lgchl-segments-core.js'));
});
test('Editorial and polling migration is staged and locked to explicit staff assignments',()=>{
 const sql=readFileSync(join(root,'supabase/migrations/20261115190000_ecm_s55_segments_editorial_polls.sql'),'utf8');
 assert.match(sql,/ecm_s55_segment_editors/);
 assert.match(sql,/one signed-in fan vote/i.test(sql)?/one signed-in fan vote/i:/primary key\(poll_id,voter_id\)/);
 assert.match(sql,/primary key\(poll_id,voter_id\)/);
 assert.match(sql,/voter_id=\(select auth.uid\(\)\)/);
 assert.match(sql,/using\(published=true and season=55\)/);
 assert.match(sql,/editor_permission_required/);
});
