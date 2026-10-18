/* Private pregame film clips, shared by the scouting report, Lineup Room, War Room Tonight and opponent scout.
   A report line can carry [clip](storage:hitmen-vod-clips/<team_id>/...mp4). Only that bucket and a plain
   .mp4 path are accepted. Players get a 1h signed URL from the signed-in client (bucket is private;
   RLS = team locker access). Missing or unreadable clips show "Clip unavailable". Nothing here writes. */
(()=>{
'use strict';
if(window.HitmenClips)return;
const BUCKET='hitmen-vod-clips',TTL=3600;
const SRC='\\[clip\\]\\(storage:hitmen-vod-clips\\/([A-Za-z0-9][A-Za-z0-9._\\/-]*\\.mp4)\\)';
const RE=()=>new RegExp(SRC,'g');
const ANY=/\s*\[clip\]\(storage:[^)\s]*\)/g;
const safe=p=>!/(^|\/)\.\.?(\/|$)/.test(p)&&!p.includes('//');
const db=()=>window.VVHLBackend?.db;
/* html must already be escaped; only the clip marker is replaced. compact = "Play clip" toggle. */
function tags(html,opt){
 const compact=!!opt?.compact;
 return String(html??'').replace(RE(),(m,path)=>{
  if(!safe(path))return'';
  return compact
   ?'<span class="hc-clip is-compact" data-clip-path="'+path+'"><button type="button" class="hc-clip-play" aria-expanded="false">Play clip</button></span>'
   :'<span class="hc-clip" data-clip-path="'+path+'"><video controls preload="none" playsinline></video><small class="hc-clip-state">Loading clip…</small></span>';
 });
}
/* plain text without any clip marker (for sentence extraction and short blurbs) */
const strip=text=>String(text??'').replace(ANY,'');
/* clip refs in a report: [{path,label}] where label is the line text without the marker */
function extract(text){
 const out=[];
 String(text??'').split(/\r?\n/).forEach(line=>{
  const re=RE();let m;
  while((m=re.exec(line))){if(safe(m[1]))out.push({path:m[1],label:strip(line).replace(/^\s*[-*•]\s*/,'').replace(/\*\*/g,'').trim()})}
 });
 return out;
}
async function sign(path){
 const store=db()?.storage?.from?.(BUCKET);
 if(!store)return null;
 try{
  const r=await store.createSignedUrl(path,TTL);
  const url=r?.data?.signedUrl;
  return !r?.error&&url&&/^https:\/\//i.test(url)?url:null;
 }catch(e){console.warn('Clip could not be signed',e);return null}
}
function fail(n){
 n.classList?.add('is-unavailable');
 n.querySelector('video')?.remove();n.querySelector('.hc-clip-play')?.remove();
 let st=n.querySelector('.hc-clip-state');
 if(!st&&n.ownerDocument){st=n.ownerDocument.createElement('small');st.className='hc-clip-state';n.appendChild(st)}
 if(st)st.textContent='Clip unavailable';
}
/* full players: sign every clip under root right away */
async function hydrate(root){
 const nodes=[...(root?.querySelectorAll?.('.hc-clip:not(.is-compact)[data-clip-path]')||[])];
 let ok=0;
 await Promise.all(nodes.map(async n=>{
  const url=await sign(n.dataset.clipPath);
  if(!url)return fail(n);
  const v=n.querySelector('video');if(!v)return fail(n);
  v.src=url;n.querySelector('.hc-clip-state')?.remove();ok++;
 }));
 return ok;
}
/* compact toggle: first click signs + adds the player, later clicks show/hide it */
async function toggle(n,doc){
 const btn=n.querySelector('.hc-clip-play');if(!btn)return false;
 let v=n.querySelector('video');
 if(v){const open=v.hidden;v.hidden=!open;btn.textContent=open?'Hide clip':'Play clip';btn.setAttribute('aria-expanded',String(open));if(open)v.play?.().catch(()=>{});else v.pause?.();return true}
 btn.disabled=true;btn.textContent='Loading…';
 const url=await sign(n.dataset.clipPath);
 if(!url){fail(n);return false}
 v=doc.createElement('video');v.controls=true;v.preload='none';v.playsInline=true;v.setAttribute('playsinline','');v.src=url;
 n.appendChild(v);btn.disabled=false;btn.textContent='Hide clip';btn.setAttribute('aria-expanded','true');
 v.play?.().catch(()=>{});
 return true;
}

/* Team clips: every clip in <team_id>/pregame-clips/<date>/<opponent>/ for one opponent, listed by the signed-in
   client (RLS: team locker access) and shown as full players. Labels come from report clip lines when known. */
const TEAM_ID='b0bcbdda-da9d-419d-8f61-b34937966d49';
const labels=new Map(),reports=new Map();
const slugNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const escH=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function remember(opponent,text){
 const k=slugNorm(opponent);if(!k)return;
 const t=String(text||''),prev=reports.get(k)||'';if(!t||prev.includes(t))return;
 reports.set(k,prev+'\n'+t);
 extract(text).forEach(c=>labels.set(c.path,c.label));
}
function slugsFor(opponent){
 const k=slugNorm(opponent),out=new Set();
 extract(reports.get(k)||'').forEach(c=>{const seg=c.path.split('/');if(seg[1]==='pregame-clips'&&seg[3])out.add(seg[3])});
 const w=k.split(' ').filter(Boolean);
 if(w[0])out.add(w[0]);if(w.length>1)out.add(w[0]+'_'+w[1]);
 return [...out].filter(x=>/^[a-z0-9_-]+$/.test(x));
}
function teamButton(opponent,text){
 if(text)remember(opponent,text);
 return '<div class="hc-team"><button type="button" class="hc-team-btn" data-hc-team="'+escH(opponent)+'" aria-expanded="false">Team clips</button><div class="hc-team-panel" hidden></div></div>';
}
async function teamClips(opponent){
 const store=db()?.storage?.from?.(BUCKET);if(!store)return null;
 const base=TEAM_ID+'/pregame-clips';
 const d=await store.list(base,{limit:200,sortBy:{column:'name',order:'desc'}});
 if(d.error)return null;
 const dates=(d.data||[]).filter(x=>!x.id&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name);
 const out=[];
 for(const date of dates)for(const slug of slugsFor(opponent)){
  const r=await store.list(base+'/'+date+'/'+slug,{limit:200,sortBy:{column:'name',order:'asc'}});
  (r.data||[]).filter(x=>x.id&&/\.mp4$/i.test(x.name)).forEach(x=>{const path=base+'/'+date+'/'+slug+'/'+x.name;if(safe(path)&&!out.some(o=>o.path===path))out.push({path,date,label:labels.get(path)||x.name.replace(/\.mp4$/i,'').replace(/^\d{4}-\d{2}-\d{2}_\d+_/,'').replace(/-/g,' ')})});
 }
 return out;
}
async function openTeam(btn){
 const wrap=btn.closest('.hc-team'),panel=wrap?.querySelector('.hc-team-panel');if(!panel)return;
 if(panel.dataset.loaded){panel.hidden=!panel.hidden;btn.setAttribute('aria-expanded',String(!panel.hidden));btn.textContent=panel.hidden?'Team clips':'Hide team clips';return}
 btn.disabled=true;btn.textContent='Loading team clips…';panel.hidden=false;
 const name=btn.dataset.hcTeam,list=await teamClips(name);
 btn.disabled=false;btn.textContent='Hide team clips';btn.setAttribute('aria-expanded','true');
 if(!list){panel.innerHTML='<p class="hc-clip-state">Team clips unavailable. Sign in with Hitmen team access.</p>';return}
 panel.dataset.loaded='1';
 panel.innerHTML='<div class="hc-team-head"><b>'+escH(name)+' · team clips</b><small>'+list.length+' clip'+(list.length===1?'':'s')+' · private film</small></div>'+
  (list.length?list.map(c=>'<div class="hc-team-item"><span>'+escH(c.date)+' · '+escH(c.label)+'</span>'+tags('[clip](storage:hitmen-vod-clips/'+c.path+')')+'</div>').join(''):'<p class="hc-clip-state">No clips saved for this opponent yet.</p>');
 await hydrate(panel);
}
const CSS='.hc-clip{display:block;margin:8px 0 12px;padding:6px;border:1px solid rgba(214,218,222,.14);border-radius:10px;background:#111213;color:#e8e6e3}'+
 '.hc-clip video{display:block;width:100%;max-height:420px;border-radius:6px;background:#000}'+
 '.hc-clip.is-compact{display:inline-flex;flex-direction:column;gap:6px;margin:4px 0 4px 6px;padding:0;border:0;background:none;vertical-align:middle;max-width:100%}'+
 '.hc-clip.is-compact video{margin-top:2px;width:min(520px,100%)}'+
 '.hc-clip-play{align-self:flex-start;border:1px solid rgba(214,218,222,.24);border-radius:6px;background:#17191b;color:#e8e6e3;padding:5px 9px;font:800 9px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}'+
 '.hc-clip-play:hover,.hc-clip-play:focus-visible{background:#202326;border-color:rgba(214,218,222,.4)}.hc-clip-play:disabled{opacity:.6;cursor:wait}'+
 '.hc-clip-state{display:block;padding:8px 4px;color:#a7adb3;font:800 9px/1 Inter,system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}'+
 '.wr-clips{list-style:none;margin:0;padding:0}.wr-clips li{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:7px 0;border-bottom:1px solid rgba(214,218,222,.08);font:400 12px/1.45 Inter,system-ui,sans-serif;color:#c9ccd0}.wr-clips li .hc-clip.is-compact{margin:0}'+
 '.hc-team{margin:10px 0 14px}.hc-team-btn{border:1px solid rgba(214,218,222,.28);border-radius:8px;background:#17191b;color:#e8e6e3;padding:9px 12px;font:800 10px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.hc-team-btn:hover,.hc-team-btn:focus-visible{background:#202326;border-color:rgba(214,218,222,.45)}.hc-team-btn:disabled{opacity:.6;cursor:wait}'+
 '.hc-team-panel{margin-top:10px;padding:12px;border:1px solid rgba(214,218,222,.14);border-radius:10px;background:#0d0e0f}.hc-team-head{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:8px;color:#e8e6e3}.hc-team-head small{color:#a7adb3;font-size:10px}.hc-team-item>span{display:block;margin-top:10px;color:#c9ccd0;font:600 12px/1.45 Inter,system-ui,sans-serif}'+
 '.hc-clip.is-unavailable{border:1px dashed rgba(214,218,222,.22)}.hc-clip.is-compact.is-unavailable{padding:2px 6px}';
function install(doc){
 if(!doc?.head||doc.getElementById?.('hc-clip-style'))return;
 const s=doc.createElement('style');s.id='hc-clip-style';s.textContent=CSS;doc.head.appendChild(s);
 doc.addEventListener('click',e=>{const tb=e.target?.closest?.('.hc-team-btn');if(tb){e.preventDefault();e.stopPropagation();openTeam(tb);return}
  const b=e.target?.closest?.('.hc-clip-play');const n=b?.closest?.('.hc-clip[data-clip-path]');if(n){e.preventDefault();e.stopPropagation();toggle(n,doc)}},true);
}
try{install(document)}catch{}
window.HitmenClips={BUCKET,TTL,tags,strip,extract,hydrate,toggle,sign,teamButton,teamClips,openTeam,remember,slugsFor};
})();
