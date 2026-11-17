/* EliteChel Media LG3s public national lockers. Only verified main-roster
   players from the saved snapshot; read-only season stats from Supabase public views.
   The GB 3D entry stays isolated and unchanged. No unverified numbers or ratings. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const teamId=Number(params.get('team'));
const logo=id=>'assets/lg3s/team'+id+'.svg';
const jersey=id=>'assets/lg3s/jerseys/'+id+'.webp';
const room=id=>id===1446?'lg3s-team.html?team=1446&fallback=1':'lg3s-team.html?team='+id;
const API='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const kits={
 1446:['#102448','#cb2446','#ffffff'],
 341:['#111318','#e33440','#f4f4f4'],342:['#163a86','#ebebf0','#cb2438'],
 532:['#171717','#dfb134','#d72636'],343:['#123259','#f6cf39','#f2f2f2'],
 591:['#111316','#d7293e','#ebebeb'],822:['#176eb1','#f5f5f5','#d52940'],
 404:['#d32237','#faf6f4','#fff'],1439:['#812c3d','#f3f3f0','#fff'],
 1444:['#b02d42','#f5f1ef','#fff'],1079:['#1d5094','#f0edef','#d92a39'],
 531:['#218abf','#e6c334','#f8ebbf']
};
// Photo-style cutouts already include the reference chest graphics: never double-overlay crests.
const nationFlags={
 341:['🇨🇦','CAN'],342:['🇺🇸','USA'],1446:['🇬🇧','GBR'],
 532:['🇩🇪','GER'],343:['🇸🇪','SWE'],591:['🇯🇵','JPN'],
 822:['🇮🇹','ITA'],404:['🇨🇭','SUI'],1439:['🇱🇻','LVA'],
 1444:['🇵🇱','POL'],1079:['🇸🇰','SVK'],531:['🇰🇿','KAZ']
};
function renderNationRibbon(teams){
 const ribbon=$('nationRibbon');
 const order=[341,342,1446,532,343,591,822,404,1439,1444,1079,531];
 const sorted=[...teams].sort((a,b)=>order.indexOf(Number(a.lgTeamId))-order.indexOf(Number(b.lgTeamId)));
 ribbon.innerHTML=sorted.map(t=>{
  const id=Number(t.lgTeamId),flag=nationFlags[id]||['🏒','TEAM'];
  return '<a class="nation-tab'+(id===teamId?' is-active':'')+'" href="'+room(id)+'"'
   +(id===teamId?' aria-current="page"':'')
   +' aria-label="'+esc(t.teamName)+(' locker room')+'">'
   +'<span class="nation-flag" aria-hidden="true">'+flag[0]+'</span>'
   +'<b>'+flag[1]+'</b></a>';
 }).join('');
}
let players=[],latestSnapshot='',page=0;
const PAGE_SIZE=6;
function validPlayer(p){
 return p?.rosterStatus==='active'&&Number.isSafeInteger(Number(p.lgUserId))&&Number(p.lgUserId)>0;
}
function statCell(label,value){
 return '<span>'+esc(label)+'<b>'+esc(value==null?'—':value)+'</b></span>';
}
let fixture=null,nationName='',nationNames=new Map();
function monitor(count){
 const href=fixture?'lg3s-media.html#game/'+Number(fixture.lg_game_id):'lg3s-media.html#nation/'+teamId;
 const opponent=fixture&&nationNames.get(Number(fixture.home_lg_team_id)===teamId?Number(fixture.away_lg_team_id):Number(fixture.home_lg_team_id));
 const time=fixture&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(fixture.scheduled_at));
 return '<aside class="locker-monitor slots-'+count+'"><a href="'+href+'"><small>ECM · '+esc(nationName)+'</small><strong>'+esc(opponent?('vs. '+opponent):'Team coverage')+'</strong><span>'+esc(time||'Results & schedule')+'</span><b>'+ (opponent?'Game preview':'Open team desk')+' →</b></a></aside>';
}
async function loadNextGame(){
 const query=new URLSearchParams({select:'lg_game_id,home_lg_team_id,away_lg_team_id,scheduled_at',status:'eq.scheduled',scheduled_at:'gte.'+new Date().toISOString(),or:'(home_lg_team_id.eq.'+teamId+',away_lg_team_id.eq.'+teamId+')',order:'scheduled_at.asc',limit:'1'});
 try{
  const result=await fetch(API+'lg3s_public_games?'+query,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},signal:AbortSignal.timeout(8000)});
  if(!result.ok)return;
  const [game]=await result.json();
  if(game&&Number(game.lg_game_id)>0&&Date.parse(game.scheduled_at)>=Date.now()){
   fixture=game;render();
  }
 }catch{ /* The team desk remains available when the schedule feed is offline. */ }
}
// Fit the lettering to the brass plaque even when a stall is resized.
const lettering=document.createElement?.('canvas')?.getContext('2d');
function upperPlate(name){
 const label=name.toUpperCase();
 if(lettering)lettering.font='900 18px Arial';
 const width=Math.max(130,Math.ceil(lettering?.measureText(label).width||label.length*18)+8);
 return '<svg class="stall-gamertag" aria-hidden="true" viewBox="0 0 '+width+' 24"><text x="50%" y="18" text-anchor="middle">'+esc(label)+'</text></svg>';
}
function stallNumber(player,kind){
 let number=player.jerseyNumber;
 if(number==null){
  try{number=JSON.parse(localStorage.getItem('ecm-card-v1:lg3s:'+kind+':'+player.id))?.jersey;}catch{}
 }
 return /^\d{1,2}$/.test(String(number))?'#'+number:'';
}
function render(){
 const search=String($('roomSearch').value||'').trim().toLocaleLowerCase();
 const filtered=search?players.filter(p=>p.name.toLocaleLowerCase().includes(search)):players;
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 page=Math.max(0,Math.min(page,pageCount-1));
 $('roomPageStatus').textContent=filtered.length?'STALLS '+(page*PAGE_SIZE+1)+'–'+Math.min(filtered.length,(page+1)*PAGE_SIZE)+' OF '+filtered.length:'NO MATCHING PLAYERS';
 $('roomPrev').disabled=page===0;
 $('roomNext').disabled=page>=pageCount-1;
 $('roomPlayers').innerHTML=filtered.map((p,idx)=>{
  const kind=p.pos==='G'?'goalie':'skater';
  const card='player-cards.html?league=lg3s&id='+p.id+'&kind='+kind;
  const image=teamId===1446?'assets/lg3s/scene/gb-kit.webp':jersey(teamId);
  const crest=''; // Chest motif is already baked into the photoreal-style jersey image.
  const stats=p.stats;
  const second=kind==='goalie'?(stats?.sv_pct==null?'—':(Number(stats.sv_pct)<=1?Number(stats.sv_pct)*100:Number(stats.sv_pct)).toFixed(1)+'%'):(stats?.p??'—');
  const label=kind==='goalie'?'SV%':'PTS';
  const outOfPage=idx<page*PAGE_SIZE||idx>=(page+1)*PAGE_SIZE;
  return '<a class="stall"'+(outOfPage?' hidden':'')+' href="'+card+'" aria-label="Open '+esc(p.name)+' player card">'
    +upperPlate(p.name)
    +'<strong class="nameplate"><img src="'+logo(teamId)+'" alt="" loading="lazy"><span>'+stallNumber(p,kind)+'</span></strong>'
    +'<div class="locker-spotlight" aria-hidden="true"></div>'
    +'<div class="jersey-stage"><span class="jersey-hanger" aria-hidden="true"></span>'
    +'<img class="nation-jersey" src="'+image+'" alt="'+esc(p.team)+' inspired hockey jersey concept" loading="lazy" decoding="async">'
    +'<img class="jersey-fabric" src="assets/lg3s/jerseys/fabric-overlay.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">'+crest
    +'<small class="concept-tag">NATIONAL CONCEPT KIT · NOT OFFICIAL</small></div>'
    +'<div class="stall-info"><p>'+esc(p.pos)+' · '+(kind==='goalie'?'GOALTENDER':'SKATER')+' · MAIN ROSTER</p>'
    +'<div class="stats">'+statCell('SEASON GP',stats?.gp??'—')+statCell(label,second)+'</div>'
    +'<span class="open-card">VIEW / BUILD HOCKEY CARD →</span></div>'
    +'</a>';
 }).join('')||'<p class="note">'+(search?'No main-roster players match that search.':'No verified main-roster players in this snapshot.')+'</p>';
 const visible=Math.min(PAGE_SIZE,filtered.length-page*PAGE_SIZE);
 if(!search&&visible>0&&visible<PAGE_SIZE)$('roomPlayers').innerHTML+=monitor(visible);
 $('roomPlayers').setAttribute('aria-busy','false');
}
function fail(message){
 $('roomRecord').textContent=message;
 $('roomPlayers').textContent='The public main-roster snapshot could not be loaded.';
 $('roomPlayers').setAttribute('aria-busy','false');
}
async function loadStats(){
 const skaters=players.filter(p=>p.pos!=='G').map(p=>p.id);
 const goalies=players.filter(p=>p.pos==='G').map(p=>p.id);
 const requests=[];
 for(const [view,ids,fields] of [
  ['lg3s_public_skater_leaders',skaters,'lg_user_id,gp,p'],
  ['lg3s_public_goalie_leaders',goalies,'lg_user_id,gp,sv_pct']]){
  if(!ids.length)continue;
  const qs=new URLSearchParams({select:fields,lg_user_id:'in.('+ids.join(',')+')'});
  requests.push(fetch(API+view+'?'+qs.toString(),{
   headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store',signal:AbortSignal.timeout(12000)
  }).then(async response=>{
   if(!response.ok)throw Error(view+' '+response.status);
   const data=await response.json();
   if(!Array.isArray(data))throw Error('Invalid stats response');
   return data;
  }));
 }
 try{
  const outcomes=await Promise.allSettled(requests);
  const results=outcomes.filter(x=>x.status==='fulfilled').map(x=>x.value);
  const partial=outcomes.some(x=>x.status==='rejected');
  const map=new Map(results.flat().filter(x=>Number.isSafeInteger(Number(x.lg_user_id))).map(x=>[Number(x.lg_user_id),x]));
  players.forEach(p=>{p.stats=map.get(p.id)||null;});
  render();
  $('rosterNote').textContent='Main roster: verified snapshot '+latestSnapshot+'; Training Camp excluded. Season-wide GP and points/save percentages come from read-only public stats. Concept jerseys are not official uniforms. Jersey numbers are intentionally omitted until verified.'+(partial?' One or more stat feeds could not be loaded.':'');
 }catch(error){
  console.warn('LG3s optional player stats:',error);
  $('rosterNote').textContent='Main roster: saved snapshot '+latestSnapshot+'. Season stats are temporarily unavailable; no values were invented. Concept jerseys are not official uniforms.';
 }
}
async function start(){
 try{
  const response=await fetch('data/lg3s/season1-active-roster-2026-11-14.json',{cache:'no-cache'});
  if(!response.ok)throw Error('Main-roster snapshot '+response.status);
  const data=await response.json();
  if(data.league!=='lg3s'||data.season!==1||!Array.isArray(data.teams))throw Error('Invalid roster snapshot');
  const eligible=data.teams.filter(t=>Number.isSafeInteger(Number(t.lgTeamId))&&Number(t.lgTeamId)>0);
  $('roomTeam').innerHTML=eligible.map(t=>'<option value="'+Number(t.lgTeamId)+'"'+(Number(t.lgTeamId)===teamId?' selected':'')+'>'+esc(t.teamName)+'</option>').join('');
  $('roomTeam').addEventListener('change',()=>{location.href=room(Number($('roomTeam').value));});
  renderNationRibbon(eligible);
  const team=eligible.find(t=>Number(t.lgTeamId)===teamId);
  if(!team){$('roomName').textContent='Team not found';fail('Choose a nation from the LG3s desk.');return;}
  document.body.style.setProperty('--room-floor',teamId===341?'url(assets/lg3s/scene/canada-floor.webp)':'none');
  document.body.style.setProperty('--floor-overlay',teamId===341?'0':'1');
  $('roomLogo').src=logo(teamId);
  $('roomLogo').alt=team.teamName+' crest';
  $('roomName').textContent='TEAM '+team.teamName;
  for(const id of ['roomLogoMirror','roomBannerLeft','roomBannerRight','roomFloorCrest'])$(id).src=logo(teamId);
  $('roomSideName').textContent=team.teamName.toLocaleUpperCase();
  $('roomFloorName').textContent=team.teamName.toLocaleUpperCase();
  $('roomTeam').value=String(teamId);
  document.title=team.teamName+' LG3s Locker Room | EliteChel Media';
  $('nationCoverage').href='lg3s-media.html#nation/'+teamId;
  const kit=kits[teamId]||['#1b2738','#c8ad6b','#fff'];
  ['--kit-base','--kit-accent','--kit-trim'].forEach((name,i)=>document.body.style.setProperty(name,kit[i]));
  players=(team.players||[]).filter(validPlayer).map(p=>({id:Number(p.lgUserId),jerseyNumber:p.jerseyNumber,name:String(p.gamertag||'Unknown'),pos:String(p.position||''),team:team.teamName,stats:null}));
  nationName=team.teamName;
  nationNames=new Map(eligible.map(t=>[Number(t.lgTeamId),t.teamName]));
  latestSnapshot=String(data.capturedOn||'date not recorded');
  $('roomRecord').textContent=players.length+' main-roster players · Snapshot '+latestSnapshot;
  $('playersTitle').textContent='Main roster · '+players.length;
  $('rosterNote').textContent='Verified main roster snapshot '+latestSnapshot+'. Loading season statistics…';
  render();
  await Promise.all([loadStats(),loadNextGame()]);
 }catch(error){console.warn('LG3s public locker:',error);$('roomName').textContent='LG3s Team Locker';fail('Public roster snapshot unavailable.');}
}
if(teamId===1446&&params.get('fallback')!=='1'){location.replace('lg3s-gb-locker.html');return;}
$('roomSearch').addEventListener('input',()=>{page=0;render();});
$('roomPrev').addEventListener('click',()=>{if(page>0){page--;render();}});
$('roomNext').addEventListener('click',()=>{
 const filtered=String($('roomSearch').value||'').trim().toLocaleLowerCase();
 const count=filtered?players.filter(p=>p.name.toLocaleLowerCase().includes(filtered)).length:players.length;
 if((page+1)*PAGE_SIZE<count){page++;render();}
});
start();
})();
