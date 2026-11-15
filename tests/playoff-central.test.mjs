import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bracket=JSON.parse(read('assets/lgchl/playoffs/s55.json'));
const js=read('playoff-central.js');
const sql=read('supabase/migrations/20261115000000_ecm_playoff_predictor_s55.sql');
const page=read('playoff-central.html');
const home=read('index.html');
const lg=read('lgchl-media.html');

test('browser bundle parses cleanly',()=>{assert.doesNotThrow(()=>new vm.Script(js));});
test('playoff scoreboard uses official bracket and never guesses live state from schedule',()=>{
 assert.match(js,/\/api\/lgchl-playoffs/);
 assert.match(js,/g\.status === 'live'/);
 assert.match(js,/label = 'Await'/);
 assert.match(js,/data\.stale/);
 assert.match(page,/id="pcScoreGrid"/);
});
test('snapshot contains twelve distinct first-round eligible series',()=>{
 const entries=bracket.leagues.flatMap(l=>l.conferences.flatMap(c=>c.rounds.filter(r=>r.label==='R1').flatMap(r=>r.slots.filter(s=>s.kind==='series'))));
 assert.equal(entries.length,12);
 assert.equal(new Set(entries.map(e=>e.id)).size,12);
 for(const s of entries){
   assert.ok(s.sides?.length===2);
   assert.ok(s.sides.every(t=>Number.isInteger(t.team_id)&&Number.isInteger(t.seed)));
   assert.ok(s.games?.[0]?.at);
 }
});
test('predictor schemas restrict reads and prohibit public direct pick writes',()=>{
 for(const name of ['ecm_playoff_series','ecm_playoff_handles','ecm_playoff_picks']){
   assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security','i'));
 }
 assert.match(sql,/grant select on public\.ecm_playoff_handles,public\.ecm_playoff_picks to authenticated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete|all) on public\.ecm_playoff_picks to (anon|authenticated)/i);
 assert.match(sql,/clock_timestamp\(\)/);
 assert.match(sql,/complete_round_required/);
 assert.match(sql,/is_open\)\s*values[\s\S]*false/);
});
test('leaderboard points derive only from verified winners and expose eligibility',()=>{
 assert.match(sql,/confirmed_winner_id/);
 assert.match(sql,/verified_at is not null/);
 assert.match(sql,/10\*count\(\*\) filter\(where correct\)/);
 assert.match(sql,/grand_prize_eligible boolean/);
 assert.match(page,/Grand Prize/);
});
test('navigation links to the new dashboard',()=>{
 assert.match(home,/href="playoff-central\.html"/);
 assert.match(lg,/href="playoff-central\.html"/);
 assert.match(page,/id="pcLeaders"/);
 assert.match(page,/id="pcBallot"/);
});


test('predictor series-length changes use the same ID key as saved and submitted picks',()=>{
 assert.match(js,/const seriesKey = \(id\) => String\(id\)/);
 assert.match(js,/state\.saved\.set\(seriesKey\(x\.series_id\),x\)/);
 assert.match(js,/state\.picks\.get\(seriesKey\(s\.id\)\)/);
 assert.match(js,/state\.saved\.get\(seriesKey\(s\.id\)\)/);
 assert.match(js,/state\.picks\.set\(s,\{\.\.\.current,games\}\)/);
 assert.match(js,/e\.target\.closest\('button\[data-series-length\]'\)/);
 assert.match(js,/button\.dataset\.games/);
 assert.match(js,/aria-pressed/);
 assert.doesNotMatch(js,/select\[data-series-length\]/);
 assert.match(js,/\[4,5,6,7\]\.map/);
 const hq=read('playoff-hq.html');
 assert.match(hq,/playoff-central\.js\?v=20261115-length-buttons-v2/);
 assert.match(page,/playoff-central\.js\?v=20261115-length-buttons-v2/);
 assert.match(hq,/playoff-central\.css\?v=20261115-length-buttons-v2/);
 assert.match(page,/playoff-central\.css\?v=20261115-length-buttons-v2/);
 const saved=new Map([['101',{winner_id:11,games:6}]]);
 const picks=new Map();
 for(const games of [4,5,6,7]){
   const fromDom='101';
   const previous=picks.get(fromDom)||saved.get(fromDom);
   picks.set(fromDom,{...previous,games});
   const rendered=picks.get(String(101))||saved.get(String(101));
   assert.equal(rendered.games,games);
   assert.equal(rendered.winner_id,11);
 }
});


