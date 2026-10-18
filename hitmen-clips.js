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
const CSS='.hc-clip{display:block;margin:8px 0 12px;padding:6px;border:1px solid rgba(214,218,222,.14);border-radius:10px;background:#111213;color:#e8e6e3}'+
 '.hc-clip video{display:block;width:100%;max-height:420px;border-radius:6px;background:#000}'+
 '.hc-clip.is-compact{display:inline-flex;flex-direction:column;gap:6px;margin:4px 0 4px 6px;padding:0;border:0;background:none;vertical-align:middle;max-width:100%}'+
 '.hc-clip.is-compact video{margin-top:2px;width:min(520px,100%)}'+
 '.hc-clip-play{align-self:flex-start;border:1px solid rgba(214,218,222,.24);border-radius:6px;background:#17191b;color:#e8e6e3;padding:5px 9px;font:800 9px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}'+
 '.hc-clip-play:hover,.hc-clip-play:focus-visible{background:#202326;border-color:rgba(214,218,222,.4)}.hc-clip-play:disabled{opacity:.6;cursor:wait}'+
 '.hc-clip-state{display:block;padding:8px 4px;color:#a7adb3;font:800 9px/1 Inter,system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}'+
 '.wr-clips{list-style:none;margin:0;padding:0}.wr-clips li{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:7px 0;border-bottom:1px solid rgba(214,218,222,.08);font:400 12px/1.45 Inter,system-ui,sans-serif;color:#c9ccd0}.wr-clips li .hc-clip.is-compact{margin:0}'+
 '.hc-clip.is-unavailable{border:1px dashed rgba(214,218,222,.22)}.hc-clip.is-compact.is-unavailable{padding:2px 6px}';
function install(doc){
 if(!doc?.head||doc.getElementById?.('hc-clip-style'))return;
 const s=doc.createElement('style');s.id='hc-clip-style';s.textContent=CSS;doc.head.appendChild(s);
 doc.addEventListener('click',e=>{const b=e.target?.closest?.('.hc-clip-play');const n=b?.closest?.('.hc-clip[data-clip-path]');if(n){e.preventDefault();e.stopPropagation();toggle(n,doc)}},true);
}
try{install(document)}catch{}
window.HitmenClips={BUCKET,TTL,tags,strip,extract,hydrate,toggle,sign};
})();
