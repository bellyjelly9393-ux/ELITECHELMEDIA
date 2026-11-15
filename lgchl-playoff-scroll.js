/* Additional LGCHL Playoff Central long-page enhancements.
   Reuses the same canonical bracket and leaves scrolling to the browser. */
(()=>{
'use strict';
const C=window.ECMPlayoffSegments,box=document.getElementById('lgScrollTeamRecords');
if(!C||!box)return;
const escape=C.escape;
const menu=document.querySelector('.lg-scroll-mobile-menu');
menu?.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{menu.open=false;}));
const isValidFinal=C.isFinal;
function standings(data){
 const teams=new Map(Object.values(data.teams||{}).filter(t=>C.validId(t.id)).map(t=>[Number(t.id),{
   id:Number(t.id),name:t.name,league:t.league,gp:0,w:0,l:0,gf:0,ga:0
 }]));
 const seen=new Set();
 for(const slot of C.allSlots(data)){
  for(const game of slot.games||[]){
   if(!isValidFinal(game)||seen.has(Number(game.id)))continue;
   const home=teams.get(Number(game.home)),away=teams.get(Number(game.away));
   if(!home||!away)continue;
   seen.add(Number(game.id));
   const h=Number(game.home_score),a=Number(game.away_score);
   home.gp++;away.gp++;home.gf+=h;home.ga+=a;away.gf+=a;away.ga+=h;
   if(h>a){home.w++;away.l++}else{away.w++;home.l++}
  }
 }
 return [...teams.values()].filter(t=>t.gp>0).sort((a,b)=>b.w-a.w||((b.gf-b.ga)-(a.gf-a.ga))||a.name.localeCompare(b.name));
}
async function fetchBracket(){
 for(const url of ['/api/lgchl-playoffs','assets/lgchl/playoffs/s55.json']){
  try{
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)continue;
   const data=await response.json();
   if(data?.teams&&data?.leagues&&data?.matchups)return{data,source:url};
  }catch{}
 }
 return null;
}
async function populate(){
 const found=await fetchBracket();
 if(!found){box.innerHTML='<p>Playoff results are unavailable. No records have been estimated.</p>';return}
 const records=standings(found.data).slice(0,3);
 if(!records.length){
  box.innerHTML='<p>Waiting for confirmed playoff game results. Scheduled games do not count as played.</p>';
  return;
 }
 const delayed=found.source.includes('s55.json')||found.data.stale;
 box.innerHTML=records.map(t=>'<div class="lg-scroll-stat-row"><img alt="" loading="lazy" src="assets/lgchl/s55/team'+Number(t.id)+'.png"><b>'+escape(t.name)+'</b><span>'+t.w+'–'+t.l+' · GD '+(t.gf-t.ga>0?'+':'')+(t.gf-t.ga)+'</span></div>').join('')+
 '<small style="display:block;margin-top:10px;color:#bdc8d4">'+(delayed?'Saved playoff bracket · may be delayed':'Official playoff data feed')+' · verified final games only</small>';
}
populate().catch(()=>{box.textContent='Playoff records currently unavailable. Use the official bracket for confirmed results.'});
})();