test('clicking series-length buttons keeps the winner and submits the chosen game count',async()=>{
 const elements=new Map(),events=new Map();
 const defaults={pcPickRound:'1',pcScoreRound:'R1',pcLeaderRound:'ALL',pcHandle:'tester'};
 const el=id=>{
   if(!elements.has(id)) elements.set(id,{
     value:defaults[id]||'',innerHTML:'',textContent:'',disabled:false,
     addEventListener(type,handler){
       const key=id+':'+type;
       if(!events.has(key)) events.set(key,[]);
       events.get(key).push(handler);
     }
   });
   return elements.get(id);
 };
 const rows=[{
   id:101,round_no:1,league:'OHL',conference:'East',team_a:11,team_b:22,
   seed_a:1,seed_b:2,is_open:true,lock_at:'2099-11-15T22:00:00Z'
 }];
 let submitted=null;
 const db={
   from(name){
     return {
       select(){return this;},eq(){return this;},order(){return this;},
       maybeSingle(){return Promise.resolve({data:{handle:'tester'},error:null});},
       then(resolve,reject){
         return Promise.resolve({
           data:name==='ecm_playoff_series'?rows:[],error:null
         }).then(resolve,reject);
       }
     };
   },
   rpc(name,args){
     if(name==='ecm_predictor_submit_ballot') submitted=args;
     return Promise.resolve({data:[],error:null});
   }
 };
 const sandbox={
   document:{getElementById:el,querySelectorAll:()=>[],hidden:false},
   window:{VVHLBackend:{db,state:{user:{id:'test-user'},profile:{display_name:'tester'}}},addEventListener(){}},
   fetch:async()=>{throw new Error('Network disabled in test');},
   setInterval:()=>null,URL,Date,Intl,console,Promise,Number,String
 };
 vm.runInNewContext(js,sandbox);
 await new Promise(resolve=>setImmediate(resolve));
 const click=(selector,target)=>{
   const event={target:{closest:query=>query===selector?target:null}};
   for(const handler of events.get('pcBallot:click')||[]) handler(event);
 };
 click('button[data-winner]',{dataset:{series:'101',winner:'11'},disabled:false});
 assert.match(el('pcBallot').innerHTML,/data-games="4"/);
 assert.match(el('pcBallot').innerHTML,/data-games="7"/);
 const buttons=[];
 const group={querySelectorAll:()=>buttons};
 for(const games of [4,5,6,7]){
   const button={
     dataset:{seriesLength:'101',games:String(games)},disabled:false,pressed:'false',
     classList:{toggle(_class,_on){}},
     setAttribute(name,value){if(name==='aria-pressed')this.pressed=value;},
     closest(selector){return selector==='.pc-length-options'?group:null;}
   };
   buttons.push(button);
 }
 click('button[data-series-length]',buttons[0]);
 assert.equal(buttons[0].pressed,'true');
 click('button[data-series-length]',buttons[3]);
 assert.equal(buttons[3].pressed,'true');
 assert.equal(buttons[0].pressed,'false');
 const submit=events.get('pcSubmit:click')?.[0];
 assert.ok(submit,'submit handler registered');
 await submit();
 assert.equal(submitted?.p_round,1);
 assert.equal(submitted?.p_ballot?.length,1);
 assert.equal(submitted?.p_ballot?.[0]?.series_id,101);
 assert.equal(submitted?.p_ballot?.[0]?.winner_id,11);
 assert.equal(submitted?.p_ballot?.[0]?.games,7);
});
