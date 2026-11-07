/* Public Calgary room only. Receives the same verified main roster as the stalls.
   No account, private locker, scouting, or identity-table reads. */
(()=>{'use strict';
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
// Alias fields may only come from the public roster, never a private identity lookup.
const names=p=>[p.gamertag,p.ea_alias,...(Array.isArray(p.ea_aliases)?p.ea_aliases:[])].filter(v=>typeof v==='string'&&v.trim());
const matches=(p,q)=>names(p).some(n=>normalize(n).includes(normalize(q)));
function create({input,room}){
 const label=input.closest('label');label.firstChild.textContent='Find My Stall ';
 input.placeholder='Search your roster name';input.disabled=true;
 input.setAttribute('aria-describedby','stallFinderHelp stallFinderStatus');
 const panel=document.createElement('div');panel.className='stall-finder';
 panel.innerHTML='<p id="stallFinderHelp" class="note">Search the 17 main-rostered Hitmen. Select a name to find their stall, then open the highlighted player card.</p><button type="button" class="stall-control" id="stallFinderClear" disabled>Clear search</button><p id="stallFinderStatus" class="note" role="status">Loading roster…</p><ul id="stallFinderResults" aria-label="Matching roster players" hidden></ul><nav aria-label="Explore player stalls"><button type="button" class="stall-control" id="stallFinderPrev" disabled>← Previous stall</button><button type="button" class="stall-control" id="stallFinderNext" disabled>Next stall →</button></nav>';
 room.before(panel);
 const get=id=>panel.querySelector('#'+id),status=get('stallFinderStatus'),results=get('stallFinderResults'),clear=get('stallFinderClear'),prev=get('stallFinderPrev'),next=get('stallFinderNext');
 let players=[],selected=-1;
 const stall=p=>document.getElementById('hitmen-stall-'+Number(p.lg_user_id));
 function buttons(){prev.disabled=selected<=0;next.disabled=!players.length||selected===players.length-1;}
 function choose(index){
  if(index<0||index>=players.length)return false;
  const p=players[index],target=stall(p);if(!target)return false;
  if(selected>=0){const old=stall(players[selected]);old?.classList.remove('is-found');old?.removeAttribute('aria-current');}
  selected=index;target.classList.add('is-found');target.setAttribute('aria-current','true');
  results.hidden=true;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.focus({preventScroll:true});target.scrollIntoView({behavior:reduced?'auto':'smooth',block:'center',inline:document.body.classList.contains('hitmen-concept')?'center':'nearest'});
  status.textContent=p.gamertag+' · Stall '+(index+1)+' of '+players.length+'. Press Enter or tap the stall to open the public player card.';
  buttons();
  // Future room scenes can consume this stable public identity and roster-order index.
  room.dispatchEvent(new CustomEvent('hitmen-stall-selected',{bubbles:true,detail:{lg_user_id:Number(p.lg_user_id),index,stallId:target.id}}));
  return true;
 }
 function search(){
  results.replaceChildren();clear.disabled=!input.value;
  const q=normalize(input.value);
  if(!q){results.hidden=true;status.textContent=players.length?players.length+' main-rostered players. Search a name or explore the stalls.':'No main-rostered players are available.';return;}
  const found=players.filter(p=>matches(p,input.value));
  status.textContent=found.length?found.length+' matching player'+(found.length===1?'':'s')+'. Select a name to find their stall.':'Not on this saved 17-player roster, or name not recognized. Try your LG roster name. Training camp and former players are excluded.';
  for(const p of found){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=p.gamertag+' · '+p.position;button.addEventListener('click',()=>choose(players.indexOf(p)));li.append(button);results.append(li);}
  results.hidden=!found.length;
 }
 input.addEventListener('input',search);
 input.addEventListener('keydown',e=>{
  if((e.key==='ArrowDown'||e.key==='Enter')&&!results.hidden){e.preventDefault();const first=results.querySelector('button');if(e.key==='Enter')first?.click();else first?.focus();}
  if(e.key==='Escape'){input.value='';search();}
 });
 results.addEventListener('keydown',e=>{
  const all=[...results.querySelectorAll('button')],i=all.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();all[(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length]?.focus();}
  if(e.key==='Escape'){results.hidden=true;input.focus();}
 });
 clear.addEventListener('click',()=>{input.value='';search();input.focus();});
 prev.addEventListener('click',()=>choose(selected-1));next.addEventListener('click',()=>choose(selected+1));
 return {
  setPlayers(rows){players=rows.slice();selected=-1;input.disabled=!players.length;search();buttons();room.dispatchEvent(new CustomEvent('hitmen-stalls-ready',{bubbles:true}));},
  unavailable(){players=[];selected=-1;input.disabled=true;clear.disabled=true;results.replaceChildren();results.hidden=true;buttons();status.textContent='The verified main roster is unavailable. Reload the page to try again.';room.dispatchEvent(new CustomEvent('hitmen-stalls-ready',{bubbles:true}));},
  focusStall(id){return choose(players.findIndex(p=>Number(p.lg_user_id)===Number(id)));}
 };
}
window.HitmenStallFinder={create,normalize,matches};
})();
