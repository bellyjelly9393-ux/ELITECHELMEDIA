/* Generic public LG3s rooms. Reuse the existing 6s-stall visual pattern
   while keeping main-roster data and published-card claims evidence-based. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const teamId=Number(params.get('team'));
const LOGO=id=>'assets/lg3s/team'+id+'.svg';
const ROOM=id=>id===1446?'lg3s-gb-locker.html':id===591?'lg3s-japan-locker.html':'lg3s-team.html?team='+id;
const basic=window.ECMLG3SBasic;
let rows=[];
const sessionAppearance=new Map();
function render(){
 const q=String($('roomSearch').value||'').trim().toLocaleLowerCase();
 const filtered=q?rows.filter(p=>p.n.toLocaleLowerCase().includes(q)):rows;
 $('roomPlayers').innerHTML=filtered.map(p=>{
   const type=p.p==='G'?'goalie':'skater';
   const card='player-cards.html?league=lg3s&id='+Number(p.id)+'&kind='+type;
   const custom=sessionAppearance.get(p.id)||basic?.read(teamId,{id:p.id,gamertag:p.n})||{name:p.n,number:''};
   return '<a class="stall" href="'+card+'" aria-label="Open verified '+esc(p.n)+' hockey card profile">'
     +'<strong class="nameplate">'+esc(custom.name)+(custom.number!==''?'<span class="room-basic-number"> #'+esc(custom.number)+'</span>':'')+'</strong>'
     +'<div class="jersey-stage"><div class="concept-kit" role="img" aria-label="Generic non-official hockey jersey template with '+esc($('roomName').textContent)+' crest">'
     +'<img class="concept-crest" loading="lazy" alt="" src="'+LOGO(teamId)+'"></div><small class="concept-tag">CONCEPT JERSEY · NOT OFFICIAL</small></div>'
     +'<div class="stall-info"><p>'+esc(p.p)+' · MAIN ROSTER<small class="room-verified-name">Verified: '+esc(p.n)+'</small></p>'
     +'<div class="stats"><span>PLAYER<b>'+esc(type==='goalie'?'GOALIE':'SKATER')+'</b></span><span>SEASON<b>1</b></span></div>'
     +'<span class="open-card">VIEW / BUILD HOCKEY CARD →</span></div></a>';
 }).join('')||'<p class="note">'+(q?'No matching roster player.':'No public main-roster players in this snapshot.')+'</p>';
 $('roomPlayers').setAttribute('aria-busy','false');
}
/* Free local appearance editor. Official player identities and Hockey Cards stay immutable. */
function currentPlayer(){
 const id=Number($('roomCustomizePlayer').value);
 return rows.find(p=>p.id===id)||null;
}
function populateBasicEditor(){
 const player=currentPlayer();
 $('roomPlateName').disabled=!player;
 $('roomJerseyNumber').disabled=!player;
 $('roomSaveBasic').disabled=!player;
 $('roomResetBasic').disabled=!player;
 if(!player)return;
 const custom=sessionAppearance.get(player.id)||basic?.read(teamId,{id:player.id,gamertag:player.n})||{name:player.n.slice(0,18),number:''};
 $('roomPlateName').value=custom.name;
 $('roomJerseyNumber').value=custom.number;
 $('roomCustomizeStatus').textContent='Editing this browser\'s view of '+player.n+' (LeagueGaming #'+player.id+'). Official roster and Hockey Card remain unchanged.';
}
function configureBasicEditor(){
 if(!basic){
  $('roomCustomizeStatus').textContent='Basic personalization could not load. Official team stalls are still available.';
  return;
 }
 $('roomCustomizePlayer').innerHTML='<option value="">Choose a verified roster player</option>'+
  rows.map(p=>'<option value="'+p.id+'">'+esc(p.n)+' · '+esc(p.p)+'</option>').join('');
 $('roomCustomizePlayer').disabled=false;
 if(rows.length)$('roomCustomizePlayer').value=String(rows[0].id);
 populateBasicEditor();
}
function saveBasic(event){
 event.preventDefault();
 const player=currentPlayer();
 if(!player||!basic){$('roomCustomizeStatus').textContent='Choose a verified player before customizing.';return}
 const result=basic.save(teamId,{id:player.id,gamertag:player.n},
  $('roomPlateName').value,$('roomJerseyNumber').value);
 if(!result.ok){$('roomCustomizeStatus').textContent=result.reason;return}
 sessionAppearance.set(player.id,result.value);
 populateBasicEditor();render();
 $('roomCustomizeStatus').textContent=result.persisted
  ?'Saved on this browser. '+result.value.name+(result.value.number!==''?' #'+result.value.number:'')+' is cosmetic and not a verified player name or jersey assignment.'
  :'Preview updated, but browser storage is unavailable; changes are not saved.';
}
function resetBasic(){
 const player=currentPlayer();if(!player)return;
 const value=basic?.reset(teamId,{id:player.id,gamertag:player.n})||{name:player.n.slice(0,18),number:''};
 sessionAppearance.delete(player.id);
 populateBasicEditor();render();
 $('roomCustomizeStatus').textContent='This browser\'s appearance preference is reset. Verified identity: '+player.n+'.';
}
$('roomCustomizePlayer').addEventListener('change',populateBasicEditor);
$('roomCustomizeForm').addEventListener('submit',saveBasic);
$('roomResetBasic').addEventListener('click',resetBasic);
function fail(message){
 $('roomRecord').textContent=message;
 $('roomPlayers').textContent='The public roster cannot be loaded right now.';
 $('roomPlayers').setAttribute('aria-busy','false');
}
async function start(){
 try{
   const response=await fetch('data/lg3s/season1-active-roster-2026-11-14.json',{cache:'no-cache'});
   if(!response.ok)throw Error('Public roster fetch failed');
   const d=await response.json();
   if(d.league!=='lg3s'||d.season!==1||!Array.isArray(d.teams))throw Error('Invalid LG3s snapshot');
   const eligible=d.teams.filter(t=>Number.isSafeInteger(Number(t.lgTeamId)));
   $('roomTeam').innerHTML=eligible.map(t=>'<option value="'+Number(t.lgTeamId)+'"'+(Number(t.lgTeamId)===teamId?' selected':'')+'>'+esc(t.teamName)+'</option>').join('');
   $('roomTeam').addEventListener('change',()=>{location.href=ROOM(Number($('roomTeam').value));});
   const team=eligible.find(t=>Number(t.lgTeamId)===teamId);
   if(!team||!Number.isSafeInteger(teamId)||teamId<=0){$('roomName').textContent='Team not found';fail('Choose a nation from the LG3s coverage page.');return;}
   $('roomLogo').src=LOGO(teamId);
   $('roomLogo').alt=team.teamName+' team crest';
   $('roomName').textContent=team.teamName;
   $('roomTeam').value=String(teamId);
   document.title=team.teamName+' LG3s Locker Room | EliteChel Media';
   $('nationCoverage').href='lg3s-media.html#nation/'+teamId;
   rows=team.players.filter(p=>p.rosterStatus==='active'&&Number.isSafeInteger(Number(p.lgUserId))&&Number(p.lgUserId)>0).map(p=>({id:Number(p.lgUserId),n:p.gamertag,p:p.position}));
   const recordedDate=String(d.capturedOn||'source date not available');
   $('roomRecord').textContent=rows.length+' main-roster players · Snapshot '+recordedDate;
   $('playersTitle').textContent='Main roster · '+rows.length;
   $('rosterNote').textContent='Source: saved LG3s Season 1 main-roster snapshot, '+recordedDate+'. Training Camp excluded. Uniforms are generic concepts, not official designs. Cosmetic names and numbers are private browser choices, not official roster updates.';
   configureBasicEditor();
   render();
 }catch(e){console.warn('LG3s team room roster:',e);$('roomName').textContent='LG3s Team Room';fail('Main-roster snapshot temporarily unavailable.');}
}
if(teamId===1446&&params.get('fallback')!=='1'){location.replace('lg3s-gb-locker.html');return;}
if(teamId===591&&params.get('fallback')!=='1'){location.replace('lg3s-japan-locker.html');return;}
$('roomSearch').addEventListener('input',render);
start();
})();
