const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const shell=readFileSync(join(__dirname,'../lg3s-japan-shell.js'),'utf8');
const snapshot=JSON.parse(readFileSync(join(__dirname,'../data/lg3s/season1-active-roster-2026-11-14.json'),'utf8'));
const STORE='ecm:lg3s:s1:japan:custom:v1:';

function makeHarness(storage=new Map()){
 const elements=new Map(),events=[];
 const element=id=>{
  if(!elements.has(id)){
   const handlers={};
   elements.set(id,{
    textContent:'',innerHTML:'',value:'',disabled:false,href:'',
    addEventListener(type,listener){handlers[type]=listener},
    fire(type,value){
     if(value!==undefined)this.value=value;
     const cb=handlers[type];if(!cb)throw Error('No '+type+' handler for '+id);
     cb({preventDefault(){},target:this});
    }
   });
  }
  return elements.get(id);
 };
 const site={
  localStorage:{
   getItem:k=>storage.has(k)?storage.get(k):null,
   setItem:(k,v)=>storage.set(k,v),
   removeItem:k=>storage.delete(k)
  },
  dispatchEvent:e=>events.push(e)
 };
 const location={href:'https://example.test/lg3s-japan-locker.html',search:''};
 const history={replaceState(){}};
 const fetch=async()=>({ok:true,json:async()=>snapshot});
 const CustomEvent=function(type,options){this.type=type;this.detail=options.detail};
 new Function('window','document','location','history','fetch','CustomEvent','setTimeout','console',shell)(
  site,{getElementById:element},location,history,fetch,CustomEvent,()=>0,{warn(){}}
 );
 return{site,storage,element,events,ready:site.ECMJapanLocker.ready};
}

test('Name and 00 number save to browser for selected player without changing their verified LG identity',async()=>{
 const h=makeHarness();await h.ready;
 const player=h.site.ECMJapanLocker.players[0];
 h.site.ECMJapanLocker.selectPlayer(player.id);
 h.element('plateDisplayName').value='Tokyo Sniper';
 h.element('jerseyPreviewNumber').value='00';
 h.element('freeCustomizeForm').fire('submit');
 const saved=JSON.parse(h.storage.get(STORE+player.id));
 assert.deepEqual(saved,{name:'Tokyo Sniper',number:'00'});
 assert.equal(h.site.ECMJapanLocker.selected.gamertag,player.gamertag);
 assert.equal(h.element('selectedPlayer').textContent,player.gamertag);
 assert.equal(h.element('playerCardLink').href,'player-cards.html?league=lg3s&id='+player.id+'&kind=skater');
 assert.equal(h.events.at(-1).type,'ecm-japan-customization-change');
 assert.equal(h.events.at(-1).detail.playerId,player.id);
});

test('Customizations remain isolated by player and survive page reload on the same browser',async()=>{
 const store=new Map();const first=makeHarness(store);await first.ready;
 const a=first.site.ECMJapanLocker.players[0],b=first.site.ECMJapanLocker.players[1];
 first.site.ECMJapanLocker.selectPlayer(a.id);
 first.element('plateDisplayName').value='AKIRA';
 first.element('jerseyPreviewNumber').value='9';
 first.element('freeCustomizeForm').fire('submit');
 first.site.ECMJapanLocker.selectPlayer(b.id);
 assert.equal(first.element('plateDisplayName').value,b.gamertag.slice(0,18));
 assert.equal(first.element('jerseyPreviewNumber').value,'');
 const second=makeHarness(store);await second.ready;
 second.site.ECMJapanLocker.selectPlayer(a.id);
 assert.equal(second.element('plateDisplayName').value,'AKIRA');
 assert.equal(second.element('jerseyPreviewNumber').value,'9');
});

test('Reset deletes only this local appearance and restores the original player nameplate',async()=>{
 const h=makeHarness();await h.ready;
 const player=h.site.ECMJapanLocker.players[0];
 h.site.ECMJapanLocker.selectPlayer(player.id);
 h.element('plateDisplayName').value='RISING SUN';
 h.element('jerseyPreviewNumber').value='99';
 h.element('freeCustomizeForm').fire('submit');
 h.element('resetFreeCustomization').fire('click');
 assert.equal(h.storage.has(STORE+player.id),false);
 assert.equal(h.element('plateDisplayName').value,player.gamertag.slice(0,18));
 assert.equal(h.element('jerseyPreviewNumber').value,'');
 assert.equal(h.events.at(-1).detail.customize.number,'');
});

test('Reject blank name and invalid numbers before writing preferences',async()=>{
 const h=makeHarness();await h.ready;
 const player=h.site.ECMJapanLocker.players[0];
 h.site.ECMJapanLocker.selectPlayer(player.id);
 h.element('plateDisplayName').value='';
 h.element('jerseyPreviewNumber').value='21';
 h.element('freeCustomizeForm').fire('submit');
 assert.equal(h.storage.has(STORE+player.id),false);
 h.element('plateDisplayName').value='NIPPON';
 h.element('jerseyPreviewNumber').value='999';
 h.element('freeCustomizeForm').fire('submit');
 assert.equal(h.storage.has(STORE+player.id),false);
 assert.match(h.element('numberPreviewStatus').textContent,/0 to 99/);
});

test('Selected player changes do not forge new canonical roster IDs or card destinations',async()=>{
 const h=makeHarness();await h.ready;
 const first=h.site.ECMJapanLocker.players[0];
 h.site.ECMJapanLocker.selectPlayer(first.id);
 h.site.ECMJapanLocker.selectPlayer(9999999);
 assert.equal(h.site.ECMJapanLocker.selected.id,first.id);
 assert.match(h.element('selectedId').textContent,/original gamertag/);
});
