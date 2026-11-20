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
const texture=read('lg3s-gb-panorama-texture.js');
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
 assert.match(html,/lg3s-gb-panorama-texture\.js/);
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

test('all 11 jerseys are baked into both equirectangular scenes, not DOM cards',()=>{
 assert.ok(js.includes("const JERSEY='assets/lg3s/scene/gb-royal-blue.webp'"));
 assert.match(js,/GBPanoramaTextures\.composeScenes/);
 assert.match(js,/createTooltipFunc:playerHotspot/);
 assert.match(js,/hotSpots:roster\.map/);
 assert.match(js,/card\.href=cardLink\(p\)/);
 assert.match(js,/gbp-player-card-link/);
 assert.match(js,/entrance-empty-v5\.png/);
 assert.match(js,/centre-empty-v5\.png/);
 assert.doesNotMatch(js,/gbp-jersey-front|gbp-jersey-stall-goalie|signHotspot/);
 assert.match(texture,/drawMountedJersey/);
 assert.match(texture,/drawTeamSign/);
 assert.match(texture,/canvas\.toDataURL\('image\/jpeg'/);
 assert.match(css,/\.gbp-hotspot\.gbp-mounted-hit/);
 assert.doesNotMatch(css,/\.gbp-jersey-front|\.gbp-jersey-stall\{/);
});
test('Calgary-style GB closeup keeps public identity and goalie equipment distinction',()=>{
 for(const id of ['gbpModalJersey','gbpModalKit','gbpModalEquipmentTitle','gbpModalEquipmentItems','gbpModalEquipmentNote','gbpCloseupScene','gbpCloseupName','gbpCloseupPosition','gbpCloseupBackground'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/GB_GEAR_NOTE=/);
 assert.match(js,/stall-goalie-v7\.png/);
 assert.match(js,/stall-empty-v5\.png/);
 assert.match(js,/Mask · chest protector · blocker · catcher · leg pads/);
 assert.match(js,/Helmet · gloves · skates · stick/);
 assert.match(css,/\.gbp-closeup-jersey/);
 assert.match(css,/\.gbp-equipment-panel/);
 assert.match(html,/individual jersey numbers, personal equipment models and ratings are not invented/);
 assert.doesNotMatch(html,/player-specific goalie pads|authentic licensed jersey|verified uniform number/);
});
test('standard Great Britain public room retains original original-portal routing',()=>{
 const page=read('lg3s-gb-locker.html');
 const loader=read('lg3s-gb-locker.js');
 assert.match(page,/Great Britain 3D Locker Room/);
 assert.doesNotMatch(page,/gbp-jersey-stall|lg3s-gb-panorama\.css/);
 assert.match(loader,/enterRoom/);
});

test('compositor mounts all 11 jerseys into both 360 scene textures and embeds GB signage',async()=>{
 const vm=require('node:vm');
 const draw=[];
 const fakeCanvas=()=>({
  width:0,height:0,
  getContext(){return {
   save(){},restore(){},fillRect(){},strokeRect(){},fillText(){},
   beginPath(){},arc(){},fill(){},
   drawImage(img,...args){draw.push({path:img.path,args});}
  }},
  toDataURL(){return 'data:image/jpeg;base64,ROOM';}
 });
 class FakeImage{
  constructor(){this.naturalWidth=4096;this.naturalHeight=2048;}
  set src(value){this.path=value;Promise.resolve().then(()=>this.onload());}
 }
 const w={};
 vm.runInNewContext(texture,{window:w,Image:FakeImage,
   document:{createElement(t){assert.equal(t,'canvas');return fakeCanvas();}},
   console
 },{filename:'lg3s-gb-panorama-texture.js',timeout:4000});
 const players=gb.players.map(p=>({position:p.position}));
 const scenes={
  entrance:{image:'assets/lgchl/room-360/entrance-empty-v5.png',coords:[[-50,-7],[-43,-7],[-36,-7],[-18,-7],[-9,-7],[0,-7],[9,-7],[18,-7],[36,-7],[43,-7],[50,-7]]},
  centre:{image:'assets/lgchl/room-360/centre-empty-v5.png',coords:[[-143,-11.5],[-126,-11.5],[-110,-11.5],[-94,-11.5],[-65,-11.5],[-36,-11.5],[0,-11.5],[36,-11.5],[65,-11.5],[111,-11.5],[144,-11.5]]}
 };
 const out=await w.GBPanoramaTextures.composeScenes({
  scenes,players,jerseyPath:'gb-royal-blue.webp',crestPath:'gb-crest.svg',ecmPath:'ecm-logo.webp'
 });
 assert.match(out.entrance,/^data:image\/jpeg/);
 assert.match(out.centre,/^data:image\/jpeg/);
 const mounted=draw.filter(x=>x.path==='gb-royal-blue.webp');
 assert.equal(mounted.length,22,'11 jerseys in each of two camera views');
 const backgrounds=draw.filter(x=>x.path.includes('-empty-v5.png'));
 assert.equal(backgrounds.length,2);
 assert.ok(draw.filter(x=>x.path==='gb-crest.svg').length===2);
 for(const placement of mounted){
  const [x,y,width,height]=placement.args;
  assert.ok(x>=0&&x+width<=4096);
  assert.ok(y>=0&&y+height<=2048);
  assert.ok(width>50&&width<100,'physically sized jersey, not oversized floating card');
  assert.ok(height>90&&height<180);
 }
});
test('runtime mounts transparent, clickable hotspots aligned to 11 texture-baked player jerseys',async()=>{
 const vm=require('node:vm');
 const idMap=new Map();
 const node=(tag='div')=>{
  const listeners=Object.create(null),children=[];
  return {
   tagName:tag.toUpperCase(),className:'',dataset:{},children,hidden:false,disabled:false,value:'',
   textContent:'',href:'',src:'',alt:'',open:false,style:{},
   classList:{add(){},remove(){},toggle(){}},
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
 const window={
  GBPanoramaTextures:{composeScenes:async()=>({
   entrance:'data:image/jpeg;base64,ENTER',centre:'data:image/jpeg;base64,CENTRE'
  })},
  pannellum:{viewer(_host,options){config=options;return viewer;}},
  matchMedia:()=>({matches:true}),
  addEventListener(){}
 };
 const context={
  window,document,fetch:async()=>({ok:true,json:async()=>fixture}),
  AbortSignal,console,innerWidth:1400,encodeURIComponent
 };
 vm.runInNewContext(js,context,{filename:'lg3s-gb-panorama.js',timeout:4000});
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.ok(config&&config.scenes);
 assert.match(config.scenes.entrance.panorama,/^data:image\/jpeg/);
 assert.match(config.scenes.centre.panorama,/^data:image\/jpeg/);
 assert.equal(get('gbpPlayers').children.length,11);
 for(const [sceneName,scene] of Object.entries(config.scenes)){
  const playerHotspots=scene.hotSpots.filter(h=>h.id.includes('-player-'));
  assert.equal(playerHotspots.length,11,sceneName);
  for(let i=0;i<11;i++){
   const player=gb.players[i],hotspot=playerHotspots[i],host=node();
   hotspot.createTooltipFunc(host,{index:i});
   const button=host.children[0];
   assert.equal(button.dataset.playerId,String(player.lgUserId));
   assert.equal(button.children.length,1,'only text fallback, no visible jersey overlay');
   assert.ok(button.className.includes('gbp-mounted-hit'));
   assert.match(button.getAttribute?.('aria-label')||button.title, /./);
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
 assert.equal(get('gbpCloseupName').textContent,gb.players[goalieIndex].gamertag);
 assert.equal(get('gbpCloseupBackground').src,'assets/lgchl/room-360/stall-goalie-v7.png');
 assert.equal(get('gbpModalJersey').src,'assets/lg3s/scene/gb-royal-blue.webp');
 assert.equal(get('gbpModalCard').href,'player-cards.html?league=lg3s&id='+gb.players[goalieIndex].lgUserId+'&kind=goalie');
});
