/* Generic public LG3s rooms. Reuse the existing 6s-stall visual pattern
   while keeping main-roster data and published-card claims evidence-based. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const teamId=Number(params.get('team'));
const LOGO=id=>'assets/lg3s/team'+id+'.svg';
const ROOM=id=>id===1446?'lg3s-gb-locker.html':id===591?'lg3s-japan-locker.html':'lg3s-team.html?team='+id;
let rows=[];
function render(){
 const q=String($('roomSearch').value||'').trim().toLocaleLowerCase();
 const filtered=q?rows.filter(p=>p.n.toLocaleLowerCase().includes(q)):rows;
 $('roomPlayers').innerHTML=filtered.map(p=>{
   const type=p.p==='G'?'goalie':'skater';
   const card='player-cards.html?league=lg3s&id='+Number(p.id)+'&kind='+type;
   return '<a class="stall" href="'+card+'" aria-label="Open '+esc(p.n)+' hockey card profile">'
     +'<strong class="nameplate">'+esc(p.n)+'</strong>'
     +'<div class="jersey-stage"><div class="concept-kit" role="img" aria-label="Generic non-official hockey jersey template with '+esc($('roomName').textContent)+' crest">'
     +'<img class="concept-crest" loading="lazy" alt="" src="'+LOGO(teamId)+'"></div><small class="concept-tag">CONCEPT JERSEY · NOT OFFICIAL</small></div>'
     +'<div class="stall-info"><p>'+esc(p.p)+' · MAIN ROSTER</p>'
     +'<div class="stats"><span>PLAYER<b>'+esc(type==='goalie'?'GOALIE':'SKATER')+'</b></span><span>SEASON<b>1</b></span></div>'
     +'<span class="open-card">VIEW / BUILD HOCKEY CARD →</span></div></a>';
 }).join('')||'<p class="note">'+(q?'No matching roster player.':'No public main-roster players in this snapshot.')+'</p>';
 $('roomPlayers').setAttribute('aria-busy','false');
}
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
   $('rosterNote').textContent='Source: saved LG3s Season 1 main-roster snapshot, '+recordedDate+'. Training Camp excluded. Uniforms are generic concepts, not official designs. Statistics are not invented; open a player card for available verified data.';
   render();
 }catch(e){console.warn('LG3s team room roster:',e);$('roomName').textContent='LG3s Team Room';fail('Main-roster snapshot temporarily unavailable.');}
}
if(teamId===1446&&params.get('fallback')!=='1'){location.replace('lg3s-gb-locker.html');return;}
if(teamId===591&&params.get('fallback')!=='1'){location.replace('lg3s-japan-locker.html');return;}
$('roomSearch').addEventListener('input',render);
start();
})();
