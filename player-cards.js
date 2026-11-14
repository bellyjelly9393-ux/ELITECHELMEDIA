/* Elitechel 3D Player Cards: public league stats + private device-only customization.
   No write access to league records, profile identities, or published player images. */
(()=>{'use strict';
const API='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
let league=params.get('league')==='lg3s'?'lg3s':'lgchl';
let all=[],visible=[],current=null,req=0;
let ratingCache=new Map();
let portraitData='';let uploadRevision=0;
const BACKGROUNDS=['arena','heat','city','locker','playoff','storm','classic'];

function getBackground(){const selected=document.querySelector('input[name="cardBackground"]:checked');return selected&&BACKGROUNDS.includes(selected.value)?selected.value:'arena';}
function setBackground(value){const valid=BACKGROUNDS.includes(value)?value:'arena';document.querySelectorAll('input[name="cardBackground"]').forEach(r=>{r.checked=r.value===valid;});}
function earnedStyle(){
 const ovr=rating().overall;
 if(ovr==null)return {finish:'ice',edition:'season',label:'Finish pending · unrated'};
 if(ovr>=90)return {finish:'gold',edition:'gold',label:'Championship Gold · 90+ OVR'};
 if(ovr>=80)return {finish:'ice',edition:'silver',label:'Ice Chrome · 80–89 OVR'};
 return {finish:'crimson',edition:'base',label:'Crimson Steel · below 80 OVR'};
}
function getEdition(){return earnedStyle().edition;}
const blank='--';
const asNum=v=>(v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v)))?Number(v):null;
const fmt=v=>asNum(v)===null?blank:String(asNum(v));
const pc=v=>{let n=asNum(v);return n===null?blank:(n<=1?n*100:n).toFixed(1)+'%';};
const fixed=v=>asNum(v)===null?blank:Number(v).toFixed(2);
const norm=(p,kind)=>league==='lg3s'?{
 id:String(p.lg_user_id),kind,tag:p.gamertag||'Unknown',team:kind==='goalie'?(Array.isArray(p.nations_played_for)?p.nations_played_for.join(' / '):p.nation||''):p.nation||'',pos:p.position||p.primary_position||kind.toUpperCase(),gp:p.gp,
 goals:p.g,assists:p.a,points:p.p,wins:p.wins,sv:p.sv_pct,gaa:p.gaa_per_game
}:{teamId:p.lg_team_id,updated:p.fetched_at||null,id:String(p.lg_user_id),kind:p.player_kind==='goalie'?'goalie':'skater',tag:p.gamertag||'Unknown',team:p.team_name||'',pos:p.position||p.primary_position||'',gp:p.gp,goals:p.goals,assists:p.assists,points:p.points,wins:p.wins,sv:p.save_pct,gaa:p.gaa};
function key(){return current?'ecm-card-v1:'+league+':'+current.kind+':'+current.id:'';}
async function read(table){const data=[];for(let n=0;n<30;n++){const q=new URLSearchParams({select:'*',order:'lg_user_id.asc,gamertag.asc',offset:String(n*500),limit:'500'});const res=await fetch(API+table+'?'+q,{headers:{apikey:KEY},cache:'no-store',signal:AbortSignal.timeout(18000)});if(!res.ok)throw new Error('League feed '+res.status);const chunk=await res.json();data.push(...chunk);if(chunk.length<500)break;}return data;}
async function readRatingRows(){const rows=[];for(let n=0;n<30;n++){const q=new URLSearchParams({select:'lg_user_id,player_kind,gamertag,position,lg_team_id,games_played,stats,fetched_at',lg_league_id:'eq.39',season:'eq.55',season_type:'eq.regular',order:'lg_user_id.asc,player_kind.asc,gamertag.asc',offset:String(n*500),limit:'500'});const res=await fetch(API+'lg_player_season_stats?'+q,{headers:{apikey:KEY},cache:'no-store',signal:AbortSignal.timeout(18000)});if(!res.ok)throw Error('Detailed rating feed '+res.status);const chunk=await res.json();rows.push(...chunk);if(chunk.length<500)return rows;}throw Error('Detailed feed exceeded the pagination limit');}
function rating(){const key=current?current.kind+':'+current.id:'none';if(!ratingCache.has(key))ratingCache.set(key,window.ECMRating.assess(current,all,{league}));return ratingCache.get(key);}
function displayedOverall(){return rating().overall??'';}
function attachDetailed(rows,raw){const teamNames=new Map(rows.filter(p=>p.teamId&&p.team).map(p=>[Number(p.teamId),p.team]));const latest=new Map();for(const p of raw){if(!p.lg_user_id||p.stats?.current_source_missing)continue;const key=p.player_kind+':'+p.lg_user_id,old=latest.get(key);if(old&&old.fetched_at===p.fetched_at&&JSON.stringify(old)!==JSON.stringify(p))throw Error('Conflicting source records for one LG ID');if(!old||Date.parse(p.fetched_at)>Date.parse(old.fetched_at))latest.set(key,p);}if(!latest.size)return rows;return [...latest.values()].map(p=>{const s=p.stats||{},goalie=p.player_kind==='goalie';return {id:String(p.lg_user_id),kind:p.player_kind,tag:p.gamertag,teamId:p.lg_team_id,team:teamNames.get(Number(p.lg_team_id))||'',pos:goalie?'G':p.position,gp:p.games_played,goals:s.goals??null,assists:s.assists??null,points:s.points??null,wins:s.wins??(typeof s.record==='string'?Number(s.record.split('-')[0]):null),sv:s.savep??null,gaa:s.gaa??null,updated:p.fetched_at,ratingStats:s};});}

