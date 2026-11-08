/* Opt-in 360 tour: public main-roster identities and public cards only. */
(()=>{'use strict';
 const params=new URLSearchParams(location.search);
 if(Number(params.get('team')||412)!==412||!(params.get('room')==='360'||document.body.dataset.roomTour==='true'))return;
 const room=document.getElementById('roomPlayers'),finder=window.HitmenPublicRoom;
 if(!room||!finder)return;
 document.body.classList.add('hitmen-tour');
 const shell=document.createElement('section');shell.className='tour-shell';shell.setAttribute('aria-label','Calgary Hitmen 360 degree public locker room');
 shell.innerHTML='<div class="tour-heading"><img src="assets/lgchl/s55/team412.png" alt=""><div><span>ELITE CHEL MEDIA · INTERACTIVE CONCEPT</span><h2>PUBLIC LOCKER ROOM</h2></div><b>360°</b></div><div class="tour-scene-tabs" aria-label="Room viewpoints"><button type="button" data-tour-scene="entrance" disabled>Entrance</button><button type="button" data-tour-scene="centre" disabled>Centre of the room</button><button type="button" id="tourReset" disabled>Reset view</button></div><div class="tour-look-controls" aria-label="Look around the room"><button type="button" data-tour-action="left" disabled>← Look left</button><button type="button" data-tour-action="right" disabled>Look right →</button><button type="button" data-tour-action="in" disabled>Zoom in +</button><button type="button" data-tour-action="out" disabled>Zoom out −</button><button type="button" data-tour-action="full" disabled>Full screen</button></div><div id="hitmenPanorama" tabindex="0" aria-label="360 degree room. Drag or swipe to look around. Arrow keys turn the view. Select a player hotspot to open their public card." aria-describedby="tourHelp"></div><div class="tour-caption"><p id="tourStatus" role="status">Loading the 360° room…</p><p id="tourHelp">Drag to look around · Swipe on phone · Floor arrows change viewpoint · Search above to find your stall</p></div><div class="tour-actions"><button type="button" id="tourPrevious" disabled>← Previous stall</button><a id="tourPlayerCard" hidden>Open public player card →</a><button type="button" id="tourNext" disabled>Next stall →</button><button type="button" id="tourRosterToggle" aria-expanded="true" aria-controls="roomPlayers">Hide roster cards</button></div>';
 room.before(shell);
 const $=id=>shell.querySelector('#'+id),stage=$('hitmenPanorama'),status=$('tourStatus');
 const sceneButtons=[...shell.querySelectorAll('[data-tour-scene]')],previous=$('tourPrevious'),next=$('tourNext'),card=$('tourPlayerCard'),toggle=$('tourRosterToggle'),reset=$('tourReset');
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let players=[],viewer=null,selected=-1,loaded=false,pending=null,started=false;
 // Coordinates are calibrated against the versioned artwork. Roster order binds identities.
 // No jersey numbers or private locker IDs are inferred from the generated environment.
 const points={
  centre:[[-143,4],[-126,4],[-110,4],[-94,4],[-80,4],[-65,4],[-36,1.4],[-18,1.4],[0,1.4],[18,1.4],[36,1.4],[65,4],[80,4],[95,4],[111,4],[127,4],[144,4]],
  entrance:[[-75,0],[-66,0],[-58,0],[-50,0],[-43,0],[-36,0],[-18,-1],[-9,-1],[0,-1],[9,-1],[18,-1],[36,0],[43,0],[50,0],[58,0],[66,0],[75,0]]
 };
 const paths={centre:'assets/lgchl/room-360/centre-branded-v1.png',entrance:'assets/lgchl/room-360/entrance-branded-v1.png'};
 function rosterVisible(show){room.hidden=!show;toggle.textContent=show?'Hide roster cards':'Show roster cards';toggle.setAttribute('aria-expanded',String(show));}
 toggle.addEventListener('click',()=>rosterVisible(room.hidden));
 function sync(){
  previous.disabled=!loaded||selected<=0;next.disabled=!loaded||!players.length||selected===players.length-1;
  shell.querySelectorAll('[data-tour-action]').forEach(b=>b.disabled=!loaded);sceneButtons.forEach(b=>{b.disabled=!loaded;b.setAttribute('aria-pressed',String(viewer?.getScene()===b.dataset.tourScene));});reset.disabled=!loaded;
  shell.querySelectorAll('.tour-player-button').forEach(b=>{const current=Number(b.dataset.playerId)===players[selected]?.id;b.classList.toggle('is-selected',current);if(current)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
  if(selected>=0){card.hidden=false;card.href=players[selected].href;card.textContent='Open '+players[selected].name+'’s public card →';}else card.hidden=true;
 }
 function fail(){loaded=false;status.textContent='The 360° room is unavailable on this device. Use the public roster cards below.';stage.hidden=true;rosterVisible(true);sync();}
 function goToPlayer(id,focus=true){
  const i=players.findIndex(p=>p.id===Number(id));if(i<0)return false;
  selected=i;pending={id:Number(id),focus};sync();
  if(!loaded)return true;
  const [yaw,pitch]=points[viewer.getScene()][i];pending=null;
  viewer.lookAt(pitch-10,yaw,window.innerWidth<600?55:85,reduced()?false:850,()=>{
   if(focus&&players[selected]?.id===Number(id)){const b=shell.querySelector('.tour-player-button[data-player-id="'+id+'"]');b?.focus({preventScroll:true});}
  });
  stage.focus({preventScroll:true});shell.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});
  status.textContent=players[i].name+' · Stall '+(i+1)+' of 17 · Select the highlighted name or use Open public player card.';
  return true;
 }
 function setView(scene){if(!viewer||!['entrance','centre'].includes(scene))return false;loaded=false;pending=null;selected=-1;sync();status.textContent='Moving to '+(scene==='centre'?'the centre of the room':'the entrance')+'…';viewer.loadScene(scene,-8,0,100);return true;}
 sceneButtons.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.tourScene)));
 shell.querySelectorAll('[data-tour-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.tourAction,duration=reduced()?false:450;if(a==='left'||a==='right')viewer.setYaw(viewer.getYaw()+(a==='left'?-30:30),duration);if(a==='in'||a==='out')viewer.setHfov(viewer.getHfov()+(a==='in'?-10:10),duration);if(a==='full')viewer.toggleFullscreen();}));
 reset.addEventListener('click',()=>{selected=-1;pending=null;viewer.lookAt(-8,0,100,reduced()?false:700);status.textContent='Look around the room or find your stall above.';sync();});
 previous.addEventListener('click',()=>finder.focusStall(players[selected-1]?.id));next.addEventListener('click',()=>finder.focusStall(players[selected+1]?.id));
 room.addEventListener('hitmen-stall-selected',e=>goToPlayer(e.detail.lg_user_id));
 function playerHotspot(host,{player}){
  const a=document.createElement('a');a.className='tour-player-button';a.dataset.playerId=player.id;a.href=player.href;a.textContent=player.name;a.setAttribute('aria-label','Open '+player.name+' public player card');host.append(a);
 }
 function floorHotspot(host,{target,label}){
  const button=document.createElement('button');button.type='button';button.className='tour-floor-arrow';button.innerHTML='<span aria-hidden="true">↑</span>';const text=document.createElement('small');text.textContent=label;button.append(text);button.setAttribute('aria-label',label);button.addEventListener('click',e=>{e.stopPropagation();setView(target);});host.append(button);
 }
 async function start(){
  if(started)return;
  const stalls=[...room.querySelectorAll('.stall[id]')];
  if(stalls.length!==17){status.textContent='The verified 17-player roster is unavailable. Please reload to try again.';stage.hidden=true;rosterVisible(true);return;}
  players=stalls.map(el=>({id:Number(el.id.replace('hitmen-stall-','')),name:el.querySelector('.nameplate').textContent,href:el.getAttribute('href')}));started=true;
  try{
   if(!window.pannellum){
    const css=document.createElement('link');css.rel='stylesheet';css.href='vendor/pannellum/pannellum.css';document.head.append(css);
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/pannellum/pannellum.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
   }
   const scenes={};
   for(const scene of ['entrance','centre'])scenes[scene]={title:scene==='centre'?'Centre of the room':'Entrance',type:'equirectangular',panorama:paths[scene],yaw:0,pitch:-8,hfov:100,hotSpots:[...players.map((player,i)=>({id:'player-'+player.id,yaw:points[scene][i][0],pitch:points[scene][i][1],cssClass:'tour-hotspot',createTooltipFunc:playerHotspot,createTooltipArgs:{player}})),{id:'floor-travel',yaw:scene==='entrance'?0:180,pitch:-30,cssClass:'tour-hotspot',createTooltipFunc:floorHotspot,createTooltipArgs:{target:scene==='entrance'?'centre':'entrance',label:scene==='entrance'?'Move to centre':'Return to entrance'}}]};
   viewer=window.pannellum.viewer(stage,{default:{firstScene:'entrance',autoLoad:true,showControls:false,showFullscreenCtrl:false,mouseZoom:'fullscreenonly',keyboardZoom:false,minHfov:45,maxHfov:110,minPitch:-65,maxPitch:65,sceneFadeDuration:reduced()?0:650,orientationOnByDefault:false,escapeHTML:true},scenes});
   viewer.on('load',()=>{loaded=true;stage.hidden=false;rosterVisible(false);sync();status.textContent=(viewer.getScene()==='centre'?'Centre of the room':'Entrance')+' · 17 public player stalls · Drag or swipe to explore.';if(pending)goToPlayer(pending.id,pending.focus);});
   viewer.on('error',fail);
  }catch{fail();}
 }
 room.addEventListener('hitmen-stalls-ready',start);if(room.getAttribute('aria-busy')==='false')start();
 window.HitmenPublicTour={goToPlayer,setView,getState:()=>({loaded,scene:viewer?.getScene(),selectedId:players[selected]?.id??null,yaw:viewer?.getYaw(),pitch:viewer?.getPitch(),players:players.map(p=>p.id)})};
})();
