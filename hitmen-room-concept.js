/* Opt-in public room preview. Moves the existing public stalls; no extra data reads. */
(()=>{'use strict';
 const params=new URLSearchParams(location.search);
 if(Number(params.get('team')||412)!==412||!(params.get('room')==='concept'||document.body.dataset.roomConcept==='true'))return;
 const room=document.getElementById('roomPlayers');if(!room||!window.HitmenPublicRoom)return;
 document.body.classList.add('hitmen-concept');
 const heading=document.querySelector('[aria-labelledby="playersTitle"]');heading.classList.add('concept-section');
 const intro=document.createElement('div');intro.className='concept-intro';
 intro.innerHTML='<div><span class="concept-kicker">PUBLIC LOCKER ROOM · CONCEPT PREVIEW</span><h2>THIS IS OUR ROOM.</h2><p>Seventeen players. One identity. Take a look around.</p></div><a class="concept-list-link" href="lgchl-team.html?team=412">View roster layout ↗</a>';
 heading.prepend(intro);
 const finder=document.querySelector('.stall-finder');finder.classList.add('concept-finder');
 const label=document.getElementById('roomSearch').closest('label');finder.prepend(label);
 const help=document.getElementById('stallFinderHelp');help.textContent='Find your LG roster name, then travel to your stall. Open the jersey for your public player card.';
 const frame=document.createElement('div');frame.className='concept-room';frame.setAttribute('aria-label','Calgary Hitmen interactive public locker room');
 room.before(frame);
 frame.innerHTML='<div class="concept-ceiling" aria-hidden="true"><i></i><i></i><i></i></div><div class="concept-room-sign"><img src="assets/lgchl/s55/team412.png" alt=""><div><span>CALGARY</span><strong>HITMEN</strong></div><small>LGCHL<br>SEASON 55</small></div><div class="concept-viewport"></div><div class="concept-floor" aria-hidden="true"><div class="concept-floor-mark"><img src="assets/lgchl/s55/team412.png" alt=""><span>CALGARY HITMEN</span></div></div><div class="concept-room-controls"><button class="concept-arrow" type="button" id="conceptLeft" aria-label="Look left to the previous player stall" disabled>←</button><div><span id="conceptRoomPosition" role="status">Loading the room…</span><small>Use arrows, swipe, or search your name</small></div><button class="concept-arrow" type="button" id="conceptRight" aria-label="Look right to the next player stall" disabled>→</button></div>';
 frame.querySelector('.concept-viewport').append(room);
 room.setAttribute('aria-label','Player stalls. Swipe or use left and right arrow keys to explore.');
 room.setAttribute('tabindex','0');
 const left=document.getElementById('conceptLeft'),right=document.getElementById('conceptRight'),position=document.getElementById('conceptRoomPosition');
 let stalls=[],index=0;
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const playerName=i=>stalls[i]?.querySelector('.nameplate')?.textContent||'';
 function sync(){left.disabled=!stalls.length||index===0;right.disabled=!stalls.length||index===stalls.length-1;position.textContent=stalls.length?playerName(index)+' · '+(index+1)+' / '+stalls.length:'The room is unavailable';}
 function nearest(){
  if(!stalls.length)return;
  const center=room.getBoundingClientRect().left+room.clientWidth/2;
  let best=Infinity;stalls.forEach((el,i)=>{const b=el.getBoundingClientRect(),d=Math.abs(b.left+b.width/2-center);if(d<best){best=d;index=i;}});sync();
 }
 function move(delta){const next=Math.min(stalls.length-1,Math.max(0,index+delta));if(!stalls.length||next===index)return;window.HitmenPublicRoom.focusStall(Number(stalls[next].id.replace('hitmen-stall-','')));}
 left.addEventListener('click',()=>move(-1));right.addEventListener('click',()=>move(1));
 room.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}if(e.key==='Home'||e.key==='End'){e.preventDefault();move((e.key==='Home'?0:stalls.length-1)-index);}});
 room.addEventListener('scrollend',nearest);
 room.addEventListener('hitmen-stall-selected',e=>{index=e.detail.index;sync();});
 function ready(){stalls=[...room.querySelectorAll('.stall')];index=Math.min(8,Math.max(0,stalls.length-1));sync();if(stalls.length){const b=stalls[index].getBoundingClientRect(),r=room.getBoundingClientRect();room.scrollTo({left:room.scrollLeft+b.left-r.left-(room.clientWidth-b.width)/2,behavior:'instant'});}}
 room.addEventListener('hitmen-stalls-ready',ready);
 // The data may have arrived before this deferred preview script executes.
 if(room.getAttribute('aria-busy')==='false')ready();
 // Keep the view centered after a responsive resize without shifting keyboard focus.
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(stalls[index])stalls[index].scrollIntoView({behavior:reduced()?'auto':'smooth',block:'nearest',inline:'center'});},120);});
})();
