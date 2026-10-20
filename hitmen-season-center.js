/* Calgary Hitmen Game Center. Public LeagueGaming imports, not old Pro Series games. */
(() => {
 'use strict';
 const url='https://lrgllzvwgvqagcpiyvfd.supabase.co';
 const key='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
 const db=window.supabase?.createClient(url,key);
 const TEAM=412, SEASON=55, $=id=>document.getElementById(id);
 if(!db||!$('hitmenSeasonGames'))return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const S={games:[],teams:new Map(),recaps:new Map(),sources:[],filter:'all',week:'all',broadcast:'',loading:false,expanded:false};
 const official=id=>'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+encodeURIComponent(id);
 const time=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(date));
 const team=id=>S.teams.get(id)||'Team '+id;
 function isFinal(g){return g.status==='final'&&g.home_score!=null&&g.away_score!=null;}
 function cgScore(g){return g.home_lg_team_id===TEAM?g.home_score:g.away_score;}
 function oppScore(g){return g.home_lg_team_id===TEAM?g.away_score:g.home_score;}
 function opponent(g){return team(g.home_lg_team_id===TEAM?g.away_lg_team_id:g.home_lg_team_id);}
 function recap(g){return S.recaps.get(Number(g.lg_game_id));}
 function gameCard(g){
  const final=isFinal(g),home=g.home_lg_team_id===TEAM;
  const result=final?(cgScore(g)>oppScore(g)?'WIN':cgScore(g)<oppScore(g)?'LOSS':'TIE'):(g.status==='live'?'LIVE':'UPCOMING');
  const article=document.createElement('article');article.className='hg-game '+(final?(result==='WIN'?'hg-win':'hg-loss'):'hg-upcoming');
  const top=document.createElement('div');top.className='hg-game-top';
  top.innerHTML='<span>WEEK '+esc(g.week||'?')+' · '+esc(time(g.game_at))+' ET</span><b>'+esc(result)+'</b>';
  const centre=document.createElement('div');centre.className='hg-game-center';
  centre.innerHTML='<div class="hg-matchup"><strong>CALGARY HITMEN</strong><small>'+esc(home?'HOME':'AWAY')+' VS '+esc(opponent(g))+'</small></div><div class="hg-score">'+(final?esc(cgScore(g))+' <em>–</em> '+esc(oppScore(g)):'<small>VS</small>')+'</div>';
  const bottom=document.createElement('div');bottom.className='hg-game-links';
  const l=document.createElement('a');l.href=g.source_url?.startsWith('https://www.leaguegaming.com/')?g.source_url:official(g.lg_game_id);l.target='_blank';l.rel='noopener noreferrer';l.textContent='LG Game / Box Score ↗';
  bottom.append(l);
  const m=recap(g);if(m){const r=document.createElement('a');r.href='hitmen-media.html#game-'+g.lg_game_id;r.textContent='Read Game Story →';r.title=m.title;bottom.append(r);}
  article.append(top,centre,bottom);return article;
 }
 function render(){
  const root=$('hitmenSeasonGames');root.replaceChildren();
  let rows=S.games.filter(g=>S.week==='all'||String(g.week)===S.week).filter(g=>S.filter==='all'||(S.filter==='final'?isFinal(g):S.filter==='upcoming'?!isFinal(g):g.status==='live'));
  const totalFiltered=rows.length;
  // Upcoming first, then completed from newest to oldest. Reordering is display-only.
  rows.sort((a,b)=>Number(isFinal(a))-Number(isFinal(b))||(!isFinal(a)?Date.parse(a.game_at)-Date.parse(b.game_at):Date.parse(b.game_at)-Date.parse(a.game_at)));
  if(!S.expanded && S.filter==='all' && S.week==='all'){
    const upcoming=rows.filter(g=>!isFinal(g)).slice(0,9);
    const recent=rows.filter(isFinal).slice(0,9);
    rows=[...upcoming,...recent];
  }
  const show=$('hitmenShowAll');if(show){show.hidden=totalFiltered<=rows.length;show.textContent=S.expanded?'Showing Full Season':'Show All '+totalFiltered+' Season Games';}
  if(!rows.length){root.innerHTML='<div class="empty-state">No Calgary games match these filters yet.</div>';return;}
  let currentWeek='';
  rows.forEach(g=>{
   const week='WEEK '+(g.week||'?');if(week!==currentWeek){currentWeek=week;const h=document.createElement('h3');h.className='hg-week';h.textContent=week;root.append(h);}
   root.append(gameCard(g));
  });
  const finals=S.games.filter(isFinal).length,up=S.games.length-finals;
  $('hitmenGamesCount').textContent=finals+' FINAL · '+up+' UPCOMING';
  $('hitmenSeasonStatus').textContent='LGCHL S55 · '+S.games.length+' SCHEDULED / RECORDED GAMES';
  $('seasonRefreshStamp').textContent='Imported data refreshed '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
 }
 function sourceKey(s){return s.metadata?.channel_key||'hitmen';}
 function twitchEmbed(raw){
  try{
   const u=new URL(raw);const host=u.hostname.toLowerCase();
   if(!['www.twitch.tv','twitch.tv'].includes(host))return '';
   const name=u.pathname.split('/').filter(Boolean)[0];if(!/^[\w]{3,25}$/.test(name))return '';
   return 'https://player.twitch.tv/?channel='+encodeURIComponent(name)+'&parent='+encodeURIComponent(location.hostname)+'&autoplay=false&muted=true';
  }catch{return '';}
 }
 function renderBroadcast(){
  const picker=$('broadcastChannelPicker'),stage=$('featuredBroadcast');
  picker.replaceChildren();
  if(!S.sources.length){stage.innerHTML='<div class="featured-placeholder"><strong>No assigned broadcast channels</strong><p>Elitechel can add public Twitch sources in the management console.</p></div>';$('liveBroadcastCount').textContent='NO CHANNEL ATTACHED';return;}
  const wanted=new URLSearchParams(location.search).get('channel');
  const chosen=S.sources.find(s=>sourceKey(s)===S.broadcast)||S.sources.find(s=>sourceKey(s)===wanted)||S.sources[0];
  S.broadcast=sourceKey(chosen);
  const select=document.createElement('select');select.id='broadcastChannelSelect';select.className='select-field';select.setAttribute('aria-label','Broadcast channel');
  S.sources.forEach((s,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=s.display_label||((sourceKey(s)==='hitmen'?'Calgary Hitmen':'Elitechel')+' channel');opt.selected=s.id===chosen.id;select.append(opt);});
  select.addEventListener('change',()=>{const s=S.sources[Number(select.value)];if(!s)return;S.broadcast=sourceKey(s);const link=new URL(location.href);link.searchParams.set('channel',S.broadcast);history.replaceState(null,'',link);renderBroadcast();});
  const label=document.createElement('label');label.textContent='WATCH CHANNEL ';label.append(select);picker.append(label);
  const hitmenChannel=sourceKey(chosen)==='hitmen';
  const src=hitmenChannel?'public-broadcast-stage.html?channel=hitmen-main':twitchEmbed(chosen.url),id=chosen.id;
  if(stage.dataset.sourceId!==id){
    stage.dataset.sourceId=id;stage.replaceChildren();
    const holder=document.createElement('section');holder.className='hg-broadcast-player';
    if(src){const frame=document.createElement('iframe');frame.src=src;frame.allowFullscreen=true;frame.allow='autoplay; fullscreen; picture-in-picture';frame.title=hitmenChannel?'Calgary Hitmen EliteChel Broadcast Studio':(chosen.display_label||'Calgary Hitmen broadcast');holder.append(frame);}
    else{holder.innerHTML='<div class="featured-placeholder">This channel opens on its streaming provider.</div>';}
    const meta=document.createElement('aside');meta.className='hg-broadcast-meta';
    const title=document.createElement('h3');title.textContent=chosen.display_label||'Hitmen broadcast channel';
    const p=document.createElement('p');p.textContent=hitmenChannel?'Hitmen Broadcast Studio · The stream feed follows configured production sources. Game times and score results below come from the official LGCHL season log.':'Channel attached · A public source is not proof that the streamer is currently live.';
    const link=document.createElement('a');link.className='small-btn';link.href=chosen.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open Stream Source ↗';
    const mv=document.createElement('a');mv.className='small-btn';mv.href='multiview.html';mv.textContent='Launch Multiview →';
    meta.append(title,p,link,mv);stage.append(holder,meta);
  }
  $('liveBroadcastCount').textContent='CHANNEL READY';
  $('liveRefreshStamp').textContent='Source '+(chosen.display_label||'Elitechel');
  document.querySelector('#featured .section-heading h2').textContent=sourceKey(chosen)==='hitmen'?'CALGARY HITMEN LIVE':'ELITECHEL MEDIA CHANNEL';
 }
 async function load(){
  if(S.loading)return;S.loading=true;
  const [games,teams,posts,sources,standing]=await Promise.all([
   db.from('lgchl_games').select('lg_game_id,week,game_at,status,decided_in,home_lg_team_id,away_lg_team_id,home_score,away_score,source_url').eq('season',SEASON).or('home_lg_team_id.eq.'+TEAM+',away_lg_team_id.eq.'+TEAM).order('game_at',{ascending:true}).limit(130),
   db.from('lgchl_teams').select('lg_team_id,name').eq('season',SEASON),
   db.from('media_posts').select('title,source_metrics').eq('published',true).eq('post_type','recap').filter('source_metrics->>team','eq','Calgary Hitmen').limit(90),
   db.from('tournament_automation_sources').select('id,url,display_label,provider,metadata,slot_order').eq('active',true).eq('public_visible',true).order('slot_order').limit(20),
   db.from('lgchl_standings_snapshots').select('w,l,otl,pts,gf,ga,gp,taken_at').eq('season',SEASON).eq('lg_team_id',TEAM).order('taken_at',{ascending:false}).limit(1)
  ]);
  const err=[games,teams,posts,sources,standing].find(x=>x.error);
  if(err){console.error('Hitmen games load',err.error);$('hitmenSeasonGames').innerHTML='<div class="empty-state">LeagueGaming data is temporarily unavailable. Try refreshing this page.</div>';S.loading=false;return;}
  S.games=games.data||[];S.teams=new Map((teams.data||[]).map(t=>[t.lg_team_id,t.name]));S.recaps=new Map((posts.data||[]).filter(p=>p.source_metrics?.lg_game_id).map(p=>[Number(p.source_metrics.lg_game_id),p]));
  S.sources=(sources.data||[]).filter(s=>['twitch','youtube'].includes(s.provider)); // Only channels with valid public provider.
  const last=standing.data?.[0];
  if(last){$('hitmenSeasonRecord').textContent=last.w+'-'+last.l+'-'+last.otl;$('hitmenSeasonGoals').textContent=last.gf+'–'+last.ga;$('hitmenSeasonPoints').textContent=last.pts+' PTS';$('hitmenSeasonStamp').textContent='Official standings snapshot: '+new Date(last.taken_at).toLocaleString();}
  const week=$('gameWeekFilter');let chosen=week.value;
  week.innerHTML='<option value="all">All Weeks</option>'+[...new Set(S.games.map(g=>g.week))].sort((a,b)=>a-b).map(w=>'<option value="'+esc(w)+'">Week '+esc(w)+'</option>').join('');
  week.value=[...week.options].some(o=>o.value===chosen)?chosen:'all';S.week=week.value;
  render();S.loading=false;
 }
 $('gameWeekFilter')?.addEventListener('change',e=>{S.week=e.target.value;render();});
 $('gameStatusFilter')?.addEventListener('change',e=>{S.filter=e.target.value;render();});
 $('hitmenShowAll')?.addEventListener('click',()=>{S.expanded=true;render();});
 $('hitmenRefresh')?.addEventListener('click',load);
 load();setInterval(()=>{if(!document.hidden)load();},60000);
})();
