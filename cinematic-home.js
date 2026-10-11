(() => {
 'use strict';
 const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('.main-nav');
 function close(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');}
 menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=nav.classList.contains('open');close();if(open)menu.focus();}});
 document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))close();});
 const API='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/',KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=v=>{const d=new Date(v);return Number.isNaN(+d)?'Date pending':new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d)+' ET';};
 async function read(table,params){const response=await fetch(API+table+'?'+new URLSearchParams(params),{headers:{apikey:KEY,Authorization:'Bearer '+KEY},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(table+' unavailable');return response.json();}
 function error(id,text){$(id).innerHTML='<p class="empty">'+esc(text)+'</p>';}
 function powerScore(s){const gp=Math.max(1,Number(s.gp||1));return 100*(.70*Math.min(1,s.pts/(2*gp))+.20*Math.max(0,Math.min(1,((s.gf-s.ga)/gp+3)/6))+.10*Math.max(0,Math.min(1,(s.gf/gp)/6)));}
 async function season(){try{
  const [snap,teams,games]=await Promise.all([
   read('lgchl_standings_snapshots',{select:'lg_team_id,gp,w,l,otl,pts,gf,ga,taken_at',season:'eq.55',order:'taken_at.desc',limit:'1000'}),
   read('lgchl_teams',{select:'lg_team_id,name',season:'eq.55'}),
   read('lgchl_games',{select:'lg_game_id,game_at,status,home_lg_team_id,away_lg_team_id,home_score,away_score',season:'eq.55',or:'(home_lg_team_id.eq.412,away_lg_team_id.eq.412)',order:'game_at.asc',limit:'130'})]);
  const names=new Map(teams.map(t=>[t.lg_team_id,t.name])),latest=new Map();snap.forEach(s=>{if(!latest.has(s.lg_team_id))latest.set(s.lg_team_id,s);});
  const cal=latest.get(412);if(cal){$('record').textContent=cal.w+'–'+cal.l+'–'+cal.otl;$('points').textContent=cal.pts;$('played').textContent=cal.gp;$('standings-stamp').textContent='Official standings import · '+date(cal.taken_at);}else $('standings-stamp').textContent='No Season 55 standings import available.';
  const final=g=>g.status==='final'&&g.home_score!==null&&g.away_score!==null;
  const upcoming=games.filter(g=>!final(g)&&Date.parse(g.game_at)>=Date.now()).slice(0,2),recent=games.filter(final).sort((a,b)=>Date.parse(b.game_at)-Date.parse(a.game_at)).slice(0,1);
  $('games').innerHTML=[...upcoming,...recent].map(g=>{const home=g.home_lg_team_id===412,opp=names.get(home?g.away_lg_team_id:g.home_lg_team_id)||'Opponent pending';return '<a class="game-row" href="game-center.html?channel=hitmen#live-board"><div><small>'+esc(final(g)?'Latest final':g.status==='live'?'In progress':'Upcoming')+' · '+esc(date(g.game_at))+'</small><strong>'+esc(home?'vs '+opp:'at '+opp)+'</strong></div><span class="game-score">'+(final(g)?esc(home?g.home_score:g.away_score)+'–'+esc(home?g.away_score:g.home_score):'→')+'</span></a>';}).join('')||'<p class="empty">No upcoming games or recorded finals in the imported schedule.</p>';
  if(!upcoming.length)$('games').insertAdjacentHTML('afterbegin','<p class="feed-note">No future games currently listed in the imported schedule.</p>');
  const rank=[...latest.values()].filter(s=>s.gp>=5).map(s=>({...s,score:powerScore(s)})).sort((a,b)=>b.score-a.score||b.pts-a.pts);
  $('power').innerHTML=rank.slice(0,4).map((s,i)=>'<li><span class="rank">0'+(i+1)+'</span><div><strong>'+esc(names.get(s.lg_team_id)||'Team '+s.lg_team_id)+'</strong><small>'+esc(s.w+'–'+s.l+'–'+s.otl)+' · '+esc(s.pts)+' PTS</small></div><span class="power-value">'+s.score.toFixed(1)+'</span></li>').join('')||'<li>No qualifying standings yet.</li>';
  $('power-stamp').textContent='Wildman model · minimum 5 GP · '+(snap.length?'Imported '+date(snap[0].taken_at):'No import available');
 }catch{error('games','Season data is temporarily unavailable. Open Game Center for the full tracker.');$('standings-stamp').textContent='Standings unavailable — try reloading.';error('power','Power rankings are temporarily unavailable.');}}
 async function stories(){try{const posts=await read('media_posts',{select:'id,title,body,source_metrics,published_at',published:'eq.true',post_type:'eq.recap','source_metrics->>team':'eq.Calgary Hitmen',order:'published_at.desc',limit:'30'});
  posts.sort((a,b)=>Date.parse(b.source_metrics?.sort_at||b.source_metrics?.ended_utc||b.source_metrics?.game_date||b.published_at)-Date.parse(a.source_metrics?.sort_at||a.source_metrics?.ended_utc||a.source_metrics?.game_date||a.published_at));
  const href=p=>{const id=Number(p.source_metrics?.lg_game_id);return 'hitmen-media.html'+(Number.isSafeInteger(id)&&id>0?'#game-'+id:'#hmRecapList');};
  if(!posts.length){error('stories','Published Hitmen stories will appear here after game night.');return;}
  const p=posts[0],lede=(p.body||'').split(/\n\s*\n/).find(x=>x.trim()&&!x.startsWith('##'))||p.source_metrics?.dek||'';
  $('stories').innerHTML='<a class="story-feature" href="'+href(p)+'"><span class="kicker">Featured published recap</span><h3>'+esc(p.title)+'</h3><p>'+esc(lede.slice(0,230))+(lede.length>230?'…':'')+'</p><span class="text-link" style="margin-top:22px">Read the full story →</span></a><div>'+posts.slice(1,4).map(p=>'<a class="story-line" href="'+href(p)+'"><small class="feed-note">'+esc(p.source_metrics?.game_date||'Published recap')+' · LGCHL S55</small><h3>'+esc(p.title)+'</h3></a>').join('')+'</div>';
 }catch{error('stories','Published stories could not load. Visit Hitmen Media for coverage.');}}
 async function broadcasts(){try{const sources=await read('tournament_automation_sources',{select:'url,display_label,provider,metadata,slot_order',active:'eq.true',public_visible:'eq.true',order:'slot_order.asc',limit:'12'});
 const valid=sources.filter(s=>{try{const u=new URL(s.url);return u.protocol==='https:'&&['twitch.tv','www.twitch.tv','youtube.com','www.youtube.com','youtu.be'].includes(u.hostname);}catch{return false;}});
 if(!valid.length){$('broadcast-status').textContent='No public channels assigned';return;}
 $('broadcast-status').textContent=valid.length+' configured channels · live status unverified';
 $('broadcast-rail').innerHTML=valid.map(s=>'<a class="broadcast-item" href="game-center.html?channel='+encodeURIComponent(s.metadata?.channel_key||'hitmen')+'"><span class="broadcast-thumb" aria-hidden="true">▷</span><span><strong>'+esc(s.display_label||'Network broadcast')+'</strong><small>'+esc(s.provider)+' · Channel ready</small></span></a>').join('');
 }catch{$('broadcast-status').textContent='Channel feed unavailable · Multiview remains available';}}
 season();stories();broadcasts();
})();