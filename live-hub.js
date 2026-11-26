/* Public LGCHL + LG Threes directory, hosted games and games people add. Never reads private VOD or scouting resources. */
(() => {
  'use strict';
  const API='https://lrgllzvwgvqagcpiyvfd.supabase.co';
  const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const db=window.supabase?.createClient(API,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'lgchl-live-public'}});
  const $=id=>document.getElementById(id);
  const data={lgchl:[],lg3s:[],added:[]};
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
  // Channels kept off the public Live Hub directory (still used by the Hitmen broadcast stage).
  const HIDDEN=/twitch\.tv\/ctbli\b/i;
  const classify=s=>{
    if(HIDDEN.test(String(s.url||'')))return null;
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
  // All Games: every listed league in one directory, with a league filter. Games people add
  // (checked by Elitechel Media first) come first, soonest start time first.
  const LEAGUES={lgchl:'LGCHL',lg3s:'LG Threes',wjhc:'World Juniors',other:'Other league'};
  let gamesLeague='all';
  const when=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
  const addedTitle=g=>g.home_name+' vs '+g.away_name;
  const addedCard=g=>{
    const card=document.createElement('article');card.className='lh-card lh-card-added';
    const eyebrow=document.createElement('small');eyebrow.textContent=(LEAGUES[g.league]||LEAGUES.other)+' · Added game';
    const title=document.createElement('h3');title.textContent=addedTitle(g);
    const sub=document.createElement('p');sub.textContent=[g.note,g.starts_at&&'Starts '+when(g.starts_at)].filter(Boolean).join(' · ')||'Checked by Elitechel Media';
    const actions=document.createElement('div');actions.className='lh-card-actions';
    const here=document.createElement('button');here.type='button';here.textContent='▶ Watch here';here.addEventListener('click',()=>watchHere(g));
    const open=document.createElement('a');open.href=g.url;open.target='_blank';open.rel='noopener noreferrer';open.textContent='Open ↗';
    const multi=document.createElement('a');multi.href='multiview.html?hub=1&add='+encodeURIComponent(g.url);multi.textContent='+ Multiview';
    actions.append(here,open,multi);card.append(eyebrow,title,sub,actions);return card;
  };
  const renderGames=()=>{
    const root=$('gamesStreams');if(!root)return;
    const text=($('gamesFilter')?.value||'').trim().toLowerCase();
    const listed=['lgchl','lg3s'].flatMap(league=>data[league].map(s=>({league,text:[s.display_label,s.metadata?.title,s.url],card:()=>item(s,league)})));
    const added=data.added.map(g=>({league:g.league,text:[g.home_name,g.away_name,g.note,LEAGUES[g.league],g.url],card:()=>addedCard(g)}));
    const all=[...added,...listed];
    const rows=all.filter(r=>(gamesLeague==='all'||r.league===gamesLeague)&&r.text.filter(Boolean).join(' ').toLowerCase().includes(text));
    root.replaceChildren();
    if(rows.length)rows.forEach(r=>root.append(r.card()));
    else {const p=document.createElement('p');p.className='lh-empty';p.textContent=all.length?'No matching games. Try a different league or team.':'No games are listed yet. Know one that should be here? Add it below.';root.append(p);}
    const count=$('gamesCount');if(count)count.textContent=all.length+' GAME'+(all.length===1?'':'S')+' LISTED';
  };
  $('gamesFilter')?.addEventListener('input',renderGames);
  document.querySelectorAll('[data-games-league]').forEach(chip=>chip.addEventListener('click',()=>{
    gamesLeague=chip.dataset.gamesLeague;
    document.querySelectorAll('[data-games-league]').forEach(c=>c.setAttribute('aria-pressed',String(c===chip)));
    renderGames();
  }));
  ['lgchl','lg3s'].forEach(k=>$(k+'Filter')?.addEventListener('input',()=>render(k)));
  async function refresh(){
    if(!db){['lgchl','lg3s','games'].forEach(k=>{const root=$(k+'Streams');if(root)root.textContent='Public channel listings unavailable. Manual multiview is still available.';});return;}
    loadAdded();
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
      renderGames();
    }catch(e){
      console.warn('Public stream listings unavailable',e);
      ['lgchl','lg3s','games'].forEach(k=>{const root=$(k+'Streams');if(root){root.replaceChildren();const p=document.createElement('p');p.className='lh-empty';p.textContent='Public listings could not be loaded. Please try later, or add a public stream to your personal multiview.';root.append(p);}const n=$(k+'Count');if(n)n.textContent='LIST UNAVAILABLE';});
    }
  }
  async function loadAdded(){
    try{
      const {data:rows,error}=await db.from('live_hub_game_links').select('id,url,league,home_name,away_name,note,starts_at,expires_at').eq('status','approved').gt('expires_at',new Date().toISOString()).order('starts_at',{ascending:true,nullsFirst:false}).limit(100);
      if(error)throw error;
      data.added=(rows||[]).map(g=>({...g,url:canonical(g.url)})).filter(g=>g.url&&!HIDDEN.test(g.url));
    }catch(e){data.added=[];console.warn('Added games unavailable',e);}
    renderGames();
  }
  $('lhAddForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const url=canonical($('lhStreamUrl')?.value),err=$('lhAddError');
    if(!url){if(err)err.textContent='Enter a valid public Twitch channel or YouTube video/live link.';return;}
    location.href='multiview.html?hub=1&add='+encodeURIComponent(url);
  });
  // Keeps each team's stream link current from the public broadcast state. Players are
  // loaded by the Live Hub channels script only while their channel is open.
  const announce=()=>document.dispatchEvent(new CustomEvent('livehub:streams'));
  async function syncGameplay(){
    const link=$('czechiaGameplayLink'),player=$('czechiaPlayer');
    if(!db||!link||!player||document.hidden)return;
    try{
      const result=await db.from('obs_broadcast_state').select('url:payload->>streamUrl').eq('channel','wjhc-czechia').eq('is_public',true).maybeSingle();
      const url=canonical(result.data?.url);
      if(result.error||!url||url===link.href||HIDDEN.test(url))return;
      const source=new URL(url);
      const twitch=source.hostname==='www.twitch.tv';
      const label=twitch?source.pathname.slice(1):'YouTube';
      if(player.hasAttribute('src'))player.src=twitch?'https://player.twitch.tv/?channel='+encodeURIComponent(label)+'&parent='+encodeURIComponent(location.hostname)+'&autoplay=false':'https://www.youtube.com/embed/'+encodeURIComponent(source.searchParams.get('v'));
      link.href=url;
      link.textContent=label+' ↗';
      player.title='Czechia gameplay from '+label;
      announce();
    }catch{/* Keep the existing player during a network interruption. */}
  }
  async function syncBritain(){
    const link=$('gbStreamLink');
    if(!db||!link||document.hidden)return;
    try{
      const result=await db.from('obs_broadcast_state').select('url:payload->>streamUrl').eq('channel','lg3s-gbr').eq('is_public',true).maybeSingle();
      if(result.error)return;
      const url=canonical(result.data?.url);
      const live=url&&!HIDDEN.test(url)?'1':'0';
      if(live===link.dataset.live&&(live==='0'||url===link.href))return;
      link.dataset.live=live;
      link.hidden=live!=='1';
      if(live==='1')link.href=url;
      document.querySelectorAll('.lh-team-note').forEach(note=>{note.textContent=live==='1'?'Stream: '+(new URL(url).hostname==='www.twitch.tv'?new URL(url).pathname.slice(1)+' on Twitch':'YouTube'):'Broadcast appears here when Great Britain is on';});
      announce();
    }catch{/* Keep the current state during a network interruption. */}
  }
  // The All Games player shows the game Elitechel Media hosts (published from the studio's
  // "All Games" desk), or a listed game the viewer chose to watch here.
  const hosted={live:'0',url:'',matchup:'Hosted game',note:'No hosted game right now'};
  let picked=null;
  function paintGamesPlayer(){
    const link=$('gamesStreamLink'),frame=document.querySelector('#ch-games iframe[data-stream-link]'),back=$('gamesBack');
    if(!link||!frame)return;
    const show=picked||hosted;
    $('gamesMatchup').textContent=show.matchup;
    $('gamesNote').textContent=show.note;
    link.dataset.live=hosted.live;
    link.hidden=!picked&&hosted.live!=='1';
    link.href=picked?picked.url:hosted.live==='1'?hosted.url:'multiview.html?hub=1';
    if(picked)frame.dataset.pick=picked.url;else delete frame.dataset.pick;
    if(back){back.hidden=!picked;back.textContent=hosted.live==='1'?'Back to hosted game':'Close';}
    announce();
  }
  function watchHere(g){
    picked={url:g.url,matchup:addedTitle(g),note:[LEAGUES[g.league],g.note].filter(Boolean).join(' · ')};
    paintGamesPlayer();
    document.querySelector('#ch-games .lh-player')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  $('gamesBack')?.addEventListener('click',()=>{picked=null;paintGamesPlayer();});
  async function syncHosted(){
    if(!db||!$('gamesStreamLink')||document.hidden)return;
    try{
      const result=await db.from('obs_broadcast_state').select('url:payload->>streamUrl,home:payload->>homeName,away:payload->>awayName,event:payload->>event').eq('channel','ecm-games').eq('is_public',true).maybeSingle();
      if(result.error)return;
      const row=result.data||{};
      const url=canonical(row.url);
      const live=url&&!HIDDEN.test(url)?'1':'0';
      const home=String(row.home||'').trim(),away=String(row.away||'').trim();
      const next={live,url:live==='1'?url:'',
        matchup:live==='1'?(home&&away?home+' vs '+away:home||away||'Hosted game'):'Hosted game',
        note:live==='1'?(String(row.event||'').trim()||'Hosted by Elitechel Media'):'No hosted game right now'};
      if(Object.keys(next).every(k=>next[k]===hosted[k]))return;
      Object.assign(hosted,next);
      paintGamesPlayer();
    }catch{/* Keep the current state during a network interruption. */}
  }
  const syncTeams=()=>{syncGameplay();syncBritain();syncHosted();};
  syncTeams();
  setInterval(syncTeams,15000);
  document.addEventListener('visibilitychange',syncTeams);
  // Add a game. Anyone signed in with Discord can send one; it only shows after Elitechel Media
  // approves it. This client keeps the site-wide sign-in; the one above stays anonymous.
  const form=$('gamesAddForm');
  const AUTH_ORIGIN='https://wildmanhockey-elitechelmedia.app';
  const DRAFT='lh-add-game-draft';
  const authDb=form&&window.supabase?.createClient(API,KEY);
  const fields={url:'gamesAddUrl',home_name:'gamesAddHome',away_name:'gamesAddAway',league:'gamesAddLeague',starts:'gamesAddStart',note:'gamesAddNote'};
  let signedIn=false,reviewer=false;
  const say=(text,tone)=>{const el=$('gamesAddStatus');if(!el)return;el.textContent=text;if(tone)el.dataset.tone=tone;else delete el.dataset.tone;};
  const draft=()=>Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,$(id)?.value||'']));
  function paintForm(){
    const label=$('gamesAddSubmit')?.querySelector('span');
    if(label)label.textContent=signedIn?(reviewer&&$('gamesAddNow')?.checked?'Add to the site':'Send for review'):'Sign in with Discord to add';
    $('gamesAddNowRow').hidden=!reviewer;
    $('gamesAddReview').hidden=!reviewer;
  }
  async function readSession(){
    try{
      const {data}=await authDb.auth.getSession();
      signedIn=!!data.session;
      reviewer=false;
      if(signedIn){const r=await authDb.rpc('ecm_live_hub_can_review');reviewer=r.data===true;}
    }catch{signedIn=false;reviewer=false;}
    paintForm();
  }
  if(form&&authDb){
    try{const saved=JSON.parse(sessionStorage.getItem(DRAFT)||'null');if(saved)Object.entries(fields).forEach(([k,id])=>{if(saved[k]&&$(id))$(id).value=saved[k];});}catch{}
    authDb.auth.onAuthStateChange(event=>{
      if(event==='SIGNED_IN'&&sessionStorage.getItem(DRAFT)){sessionStorage.removeItem(DRAFT);setTimeout(()=>{location.hash='#games-add';say('Signed in. Check the details and send the game.');},0);}
      setTimeout(readSession,0);
    });
    readSession();
    $('gamesAddNow')?.addEventListener('change',paintForm);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!signedIn){
        sessionStorage.setItem(DRAFT,JSON.stringify(draft()));
        const local=['localhost','127.0.0.1'].includes(location.hostname);
        const {error}=await authDb.auth.signInWithOAuth({provider:'discord',options:{redirectTo:(local?location.origin:AUTH_ORIGIN)+'/esports-hub.html',scopes:'identify'}});
        if(error){sessionStorage.removeItem(DRAFT);say('Discord sign-in is unavailable right now. Please try again later.','error');}
        return;
      }
      const d=draft();
      // People often paste links without https:// (twitch.tv/name) or with http://.
      const url=canonical(d.url.trim().replace(/^http:\/\//i,'https://').replace(/^(?!https:\/\/)/i,'https://'));
      Object.values(fields).forEach(id=>$(id)?.removeAttribute('aria-invalid'));
      const bad=id=>{$(id)?.setAttribute('aria-invalid','true');$(id)?.focus();};
      if(!url||HIDDEN.test(url)){bad(fields.url);say('Use a public Twitch channel link or a YouTube video or live link.','error');return;}
      if(!d.home_name.trim()){bad(fields.home_name);say('Add the home team.','error');return;}
      if(!d.away_name.trim()){bad(fields.away_name);say('Add the away team.','error');return;}
      const starts=d.starts?new Date(d.starts):null;
      const now=reviewer&&$('gamesAddNow')?.checked;
      const button=$('gamesAddSubmit');button.disabled=true;say('Sending…');
      try{
        const {error}=await authDb.from('live_hub_game_links').insert({url,league:d.league||'other',home_name:d.home_name.trim(),away_name:d.away_name.trim(),note:d.note.trim()||null,starts_at:starts&&!isNaN(starts)?starts.toISOString():null,status:now?'approved':'pending'});
        if(error)throw error;
        form.reset();paintForm();
        say(now?'Added. It is on All Games now and comes off in 7 days.':'Thanks! Your game was sent. It shows here once Elitechel Media checks it.','ok');
        if(now)loadAdded();
      }catch(err){
        const msg=String(err?.message||'');
        say(/already listed|5 games a day|Sign in/.test(msg)?msg:'The game could not be sent. Check the details and try again.','error');
        if(/JWT|session/i.test(msg))readSession();
      }finally{button.disabled=false;}
    });
  }
  refresh();
})();
