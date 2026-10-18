/* Public LGCHL + LG Threes directory. Never reads private VOD or scouting resources. */
(() => {
  'use strict';
  const API='https://lrgllzvwgvqagcpiyvfd.supabase.co';
  const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const db=window.supabase?.createClient(API,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'lgchl-live-public'}});
  const $=id=>document.getElementById(id);
  const data={lgchl:[],lg3s:[]};
  const canonical=raw=>{
    try{
      const u=new URL(String(raw||'').trim());
      if(u.protocol!=='https:')return null;
      const host=u.hostname.toLowerCase().replace(/^www\./,'');
      const path=u.pathname.split('/').filter(Boolean);
      if(['twitch.tv','m.twitch.tv'].includes(host) && path[0] && !['videos','search','directory','downloads','clip','settings'].includes(path[0].toLowerCase()) && /^[a-z0-9_]{3,25}$/i.test(path[0])){
        return 'https://www.twitch.tv/'+path[0].toLowerCase();
      }
      if(['youtube.com','m.youtube.com','youtu.be'].includes(host)){
        const id=host==='youtu.be'?path[0]:u.searchParams.get('v')||(['live','embed'].includes(path[0])?path[1]:'');
        if(id && /^[a-zA-Z0-9_-]{11}$/.test(id))return 'https://www.youtube.com/watch?v='+id;
      }
    }catch(_){}return null;
  };
  const classify=s=>{
    const m=s.metadata||{};
    const tag=[m.league,m.league_key,m.competition,m.category,m.title,s.display_label].filter(Boolean).join(' ').toLowerCase();
    const three=/\blg\s*3s\b|\blg\s*threes\b|leaguegaming\s*3s/.test(tag);
    const chl=/\blgchl\b|\bcalgary hitmen\b/.test(tag);
    return three?'lg3s':chl?'lgchl':null;
  };
  const item=(s,league)=>{
    const card=document.createElement('article');card.className='lh-card';
    const eyebrow=document.createElement('small');eyebrow.textContent=league==='lg3s'?'LG THREES · PUBLIC LISTING':'LGCHL · PUBLIC LISTING';
    const title=document.createElement('h3');title.textContent=s.display_label||s.metadata?.title||'League broadcaster';
    const sub=document.createElement('p');sub.textContent='Listed broadcaster · Live status not independently verified';
    const actions=document.createElement('div');actions.className='lh-card-actions';
    const watch=document.createElement('a');watch.href=s.url;watch.target='_blank';watch.rel='noopener noreferrer';watch.textContent='Open broadcast ↗';
    const multi=document.createElement('a');multi.href='multiview.html?hub=1&league='+league+'&streams='+encodeURIComponent('source:'+s.id);multi.textContent='+ Multiview';
    actions.append(watch,multi);card.append(eyebrow,title,sub,actions);return card;
  };
  const render=league=>{
    const root=$(league+'Streams'),filter=$(league+'Filter'),count=$(league+'Count');if(!root)return;
    const rows=data[league].filter(s=>[s.display_label,s.metadata?.title,s.url].filter(Boolean).join(' ').toLowerCase().includes((filter?.value||'').trim().toLowerCase()));
    root.replaceChildren();
    if(rows.length)rows.forEach(s=>root.append(item(s,league)));
    else {const p=document.createElement('p');p.className='lh-empty';p.textContent=data[league].length?'No matching broadcasts. Try a different channel or team name.':'No verified public channels are listed in this section yet. Use the Twitch search link or add a broadcast to your personal multiview.';root.append(p);}
    if(count)count.textContent=data[league].length+' PUBLIC CHANNEL'+(data[league].length===1?'':'S')+' LISTED';
  };
  ['lgchl','lg3s'].forEach(k=>$(k+'Filter')?.addEventListener('input',()=>render(k)));
  async function refresh(){
    if(!db){['lgchl','lg3s'].forEach(k=>{const root=$(k+'Streams');if(root)root.textContent='Public channel listings unavailable. Manual multiview is still available.';});return;}
    try{
      const {data:rows,error}=await db.from('tournament_automation_sources').select('id,url,provider,display_label,metadata,active,public_visible').eq('active',true).eq('public_visible',true).limit(200);
      if(error)throw error;
      const seen=new Set();data.lgchl=[];data.lg3s=[];
      (rows||[]).forEach(s=>{
        const category=classify(s),url=canonical(s.url);
        if(!category||!url||seen.has(category+':'+url))return;
        seen.add(category+':'+url);
        data[category].push({...s,url});
      });
      ['lgchl','lg3s'].forEach(render);
    }catch(e){
      console.warn('Public stream listings unavailable',e);
      ['lgchl','lg3s'].forEach(k=>{const root=$(k+'Streams');if(root){root.replaceChildren();const p=document.createElement('p');p.className='lh-empty';p.textContent='Public listings could not be loaded. Please try later, or add a public stream to your personal multiview.';root.append(p);}const n=$(k+'Count');if(n)n.textContent='LIST UNAVAILABLE';});
    }
  }
  $('lhAddForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const url=canonical($('lhStreamUrl')?.value),err=$('lhAddError');
    if(!url){if(err)err.textContent='Enter a valid public Twitch channel or YouTube video/live link.';return;}
    location.href='multiview.html?hub=1&add='+encodeURIComponent(url);
  });
  refresh();
})();
