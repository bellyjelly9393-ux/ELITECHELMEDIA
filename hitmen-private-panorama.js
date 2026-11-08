/* Private room presentation only. Identities/permissions come from authorized rendered stalls.
   No private queries, copies to public storage, customization writes or access-rule changes. */
(()=>{'use strict';
if(document.body.dataset.room!=='locker'||!document.body.classList.contains('v3-locker-live'))return;
const app=document.getElementById('hqApp'),grid=document.getElementById('lockerRoster');if(!app||!grid)return;
const authorized=()=>!app.hidden&&window.HitmenTeamLocker?.hasAccess();
let shell=null,viewer=null,rows=[],selected=-1,signature='',epoch=0,loading=false,loaded=false;
const points=[-75,-66,-58,-50,-43,-36,-18,-9,0,9,18,36,43,50,58,66,75];
function resize(){if(!viewer||!shell)return;const focal=shell.querySelector('.wr-pano-stage').clientWidth/(2*Math.tan(viewer.getHfov()*Math.PI/360));shell.querySelectorAll('.wr-pano-stall').forEach(el=>el.style.width=(2*focal*Math.tan(5.1*Math.PI/180))+'px');const sign=shell.querySelector('.wr-pano-sign');if(sign)sign.style.width=(2*focal*Math.tan(18.5*Math.PI/180))+'px';}
window.addEventListener('resize',resize);
function clear(){epoch++;viewer?.destroy();viewer=null;shell?.remove();shell=null;rows=[];selected=-1;signature='';loading=false;loaded=false;}
function select(i){if(!authorized()||!rows[i]||!viewer)return false;selected=i;const p=rows[i];viewer.lookAt(-9,p.yaw,innerWidth<600?55:85,matchMedia('(prefers-reduced-motion: reduce)').matches?false:650);shell.querySelectorAll('.wr-pano-stall').forEach((el,j)=>el.classList.toggle('is-selected',i===j));shell.querySelector('.wr-pano-selected').textContent=p.name+(p.number?' · #'+p.number:'');const link=shell.querySelector('.wr-pano-open');link.hidden=!p.href;if(p.href)link.href=p.href;shell.querySelector('.wr-pano-status').textContent=p.href?'Stall selected. Open your existing private stall below.':'Team jersey preview. This account cannot open this player’s dossier.';return true;}
function hotspot(host,p){
 const button=document.createElement(p.href?'a':'button');if(p.href)button.href=p.href;else button.type='button';button.className='wr-pano-stall';button.setAttribute('aria-label',(p.href?'Open ':'Preview ')+p.name+' private stall');
 const crop=document.createElement('span');crop.className='wr-pano-jersey';crop.innerHTML='<img src="assets/hitmen-v3/locker-photo-master.webp?v=20261105-mobile-jersey-1" alt="" draggable="false">';
 const label=document.createElement('span');label.className='wr-pano-plate';label.title=p.name;label.textContent=p.name+(p.number?' / '+p.number:'');button.append(crop,label);button.addEventListener('click',()=>select(rows.indexOf(p)));host.append(button);
}
async function build(){
 if(!authorized()){clear();return;}
 const source=[...grid.querySelectorAll('.locker-stall')];if(!source.length){clear();return;}
 const next=source.map(el=>({name:el.querySelector('.stall-nameplate strong')?.textContent||'',number:(el.querySelector('.stall-name-num')?.textContent||'').replace(/\D/g,'').slice(0,2),href:el.tagName==='A'?el.getAttribute('href'):null}));
 const key=JSON.stringify(next);if(key===signature)return;
 clear();loading=true;signature=key;const token=epoch;
 rows=next.map((p,i)=>({...p,yaw:points[Math.round(i*16/Math.max(1,next.length-1))]||0}));
 shell=document.createElement('section');shell.className='wr-private-panorama';shell.setAttribute('aria-label','Private War Room panoramic locker room');
 shell.innerHTML='<div class="wr-pano-head"><div><small>PRIVATE · WAR ROOM</small><h2>Find your stall</h2></div><label>Player name<input class="wr-pano-search" type="search" placeholder="Find a team stall" maxlength="100"></label></div><ul class="wr-pano-results" aria-label="Matching private team stalls" hidden></ul><div class="wr-pano-stage" tabindex="0" aria-label="Private locker room. Drag or swipe to look around. Use arrow keys to turn."></div><div class="wr-pano-nav"><button type="button" data-turn="-30" aria-label="Look left">←</button><button type="button" data-turn="30" aria-label="Look right">→</button><strong class="wr-pano-selected">'+rows.length+' active roster stalls</strong><a class="wr-pano-open" hidden>Open private stall →</a></div><p class="wr-pano-status" role="status">Loading the private room…</p>';
 grid.before(shell);const current=shell;
 const input=shell.querySelector('input'),results=shell.querySelector('ul');
 const normal=v=>v.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
 input.addEventListener('input',()=>{results.replaceChildren();const q=normal(input.value);const matches=q?rows.filter(p=>normal(p.name).includes(q)):[];results.hidden=!matches.length;for(const p of matches){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=p.name;b.addEventListener('click',()=>{select(rows.indexOf(p));results.hidden=true;current.querySelector('.wr-pano-stage').focus();});li.append(b);results.append(li);}current.querySelector('.wr-pano-status').textContent=q&&!matches.length?'No matching active-roster stall. Training camp remains in its separate section.':rows.length+' active roster stalls. Select a name or explore the room.';});
 input.addEventListener('keydown',e=>{if(['Enter','ArrowDown'].includes(e.key)&&!results.hidden){e.preventDefault();const b=results.querySelector('button');if(e.key==='Enter')b?.click();else b?.focus();}if(e.key==='Escape'){results.hidden=true;input.focus();}});
 results.addEventListener('keydown',e=>{const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='Escape'){results.hidden=true;input.focus();}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
 current.querySelectorAll('[data-turn]').forEach(b=>b.addEventListener('click',()=>{if(authorized()&&viewer)viewer.setYaw(viewer.getYaw()+Number(b.dataset.turn),false);}));
 try{
  if(!window.pannellum)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/pannellum/pannellum.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
  if(token!==epoch||!authorized())return;
  viewer=window.pannellum.viewer(current.querySelector('.wr-pano-stage'),{type:'equirectangular',panorama:'assets/lgchl/room-360/entrance-gear-v7.png',autoLoad:true,showControls:false,showFullscreenCtrl:false,mouseZoom:'fullscreenonly',hfov:innerWidth<600?65:110,minHfov:45,maxHfov:110,minPitch:-60,maxPitch:60,hotSpots:rows.map(p=>({yaw:p.yaw,pitch:-7,cssClass:'wr-pano-anchor',createTooltipFunc:hotspot,createTooltipArgs:p})).concat([{yaw:0,pitch:11.5,cssClass:'wr-pano-anchor',createTooltipFunc:host=>{host.innerHTML='<div class="wr-pano-sign"><img src="assets/lgchl/s55/team412.png" alt=""><span>CALGARY HITMEN<small>PRIVATE WAR ROOM</small></span><img src="assets/brand/ecm-logo.webp" alt="Elite Chel Media"></div>';}}])});
  viewer.on('zoomchange',resize);viewer.on('animatefinished',resize);viewer.on('load',()=>{if(token!==epoch||!authorized())return;loading=false;loaded=true;resize();current.querySelector('.wr-pano-status').textContent='Drag or swipe to explore. Select a jersey to open its existing private stall, or search a name.';});
  viewer.on('error',()=>{if(token===epoch){loading=false;current.querySelector('.wr-pano-status').textContent='Room artwork unavailable. Your existing private stalls remain below.';}});
 }catch{if(token===epoch){loading=false;current.querySelector('.wr-pano-status').textContent='Panoramic view unavailable. Use your existing stalls below.';}}
}
const observer=new MutationObserver(()=>{if(!authorized())clear();else build();});observer.observe(grid,{childList:true});observer.observe(app,{attributes:true,attributeFilter:['hidden']});window.addEventListener('vvhl-auth-change',clear);build();
window.HitmenPrivatePanorama={find:name=>select(rows.findIndex(p=>p.name===name)),getState:()=>({count:rows.length,selected:selected>=0?rows[selected].name:null,active:Boolean(viewer),loaded,yaw:viewer?.getYaw()} )};
})();
