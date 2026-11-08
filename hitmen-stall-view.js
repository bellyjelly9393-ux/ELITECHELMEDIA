/* Dedicated public stall level. Identity comes only from the verified room roster. */
(()=>{'use strict';
 function create({after,onClose,onPlayerChange}){
  const panel=document.createElement('section');panel.className='public-stall-view';panel.hidden=true;panel.setAttribute('aria-label','Player stall close-up');
  panel.innerHTML='<div class="stall-level-toolbar"><button type="button" class="stall-return">← Back to room</button><div class="stall-level-nav"><button type="button" class="stall-prev" aria-label="Previous player stall">←</button><span class="stall-level-count"></span><button type="button" class="stall-next" aria-label="Next player stall">→</button></div><a class="stall-public-card">Player card ↗</a></div><figure class="stall-closeup-art" aria-busy="false"><img class="stall-master" alt="Detailed red-lit player locker with sticks, gloves and a towel"><div class="stall-closeup-header" aria-hidden="true"><small>CALGARY</small><strong>HITMEN</strong></div><img class="stall-corner-crest left" src="assets/lgchl/room-360/hitmen-crest-vector.svg" alt=""><img class="stall-corner-crest right" src="assets/lgchl/room-360/hitmen-crest-vector.svg" alt=""><span class="stall-closeup-position" aria-hidden="true"></span><strong class="stall-closeup-name" aria-hidden="true"></strong><img class="stall-closeup-jersey" src="assets/lgchl/jerseys/team412.webp" alt="Black Calgary Hitmen jersey with the skull crest and copper, red and white trim"><img class="stall-closeup-publisher" src="assets/brand/ecm-logo.webp" alt="Elite Chel Media"></figure><div class="stall-level-caption"><h2 class="stall-level-name"></h2><span class="stall-level-position"></span><p class="stall-image-status" role="status"></p></div>';
  after.after(panel);
  const get=selector=>panel.querySelector(selector),image=get('.stall-master'),art=get('.stall-closeup-art'),back=get('.stall-return'),prev=get('.stall-prev'),next=get('.stall-next'),card=get('.stall-public-card'),status=get('.stall-image-status');
  let players=[],index=-1,trigger=null,jerseyFailed=false;
  const jersey=get('.stall-closeup-jersey');jersey.addEventListener('error',()=>{jerseyFailed=true;art.classList.add('jersey-unavailable');status.textContent='The jersey image is unavailable. You can return to the room or open the public player card.';});
  function render(){
   const p=players[index];if(!p)return;
   panel.dataset.playerId=p.id;
   get('.stall-closeup-name').textContent=p.name;
   get('.stall-closeup-position').textContent=p.position;
   get('.stall-level-name').textContent=p.name;
   get('.stall-level-position').textContent=p.position+' · Calgary Hitmen · Main roster';
   get('.stall-level-count').textContent=(index+1)+' / '+players.length;
   card.href=p.href;card.setAttribute('aria-label','Open '+p.name+' public player card');
   art.setAttribute('aria-label',p.name+' public locker stall. Position '+p.position+'. No jersey number assigned.');
   prev.disabled=index<=0;next.disabled=index===players.length-1;
  }
  function choose(i){if(i<0||i>=players.length)return false;index=i;render();onPlayerChange?.(players[index].id);return true;}
  function open(id,source){const i=players.findIndex(p=>p.id===Number(id));if(i<0)return false;index=i;trigger=source||document.activeElement;panel.hidden=false;render();
   if(!image.getAttribute('src')){art.setAttribute('aria-busy','true');status.textContent='Loading stall image…';image.src='assets/lgchl/room-360/stall-empty-v5.png';}
   back.focus({preventScroll:true});panel.scrollIntoView({behavior:'auto',block:'start'});return true;
  }
  function close(){if(panel.hidden)return;const id=players[index]?.id;panel.hidden=true;onClose?.({id,trigger});}
  image.addEventListener('load',()=>{art.setAttribute('aria-busy','false');art.classList.add('is-loaded');status.textContent=jerseyFailed?'The jersey image is unavailable. You can return to the room or open the public player card.':'';});
  image.addEventListener('error',()=>{art.setAttribute('aria-busy','false');art.classList.add('image-unavailable');status.textContent='The stall image is unavailable. You can return to the room or open the public player card.';});
  back.addEventListener('click',close);prev.addEventListener('click',()=>choose(index-1));next.addEventListener('click',()=>choose(index+1));
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  return {setPlayers(rows){players=rows.slice();},open,close,choosePlayer(id){return choose(players.findIndex(p=>p.id===Number(id)));},isOpen:()=>!panel.hidden,getPlayerId:()=>players[index]?.id??null};
 }
 window.HitmenStallView={create};
})();
