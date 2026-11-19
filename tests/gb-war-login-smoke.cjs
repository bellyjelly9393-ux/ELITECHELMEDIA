const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const js = fs.readFileSync('lg3s-gb-war-room.js','utf8');
const html = fs.readFileSync('lg3s-gb-war-room.html','utf8');
const originalIds = ['homeMatches','nextOpponent','nextDetails'];
for (const id of originalIds) assert(!html.includes('id="'+id+'"'), 'Mock must reflect removed dashboard element: '+id);

function createHarness({member=true,failData=false}={}) {
  const elements = new Map();
  function makeElement(id){
    const el={id,hidden:false,innerHTML:'',textContent:'',value:'',children:[],
      dataset:{},classList:{add(){},remove(){},toggle(){}},
      style:{}, addEventListener(){}, querySelectorAll(){return[]},
      querySelector(){return null},reset(){},focus(){}};
    const list=[{disabled:false},{disabled:false},{disabled:false}];
    for (const key of ['F1','F2','D','G']) list[key]={value:''};
    el.elements=list;
    return el;
  }
  function getElementById(id) {
    if(originalIds.includes(id)) return null;
    if(!elements.has(id)) elements.set(id,makeElement(id));
    return elements.get(id);
  }
  const queries={
    lg3s_gb_stalls:[],lg3s_gb_stall_profiles:[],
    lg3s_public_games:[],lg3s_public_player_lines:[],
    lg3s_gb_scouting:[],lg3s_gb_battle_plans:[],
    lg3s_gb_vod_refs:[]
  };
  const id='9c6f974d-ed28-4471-951f-a38ebc733895';
  const db={
    auth:{getUser:async()=>({data:{user:{id,user_metadata:{name:'bellyjelly9393'}}},error:null})},
    from(table){
      const api={
        select(){if(failData&&table==='lg3s_gb_stalls')throw new Error('simulated optional stats fetch failure');return api},
        eq(){return api},or(){return api},order(){return api},limit(){return api},
        maybeSingle:async()=>({data:member?{role:'owner',active:true,lg_user_id:null}:null,error:null}),
        then(resolve,reject){return Promise.resolve({data:queries[table]||[],error:null}).then(resolve,reject)}
      };
      return api;
    }
  };
  let boot;
  const document={getElementById,querySelectorAll(){return[]},addEventListener(){},querySelector(){return makeElement('sidebar')}};
  const window={VVHLBackend:{db},addEventListener(){},scrollTo(){}};
  const context={window,document,location:{reload(){}},console,Intl,Date,Number,String,Array,Set,Map,URL,
    setTimeout(fn){boot=fn},clearTimeout(){},FormData:class{},escape(){},Promise};
  vm.runInNewContext(js,context,{filename:'lg3s-gb-war-room.js'});
  return {boot,getElementById};
}
async function runTest(opts,expectedGate,expectedError){
  const harness=createHarness(opts);
  assert.equal(typeof harness.boot,'function','Application must boot');
  await harness.boot();
  const app=harness.getElementById('privateApp');
  const login=harness.getElementById('authShell');
  assert.equal(app.hidden,expectedGate!=='member');
  assert.equal(login.hidden,expectedGate==='member');
  if(expectedError) assert.match(harness.getElementById('messages').textContent,/signed in/i);
}
(async()=>{
 await runTest({member:true},'member',false);
 await runTest({member:true,failData:true},'member',true);
 await runTest({member:false},'guest',false);
 console.log('PASS: owner stays in room with removed homepage widgets and optional data failures; unapproved login remains gated');
})().catch(e=>{console.error(e);process.exitCode=1});
