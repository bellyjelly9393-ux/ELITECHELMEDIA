/* Public Great Britain panoramic room. Shared ECM Calgary 360 architecture,
   personalized using verified public LG3s roster identities only.
   Does not read private War Room, VOD, draft cards or team membership. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SNAPSHOT='data/lg3s/season1-active-roster-2026-11-14.json';
const TEAM_ID=1446;
const CREST='assets/lg3s/team1446.svg';
// All 11 verified players share the GB national concept kit; jersey numbers are unverified.
const JERSEY='assets/lg3s/scene/gb-royal-blue.webp';
const GB_KIT='assets/lg3s/scene/gb-kit.webp';
const GB_GEAR_NOTE='Concept equipment only; no player-specific gear has been verified.';
const SCENES={
 // Bay-centre yaws are adapted from the actual Calgary Hitmen room (not evenly
 // scattered on a floating UI layer). Pitch is the physical jersey centre.
 entrance:{title:'Entrance',image:'assets/lgchl/room-360/entrance-empty-v5.png',coords:[[-50,-7],[-43,-7],[-36,-7],[-18,-7],[-9,-7],[0,-7],[9,-7],[18,-7],[36,-7],[43,-7],[50,-7]]},
 centre:{title:'Centre',image:'assets/lgchl/room-360/centre-empty-v5.png',coords:[[-143,-11.5],[-126,-11.5],[-110,-11.5],[-94,-11.5],[-65,-11.5],[-36,-11.5],[0,-11.5],[36,-11.5],[65,-11.5],[111,-11.5],[144,-11.5]]}
};
const buttons={left:$('gbpLeft'),right:$('gbpRight'),reset:$('gbpReset'),zoomIn:$('gbpZoomIn'),zoomOut:$('gbpZoomOut'),full:$('gbpFull'),prev:$('gbpPrev'),next:$('gbpNext'),entrance:$('gbpEntrance'),centre:$('gbpCentre'),roster:$('gbpRosterToggle')};
const stage=$('gbPanorama'),status=$('gbpLoading'),tileGrid=$('gbpPlayers'),search=$('gbpSearch'),modal=$('gbpStallModal');
let roster=[],viewer=null,loaded=false,selected=-1,activeScene='entrance',usingTexture=false;
const safeId=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const cardLink=p=>'player-cards.html?league=lg3s&id='+encodeURIComponent(p.id)+'&kind='+(p.position==='G'?'goalie':'skater');
const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
const fov=()=>innerWidth<640?70:92;
function setLoading(message){status.hidden=false;status.textContent=message;}
function updateButtons(){
 buttons.entrance.setAttribute('aria-pressed',String(activeScene==='entrance'));
 buttons.centre.setAttribute('aria-pressed',String(activeScene==='centre'));
 for(const b of [buttons.left,buttons.right,buttons.reset,buttons.zoomIn,buttons.zoomOut,buttons.full,buttons.entrance,buttons.centre])b.disabled=!loaded;
 buttons.prev.disabled=selected<=0||!roster.length;
 buttons.next.disabled=selected>=roster.length-1;
 $('gbpSelected').textContent=selected>=0?roster[selected].name:'Explore the room';
 $('gbpCount').textContent=selected>=0?roster[selected].position+' · Stall '+(selected+1)+' of '+roster.length:roster.length+' verified public roster stalls';
 document.querySelectorAll('.gbp-hotspot').forEach(b=>{
  const current=Number(b.dataset.playerId)===roster[selected]?.id;
  b.classList.toggle('is-selected',current);
  b.setAttribute('aria-current',String(current));
 });
 document.querySelectorAll('.gbp-player-tile').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.playerId)===roster[selected]?.id)));
}
function showPlayer(index,{open=false,scroll=true}={}){
 if(!Number.isInteger(index)||index<0||index>=roster.length)return;
 selected=index;
 const player=roster[index];
 updateButtons();
 if(viewer&&loaded){
  const point=SCENES[activeScene].coords[index];
  if(point)viewer.lookAt(point[1],point[0],innerWidth<640?58:82,reduce()?false:700);
 }
 if(scroll&&!open){document.querySelector('.gbp-tour').scrollIntoView({behavior:reduce()?'auto':'smooth',block:'start'});stage.focus({preventScroll:true});}
 if(open)openStall(player);
}
function openStall(player){
 const isGoalie=player.position==='G';
 const position=isGoalie?'Goaltender':player.position;
 $('gbpModalName').textContent=player.name;
 $('gbpModalPosition').textContent=position+' · Great Britain main roster';
 $('gbpModalIdentity').textContent='Verified LG player ID '+player.id+' · No unverified jersey numbers or ratings';
 $('gbpModalCard').href=cardLink(player);
 $('gbpModalJersey').src=JERSEY;
 $('gbpModalJersey').alt='Great Britain national concept jersey for '+player.name+'; number unassigned';
 $('gbpModalKit').src=GB_KIT;
 $('gbpModalKit').alt='Great Britain concept equipment reference';
 $('gbpModalEquipmentTitle').textContent=isGoalie?'GOALTENDER EQUIPMENT':'SKATER EQUIPMENT';
 $('gbpModalEquipmentItems').textContent=isGoalie?'Mask · chest protector · blocker · catcher · leg pads':'Helmet · gloves · skates · stick';
 $('gbpModalEquipmentNote').textContent=GB_GEAR_NOTE;
 modal.classList.toggle('gbp-goalie-stall',isGoalie);
 if(!modal.open)modal.showModal();
}
function element(tag,cls,text){
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!=null)node.textContent=String(text);
 return node;
}
function drawRoster(){
 tileGrid.replaceChildren();
 const q=search.value.trim().toLocaleLowerCase().replace(/\s+/g,' ');
 const visible=roster.map((p,index)=>({...p,index})).filter(p=>p.name.toLocaleLowerCase().includes(q));
 for(const p of visible){
  const tile=element('div','gbp-player-tile');
  tile.dataset.playerId=String(p.id);
  const find=element('button','gbp-player-find');
  find.type='button';find.setAttribute('aria-label','Locate '+p.name+' jersey in the panoramic room');
  const crest=element('img');crest.src=CREST;crest.alt='';crest.loading='lazy';
  const details=element('span');
  details.append(element('strong',null,p.name),element('small',null,(p.position==='G'?'GOALTENDER':p.position)+' · VERIFIED ROSTER'));
  find.append(crest,details,element('b',null,'LOCATE'));
  find.addEventListener('click',()=>{showPlayer(p.index,{scroll:!!viewer});if(!viewer)openStall(p);});
  const card=element('a','gbp-player-card-link','CARD ↗');
  card.href=cardLink(p);
  card.setAttribute('aria-label','Open '+p.name+' EliteChel player card');
  tile.append(find,card);
  tileGrid.append(tile);
 }
 tileGrid.setAttribute('aria-busy','false');
 $('gbpRosterStatus').textContent=visible.length
  ?visible.length+' of '+roster.length+' verified GB players. Select a player to locate their stall.'
  :'No matching main-roster player. Try another gamertag.';
 updateButtons();
}
function playerHotspot(host,args){
 const p=roster[args.index];if(!p)return;
 // Rendered jersey and nameplate are part of the 360 texture. The only overlay
 // is this transparent, accessible click region, which matches the physical bay.
 const button=element('button','gbp-hotspot gbp-mounted-hit');
 button.type='button';button.dataset.playerId=String(p.id);
 button.setAttribute('aria-label','Open '+p.name+' '+(p.position==='G'?'goalie':'skater')+' locker');
 button.title=p.name+' · '+(p.position==='G'?'Goalie':p.position);
 button.append(element('span','gbp-fallback-label',p.name));
 button.addEventListener('click',e=>{e.stopPropagation();showPlayer(args.index,{open:true,scroll:false});});
 host.append(button);
}
function sceneConfig(name,textures){
 return {title:SCENES[name].title,type:'equirectangular',
 panorama:textures?.[name]||SCENES[name].image,pitch:0,yaw:0,hfov:fov(),
 hotSpots:roster.map((p,index)=>({
  id:name+'-player-'+p.id,
  pitch:SCENES[name].coords[index][1],
  yaw:SCENES[name].coords[index][0],
  cssClass:'gbp-hotspot-host',
  createTooltipFunc:playerHotspot,
  createTooltipArgs:{index}
 }))};
}
function resizeMountedHits(){
 if(!viewer)return;
 const focal=stage.clientWidth/(2*Math.tan(viewer.getHfov()*Math.PI/360));
 const width=Math.max(35,Math.min(160,2*focal*Math.tan(3.05*Math.PI/180)));
 const height=Math.max(50,Math.min(220,2*focal*Math.tan(5.5*Math.PI/180)));
 document.querySelectorAll('.gbp-mounted-hit').forEach(b=>{
  b.style.width=width+'px';b.style.height=height+'px';
 });
}
async function startPanorama(){
 if(!window.pannellum){setLoading('Interactive 360° viewer unavailable. Player roster and cards remain accessible below.');return;}
 let textures=null;
 try{
  setLoading('Mounting Great Britain jerseys inside the panoramic locker bays…');
  textures=await window.GBPanoramaTextures.composeScenes({
   scenes:SCENES,players:roster,jerseyPath:JERSEY,crestPath:CREST,
   ecmPath:'assets/brand/ecm-logo.webp'
  });
  usingTexture=true;
 }catch(error){
  console.warn('GB scene texture composition failed; using accessible fallback:',error);
  document.body.classList.add('gbp-texture-fallback');
  setLoading('The original room image loaded without mounted jerseys. Use the roster or player markers to open a stall.');
 }
 try{
  viewer=window.pannellum.viewer(stage,{
   default:{firstScene:'entrance',autoLoad:true,showControls:false,showFullscreenCtrl:false,mouseZoom:'fullscreenonly',keyboardZoom:false,
   minHfov:45,maxHfov:110,minPitch:-65,maxPitch:65,sceneFadeDuration:reduce()?0:500,escapeHTML:true},
   scenes:{entrance:sceneConfig('entrance',textures),centre:sceneConfig('centre',textures)}
  });
  viewer.on('load',()=>{loaded=true;activeScene=viewer.getScene();status.hidden=true;resizeMountedHits();updateButtons();});
  viewer.on('zoomchange',resizeMountedHits);
  window.addEventListener('resize',resizeMountedHits);
  viewer.on('error',()=>{loaded=false;setLoading('360° scene could not load. Use Find My Stall below for verified player cards.');updateButtons();});
 }catch(error){console.warn('GB public panorama:',error);setLoading('The 360° scene is unavailable. Use the player list to open a player card.');viewer=null;}
}
function changeScene(scene){
 if(!viewer||!loaded||!SCENES[scene]||scene===activeScene)return;
 loaded=false;activeScene=scene;setLoading('Moving to '+SCENES[scene].title.toLowerCase()+'…');updateButtons();viewer.loadScene(scene,0,0,fov());
}
buttons.entrance.addEventListener('click',()=>changeScene('entrance'));
buttons.centre.addEventListener('click',()=>changeScene('centre'));
buttons.left.addEventListener('click',()=>viewer?.setYaw(viewer.getYaw()-25));
buttons.right.addEventListener('click',()=>viewer?.setYaw(viewer.getYaw()+25));
buttons.reset.addEventListener('click',()=>viewer?.lookAt(0,0,fov(),reduce()?false:600));
buttons.zoomIn.addEventListener('click',()=>viewer?.setHfov(Math.max(45,viewer.getHfov()-12)));
buttons.zoomOut.addEventListener('click',()=>viewer?.setHfov(Math.min(110,viewer.getHfov()+12)));
buttons.full.addEventListener('click',()=>{
 const view=$('gbpView');
 if(document.fullscreenElement)document.exitFullscreen?.();
 else view.requestFullscreen?.().catch(()=>{});
});
buttons.prev.addEventListener('click',()=>showPlayer(selected-1));
buttons.next.addEventListener('click',()=>showPlayer(selected+1));
buttons.roster.addEventListener('click',()=>{
 const panel=$('gbpRosterPanel');panel.hidden=!panel.hidden;
 buttons.roster.textContent=panel.hidden?'Show roster':'Hide roster';
 buttons.roster.setAttribute('aria-expanded',String(!panel.hidden));
 if(!panel.hidden)search.focus({preventScroll:true});
});
search.addEventListener('input',drawRoster);
search.addEventListener('keydown',event=>{
 if(event.key==='Enter'){
  const match=roster.findIndex(p=>p.name.toLowerCase().includes(search.value.trim().toLowerCase()));
  if(match>=0){event.preventDefault();showPlayer(match);}
 }
});
$('gbpModalClose').addEventListener('click',()=>modal.close());
$('gbpModalLocate').addEventListener('click',()=>{modal.close();showPlayer(selected);});
modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
async function init(){
 try{
  const response=await fetch(SNAPSHOT,{cache:'no-cache',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('roster snapshot '+response.status);
  const data=await response.json();
  if(data.league!=='lg3s'||data.season!==1||!Array.isArray(data.teams))throw Error('invalid LG3s snapshot');
  const team=data.teams.find(t=>Number(t.lgTeamId)===TEAM_ID);
  if(!team||!Array.isArray(team.players))throw Error('GB roster missing');
  const ids=new Set();
  roster=team.players.filter(p=>p.rosterStatus==='active'&&safeId(p.lgUserId)&&typeof p.gamertag==='string'&&p.gamertag.trim()).map(p=>({id:Number(p.lgUserId),name:p.gamertag.trim(),position:String(p.position||'UNSET')})).filter(p=>{if(ids.has(p.id))return false;ids.add(p.id);return true;});
  if(roster.length<1||roster.length>SCENES.entrance.coords.length)throw Error('verified roster does not fit available scene stalls');
  drawRoster();startPanorama();
 }catch(error){
  console.warn('GB public 360 roster:',error);
  setLoading('The public roster could not be verified. 360° player hotspots are disabled rather than showing guessed identities.');
  $('gbpCount').textContent='Roster unavailable';
  $('gbpRosterStatus').textContent='Verified main-roster snapshot temporarily unavailable. No player identities were guessed.';
  tileGrid.replaceChildren();tileGrid.setAttribute('aria-busy','false');
 }
}
init();
})();
