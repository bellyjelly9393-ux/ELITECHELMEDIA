'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('lg3s-gb-panorama.html');
const css=read('lg3s-gb-panorama.css');
const js=read('lg3s-gb-panorama.js');
const oldPublic=read('lg3s-gb-locker.html');
const oldLoader=read('lg3s-gb-locker.js');
const fixture=JSON.parse(read('data/lg3s/season1-active-roster-2026-11-14.json'));
const gb=fixture.teams.find(t=>Number(t.lgTeamId)===1446);

test('original Great Britain public 3D locker remains independent and unchanged in shape',()=>{
 assert.match(oldPublic,/<title>Great Britain 3D Locker Room/);
 assert.match(oldPublic,/id="enterLocker"/);
 assert.match(oldPublic,/id="lockerFrame"/);
 assert.match(oldPublic,/lg3s-gb-locker-config\.js/);
 assert.doesNotMatch(oldPublic,/lg3s-gb-panorama\.js/);
 assert.doesNotMatch(oldPublic,/class="room-stage"/);
 assert.match(oldLoader,/const enterRoom=/);
});
test('Great Britain public panoramic page uses actual Calgary 360 viewer architecture',()=>{
 assert.match(html,/Great Britain \| 360/);
 for(const id of ['gbPanorama','gbpEntrance','gbpCentre','gbpSearch','gbpPlayers','gbpPrev','gbpNext','gbpStallModal','gbpRosterToggle','gbpModalCard'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/vendor\/pannellum\/pannellum\.js/);
 assert.match(html,/lg3s-gb-panorama\.js/);
 assert.match(html,/lg3s-gb-locker\.html/);
 assert.match(css,/\.gbp-hotspot/);
 assert.match(js,/pannellum\.viewer/);
 assert.match(js,/type:'equirectangular'/);
 assert.match(js,/createTooltipFunc:playerHotspot/);
 assert.match(js,/viewer\.loadScene/);
 assert.match(js,/viewer\.lookAt/);
});
test('shared panoramic scene sources and vendor assets actually exist',()=>{
 for(const filename of ['vendor/pannellum/pannellum.js','vendor/pannellum/pannellum.css','assets/lg3s/team1446.svg','assets/lg3s/scene/gb-royal-blue.webp','assets/lg3s/scene/gb-kit.webp'])
  assert.ok(fs.statSync(path.join(root,filename)).size>500,filename);
 for(const scene of ['entrance','centre']){
  const file=path.join(root,'assets/lgchl/room-360/'+scene+'-empty-v5.png');
  const png=fs.readFileSync(file);
  assert.ok(png.length>1000000,file);
  assert.equal(png.subarray(1,4).toString('ascii'),'PNG',file);
 }
});
test('verified public GB roster is used, with no fictional player numbers, private VOD or permissions',()=>{
 assert.equal(fixture.league,'lg3s');
 assert.equal(fixture.season,1);
 assert.equal(gb.teamName,'Great Britain');
 assert.equal(gb.players.length,11);
 assert.equal(new Set(gb.players.map(p=>Number(p.lgUserId))).size,11);
 assert.ok(gb.players.every(p=>p.rosterStatus==='active'&&Number.isSafeInteger(Number(p.lgUserId))&&p.jerseyNumber==null));
 assert.match(js,/TEAM_ID=1446/);
 assert.match(js,/rosterStatus==='active'/);
 assert.match(js,/cardLink=p=>/);
 assert.match(js,/player-cards\.html\?league=lg3s&id=/);
 assert.doesNotMatch(js,/service_role|sb_secret_|lg3s_gb_members|lg3s_gb_vod_refs/);
 assert.doesNotMatch(html,/overall:|[0-9]{2} OVR|#97\b/);
});
test('both room views assign 11 positions and can find the real GB players',()=>{
 const extract=name=>{
  const m=js.match(new RegExp(name+":\\{title:'[^']+',image:'[^']+',coords:\\[(.*?)\\]\\}"));
  assert.ok(m,name+' scene coordinates');
  return [...m[1].matchAll(/\[-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\]/g)].length;
 };
 assert.equal(extract('entrance'),11);
 assert.equal(extract('centre'),11);
 assert.match(js,/const q=search\.value\.trim\(\)/);
 assert.match(js,/showPlayer\(match\)/);
});

test('all verified GB players have on-scene jersey hotspots and direct public card destinations',()=>{
 const ids=gb.players.map(p=>Number(p.lgUserId));
 assert.equal(ids.length,11);
 assert.equal(ids.filter(x=>x>0).length,11);
 assert.ok(js.includes("const JERSEY='assets/lg3s/scene/gb-royal-blue.webp'"));
 assert.match(js,/jersey\.src=JERSEY/);
 assert.match(js,/const plate=element\('span','gbp-stall-nameplate',p\.name\)/);
 assert.match(js,/createTooltipFunc:playerHotspot/);
 assert.match(js,/hotSpots:/);
 assert.match(js,/roster\.map\(\(p,index\)=>/);
 assert.match(js,/card\.href=cardLink\(p\)/);
 assert.match(js,/gbp-player-card-link/);
 assert.match(js,/isGoalie=p\.position==='G'/);
 assert.doesNotMatch(js,/gear-v7\.png/);
 assert.match(js,/entrance-empty-v5\.png/);
 assert.match(js,/centre-empty-v5\.png/);
});
test('gear and jersey visuals are explicitly concept-only, goalies are differentiated',()=>{
 for(const id of ['gbpModalJersey','gbpModalKit','gbpModalEquipmentTitle','gbpModalEquipmentItems','gbpModalEquipmentNote'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/GB_GEAR_NOTE=/);
 assert.match(js,/gbp-jersey-stall-goalie/);
 assert.match(js,/Mask · chest protector · blocker · catcher · leg pads/);
 assert.match(js,/Helmet · gloves · skates · stick/);
 assert.match(css,/\.gbp-jersey-front/);
 assert.match(css,/\.gbp-equipment-panel/);
 assert.match(html,/individual numbers, equipment models and ratings are not invented/);
 assert.doesNotMatch(html,/player-specific goalie pads|authentic licensed jersey|verified uniform number/);
});
test('standard Great Britain public room retains original original-portal routing',()=>{
 const page=read('lg3s-gb-locker.html');
 const loader=read('lg3s-gb-locker.js');
 assert.match(page,/Great Britain 3D Locker Room/);
 assert.doesNotMatch(page,/gbp-jersey-stall|lg3s-gb-panorama\.css/);
 assert.match(loader,/enterRoom/);
});

test('runtime 360 scenes mount 11 real GB jerseys, open the correct stall and wire all cards',async()=>{
 const vm=require('node:vm');
 const idMap=new Map();
 const node=(tag='div')=>{
  const listeners=Object.create(null),children=[];
  return {
   tagName:tag.toUpperCase(),className:'',dataset:{},children,hidden:false,disabled:false,value:'',
   textContent:'',href:'',src:'',alt:'',open:false,
   style:{},classList:{add(){},remove(){},toggle(){}},
   setAttribute(){},removeAttribute(){},getAttribute(){return null},
   addEventListener(type,fn){listeners[type]=fn;},listeners,
   append(...items){children.push(...items);},
   replaceChildren(...items){children.splice(0,children.length,...items);},
   focus(){},scrollIntoView(){},
   showModal(){this.open=true},close(){this.open=false}
  };
 };
 const get=id=>{if(!idMap.has(id))idMap.set(id,node());return idMap.get(id);};
 const document={
  getElementById:get,
  createElement:tag=>node(tag),
  querySelectorAll:()=>[],
  querySelector:()=>node()
 };
 let config=null;
 const viewer={
  on(type,fn){if(type==='load')fn()},
  getScene(){return 'entrance'},
  lookAt(){},loadScene(){},setYaw(){},getYaw(){return 0},
  setHfov(){},getHfov(){return 92}
 };
 const window={pannellum:{viewer(_host,options){config=options;return viewer;}},matchMedia:()=>({matches:true})};
 const context={
  window,document,fetch:async()=>({ok:true,json:async()=>fixture}),
  AbortSignal,console,innerWidth:1400,encodeURIComponent
 };
 vm.runInNewContext(js,context,{filename:'lg3s-gb-panorama.js',timeout:4000});
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.ok(config&&config.scenes);
 assert.equal(get('gbpPlayers').children.length,11);
 for(const [sceneName,scene] of Object.entries(config.scenes)){
  const playerHotspots=scene.hotSpots.filter(h=>h.id.includes('-player-'));
  assert.equal(playerHotspots.length,11,sceneName);
  for(let i=0;i<11;i++){
   const player=gb.players[i],hotspot=playerHotspots[i],host=node();
   hotspot.createTooltipFunc(host,{index:i});
   const button=host.children[0];
   assert.equal(button.dataset.playerId,String(player.lgUserId));
   const image=button.children.find(x=>x.className==='gbp-jersey-front');
   assert.ok(image);
   assert.equal(image.src,'assets/lg3s/scene/gb-royal-blue.webp');
   assert.ok(button.children.some(x=>x.className==='gbp-stall-nameplate'&&x.textContent===player.gamertag));
   if(player.position==='G')assert.ok(button.className.includes('gbp-jersey-stall-goalie'));
  }
 }
 for(let i=0;i<11;i++){
  const p=gb.players[i],row=get('gbpPlayers').children[i];
  assert.equal(row.dataset.playerId,String(p.lgUserId));
  assert.equal(row.children[1].href,'player-cards.html?league=lg3s&id='+p.lgUserId+'&kind='+(p.position==='G'?'goalie':'skater'));
 }
 const goalieIndex=gb.players.findIndex(p=>p.position==='G');
 const goalieHot=config.scenes.entrance.hotSpots.filter(h=>h.id.includes('-player-'))[goalieIndex];
 const holder=node();
 goalieHot.createTooltipFunc(holder,{index:goalieIndex});
 holder.children[0].listeners.click({stopPropagation(){}});
 assert.equal(get('gbpModalName').textContent,gb.players[goalieIndex].gamertag);
 assert.equal(get('gbpModalEquipmentTitle').textContent,'GOALTENDER EQUIPMENT');
 assert.equal(get('gbpModalJersey').src,'assets/lg3s/scene/gb-royal-blue.webp');
 assert.equal(get('gbpModalKit').src,'assets/lg3s/scene/gb-kit.webp');
 assert.equal(get('gbpModalCard').href,'player-cards.html?league=lg3s&id='+gb.players[goalieIndex].lgUserId+'&kind=goalie');
});
