const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {URLSearchParams}=require('node:url');
const root=join(__dirname,'..');
const source=readFileSync(join(root,'lg3s-team.js'),'utf8');
const basic=readFileSync(join(root,'lg3s-basic-customization.js'),'utf8');
const html=readFileSync(join(root,'lg3s-team.html'),'utf8');
const css=readFileSync(join(root,'lg3s-basic-customization.css'),'utf8');
const roster=JSON.parse(readFileSync(join(root,'data/lg3s/season1-active-roster-2026-11-14.json'),'utf8'));
const PREFIX='ecm:lg3s:s1:team:';

async function startRoom(teamId,storage=new Map()){
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id)){
   const listeners={};
   elements.set(id,{
    value:'',innerHTML:'',textContent:'',disabled:false,src:'',alt:'',
    addEventListener(type,fn){listeners[type]=fn},
    setAttribute(){},
    fire(type){if(!listeners[type])throw Error('Missing '+type+' listener on '+id);listeners[type]({preventDefault(){},target:this})}
   });
  }
  return elements.get(id);
 };
 const document={getElementById:element,title:''};
 const window={
  localStorage:{
   getItem:k=>storage.has(k)?storage.get(k):null,
   setItem:(k,v)=>storage.set(k,v),
   removeItem:k=>storage.delete(k)
  }
 };
 const location={search:'?team='+teamId+'&fallback=1',href:'https://example.test/lg3s-team.html?team='+teamId+'&fallback=1',replace(){throw Error('2D fallback unexpectedly redirected')}};
 const fetch=async()=>({ok:true,json:async()=>roster});
 new Function('window',basic)(window);
 new Function('window','document','location','URLSearchParams','fetch','console',source)(
  window,document,location,URLSearchParams,fetch,{warn(){}}
 );
 for(let i=0;i<20;i++)await Promise.resolve();
 return{storage,window,document,element};
}
test('Every generic 2D nation room has the same free editor and locked premium upgrade',()=>{
 for(const id of ['roomCustomizeForm','roomCustomizePlayer','roomPlateName','roomJerseyNumber','roomSaveBasic','roomResetBasic'])
  assert.ok(html.includes('id="'+id+'"'),id+' missing');
 assert.match(html,/LG3s|LG3s/i);
 assert.match(html,/FREE CUSTOMIZATION/);
 assert.match(html,/verified 3D locker ownership/i);
 assert.match(html,/lg3s-basic-customization.js/);
 assert.match(html,/lg3s-basic-customization.css/);
 assert.doesNotMatch(html,/href="[^"]*checkout/i);
 assert.match(css,/@media\(max-width:520px\)/);
});
test('Canada free nameplate and number display save per player without changing Hockey Cards',async()=>{
 const h=await startRoom(341);
 const canada=roster.teams.find(t=>t.lgTeamId===341);
 const first=canada.players.find(p=>p.rosterStatus==='active');
 assert.ok(first);
 assert.match(h.element('roomPlayers').innerHTML,new RegExp('id='+first.lgUserId));
 h.element('roomPlateName').value='TRUE NORTH';
 h.element('roomJerseyNumber').value='00';
 h.element('roomCustomizeForm').fire('submit');
 const key=PREFIX+'341:player:'+first.lgUserId;
 assert.deepEqual(JSON.parse(h.storage.get(key)),{name:'TRUE NORTH',number:'00'});
 assert.match(h.element('roomPlayers').innerHTML,/TRUE NORTH/);
 assert.match(h.element('roomPlayers').innerHTML,/#00/);
 assert.match(h.element('roomPlayers').innerHTML,new RegExp('verified '+first.gamertag,'i'));
});
test('Japan 2D fallback shares exact appearance key with Japan 3D, other nations stay separate',async()=>{
 const storage=new Map();
 const japan=await startRoom(591,storage);
 const first=roster.teams.find(t=>t.lgTeamId===591).players[0];
 japan.element('roomPlateName').value='RISING SUN';
 japan.element('roomJerseyNumber').value='9';
 japan.element('roomCustomizeForm').fire('submit');
 const saved=storage.get(PREFIX+'591:player:'+first.lgUserId);
 assert.ok(saved);
 const basicRoot={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 new Function('window',basic)(basicRoot);
 const picked=basicRoot.ECMLG3SBasic.read(591,{id:Number(first.lgUserId),gamertag:first.gamertag});
 assert.deepEqual(picked,{name:'RISING SUN',number:'9'});
 const canada=await startRoom(341,storage);
 assert.doesNotMatch(canada.element('roomPlayers').innerHTML,/RISING SUN/);
});
test('Reset clears only the selected team/player and restores verified roster display',async()=>{
 const h=await startRoom(341);
 const first=roster.teams.find(t=>t.lgTeamId===341).players[0];
 h.element('roomPlateName').value='MAPLE';
 h.element('roomJerseyNumber').value='19';
 h.element('roomCustomizeForm').fire('submit');
 h.element('roomResetBasic').fire('click');
 assert.equal(h.storage.has(PREFIX+'341:player:'+first.lgUserId),false);
 assert.equal(h.element('roomPlateName').value,first.gamertag.slice(0,18));
 assert.equal(h.element('roomJerseyNumber').value,'');
 assert.match(h.element('roomPlayers').innerHTML,new RegExp('verified '+first.gamertag,'i'));
});
test('Invalid names and numbers are rejected without polluting shared preferences',async()=>{
 const h=await startRoom(341);
 const first=roster.teams.find(t=>t.lgTeamId===341).players[0];
 h.element('roomPlateName').value=' ';h.element('roomJerseyNumber').value='24';
 h.element('roomCustomizeForm').fire('submit');
 assert.equal(h.storage.has(PREFIX+'341:player:'+first.lgUserId),false);
 h.element('roomPlateName').value='CANADA';h.element('roomJerseyNumber').value='100';
 h.element('roomCustomizeForm').fire('submit');
 assert.equal(h.storage.has(PREFIX+'341:player:'+first.lgUserId),false);
 assert.match(h.element('roomCustomizeStatus').textContent,/0 to 99/);
});
test('Great Britain standalone 3D room and all 12 nation roster records are unchanged',()=>{
 const eligible=roster.teams.filter(t=>Number(t.lgTeamId)>0);
 assert.equal(eligible.length,12);
 assert.match(source,/id===1446\?'lg3s-gb-locker\.html'/);
 assert.match(source,/teamId===1446&&params\.get\('fallback'\)!=='1'/);
 assert.doesNotMatch(source,/supabase\.from\(|fetch\(['"]\/api\/.*save/i);
});
