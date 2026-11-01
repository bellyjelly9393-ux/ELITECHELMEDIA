/* Elitechel 3D Player Cards: public league stats + private device-only customization.
   No write access to league records, profile identities, or published player images. */
(()=>{'use strict';
const API='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
let league=params.get('league')==='lg3s'?'lg3s':'lgchl';
let all=[],visible=[],current=null,req=0;
let portraitData='';
const blank='--';
const asNum=v=>(v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v)))?Number(v):null;
const fmt=v=>asNum(v)===null?blank:String(asNum(v));
const pc=v=>{let n=asNum(v);return n===null?blank:(n<=1?n*100:n).toFixed(1)+'%';};
const fixed=v=>asNum(v)===null?blank:Number(v).toFixed(2);
const norm=(p,kind)=>league==='lg3s'?{
 id:String(p.lg_user_id),kind,tag:p.gamertag||'Unknown',team:kind==='goalie'?(Array.isArray(p.nations_played_for)?p.nations_played_for.join(' / '):p.nation||''):p.nation||'',pos:p.position||p.primary_position||kind.toUpperCase(),gp:p.gp,
 goals:p.g,assists:p.a,points:p.p,wins:p.wins,sv:p.sv_pct,gaa:p.gaa_per_game
}:{id:String(p.lg_user_id),kind:p.player_kind==='goalie'?'goalie':'skater',tag:p.gamertag||'Unknown',team:p.team_name||'',pos:p.position||p.primary_position||'',gp:p.gp,goals:p.goals,assists:p.assists,points:p.points,wins:p.wins,sv:p.save_pct,gaa:p.gaa};
function key(){return current?'ecm-card-v1:'+league+':'+current.kind+':'+current.id:'';}
async function read(table){const data=[];for(let n=0;n<30;n++){const q=new URLSearchParams({select:'*',order:'lg_user_id.asc,gamertag.asc',offset:String(n*500),limit:'500'});const res=await fetch(API+table+'?'+q,{headers:{apikey:KEY},cache:'no-store',signal:AbortSignal.timeout(18000)});if(!res.ok)throw new Error('League feed '+res.status);const chunk=await res.json();data.push(...chunk);if(chunk.length<500)break;}return data;}
async function load(){const i=++req;all=[];current=null;portraitData='';$('league').value=league;$('player').innerHTML='';$('player').add(new Option('Loading verified players…',''));$('feedStatus').textContent='Loading public league records…';
try{let rows;if(league==='lg3s'){const [s,g]=await Promise.all([read('lg3s_public_skater_leaders'),read('lg3s_public_goalie_leaders')]);rows=[...s.map(p=>norm(p,'skater')),...g.map(p=>norm(p,'goalie'))];}else{const s=await read('wm_lgchl_s55_player_leaders');rows=s.map(p=>norm(p,p.player_kind));}if(i!==req)return;all=rows.filter(p=>p.id!=='undefined').sort((a,b)=>a.tag.localeCompare(b.tag));
filter();const id=params.get('id'),kind=params.get('kind');const requested=all.find(p=>p.id===id&&(!kind||p.kind===kind));if(requested){$('player').value=requested.kind+':'+requested.id;select();}else if(all.length){$('player').selectedIndex=0;select();}
$('feedStatus').textContent=all.length+' public player-stat records loaded. Game statistics are read-only.';
}catch(e){if(i!==req)return;all=[];$('player').innerHTML='';$('player').add(new Option('No player records available',''));$('feedStatus').textContent='League feed unavailable. No example statistics are displayed.';current=null;render();console.warn('Player card read-only feed:',e.message);}}
function filter(){const q=$('filter').value.trim().toLowerCase();const chosen=$('player').value;visible=all.filter(p=>!q||p.tag.toLowerCase().includes(q)||p.team.toLowerCase().includes(q)).slice(0,500);$('player').innerHTML='';if(!visible.length){$('player').add(new Option('No matching players',''));current=null;render();return;}for(const p of visible){$('player').add(new Option(p.tag+' · '+(p.team||league.toUpperCase())+' · '+p.kind,p.kind+':'+p.id));}if(visible.some(p=>p.kind+':'+p.id===chosen))$('player').value=chosen;}
function loadPersonal(){portraitData='';$('portraitFile').value='';$('overall').value='';$('jersey').value='';$('finish').value='crimson';if(!current)return;try{const s=localStorage.getItem(key());if(s){const p=JSON.parse(s);$('overall').value=p.ovr||'';$('jersey').value=p.jersey??'';$('finish').value=['crimson','gold','ice'].includes(p.finish)?p.finish:'crimson';portraitData=p.portrait||'';}}catch(e){console.warn('Local card preferences unavailable:',e.message);}}
function select(){const value=$('player').value;current=all.find(p=>p.kind+':'+p.id===value)||null;loadPersonal();render();window.dispatchEvent(new Event('ecm:card-selected'));}
function render(){const p=current;$('cardName').textContent=p?p.tag:'SELECT PLAYER';$('cardTeam').textContent=p?(p.team||'TEAM UNAVAILABLE').toUpperCase():'LG VERIFIED STATS';$('cardPosition').textContent=p?(p.pos||p.kind).toUpperCase():'PLAYER';$('cardJersey').textContent=$('jersey').value?'#'+$('jersey').value:'';$('cardOvr').textContent=$('overall').value||blank;$('card').dataset.finish=$('finish').value;
const portrait=$('portrait');portrait.hidden=!portraitData;portrait.src=portraitData||'';$('silhouette').hidden=!!portraitData;
const values=p?(p.kind==='goalie'?[fmt(p.gp),fmt(p.wins),pc(p.sv),fixed(p.gaa)]:[fmt(p.gp),fmt(p.goals),fmt(p.assists),fmt(p.points)]):[blank,blank,blank,blank];
const labels=p?.kind==='goalie'?['GP','W','SV%','GAA']:['GP','G','A','PTS'];values.forEach((v,i)=>{$('stat'+(i+1)).textContent=v;$('lab'+(i+1)).textContent=labels[i];});}
function save(){if(!current){$('feedStatus').textContent='Select a player before saving.';return;}const payload={ovr:$('overall').value,jersey:$('jersey').value,finish:$('finish').value,portrait:portraitData};try{localStorage.setItem(key(),JSON.stringify(payload));$('feedStatus').textContent='Private preview saved on this device. Other visitors cannot see your changes.';}catch(e){$('feedStatus').textContent='Browser storage is full or disabled. Export your PNG to keep your card.';}}
function clear(){if(!current)return;try{localStorage.removeItem(key());}catch(e){}loadPersonal();render();$('feedStatus').textContent='Personal edits cleared for this card.';}
async function upload(file){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){$('feedStatus').textContent='Choose a PNG, JPG or WebP under 8 MB.';return;}
try{const img=new Image(),url=URL.createObjectURL(file);await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const c=document.createElement('canvas');const maxW=640,maxH=770,scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);portraitData=c.toDataURL('image/webp',.80);URL.revokeObjectURL(url);render();$('feedStatus').textContent='CHEL character loaded for local preview. Select Save on this device to retain it.';}catch(e){$('feedStatus').textContent='Could not load this character image.';console.warn(e);}}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function fit(ctx,text,max,width){let size=max;ctx.font='bold '+size+'px Impact,Arial';while(ctx.measureText(text).width>width&&size>24){size-=2;ctx.font='bold '+size+'px Impact,Arial';}return size;}
async function exportPNG(){if(!current){$('feedStatus').textContent='Choose a player before exporting.';return;}const W=700,H=980,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),finish=$('finish').value,accent=finish==='gold'?'#efb331':finish==='ice'?'#80d5f1':'#ea2845';
const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#f6f8ff');bg.addColorStop(.09,accent);bg.addColorStop(.18,'#090e17');bg.addColorStop(.72,'#18202c');bg.addColorStop(.94,accent);bg.addColorStop(1,'#e4e7f0');x.fillStyle=bg;rr(x,8,8,W-16,H-16,39);x.fill();
const core=x.createLinearGradient(0,0,W,H);core.addColorStop(0,'#263548');core.addColorStop(.45,'#0b1420');core.addColorStop(1,'#0a0c12');x.fillStyle=core;rr(x,23,23,W-46,H-46,26);x.fill();x.lineWidth=4;x.strokeStyle=accent;x.stroke();x.lineWidth=2;x.strokeStyle='#b7c0ca';rr(x,38,38,W-76,H-76,20);x.stroke();
x.textBaseline='alphabetic';x.fillStyle='#fff';x.font='bold 108px Impact,Arial';x.fillText($('overall').value||'--',62,150);x.font='bold 23px Arial';x.fillText('CHEL OVR',61,187);
x.textAlign='right';x.font='bold 44px Impact,Arial';x.fillText('ELITECHEL',W-60,102);x.fillStyle=accent;x.fillText('MEDIA',W-60,145);x.textAlign='left';
if(portraitData){const img=new Image();try{await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=portraitData;});const box={x:110,y:210,w:480,h:510};const scale=Math.min(box.w/img.naturalWidth,box.h/img.naturalHeight);const w=img.naturalWidth*scale,h=img.naturalHeight*scale;x.drawImage(img,box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h);}catch(e){}}else{
x.strokeStyle='#8a94a5';x.lineWidth=15;x.beginPath();x.arc(350,372,95,0,Math.PI*2);x.stroke();x.fillStyle='#344053';x.beginPath();x.ellipse(350,640,180,175,0,Math.PI,Math.PI*2);x.fill();x.fillStyle=accent;x.fillRect(190,670,320,20);
}
const belt=x.createLinearGradient(0,700,W,775);belt.addColorStop(0,'#192635');belt.addColorStop(.5,'#080c11');belt.addColorStop(1,accent);x.fillStyle=belt;rr(x,40,719,W-80,95,12);x.fill();x.strokeStyle=accent;x.lineWidth=3;x.stroke();
const name=current.tag.toUpperCase();fit(x,name,58,555);x.textAlign='center';x.fillStyle='#fff';x.fillText(name,350,782);x.font='bold 22px Arial';x.fillStyle='#c5cdd5';x.fillText((current.team||'TEAM UNAVAILABLE').toUpperCase(),350,850);
const values=[1,2,3,4].map(i=>$('stat'+i).textContent),labels=[1,2,3,4].map(i=>$('lab'+i).textContent);for(let i=0;i<4;i++){x.textAlign='center';const center=105+i*163;x.font='bold 45px Impact,Arial';x.fillStyle='#fff';x.fillText(values[i],center,911);x.font='bold 17px Arial';x.fillStyle='#aab7ca';x.fillText(labels[i],center,936);}
x.textAlign='center';x.font='13px Arial';x.fillText('VERIFIED LEAGUE STATS  /  CUSTOM OVR AND ARTWORK',350,955);
c.toBlob(blob=>{if(!blob){$('feedStatus').textContent='PNG export failed.';return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Elitechel-'+league+'-'+current.tag.replace(/[^a-z0-9_-]+/gi,'-')+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);$('feedStatus').textContent='PNG exported. CHEL overall remains player-supplied, not verified by LG.';},'image/png');}
$('league').addEventListener('change',()=>{league=$('league').value;const u=new URL(location.href);u.searchParams.set('league',league);u.searchParams.delete('id');u.searchParams.delete('kind');history.replaceState(null,'',u);$('filter').value='';load();});
$('filter').addEventListener('input',()=>{filter();if(visible.length)select();});
$('player').addEventListener('change',()=>{select();if(current){const u=new URL(location.href);u.searchParams.set('league',league);u.searchParams.set('id',current.id);u.searchParams.set('kind',current.kind);history.replaceState(null,'',u);}});
for(const id of ['overall','jersey','finish'])$(id).addEventListener('input',()=>{const field=$(id);if(id==='overall'&&field.value)field.value=Math.max(1,Math.min(99,Number(field.value)||1));if(id==='jersey'&&field.value)field.value=Math.max(0,Math.min(99,Number(field.value)||0));render();});
$('portraitFile').addEventListener('change',e=>upload(e.target.files?.[0]));
$('save').addEventListener('click',save);$('reset').addEventListener('click',clear);$('export').addEventListener('click',exportPNG);
window.ecmCardStudio={
 getSelected:()=>current,
 getLeague:()=>league,
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