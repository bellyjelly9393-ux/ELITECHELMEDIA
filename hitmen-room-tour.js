/* Opt-in 360 tour: public main-roster identities and public cards only. */
(()=>{'use strict';
 const params=new URLSearchParams(location.search);
 if(Number(params.get('team')||412)!==412||!(params.get('room')==='360'||document.body.dataset.roomTour==='true'))return;
 const room=document.getElementById('roomPlayers'),finder=window.HitmenPublicRoom;
 if(!room||!finder)return;
 document.body.classList.add('hitmen-tour');
 const shell=document.createElement('section');shell.className='tour-shell';shell.setAttribute('aria-label','Calgary Hitmen 360 degree public locker room');
 shell.innerHTML='<div class="tour-topbar"><a class="tour-back" href="lgchl-media.html" aria-label="Back to league coverage">←</a><div class="tour-identity"><img src="assets/lgchl/s55/team412.png" alt="Calgary Hitmen crest"><div><strong>Calgary Hitmen</strong><span>Public locker room</span></div></div><div class="tour-search-slot"></div><img class="tour-publisher" src="assets/brand/ecm-logo.webp" alt="Elite Chel Media"></div><div class="tour-view"><div id="hitmenPanorama" tabindex="0" aria-label="360 degree room. Drag or swipe to look around. Arrow keys turn the view. Select a player stall to reveal its nameplate." aria-describedby="tourHelp"></div><div class="tour-view-toolbar"><div class="tour-scene-tabs" aria-label="Room viewpoints"><button type="button" data-tour-scene="entrance" disabled>Entrance</button><button type="button" data-tour-scene="centre" disabled>Centre</button></div><details class="tour-options"><summary>View options</summary><div class="tour-options-panel"><div class="tour-look-controls" aria-label="Camera controls"><button type="button" id="tourReset" disabled>Reset view</button><button type="button" data-tour-action="in" disabled>Zoom in</button><button type="button" data-tour-action="out" disabled>Zoom out</button><button type="button" data-tour-action="full" disabled>Full screen</button></div><div class="tour-team-slot"></div></div></details></div><div class="tour-dock"><div class="tour-selected"><strong id="tourSelectionName">Explore the room</strong><small id="tourSelectionMeta">17 players</small></div><div class="tour-dock-actions"><button type="button" data-tour-action="left" aria-label="Look left" disabled>←</button><button type="button" data-tour-action="right" aria-label="Look right" disabled>→</button><button type="button" id="tourPrevious" aria-label="Previous player stall" disabled>Previous</button><button type="button" id="tourNext" aria-label="Next player stall" disabled>Next</button><a id="tourPlayerCard" hidden>Player card ↗</a><button type="button" id="tourRosterToggle" aria-expanded="true" aria-controls="roomPlayers">Roster</button></div></div></div><p id="tourStatus" class="tour-sr-only" role="status">Loading the room…</p><p id="tourHelp" class="tour-sr-only">Drag or swipe to look around. Use floor arrows to move, or find your name above.</p>';
 room.before(shell);
 const search=document.getElementById('roomSearch'),searchLabel=search.closest('label'),searchPanel=document.querySelector('.stall-finder');searchLabel.firstChild.textContent='Find my stall';search.placeholder='Find my stall';shell.querySelector('.tour-search-slot').append(searchLabel,searchPanel);searchPanel.classList.add('tour-search-results');const clearSearch=document.getElementById('stallFinderClear');clearSearch.textContent='×';clearSearch.setAttribute('aria-label','Clear search');
 const teamSlot=document.querySelector('.room-team-slot');if(teamSlot)shell.querySelector('.tour-team-slot').append(teamSlot);
 const sourceNote=document.getElementById('rosterNote'),sourceDisclosure=document.createElement('details');sourceDisclosure.className='tour-data-note';sourceDisclosure.innerHTML='<summary>Roster and score information</summary>';sourceDisclosure.append(sourceNote);const roomFooter=document.querySelector('.room-footer');const legacyNote=roomFooter?.querySelector(':scope > p.note');if(legacyNote)sourceDisclosure.append(legacyNote);roomFooter?.append(sourceDisclosure);
 const sections=document.querySelectorAll('.room-columns>section');if(sections[0])sections[0].querySelector('h2').textContent='Recent games';if(sections[1])sections[1].querySelector('h2').textContent='Upcoming';
 const $=id=>shell.querySelector('#'+id),stage=$('hitmenPanorama'),status=$('tourStatus');
 const sceneButtons=[...shell.querySelectorAll('[data-tour-scene]')],previous=$('tourPrevious'),next=$('tourNext'),card=$('tourPlayerCard'),toggle=$('tourRosterToggle'),reset=$('tourReset');
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const roomHfov=()=>window.innerWidth<600?65:110;
 let players=[],viewer=null,selected=-1,loaded=false,pending=null,started=false;
 const viewerPane=shell.querySelector('.tour-view');let entryPose=null,entryId=null;
 const closeup=window.HitmenStallView?.create({after:viewerPane,onPlayerChange(id){selected=players.findIndex(p=>p.id===id);sync();},onClose({id}){viewerPane.hidden=false;selected=players.findIndex(p=>p.id===id);sync();viewer?.resize();resizeBrands();if(viewer&&entryPose&&id===entryId){viewer.lookAt(entryPose.pitch,entryPose.yaw,entryPose.hfov,false);shell.querySelector('.tour-player-button[data-player-id="'+id+'"]')?.focus({preventScroll:true});}else if(loaded)goToPlayer(id);else stage.focus({preventScroll:true});viewerPane.scrollIntoView({behavior:'auto',block:'start'});}});
 function openStall(id,source){const index=players.findIndex(p=>p.id===Number(id));if(index<0)return false;if(!closeup)return finder.focusStall(id);viewer?.stopMovement();entryPose=viewer?{yaw:viewer.getYaw(),pitch:viewer.getPitch(),hfov:viewer.getHfov()}:null;entryId=Number(id);selected=index;sync();viewerPane.hidden=true;if(!closeup.open(id,source)){viewerPane.hidden=false;return false;}rosterVisible(false);return true;}
 room.addEventListener('click',e=>{const anchor=e.target.closest('a.stall');if(!anchor||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const id=Number(anchor.id.replace('hitmen-stall-',''));if(players.some(p=>p.id===id)){e.preventDefault();openStall(id,anchor);}});
 // Coordinates are calibrated against the versioned artwork. Roster order binds identities.
 // No jersey numbers or private locker IDs are inferred from the generated environment.
 const points={
  centre:[[-143,4],[-126,4],[-110,4],[-94,4],[-80,4],[-65,4],[-36,1.4],[-18,1.4],[0,1.4],[18,1.4],[36,1.4],[65,4],[80,4],[95,4],[111,4],[127,4],[144,4]],
  entrance:[[-75,0],[-66,0],[-58,0],[-50,0],[-43,0],[-36,0],[-18,-1],[-9,-1],[0,-1],[9,-1],[18,-1],[36,0],[43,0],[50,0],[58,0],[66,0],[75,0]]
 };
 const paths={centre:'assets/lgchl/room-360/centre-fabric-v3.png',entrance:'assets/lgchl/room-360/entrance-fabric-v3.png'};
 function rosterVisible(show){room.hidden=!show;toggle.textContent=show?'Hide roster':'Roster';toggle.setAttribute('aria-expanded',String(show));}
 toggle.addEventListener('click',()=>rosterVisible(room.hidden));
 function placeNameplates(){requestAnimationFrame(()=>requestAnimationFrame(()=>{const bounds=stage.getBoundingClientRect();shell.querySelectorAll('.tour-nameplate:not([hidden])').forEach(plate=>{const rect=plate.getBoundingClientRect();if(!rect.width||!rect.height)return;let delta=0;if(rect.top<bounds.top+8)delta=bounds.top+8-rect.top;if(rect.bottom+delta>bounds.bottom-8)delta+=bounds.bottom-8-(rect.bottom+delta);if(delta)plate.style.top=(parseFloat(getComputedStyle(plate).top)+delta)+'px';});}));}
 function sync(){
  shell.querySelector('.tour-dock').dataset.hasPlayer=String(selected>=0);
  previous.disabled=!loaded||selected<=0;next.disabled=!loaded||!players.length||selected===players.length-1;
  shell.querySelectorAll('[data-tour-action]').forEach(b=>b.disabled=!loaded);sceneButtons.forEach(b=>{b.disabled=!loaded;b.setAttribute('aria-pressed',String(viewer?.getScene()===b.dataset.tourScene));});reset.disabled=!loaded;
  shell.querySelectorAll('.tour-player-button').forEach(b=>{const current=Number(b.dataset.playerId)===players[selected]?.id;b.classList.toggle('is-selected',current);b.setAttribute('aria-expanded',String(current));const plate=b.parentElement.querySelector('.tour-nameplate');if(plate){plate.hidden=!current;plate.style.top='';}if(current)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
  $('tourSelectionName').textContent=selected>=0?players[selected].name:'Explore the room';$('tourSelectionMeta').textContent=selected>=0?players[selected].position+' · Stall '+(selected+1)+' of 17':'17 players';
  if(selected>=0){card.hidden=false;card.href=players[selected].href;card.textContent='Player card ↗';card.setAttribute('aria-label','Open '+players[selected].name+' public player card');}else card.hidden=true;placeNameplates();
 }
 function fail(){loaded=false;status.textContent='The 360° room is unavailable on this device. Use the public roster cards below.';stage.hidden=true;rosterVisible(true);sync();}
 function goToPlayer(id,focus=true){
  if(closeup?.isOpen())return closeup.choosePlayer(id);
  const i=players.findIndex(p=>p.id===Number(id));if(i<0)return false;
  selected=i;pending={id:Number(id),focus};sync();
  if(!loaded)return true;
  const [yaw,pitch]=points[viewer.getScene()][i];pending=null;
  viewer.lookAt(pitch-10,yaw,window.innerWidth<600?55:85,reduced()?false:850,()=>{
   if(focus&&players[selected]?.id===Number(id)){const b=shell.querySelector('.tour-player-button[data-player-id="'+id+'"]');b?.focus({preventScroll:true});}placeNameplates();
  });
  stage.focus({preventScroll:true});shell.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});
  status.textContent='Your stall is highlighted. Open your public player card to explore.';
  return true;
 }
 function setView(scene){if(!viewer||!['entrance','centre'].includes(scene))return false;loaded=false;pending=null;selected=-1;sync();status.textContent='Moving to '+(scene==='centre'?'the centre of the room':'the entrance')+'…';viewer.loadScene(scene,0,0,roomHfov());return true;}
 sceneButtons.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.tourScene)));
 shell.querySelectorAll('[data-tour-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.tourAction,duration=reduced()?false:450;if(a==='left'||a==='right')viewer.setYaw(viewer.getYaw()+(a==='left'?-30:30),duration);if(a==='in'||a==='out')viewer.setHfov(viewer.getHfov()+(a==='in'?-10:10),duration);if(a==='full')viewer.toggleFullscreen();}));
 reset.addEventListener('click',()=>{selected=-1;pending=null;viewer.lookAt(0,0,roomHfov(),reduced()?false:700);status.textContent='Look around the room or find your stall above.';sync();});
 previous.addEventListener('click',()=>finder.focusStall(players[selected-1]?.id));next.addEventListener('click',()=>finder.focusStall(players[selected+1]?.id));
 room.addEventListener('hitmen-stall-selected',e=>{if(closeup?.isOpen())closeup.choosePlayer(e.detail.lg_user_id);else goToPlayer(e.detail.lg_user_id);});
 function playerHotspot(host,{player,scene}){
  const button=document.createElement('button');button.type='button';button.className='tour-player-button';button.dataset.playerId=player.id;button.textContent=player.name;button.setAttribute('aria-label','Find '+player.name+' stall');button.setAttribute('aria-expanded','false');
  const plate=document.createElement('div');plate.className='tour-nameplate';plate.id='tour-nameplate-'+scene+'-'+player.id;plate.hidden=true;plate.setAttribute('role','group');plate.setAttribute('aria-label',player.name+' custom stall nameplate');button.setAttribute('aria-controls',plate.id);
  const metal=document.createElement('div');metal.className='tour-nameplate-metal';
  metal.innerHTML='<i class="plate-rivet r1" aria-hidden="true"></i><i class="plate-rivet r2" aria-hidden="true"></i><i class="plate-rivet r3" aria-hidden="true"></i><i class="plate-rivet r4" aria-hidden="true"></i><img src="assets/lgchl/s55/team412.png" alt=""><div class="plate-player"><small>CALGARY HITMEN</small><strong></strong><span></span></div><div class="plate-stall"><small>STALL</small><b></b></div>';
  metal.querySelector('.plate-player strong').textContent=player.name;
  metal.querySelector('.plate-player span').textContent=player.position+' · MAIN ROSTER';
  metal.querySelector('.plate-stall b').textContent=String(players.indexOf(player)+1).padStart(2,'0');
  const link=document.createElement('a');link.className='tour-nameplate-open';link.href=player.href;link.textContent='OPEN PUBLIC PLAYER CARD ↗';link.setAttribute('aria-label','Open '+player.name+' public player card');
  plate.append(metal,link);host.append(button,plate);
  const show=()=>{plate.hidden=false;plate.style.top='';button.setAttribute('aria-expanded','true');placeNameplates();};
  const hide=()=>{if(!button.classList.contains('is-selected')&&!host.contains(document.activeElement)){plate.hidden=true;button.setAttribute('aria-expanded','false');}};
  button.addEventListener('click',e=>{e.stopPropagation();openStall(player.id,button);});
  button.addEventListener('focus',show);host.addEventListener('mouseenter',show);host.addEventListener('mouseleave',hide);host.addEventListener('focusout',()=>setTimeout(hide,0));
  host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();selected=-1;pending=null;sync();stage.focus({preventScroll:true});status.textContent='Nameplate closed. Continue exploring the room.';}});
 }
 function floorHotspot(host,{target,label}){
  const button=document.createElement('button');button.type='button';button.className='tour-floor-arrow';button.innerHTML='<span aria-hidden="true">↑</span>';const text=document.createElement('small');text.textContent=label;button.append(text);button.setAttribute('aria-label',label);button.addEventListener('click',e=>{e.stopPropagation();setView(target);});host.append(button);
 }
 const brandLayers=[];
 function brandHotspot(host,args){
  host.classList.add('tour-brand-anchor');host.setAttribute('aria-hidden','true');
  const el=document.createElement('div');el.className='tour-art-layer tour-art-'+args.kind;
  if(args.kind==='sign')el.innerHTML='<img src="assets/lgchl/s55/team412.png" alt=""><div><b>CALGARY HITMEN</b><span>PUBLIC LOCKER ROOM</span></div><img src="assets/brand/ecm-logo.webp" alt="">';
  else{const img=document.createElement('img');img.src=args.kind==='jersey'?'assets/lgchl/s55/team412.png':'assets/brand/ecm-logo.webp';img.alt='';el.append(img);if(args.kind==='jersey'){const hit=document.createElement('button');hit.type='button';hit.tabIndex=-1;hit.className='tour-jersey-hit';hit.dataset.playerId=args.player.id;hit.setAttribute('aria-hidden','true');hit.addEventListener('click',e=>{e.stopPropagation();openStall(args.player.id,hit);});el.append(hit);}}
  host.append(el);brandLayers.push({el,scene:args.scene,angle:args.angle});resizeBrands();
 }
 function resizeBrands(){if(!viewer)return;const focal=stage.clientWidth/(2*Math.tan(viewer.getHfov()*Math.PI/360));for(const layer of brandLayers){if(layer.scene===viewer.getScene())layer.el.style.width=(2*focal*Math.tan(layer.angle*Math.PI/360))+'px';}}
 function sceneBranding(scene){return [
  {id:'real-room-sign',yaw:0,pitch:scene==='centre'?25:11.5,cssClass:'tour-hotspot',createTooltipFunc:brandHotspot,createTooltipArgs:{kind:'sign',scene,angle:scene==='centre'?67:37}},
  {id:'real-ecm-table',yaw:0,pitch:scene==='centre'?-43:-25,cssClass:'tour-hotspot',createTooltipFunc:brandHotspot,createTooltipArgs:{kind:'table',scene,angle:scene==='centre'?18:10}},
  ...players.map((p,i)=>({id:'real-jersey-'+p.id,yaw:points[scene][i][0],pitch:scene==='centre'?-11.5:-6.5,cssClass:'tour-hotspot',createTooltipFunc:brandHotspot,createTooltipArgs:{kind:'jersey',scene,player:p,angle:scene==='centre'?4.1:1.6}}))
 ];}
 window.addEventListener('resize',resizeBrands);
 async function start(){
  if(started)return;
  const stalls=[...room.querySelectorAll('.stall[id]')];
  if(stalls.length!==17){status.textContent='The verified 17-player roster is unavailable. Please reload to try again.';stage.hidden=true;rosterVisible(true);return;}
  players=stalls.map(el=>({id:Number(el.id.replace('hitmen-stall-','')),name:el.querySelector('.nameplate').textContent,href:el.getAttribute('href'),position:el.querySelector('.stall-info p').textContent.split(' · ')[0]}));closeup?.setPlayers(players);started=true;
  try{
   if(!window.pannellum){
    const css=document.createElement('link');css.rel='stylesheet';css.href='vendor/pannellum/pannellum.css';document.head.append(css);
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/pannellum/pannellum.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
   }
   const scenes={};
   for(const scene of ['entrance','centre'])scenes[scene]={title:scene==='centre'?'Centre of the room':'Entrance',type:'equirectangular',panorama:paths[scene],yaw:0,pitch:0,hfov:roomHfov(),hotSpots:[...sceneBranding(scene),...players.map((player,i)=>({id:'player-'+player.id,yaw:points[scene][i][0],pitch:points[scene][i][1],cssClass:'tour-hotspot',createTooltipFunc:playerHotspot,createTooltipArgs:{player,scene}})),{id:'floor-travel',yaw:scene==='entrance'?0:180,pitch:-24,cssClass:'tour-hotspot',createTooltipFunc:floorHotspot,createTooltipArgs:{target:scene==='entrance'?'centre':'entrance',label:scene==='entrance'?'Move to centre':'Return to entrance'}}]};
   viewer=window.pannellum.viewer(stage,{default:{firstScene:'entrance',autoLoad:true,showControls:false,showFullscreenCtrl:false,mouseZoom:'fullscreenonly',keyboardZoom:false,minHfov:45,maxHfov:110,minPitch:-65,maxPitch:65,sceneFadeDuration:reduced()?0:650,orientationOnByDefault:false,escapeHTML:true},scenes});
   viewer.on('zoomchange',resizeBrands);viewer.on('animatefinished',resizeBrands);viewer.on('load',()=>{loaded=true;brandLayers.splice(0,brandLayers.length,...brandLayers.filter(layer=>layer.el.isConnected));resizeBrands();stage.hidden=false;rosterVisible(false);sync();status.textContent=(viewer.getScene()==='centre'?'Centre of the room':'Entrance')+' · 17 public player stalls · Drag or swipe to explore.';if(pending)goToPlayer(pending.id,pending.focus);});
   viewer.on('error',fail);
  }catch{fail();}
 }
 room.addEventListener('hitmen-stalls-ready',start);if(room.getAttribute('aria-busy')==='false')start();
 window.HitmenPublicTour={goToPlayer,setView,openStall,closeStall:()=>closeup?.close(),getState:()=>({view:closeup?.isOpen()?'stall':'room',stallPlayerId:closeup?.getPlayerId()??null,loaded,scene:viewer?.getScene(),selectedId:players[selected]?.id??null,yaw:viewer?.getYaw(),pitch:viewer?.getPitch(),players:players.map(p=>p.id)})};
})();
