/* Homepage compact previews for the three Season 55 segments.
   Reads the same bracket; never alters existing predictor or bracket elements. */
(()=>{'use strict';
const C=window.ECMPlayoffSegments,root=document.getElementById('ecmSegmentsHome');if(!C||!root)return;
const E=C.escape,logo=id=>'assets/lgchl/s55/team'+Number(id)+'.png';
const card=(t,text,href)=>'<a class="s55-seg-mini" href="'+href+'"><img loading="lazy" src="'+logo(t.id)+'" alt=""><div><b>'+E(t.name)+'</b><small>'+E(text)+'</small></div><span aria-hidden="true">↗</span></a>';
async function data(){
 for(const url of ['/api/lgchl-playoffs','assets/lgchl/playoffs/s55.json']){
  try{const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok)continue;const d=await res.json();if(d?.leagues?.length&&d?.teams)return d;}catch{}
 }
 return null;
}
async function update(){
 const d=await data();if(!d){root.querySelectorAll('[data-s55-slot]').forEach(n=>n.textContent='Verified bracket temporarily unavailable.');return;}
 const p=Object.values(d.teams||{}).map(t=>({t,s:C.pressure(d,t.id)})).filter(x=>x.s.active).sort((a,b)=>Number(b.s.label==='ON THE BRINK')-Number(a.s.label==='ON THE BRINK')||Number(b.s.label==='RED HOT')-Number(a.s.label==='RED HOT')||a.t.name.localeCompare(b.t.name));
 const hot=p.filter(x=>!['AWAITING FIRST PUCK','IN THE FIGHT','AWAITING VERIFIED SCORE'].includes(x.s.label)).slice(0,2);
 const pressure=root.querySelector('[data-s55-slot="pressure"]');
 pressure.innerHTML=hot.length?hot.map(x=>card(x.t,x.s.label,'pressure-cooker.html')).join(''):'<p class="s55-seg-pending">First playoff results pending. Track who rises and who faces elimination.</p>';
 const series=C.allSeries(d).filter(s=>!C.verifiedWinner(s)).slice(0,2);
 root.querySelector('[data-s55-slot="rivalry"]').innerHTML=series.length?series.map(s=>{
  const t=C.slotTeams(s),a=d.teams[t[0]],b=d.teams[t[1]],sc=C.scoreFor(s,t[0]);
  return '<a class="s55-seg-mini" href="rivalry-report.html?series='+Number(s.id)+'"><img loading="lazy" src="'+logo(a.id)+'" alt=""><div><b>'+E(a.nick||a.name)+' vs '+E(b.nick||b.name)+'</b><small>'+E(s.league)+' · '+(sc?sc.for+'–'+sc.against:'Scheduled')+'</small></div><img loading="lazy" src="'+logo(b.id)+'" alt=""></a>';
 }).join(''):'<p class="s55-seg-pending">Awaiting confirmed active series.</p>';
 const teams=Object.values(d.teams).sort((a,b)=>a.name.localeCompare(b.name));
 const select=root.querySelector('#s55RoadSelect');
 select.innerHTML='<option value="">Choose your playoff team</option>'+teams.map(t=>'<option value="'+Number(t.id)+'">'+E(t.name)+'</option>').join('');
 const useTeam=()=>{const id=C.validId(select.value);const link=root.querySelector('#s55RoadLink');link.href=id?'road-to-cup.html?team='+id:'road-to-cup.html';link.textContent=id?'Track '+(d.teams[id]?.nick||'team')+' →':'Explore every team →';};
 select.onchange=useTeam;useTeam();
 root.querySelector('[data-s55-fresh]').textContent='Bracket: '+(d.stale?'saved/delayed':'official feed')+' · '+(d.fetched_at?new Date(d.fetched_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',timeZone:'America/Toronto'}):'time unknown');
}
update().catch(()=>{root.querySelectorAll('[data-s55-slot]').forEach(n=>n.textContent='Bracket data temporarily unavailable.')});
})();