/* Official LG3s main roster snapshot fills verified player identities missing from
   stats leaderboards (e.g. players with no published games). This is not a stats
   source and never invents games played, ratings, jersey numbers or card artwork.
   Preserve all existing league leaders, including non-rostered players. */
async function supplementLG3sRosterRows(rows){
 try{
  const response=await fetch('data/lg3s/season1-active-roster-2026-11-14.json',{cache:'no-cache',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return rows;
  const data=await response.json();
  if(data?.schemaVersion!==1||data.league!=='lg3s'||data.leagueId!==154||
     data.season!==1||data.scope!=='official-current-main-roster-only-excludes-training-camp'||
     !Array.isArray(data.teams)||data.teams.length!==12)return rows;
  const seen=new Set(rows.map(p=>p.kind+':'+p.id));
  const extras=[];
  for(const team of data.teams){
   if(!team||!Number.isSafeInteger(team.lgTeamId)||typeof team.teamName!=='string'||!Array.isArray(team.players))continue;
   for(const p of team.players){
    if(!p||p.rosterStatus!=='active'||typeof p.lgUserId!=='string'||!/^[1-9][0-9]{0,19}$/.test(p.lgUserId)||
       typeof p.gamertag!=='string'||!p.gamertag.trim()||
       !['C','LW','RW','F','LD','RD','D','G'].includes(p.position))continue;
    const kind=p.position==='G'?'goalie':'skater',key=kind+':'+p.lgUserId;
    if(p.playerKind!==kind||seen.has(key))continue;
    seen.add(key);
    extras.push({
     id:p.lgUserId,kind,tag:p.gamertag,team:team.teamName,teamId:team.lgTeamId,pos:p.position,
     gp:null,goals:null,assists:null,points:null,wins:null,sv:null,gaa:null,
     rosterOnly:true,rosterCapturedOn:data.capturedOn
    });
   }
  }
  return [...rows,...extras];
 }catch(error){console.warn('Optional LG3s main roster fallback unavailable:',error.message);return rows;}
}
async function load(){const i=++req;uploadRevision++;ratingCache=new Map();all=[];current=null;loadPersonal();render();window.dispatchEvent(new Event('ecm:card-selected'));$('league').value=league;$('player').innerHTML='';$('player').add(new Option('Loading verified players…',''));$('feedStatus').textContent='Loading public league records…';
try{let rows;if(league==='lg3s'){const [s,g]=await Promise.all([read('lg3s_public_skater_leaders'),read('lg3s_public_goalie_leaders')]);rows=await supplementLG3sRosterRows([...s.map(p=>norm(p,'skater')),...g.map(p=>norm(p,'goalie'))]);}else{const s=await read('wm_lgchl_s55_player_leaders');let capture=null;try{const response=await fetch('data/lgchl/leaders-current.json',{cache:'no-cache'});if(response.ok)capture=await response.json();}catch{}const fresh=new Map();if(capture?.boards&&Number.isFinite(Date.parse(capture.captured_at))){for(const board of Object.values(capture.boards)){for(const p of board){const k=p.player_kind+':'+p.lg_user_id;if(!fresh.has(k))fresh.set(k,p);}}}rows=s.map(p=>{const newer=fresh.get(p.player_kind+':'+p.lg_user_id);return norm(newer&&(!p.fetched_at||Date.parse(capture.captured_at)>Date.parse(p.fetched_at))?{...newer,fetched_at:capture.captured_at}:p,p.player_kind);});}if(league==='lgchl'){try{rows=attachDetailed(rows,await readRatingRows());}catch(e){console.warn('Detailed rating data unavailable:',e.message);}}if(i!==req)return;all=rows.filter(p=>/^[0-9]+$/.test(p.id)&&Number(p.id)>0).sort((a,b)=>a.tag.localeCompare(b.tag));
filter();const activeParams=new URLSearchParams(location.search);const id=activeParams.get('id'),kind=activeParams.get('kind');const requested=all.find(p=>p.id===id&&(!kind||p.kind===kind));if(requested){const value=requested.kind+':'+requested.id;if(![...$('player').options].some(o=>o.value===value))$('player').add(new Option(requested.tag+' · '+requested.team,value));$('player').value=value;select();}else{$('player').insertBefore(new Option('Choose a verified player…',''),$('player').firstChild);$('player').value='';render();}
const rosterOnlyCount=all.filter(p=>p.rosterOnly).length;$('feedStatus').textContent=(all.length-rosterOnlyCount)+' public player-stat records loaded'+(rosterOnlyCount?' · '+rosterOnlyCount+' official main-roster identities awaiting published stats (snapshot 2026-11-14)':'')+'. Game statistics are read-only.';
}catch(e){if(i!==req)return;all=[];$('player').innerHTML='';$('player').add(new Option('No player records available',''));$('feedStatus').textContent='League feed unavailable. No example statistics are displayed.';current=null;render();console.warn('Player card read-only feed:',e.message);}}
function filter(){const q=$('filter').value.trim().toLowerCase();const chosen=$('player').value;visible=all.filter(p=>!q||p.tag.toLowerCase().includes(q)||p.team.toLowerCase().includes(q)).slice(0,500);$('player').innerHTML='';if(!visible.length){$('player').add(new Option('No matching players',''));$('feedStatus').textContent='No matching player. Your selected card has not changed.';return;}for(const p of visible){$('player').add(new Option(p.tag+' · '+(p.team||league.toUpperCase())+' · '+(p.pos||p.kind)+' · '+p.kind,p.kind+':'+p.id));}if(visible.some(p=>p.kind+':'+p.id===chosen))$('player').value=chosen;else{$('player').insertBefore(new Option('Choose a matching record…',''),$('player').firstChild);$('player').value='';}}
function loadPersonal(){portraitData='';$('portraitFile').value='';$('jersey').value='';setBackground('arena');if(!current)return;try{const s=localStorage.getItem(key());if(s){const p=JSON.parse(s);$('jersey').value=p.jersey??'';portraitData=p.portrait||'';setBackground(p.background);}}catch(e){console.warn('Local card preferences unavailable:',e.message);}}
function select(){uploadRevision++;const value=$('player').value;current=all.find(p=>p.kind+':'+p.id===value)||null;loadPersonal();render();window.dispatchEvent(new Event('ecm:card-selected'));}
function render(){const style=earnedStyle();$('finish').value=style.finish;$('edition').value=style.edition;$('earnedFinish').textContent=style.label;const p=current;$('cardLeaderboardLink').href='league-leaderboard.html?league='+league+'&category='+(p?.kind==='goalie'?'save_pct':'points');const locker=$('cardLockerLink');locker.hidden=league!=='lgchl'||!Number.isSafeInteger(Number(p?.teamId))||Number(p?.teamId)<=0;if(!locker.hidden)locker.href='lgchl-team.html?team='+Number(p.teamId);$('cardName').textContent=p?p.tag:'SELECT PLAYER';$('cardTeam').textContent=p?(p.team||'TEAM UNAVAILABLE').toUpperCase():'LG VERIFIED STATS';$('cardPosition').textContent=p?(p.pos||p.kind).toUpperCase():'PLAYER';$('cardJersey').textContent=$('jersey').value?'#'+$('jersey').value:'';$('cardOvr').textContent=displayedOverall()!==''?String(displayedOverall()):blank;const ratingLabel=rating().overall!==null?'ECM OVR · BETA':'OVR PENDING';$('cardOvrLabel').textContent=ratingLabel;$('cardRatingLabel').textContent='LEAGUE STATS · '+ratingLabel;$('card').dataset.finish=$('finish').value;$('card').dataset.background=getBackground();$('card').dataset.edition=getEdition();$('cardEditionLabel').textContent=getEdition().toUpperCase()+' EDITION';
const portrait=$('portrait');portrait.hidden=!portraitData;portrait.src=portraitData||'';$('silhouette').hidden=!!portraitData;
const values=p?(p.kind==='goalie'?[fmt(p.gp),fmt(p.wins),pc(p.sv),fixed(p.gaa)]:[fmt(p.gp),fmt(p.goals),fmt(p.assists),fmt(p.points)]):[blank,blank,blank,blank];
const labels=p?.kind==='goalie'?['GP','W','SV%','GAA']:['GP','G','A','PTS'];values.forEach((v,i)=>{$('stat'+(i+1)).textContent=v;$('lab'+(i+1)).textContent=labels[i];});}
function save(){if(!current){$('feedStatus').textContent='Select a player before saving.';return;}const payload={jersey:$('jersey').value,finish:$('finish').value,background:getBackground(),edition:getEdition(),portrait:portraitData,layout:window.ECMStudioV2?.getDeviceLayout?.()||null};try{localStorage.setItem(key(),JSON.stringify(payload));$('feedStatus').textContent='Private preview saved on this device. Other visitors cannot see your changes.';}catch(e){$('feedStatus').textContent='Browser storage is full or disabled. Export your PNG to keep your card.';}}
function clear(){if(!current)return;uploadRevision++;try{localStorage.removeItem(key());}catch(e){}loadPersonal();render();$('feedStatus').textContent='Personal edits cleared for this card.';}
async function upload(file){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){$('feedStatus').textContent='Choose a PNG, JPG or WebP under 8 MB.';return;}
const revision=++uploadRevision;let url;try{const img=new Image();url=URL.createObjectURL(file);await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const c=document.createElement('canvas');const maxW=1600,maxH=1800,scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);if(revision!==uploadRevision){return;}portraitData=c.toDataURL('image/png');render();$('feedStatus').textContent='CHEL character loaded for local preview. Select Save on this device to retain it.';}catch(e){if(revision===uploadRevision)$('feedStatus').textContent='Could not load this character image.';console.warn(e);}finally{if(url)URL.revokeObjectURL(url);}}
async function exportPNG(){await window.ECMStudioV2.exportPNG();}
$('league').addEventListener('change',()=>{league=$('league').value;const u=new URL(location.href);u.searchParams.set('league',league);u.searchParams.delete('id');u.searchParams.delete('kind');history.replaceState(null,'',u);$('filter').value='';load();});
$('filter').addEventListener('input',filter);
$('player').addEventListener('change',()=>{select();if(current){const u=new URL(location.href);u.searchParams.set('league',league);u.searchParams.set('id',current.id);u.searchParams.set('kind',current.kind);history.replaceState(null,'',u);}});
for(const id of ['jersey','finish','edition'])$(id).addEventListener('input',()=>{const field=$(id);if(id==='jersey'&&field.value)field.value=Math.max(0,Math.min(99,Number(field.value)||0));render();});
document.querySelectorAll('input[name="cardBackground"]').forEach(input=>input.addEventListener('change',render));
$('portraitFile').addEventListener('change',e=>upload(e.target.files?.[0]));
$('save').addEventListener('click',save);$('reset').addEventListener('click',clear);$('export').addEventListener('click',exportPNG);
window.ecmCardStudio={
 getSelected:()=>current,
 getLeague:()=>league,
 getArtwork:()=>portraitData,
 applyApprovedArtwork:(data,layout,{force=false}={})=>{if(portraitData&&!force)return false;portraitData=data;for(const id of ['imageScale','imageX','imageY'])if(layout[id]!==undefined)$(id).value=layout[id];if(layout.background)setBackground(layout.background);render();return true;},
 getRating:rating,
 getEarnedStyle:earnedStyle,
 getDisplayedOverall:displayedOverall,
 redraw:render,

 applyAccountCustomization:(c)=>{
   if(!current || !c)return;
   $('jersey').value=c.jersey===null||c.jersey===undefined?'':String(c.jersey);

   render();
 }
};
load();
})();
