/* Japan LG3s 3D locker public shell.
   Roster remains accessible even when WebGL/Three.js CDN is unavailable.
   No player jersey numbers are inferred or persisted. */
(()=>{'use strict';
const TEAM=591;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api={teamId:TEAM,players:[],selected:null,previewNumber:'',ready:null,selectPlayer,updatePreviewNumber};
window.ECMJapanLocker=api;
for(const id of ['viewOverview','viewPlayer','rotateJersey'])$(id).disabled=true;
const cardHref=p=>'player-cards.html?league=lg3s&id='+p.id+'&kind='+(p.kind==='goalie'?'goalie':'skater');
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
 if(api.selected&&api.selected.id!==player.id&&api.previewNumber)updatePreviewNumber('');
 api.selected=player;
 $('inspectorTitle').textContent='PLAYER STALL';
 $('selectedPlayer').textContent=player.gamertag;
 $('selectedId').textContent='LG player ID '+player.id+' · official jersey number unverified';
 $('selectedPosition').textContent=player.position+' · JAPAN · '+(player.kind==='goalie'?'GOALTENDER':'SKATER');
 $('playerCardLink').href=cardHref(player);
 $('playerCardLink').textContent='Open '+player.gamertag+' Hockey Card →';
 renderButtons();
 const url=new URL(location.href);url.searchParams.set('player',String(player.id));
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 window.dispatchEvent(new CustomEvent('ecm-japan-player-select',{detail:{player}}));
}
function updatePreviewNumber(next){
 const text=String(next??'').trim();
 if(text&&!/^[0-9]{1,2}$/.test(text)){
  $('numberPreviewStatus').textContent='Enter a whole number from 0 to 99. Nothing is saved.';
  $('jerseyPreviewNumber').value=api.previewNumber;
  return;
 }
 api.previewNumber=text;
 $('jerseyPreviewNumber').value=text;
 $('numberPreviewStatus').textContent=text?
  'Preview #'+text+' applied visually. This is NOT the player\'s official jersey number and is NOT saved.':
  'Jersey number unassigned. Nothing is stored, assigned, or claimed as official.';
 window.dispatchEvent(new CustomEvent('ecm-japan-number-preview',{detail:{number:text}}));
}
$('playerSearch').addEventListener('input',renderButtons);
$('rosterGrid').addEventListener('click',event=>{
 const el=event.target.closest('button[data-player-id]');if(el)selectPlayer(el.dataset.playerId);
});
$('jerseyPreviewNumber').addEventListener('change',event=>updatePreviewNumber(event.target.value));
$('clearPreview').addEventListener('click',()=>updatePreviewNumber(''));
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
