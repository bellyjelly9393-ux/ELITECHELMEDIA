/* Japan LG3s 3D locker public shell.
   Roster remains accessible even when WebGL/Three.js CDN is unavailable.
   Player nameplate and number are cosmetic local-browser preferences only. */
(()=>{'use strict';
const TEAM=591;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE_PREFIX='ecm:lg3s:s1:japan:custom:v1:';
const api={teamId:TEAM,players:[],selected:null,previewNumber:'',previewName:'',ready:null,selectPlayer,getCustomization};
window.ECMJapanLocker=api;
for(const id of ['viewOverview','viewPlayer','rotateJersey'])$(id).disabled=true;
const cardHref=p=>'player-cards.html?league=lg3s&id='+p.id+'&kind='+(p.kind==='goalie'?'goalie':'skater');
const cleanName=x=>String(x??'').normalize('NFC').replace(/[\\u0000-\\u001f\\u007f]/g,'').replace(/\\s+/g,' ').trim().slice(0,18);
const cleanNumber=x=>{
 const n=String(x??'').trim();
 return n===''||/^[0-9]{1,2}$/.test(n)?n:null;
};
function getCustomization(id){
 const player=api.players.find(p=>p.id===Number(id));if(!player)return null;
 const fallback={name:player.gamertag.slice(0,18),number:''};
 try{
  const raw=window.localStorage?.getItem(STORAGE_PREFIX+player.id);
  if(!raw)return fallback;
  const saved=JSON.parse(raw);
  const name=cleanName(saved?.name);
  const number=cleanNumber(saved?.number);
  return{name:name||fallback.name,number:number===null?'':number};
 }catch{return fallback;}
}
function applyCustomization(player,custom){
 const value=custom||getCustomization(player.id);
 api.previewName=value.name;api.previewNumber=value.number;
 $('plateDisplayName').value=value.name;
 $('jerseyPreviewNumber').value=value.number;
 $('plateDisplayName').disabled=false;
 $('jerseyPreviewNumber').disabled=false;
 $('saveFreeCustomization').disabled=false;
 $('resetFreeCustomization').disabled=false;
 $('selectedId').textContent='LG player ID '+player.id+' · original gamertag: '+player.gamertag+' · uniform number unverified';
 $('numberPreviewStatus').textContent='Free cosmetic preview. Changes appear on this device only. Verified roster identity stays '+player.gamertag+'.';
}
function renderButtons(){
 const q=$('playerSearch').value.trim().toLocaleLowerCase();
 const players=api.players.filter(p=>!q||p.gamertag.toLocaleLowerCase().includes(q));
 $('rosterGrid').innerHTML=players.length?players.map(p=>
  '<button type="button" class="roster-button" aria-pressed="'+String(api.selected?.id===p.id)+'" data-player-id="'+p.id+'">'+
  '<img src="assets/lg3s/team591.svg" loading="lazy" alt=""><span><strong>'+escape(p.gamertag)+'</strong><small>'+escape(p.position)+' · '+(p.kind==='goalie'?'GOALTENDER':'SKATER')+' · MAIN ROSTER</small></span><span class="go" aria-hidden="true">↗</span></button>'
 ).join(''):'<p>No players match this search.</p>';
}
function selectPlayer(id){
 const player=api.players.find(p=>p.id===Number(id));
 if(!player)return;
 api.selected=player;
 $('inspectorTitle').textContent='PLAYER STALL';
 $('selectedPlayer').textContent=player.gamertag;
 $('selectedPosition').textContent=player.position+' · JAPAN · '+(player.kind==='goalie'?'GOALTENDER':'SKATER');
 $('playerCardLink').href=cardHref(player);
 $('playerCardLink').textContent='Open '+player.gamertag+' Hockey Card →';
 applyCustomization(player);
 renderButtons();
 const url=new URL(location.href);url.searchParams.set('player',String(player.id));
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 window.dispatchEvent(new CustomEvent('ecm-japan-player-select',{detail:{player}}));
}
function saveCustomization(event){
 event.preventDefault();
 const player=api.selected;
 if(!player){$('numberPreviewStatus').textContent='Select a verified roster player before saving.';return;}
 const rawName=$('plateDisplayName').value;
 const cleaned=cleanName(rawName);
 const number=cleanNumber($('jerseyPreviewNumber').value);
 if(!cleaned){$('numberPreviewStatus').textContent='Enter at least one character for the nameplate.';return;}
 if(number===null){$('numberPreviewStatus').textContent='Jersey number must be blank or 0 to 99.';return;}
 const customize={name:cleaned,number};
 let saved=false;
 try{
  window.localStorage?.setItem(STORAGE_PREFIX+player.id,JSON.stringify(customize));
  saved=window.localStorage?.getItem(STORAGE_PREFIX+player.id)!==null;
 }catch{}
 applyCustomization(player,customize);
 window.dispatchEvent(new CustomEvent('ecm-japan-customization-change',{detail:{playerId:player.id,customize}}));
 $('numberPreviewStatus').textContent=saved
  ?'Saved for this browser only. Your chosen plate reads '+cleaned+(number?' · #'+number:'')+'. Official roster identity unchanged.'
  :'Preview applied, but this browser blocked saving. Your appearance may reset after closing the page.';
}
function resetCustomization(){
 const player=api.selected;if(!player)return;
 try{window.localStorage?.removeItem(STORAGE_PREFIX+player.id)}catch{}
 const defaults={name:player.gamertag.slice(0,18),number:''};
 applyCustomization(player,defaults);
 window.dispatchEvent(new CustomEvent('ecm-japan-customization-change',{detail:{playerId:player.id,customize:defaults}}));
 $('numberPreviewStatus').textContent='This browser\'s nameplate and number preference has been reset. Verified identity unchanged.';
}
$('playerSearch').addEventListener('input',renderButtons);
$('rosterGrid').addEventListener('click',event=>{
 const el=event.target.closest('button[data-player-id]');if(el)selectPlayer(el.dataset.playerId);
});
$('freeCustomizeForm').addEventListener('submit',saveCustomization);
$('resetFreeCustomization').addEventListener('click',resetCustomization);
api.ready=(async()=>{
 try{
  const res=await fetch('data/lg3s/season1-active-roster-2026-11-14.json',{cache:'no-cache'});
  if(!res.ok)throw Error('Roster HTTP '+res.status);
  const snapshot=await res.json();
  if(snapshot.league!=='lg3s'||snapshot.season!==1||!Array.isArray(snapshot.teams))throw Error('Roster schema mismatch');
  const japan=snapshot.teams.find(t=>Number(t.lgTeamId)===TEAM&&t.teamName==='Japan');
  if(!japan||!Array.isArray(japan.players))throw Error('Japan team missing from roster snapshot');
  const seen=new Set();
  api.players=japan.players.filter(p=>p.rosterStatus==='active'&&Number.isSafeInteger(Number(p.lgUserId))&&Number(p.lgUserId)>0)
   .filter(p=>{const id=Number(p.lgUserId);if(seen.has(id))return false;seen.add(id);return true})
   .map(p=>({id:Number(p.lgUserId),gamertag:String(p.gamertag),position:String(p.position||'Player'),kind:p.playerKind==='goalie'?'goalie':'skater',number:null}));
  $('rosterStatus').textContent=api.players.length+' main-roster players · LeagueGaming snapshot '+snapshot.capturedOn+' · Training Camp excluded · Jersey numbers unverified.';
  renderButtons();
  const requested=Number(new URLSearchParams(location.search).get('player'));
  if(Number.isSafeInteger(requested)&&requested>0)selectPlayer(requested);
  return api.players;
 }catch(error){
  $('rosterStatus').textContent='The verified roster cannot be loaded. No player identities are being invented.';
  $('rosterGrid').innerHTML='<p>Use the <a href="lg3s-team.html?team=591&amp;fallback=1">Japan 2D team room</a> as a fallback.</p>';
  $('sceneStatus').textContent='3D room paused because source roster verification failed.';
  console.warn('Japan locker roster:',error);
  throw error;
 }
})();
// Graceful fallback if the external Three.js module cannot start.
setTimeout(()=>{
 if(document.getElementById('japanScene')?.dataset.ready!=='true'
    && document.getElementById('sceneStatus')?.textContent?.startsWith('Connecting')){
   document.getElementById('sceneStatus').textContent='The 3D engine is unavailable or still loading. The accessible verified roster below remains usable.';
 }
},13000);
})();
