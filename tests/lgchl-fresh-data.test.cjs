const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
test('newer verified capture replaces stale leaderboard rows; a newer live feed wins',async()=>{
 const context={window:{},fetch:async p=>({ok:true,json:async()=>read(p)}),Date};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'lgchl-fresh-data.js'),'utf8'),context);
 const fresh=await context.window.LGCHLFresh.board('points',[{gamertag:'older',fetched_at:'2026-10-28T10:00:00Z'}]);assert(fresh.capture);assert.equal(fresh.rows[0].gamertag,'bilodxau');assert.equal(fresh.rows.find(x=>x.gamertag==='xKUUZ').points,68);
 const rows=[{gamertag:'newer',fetched_at:'2026-11-03T10:00:00Z'}];const newer=await context.window.LGCHLFresh.board('points',rows);assert.equal(newer.capture,null);assert.equal(newer.rows,rows);
 const unavailable=await context.window.LGCHLFresh.board('shots',rows);assert.equal(unavailable.rows,rows);
});
test('November 1 aggregates preserve source identity and never claim complete coverage',()=>{
 const capture=read('data/lgchl/night-current.json');assert.equal(capture.night,'2026-11-01');assert.equal(capture.complete,false);assert.equal(capture.games_included,78);assert.equal(capture.games_scheduled,93);
 for(const p of capture.players){assert.equal(p.gp,p.game_ids.length);assert.equal(new Set(p.game_ids).size,p.gp);assert(p.lg_user_id>0);if(p.player_kind==='skater')assert.equal(p.points,p.goals+p.assists);else assert.equal(p.saves+p.goals_against,p.shots_against);}
 const stars=capture.players.filter(p=>p.player_kind==='skater').sort((a,b)=>b.points-a.points||b.goals-a.goals);assert.equal(stars[0].gamertag,'Washko86');assert.equal(stars[0].points,15);
});
test('night and week cards select the actual newest captured leaders, with partial coverage visible',async()=>{
 const capture=read('data/lgchl/night-current.json'),elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',hidden:false,closest:()=>({querySelector:()=>element('note')})});return elements.get(id)};
 const escape=v=>String(v??'').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
 const context={window:{WMDesk:{$:element,esc:escape,read:async()=>[],ordinal:String,tint:()=>{},F:{day:new Intl.DateTimeFormat('en-US')}},LGCHLFresh:{night:async()=>capture}},console,Intl,Date};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'lgchl-media-segments.js'),'utf8'),context);
 await context.window.LGCHLSegments.renderNight(new Map());assert(element('lgNightPlayers').innerHTML.includes('Washko86'));assert(element('lgNightCoverage').textContent.includes('78 of 93'));assert(element('lgNightTitle').innerHTML.includes('standouts'));
 await context.window.LGCHLSegments.renderForm(new Map(),[{week:6,status:'final',game_at:'2026-11-02T02:00:00Z'}]);assert(element('lgWeekPlayers').innerHTML.includes('Washko86'));assert(element('lgWeekPlayersNote').textContent.includes('78/93'));assert(element('lgWeekPlayersNote').textContent.includes('Week 6'));
});
