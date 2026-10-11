/* Public Wildman newsroom: show latest verified, published game stories.
   Keep authored fallbacks until live data is available; never expose draft posts. */
(() => {
  'use strict';
  const root=document.getElementById('wmMediaWireRail');
  if(!root)return;
  const API='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/media_posts';
  const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const escDate=v=>{try{return new Date(v).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});}catch{return 'LGCHL S55';}};
  const qs=new URLSearchParams({
    select:'title,source_metrics,published_at',
    post_type:'eq.recap',
    published:'eq.true',
    order:'published_at.desc',
    limit:'35'
  });
  async function load(){
    try{
      const response=await fetch(API+'?'+qs,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});
      if(!response.ok)throw new Error('Latest story fetch '+response.status);
      const rows=(await response.json()).filter(p=>p.source_metrics?.team==='Calgary Hitmen'&&Number.isSafeInteger(Number(p.source_metrics?.lg_game_id)))
        .sort((a,b)=>Date.parse(b.source_metrics?.sort_at||b.source_metrics?.game_date||b.published_at)-Date.parse(a.source_metrics?.sort_at||a.source_metrics?.game_date||a.published_at));
      // Leave featured headline and editorial-stats slot intact; only rotate two story links.
      const slots=[...root.querySelectorAll('a')].slice(0,2);
      const unique=new Set();
      let index=0;
      for(const p of rows){
        const id=Number(p.source_metrics.lg_game_id);
        if(!id||unique.has(id)||id===917148)continue;
        unique.add(id);
        const a=slots[index++];if(!a)break;
        a.href='hitmen-media.html#game-'+id;
        const small=a.querySelector('small'),heading=a.querySelector('strong'),source=a.querySelector('span');
        if(small)small.textContent='LGCHL S55 · '+escDate(p.source_metrics?.game_date||p.published_at);
        if(heading)heading.textContent=p.title;
        if(source)source.textContent='LeagueGaming verified game #'+id+' ↗';
      }
    }catch(e){console.warn('Wildman newsroom keeping published editorial fallback',e);}
  }
  load();
})();
