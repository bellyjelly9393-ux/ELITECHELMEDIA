/* Elitechel 3D Player Cards: public league stats + private device-only customization.
   No write access to league records, profile identities, or published player images. */
(()=>{'use strict';
const API='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
let league=params.get('league')==='lg3s'?'lg3s':'lgchl';
let all=[],visible=[],current=null,req=0;
let portraitData='';let uploadRevision=0;
const BACKGROUNDS=['arena','heat','city','locker','playoff','storm','classic'];
const EDITIONS=['season','base','silver','gold','platinum','signature','playoff'];
function getBackground(){const selected=document.querySelector('input[name="cardBackground"]:checked');return selected&&BACKGROUNDS.includes(selected.value)?selected.value:'arena';}
function setBackground(value){const valid=BACKGROUNDS.includes(value)?value:'arena';document.querySelectorAll('input[name="cardBackground"]').forEach(r=>{r.checked=r.value===valid;});}
function getEdition(){return EDITIONS.includes($('edition').value)?$('edition').value:'base';}
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
async function load(){const i=++req;uploadRevision++;all=[];current=null;loadPersonal();render();window.dispatchEvent(new Event('ecm:card-selected'));$('league').value=league;$('player').innerHTML='';$('player').add(new Option('Loading verified players…',''));$('feedStatus').textContent='Loading public league records…';
try{let rows;if(league==='lg3s'){const [s,g]=await Promise.all([read('lg3s_public_skater_leaders'),read('lg3s_public_goalie_leaders')]);rows=[...s.map(p=>norm(p,'skater')),...g.map(p=>norm(p,'goalie'))];}else{const s=await read('wm_lgchl_s55_player_leaders');let capture=null;try{const response=await fetch('data/lgchl/leaders-current.json',{cache:'no-cache'});if(response.ok)capture=await response.json();}catch{}const fresh=new Map();if(capture?.boards&&Number.isFinite(Date.parse(capture.captured_at))){for(const board of Object.values(capture.boards)){for(const p of board){const k=p.player_kind+':'+p.lg_user_id;if(!fresh.has(k))fresh.set(k,p);}}}rows=s.map(p=>{const newer=fresh.get(p.player_kind+':'+p.lg_user_id);return norm(newer&&(!p.fetched_at||Date.parse(capture.captured_at)>Date.parse(p.fetched_at))?{...newer,fetched_at:capture.captured_at}:p,p.player_kind);});}if(i!==req)return;all=rows.filter(p=>/^[0-9]+$/.test(p.id)&&Number(p.id)>0).sort((a,b)=>a.tag.localeCompare(b.tag));
filter();const activeParams=new URLSearchParams(location.search);const id=activeParams.get('id'),kind=activeParams.get('kind');const requested=all.find(p=>p.id===id&&(!kind||p.kind===kind));if(requested){const value=requested.kind+':'+requested.id;if(![...$('player').options].some(o=>o.value===value))$('player').add(new Option(requested.tag+' · '+requested.team,value));$('player').value=value;select();}else{$('player').insertBefore(new Option('Choose a verified player…',''),$('player').firstChild);$('player').value='';render();}
$('feedStatus').textContent=all.length+' public player-stat records loaded. Game statistics are read-only.';
}catch(e){if(i!==req)return;all=[];$('player').innerHTML='';$('player').add(new Option('No player records available',''));$('feedStatus').textContent='League feed unavailable. No example statistics are displayed.';current=null;render();console.warn('Player card read-only feed:',e.message);}}
function filter(){const q=$('filter').value.trim().toLowerCase();const chosen=$('player').value;visible=all.filter(p=>!q||p.tag.toLowerCase().includes(q)||p.team.toLowerCase().includes(q)).slice(0,500);$('player').innerHTML='';if(!visible.length){$('player').add(new Option('No matching players',''));$('feedStatus').textContent='No matching player. Your selected card has not changed.';return;}for(const p of visible){$('player').add(new Option(p.tag+' · '+(p.team||league.toUpperCase())+' · '+(p.pos||p.kind)+' · '+p.kind,p.kind+':'+p.id));}if(visible.some(p=>p.kind+':'+p.id===chosen))$('player').value=chosen;else{$('player').insertBefore(new Option('Choose a matching record…',''),$('player').firstChild);$('player').value='';}}
function loadPersonal(){portraitData='';$('portraitFile').value='';$('overall').value='';$('jersey').value='';$('finish').value='ice';$('edition').value='season';setBackground('arena');if(!current)return;try{const s=localStorage.getItem(key());if(s){const p=JSON.parse(s);$('overall').value=p.ovr||'';$('jersey').value=p.jersey??'';$('finish').value=['crimson','gold','ice'].includes(p.finish)?p.finish:'crimson';portraitData=p.portrait||'';setBackground(p.background);$('edition').value=EDITIONS.includes(p.edition)?p.edition:'base';}}catch(e){console.warn('Local card preferences unavailable:',e.message);}}
function select(){uploadRevision++;const value=$('player').value;current=all.find(p=>p.kind+':'+p.id===value)||null;loadPersonal();render();window.dispatchEvent(new Event('ecm:card-selected'));}
function render(){const p=current;$('cardName').textContent=p?p.tag:'SELECT PLAYER';$('cardTeam').textContent=p?(p.team||'TEAM UNAVAILABLE').toUpperCase():'LG VERIFIED STATS';$('cardPosition').textContent=p?(p.pos||p.kind).toUpperCase():'PLAYER';$('cardJersey').textContent=$('jersey').value?'#'+$('jersey').value:'';$('cardOvr').textContent=$('overall').value||blank;$('card').dataset.finish=$('finish').value;$('card').dataset.background=getBackground();$('card').dataset.edition=getEdition();$('cardEditionLabel').textContent=getEdition().toUpperCase()+' EDITION';
const portrait=$('portrait');portrait.hidden=!portraitData;portrait.src=portraitData||'';$('silhouette').hidden=!!portraitData;
const values=p?(p.kind==='goalie'?[fmt(p.gp),fmt(p.wins),pc(p.sv),fixed(p.gaa)]:[fmt(p.gp),fmt(p.goals),fmt(p.assists),fmt(p.points)]):[blank,blank,blank,blank];
const labels=p?.kind==='goalie'?['GP','W','SV%','GAA']:['GP','G','A','PTS'];values.forEach((v,i)=>{$('stat'+(i+1)).textContent=v;$('lab'+(i+1)).textContent=labels[i];});}
function save(){if(!current){$('feedStatus').textContent='Select a player before saving.';return;}const payload={ovr:$('overall').value,jersey:$('jersey').value,finish:$('finish').value,background:getBackground(),edition:getEdition(),portrait:portraitData};try{localStorage.setItem(key(),JSON.stringify(payload));$('feedStatus').textContent='Private preview saved on this device. Other visitors cannot see your changes.';}catch(e){$('feedStatus').textContent='Browser storage is full or disabled. Export your PNG to keep your card.';}}
function clear(){if(!current)return;uploadRevision++;try{localStorage.removeItem(key());}catch(e){}loadPersonal();render();$('feedStatus').textContent='Personal edits cleared for this card.';}
async function upload(file){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){$('feedStatus').textContent='Choose a PNG, JPG or WebP under 8 MB.';return;}
const revision=++uploadRevision;let url;try{const img=new Image();url=URL.createObjectURL(file);await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const c=document.createElement('canvas');const maxW=1600,maxH=1800,scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);if(revision!==uploadRevision){return;}portraitData=c.toDataURL('image/png');render();$('feedStatus').textContent='CHEL character loaded for local preview. Select Save on this device to retain it.';}catch(e){if(revision===uploadRevision)$('feedStatus').textContent='Could not load this character image.';console.warn(e);}finally{if(url)URL.revokeObjectURL(url);}}
async function exportPNG(){await window.ECMStudioV2.exportPNG();}
$('league').addEventListener('change',()=>{league=$('league').value;const u=new URL(location.href);u.searchParams.set('league',league);u.searchParams.delete('id');u.searchParams.delete('kind');history.replaceState(null,'',u);$('filter').value='';load();});
$('filter').addEventListener('input',filter);
$('player').addEventListener('change',()=>{select();if(current){const u=new URL(location.href);u.searchParams.set('league',league);u.searchParams.set('id',current.id);u.searchParams.set('kind',current.kind);history.replaceState(null,'',u);}});
for(const id of ['overall','jersey','finish','edition'])$(id).addEventListener('input',()=>{const field=$(id);if(id==='overall'&&field.value)field.value=Math.max(1,Math.min(99,Number(field.value)||1));if(id==='jersey'&&field.value)field.value=Math.max(0,Math.min(99,Number(field.value)||0));render();});
document.querySelectorAll('input[name="cardBackground"]').forEach(input=>input.addEventListener('change',render));
$('portraitFile').addEventListener('change',e=>upload(e.target.files?.[0]));
$('save').addEventListener('click',save);$('reset').addEventListener('click',clear);$('export').addEventListener('click',exportPNG);
window.ecmCardStudio={
 getSelected:()=>current,
 getLeague:()=>league,
 getArtwork:()=>portraitData,
 redraw:render,

 applyAccountCustomization:(c)=>{
   if(!current || !c)return;
   $('overall').value=c.overall===null||c.overall===undefined?'':String(c.overall);
   $('jersey').value=c.jersey===null||c.jersey===undefined?'':String(c.jersey);
   $('finish').value=['crimson','gold','ice'].includes(c.finish)?c.finish:'crimson';
   render();
 }
};
load();
})();
