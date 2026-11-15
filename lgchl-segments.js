/* EliteChel Season 55 Interactive Playoffs
   Same canonical bracket for all segments; only published editor records appear.
   Polls and video moments require verified published data. */
(()=>{'use strict';
const C=window.ECMPlayoffSegments,root=document.getElementById('segApp');
if(!C||!root)return;
const view=document.body.dataset.segmentView;
const $=id=>document.getElementById(id),E=C.escape;
const BASE='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const bracketUrl='/api/lgchl-playoffs',snapUrl='assets/lgchl/playoffs/s55.json';
const state={data:null,source:'',editorial:[],players:[],league:'ALL',conference:'ALL',round:'ALL',search:'',polls:[],ts:0};
const qs=new URLSearchParams(location.search);
const labelClass=s=>String(s||'').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
const logo=id=>C.validId(id)?'assets/lgchl/s55/team'+Number(id)+'.png':'assets/brand/ecm-crest.webp';
const allowedExternal=u=>{try{const v=new URL(u);return v.protocol==='https:'&&['www.leaguegaming.com','leaguegaming.com','www.twitch.tv','twitch.tv','clips.twitch.tv','www.youtube.com','youtube.com','youtu.be'].includes(v.hostname)?v.href:null;}catch{return null;}};
const fmt=iso=>{const n=Date.parse(iso||'');return Number.isFinite(n)?new Intl.DateTimeFormat('en-CA',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}).format(n)+' ET':'Time unconfirmed';};
const teamName=id=>state.data?.teams?.[id]?.name||'Opponent TBD';
const thumb=(id,alt='')=>'<img src="'+logo(id)+'" loading="lazy" width="72" height="72" alt="'+E(alt)+'">';
const teamLink=id=>'road-to-cup.html?team='+Number(id);
const rivalryLink=s=>'rivalry-report.html?series='+encodeURIComponent(s.id);
const cardButton=(text,href)=>'<a href="'+href+'">'+E(text)+' →</a>';
const sourceLabel=()=>state.source==='snapshot'||state.data?.stale?'Saved/delayed official bracket':'Current official bracket feed';
const ed=(kind,target)=>state.editorial.find(r=>r.kind===kind&&String(r.target_id)===String(target)&&r.published===true)||null;
function line(s){return s?.length?s.map(x=>'<li>'+E(x)+'</li>').join(''):''}
function sortTeams(a,b){return String(a?.name||'').localeCompare(String(b?.name||''))}
function selectors(type){
 $('segControls').innerHTML='<label>League<select id="segLeague"><option value="ALL">All three leagues</option><option value="OHL">OHL</option><option value="WHL">WHL</option><option value="QMJHL">QMJHL</option></select></label>'+
  (type==='pressure'?'<label>Conference<select id="segConf"><option value="ALL">All conferences</option><option value="Eastern">Eastern</option><option value="Western">Western</option></select></label><label>Round<select id="segRound"><option value="ALL">All rounds</option><option value="R1">Round One</option><option value="R2">Round Two</option><option value="R3">Conference Final</option><option value="LF">League Final</option><option value="SF">Cup Semifinal</option><option value="F">Cup Final</option></select></label>':
  type==='rivalry'?'<label>Round<select id="segRound"><option value="ALL">All rounds</option><option value="R1">Round One</option><option value="R2">Round Two</option><option value="R3">Conference Final</option><option value="LF">League Final</option><option value="SF">Cup Semifinal</option><option value="F">Cup Final</option></select></label>':'')+
  '<label class="seg-search">Find '+(type==='road'?'a team':'team or series')+'<input id="segSearch" type="search" maxlength="70" placeholder="Search by name"></label>';
 $('segLeague').value=state.league;
 if($('segConf'))$('segConf').value=state.conference;
 if($('segRound'))$('segRound').value=state.round;
 $('segSearch').value=state.search;
 $('segControls').addEventListener('change',e=>{
  if(e.target.id==='segLeague')state.league=e.target.value;
  if(e.target.id==='segConf')state.conference=e.target.value;
  if(e.target.id==='segRound')state.round=e.target.value;
  render();
 });
 $('segSearch').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();render()});
}
function matchTeam(team){return(team&&(state.league==='ALL'||team.league===state.league)&&team.name.toLowerCase().includes(state.search));}
function pressureCard(team){
 const info=C.pressure(state.data,team.id,ed('pressure',team.id));if(!info.active)return '';
 const slot=info.slot,score=info.score,rec=info.form?.games||[],other=slot?C.slotTeams(slot).find(id=>id!==team.id):null,previous=info.editorial?.previous_label;
 const detail=rec.length?rec.slice(-3).reverse().map(g=>(g.win===Number(team.id)?'Win':'Loss')+' '+g.gf+'–'+g.ga+(g.at?' · '+fmt(g.at):'')):[];
 const links=slot?.id?[cardButton('Rivalry Report',rivalryLink(slot))]:[];
 links.push(cardButton('Team journey',teamLink(team.id)));
 return'<article class="seg-card" style="--seg-bg:url('+logo(team.id)+')"><div class="seg-card-topline"><span class="seg-status '+labelClass(info.label)+'">'+E(info.label)+'</span><small>'+E(slot?.roundTitle||'Playoff field')+'</small></div>'+
  '<div class="seg-card-title">'+thumb(team.id)+'<div><h3>'+E(team.name)+'</h3><p>'+E(team.league||'')+' · '+E(slot?.conference||'')+'</p></div></div>'+
  '<div class="seg-score">'+(score?'Series '+score.for+' <em>–</em> '+score.against:'Current series pending')+'</div><p>'+E(info.reason)+'</p>'+
  (previous&&previous!==info.label?'<p><strong>Movement:</strong> '+E(previous)+' → '+E(info.label)+' · editorial revision</p>':'')+
  (slot&&detail.length?'<details class="seg-details"><summary>Verified recent results</summary><ul>'+line(detail)+'</ul></details>':'')+
  '<div class="seg-card-foot">'+links.join('')+'</div></article>';
}
function renderPressure(){
 const p=Object.values(state.data.teams||{}).filter(team=>matchTeam(team)).map(team=>({team,info:C.pressure(state.data,team.id,ed('pressure',team.id))}))
 .filter(x=>x.info.active&&(state.conference==='ALL'||x.info.slot?.conference===state.conference)&&(state.round==='ALL'||x.info.slot?.stage===state.round));
 const priority=['ON THE BRINK','RED HOT','BUILT DIFFERENT','FEELING THE HEAT','ICE COLD','IN THE FIGHT','AWAITING FIRST PUCK','AWAITING VERIFIED SCORE'];
 p.sort((a,b)=>priority.indexOf(a.info.label)-priority.indexOf(b.info.label)||sortTeams(a.team,b.team));
 $('segTitle').textContent='The Pressure Cooker · '+p.length+' active teams';
 root.innerHTML=p.length?'<div class="seg-grid">'+p.map(x=>pressureCard(x.team)).join('')+'</div>':'<p class="seg-empty">No active playoff teams match these filters. Eliminated teams remain accessible through Road to the Cup.</p>';
}
function seriesTeams(s){const ids=C.slotTeams(s);return ids.map(x=>state.data.teams?.[x]).filter(Boolean);}
function seriesPreview(s){
 const teams=seriesTeams(s),a=teams[0],b=teams[1],score=C.scoreFor(s,a.id),win=C.verifiedWinner(s);
 return '<article class="seg-card"><div class="seg-card-topline"><span class="seg-status '+(win?'advancing':'in-the-fight')+'">'+(win?'SERIES DECIDED':'SERIES ACTIVE')+'</span><small>'+E(s.league)+' · '+E(s.roundTitle)+'</small></div><div class="seg-vs"><div class="seg-vs-team">'+thumb(a.id)+'<h3>'+E(a.nick||a.name)+'</h3></div><span class="seg-vs-mark">VS</span><div class="seg-vs-team">'+thumb(b.id)+'<h3>'+E(b.nick||b.name)+'</h3></div></div><p class="seg-series-score">'+(score?score.for+' : '+score.against:'Awaiting verified score')+'</p><p>'+E(C.seriesStory(state.data,s))+'</p><div class="seg-card-foot">'+cardButton('Full Rivalry Report',rivalryLink(s))+cardButton('A journey',teamLink(a.id))+cardButton('B journey',teamLink(b.id))+'</div></article>';
}
function seriesStats(s,id){
 const score=C.scoreFor(s,id),games=C.finalGames(s),wins=games.filter(g=>(Number(g.away_score)>Number(g.home_score)?Number(g.away):Number(g.home))===id).length;
 const gf=games.reduce((sum,g)=>sum+Number(g.away===id?g.away_score:g.home_score),0);
 const ga=games.reduce((sum,g)=>sum+Number(g.away===id?g.home_score:g.away_score),0);
 return{score,wins,finals:games.length,gf,ga};
}
function printVerifiedGames(s){
 const games=C.finalGames(s);
 if(!games.length)return'<p>Individual completed-game scores are not yet verified in the bracket feed.</p>';
 return games.map(g=>'<div class="seg-game"><span>Game '+E(g.n||'?')+' · '+E(fmt(g.at))+'</span><strong>'+E(teamName(g.away))+' '+Number(g.away_score)+' – '+Number(g.home_score)+' '+E(teamName(g.home))+'</strong>'+(allowedExternal(g.url)?'<a href="'+E(allowedExternal(g.url))+'" target="_blank" rel="noopener noreferrer">Box score ↗</a>':'')+'</div>').join('');
}
function spotlights(s,editorial){
 const targets=Array.isArray(editorial?.players)?editorial.players:[];
 const ids=new Set(C.slotTeams(s).map(Number));
 const rows=targets.map(x=>{const p=state.players.find(p=>Number(p.lg_user_id)===Number(x.player_id)&&Number(p.lg_team_id)===Number(x.team_id)&&p.verified===true);return p?{p,x}:null}).filter(Boolean).filter(x=>ids.has(Number(x.p.lg_team_id)));
 if(!rows.length)return'';
 return'<section class="seg-panel"><h3>PLAYERS TO WATCH</h3><p>Verified playoff stat leaders chosen by the editorial desk.</p>'+rows.map(({p,x})=>'<div class="seg-spotlight">'+thumb(p.lg_team_id)+'<div><strong>'+E(p.gamertag)+'</strong><small>'+E(x.role||p.player_kind)+' · '+(p.player_kind==='goalie'?'SV% '+(Number(p.save_pct||0)*100).toFixed(1)+' · GP '+Number(p.gp):'PTS '+Number(p.points||0)+' · GP '+Number(p.gp))+'</small>'+(x.note?'<small>'+E(x.note)+'</small>':'')+'</div><a href="player-cards.html?league=lgchl&amp;id='+Number(p.lg_user_id)+'">Hockey Card →</a></div>').join('')+'</section>';
}
function verifiedMoment(s,editorial){
 const m=editorial?.moment;if(!m?.verified||!m?.game_id||!m?.description)return'';
 const game=C.finalGames(s).find(g=>Number(g.id)===Number(m.game_id));
 const link=allowedExternal(m.url);
 if(!game||!link)return'';
 return'<section class="seg-panel"><h3>THE MOMENT THAT CHANGED EVERYTHING</h3><p>'+E(m.description)+'</p><p>Game '+E(game.n||'?')+(m.period&&m.clock?' · Period '+E(m.period)+' · '+E(m.clock):'')+'</p><a class="seg-action" href="'+E(link)+'" target="_blank" rel="noopener noreferrer">Watch verified replay ↗</a></section>';
}
function renderReport(s){
 if(!s){root.innerHTML='<p class="seg-empty">That series is not in the current verified playoff bracket. Choose another matchup.</p>';return}
 const teams=seriesTeams(s),a=teams[0],b=teams[1],sa=seriesStats(s,a.id),sb=seriesStats(s,b.id),editor=ed('rivalry',s.id);
 const stats=['Series wins','GF in verified finals','GA in verified finals'];
 const vals=[[sa.score?.for,sa.score?.against],[sa.finals?sa.gf:null,sb.finals?sb.gf:null],[sa.finals?sa.ga:null,sb.finals?sb.ga:null]];
 const tape=stats.map((l,i)=>'<div class="seg-stat"><small>'+E(l)+'</small><b>'+(vals[i][0]??'—')+' : '+(vals[i][1]??'—')+'</b></div>').join('');
 const narrative=editor?.body?'<p>'+E(editor.body).replace(/\n/g,'</p><p>')+'</p>':'<p>'+E(C.seriesStory(state.data,s))+'</p>';
 const story='<section class="seg-panel"><p class="seg-kicker">'+E(s.league)+' · '+E(s.roundTitle)+' · SERIES #'+E(s.id)+'</p><div class="seg-vs"><div class="seg-vs-team">'+thumb(a.id)+'<h3>'+E(a.name)+'</h3></div><span class="seg-vs-mark">VS</span><div class="seg-vs-team">'+thumb(b.id)+'<h3>'+E(b.name)+'</h3></div></div><div class="seg-series-score">'+(sa.score?sa.score.for+' : '+sa.score.against:'Score pending')+'</div><div class="seg-statgrid">'+tape+'</div><h4>The Story So Far</h4><div class="seg-story">'+narrative+'</div><h4>Verified Series Results</h4>'+printVerifiedGames(s)+'<div class="seg-card-foot">'+cardButton(a.name+' journey',teamLink(a.id))+cardButton(b.name+' journey',teamLink(b.id))+(allowedExternal(s.url)?'<a href="'+E(allowedExternal(s.url))+'" target="_blank" rel="noopener noreferrer">Official series ↗</a>':'')+'</div></section>';
 const sidebar='<section class="seg-panel"><h3>THE TALE OF THE TAPE</h3><p>League: '+E(s.league)+' · '+E(s.conference||'Final')+'</p><p>First to '+E(sa.score?.needed||s.wins_needed||4)+' confirmed series wins. Individual game goals only include verified finals.</p><h4>Series status</h4><p>'+E(C.verifiedWinner(s)?teamName(C.verifiedWinner(s))+' has won the series.':'Unresolved. No winner declared.')+'</p><h4>Share this matchup</h4><button class="seg-share" type="button" data-share>Share Rivalry Report</button><p>Fan polls and additional editorials appear only after verified content is published.</p></section>';
 root.innerHTML='<div class="seg-report"><div>'+story+'</div><aside>'+sidebar+'</aside></div><div class="seg-report" style="margin-top:18px">'+spotlights(s,editor)+verifiedMoment(s,editor)+'</div>';
 $('segTitle').textContent=a.name+' vs '+b.name;
 const share=root.querySelector('[data-share]');if(share)share.addEventListener('click',()=>shareCurrent('Rivalry Report: '+a.name+' vs '+b.name));
}
function renderRivalry(){
 const chosen=qs.get('series');
 if(chosen){const slot=C.allSeries(state.data).find(x=>String(x.id)===chosen);renderReport(slot);return;}
 const list=C.allSeries(state.data).filter(s=>(state.league==='ALL'||s.league===state.league)&&(state.round==='ALL'||s.stage===state.round)&&seriesTeams(s).some(t=>t.name.toLowerCase().includes(state.search))).sort((a,b)=>(ed('rivalry',b.id)?.featured?1:0)-(ed('rivalry',a.id)?.featured?1:0)||a.order-b.order);
 $('segTitle').textContent='Rivalry Report · '+list.length+' playoff series';
 root.innerHTML=list.length?'<div class="seg-grid">'+list.map(seriesPreview).join('')+'</div>':'<p class="seg-empty">No verified matchups match your filters. Return when the bracket confirms the next series.</p>';
}

/* Fan War Room. Polls exist only when editorially published in the separate RLS backend.
   One authenticated user, one vote per poll; aggregate percentages come from recorded votes. */
let fanDb=null;
const fanClient=()=>{if(!fanDb&&window.supabase?.createClient)fanDb=window.supabase.createClient('https://lrgllzvwgvqagcpiyvfd.supabase.co',KEY);return fanDb};
const pollNodeId='segFanWarRoom';
async function renderPolls(){
 const seriesId=C.validId(qs.get('series')),slot=C.allSeries(state.data).find(x=>Number(x.id)===seriesId);if(!slot)return;
 const response=await Promise.allSettled([
  getJSON(BASE+'ecm_s55_rivalry_polls?select=id,series_id,question,options,status,published,updated_at&season=eq.55&published=is.true&series_id=eq.'+seriesId+'&order=updated_at.desc&limit=10',{headers:{apikey:KEY}}),
  fanClient()?.auth.getUser()||Promise.resolve({data:{user:null}})
 ]);
 const polls=response[0].status==='fulfilled'&&Array.isArray(response[0].value)?response[0].value:[];
 let node=document.getElementById(pollNodeId);
 if(!polls.length){node?.remove();return}
 if(!node){node=document.createElement('section');node.id=pollNodeId;node.className='seg-panel';node.style.marginTop='20px';root.appendChild(node)}
 const user=response[1].status==='fulfilled'?response[1].value?.data?.user:null;
 const prior=new Set();
 if(user&&fanClient()){
  const ids=polls.map(p=>p.id);
  const {data}=await fanClient().from('ecm_s55_rivalry_votes').select('poll_id').in('poll_id',ids).eq('voter_id',user.id);
  for(const row of data||[])prior.add(row.poll_id);
 }
 node.innerHTML='<p class="seg-kicker">COMMUNITY · SEPARATE FROM THE PREDICTOR</p><h3>FAN WAR ROOM</h3><p>One vote per signed-in account, per poll. Percentages are based on actual submitted votes.</p>'+
 polls.map(p=>{
  const options=Array.isArray(p.options)?p.options:[],voted=prior.has(p.id),closed=p.status!=='open';
  if(options.length<2||options.length>5)return'';
  return'<article class="seg-poll" data-poll="'+E(p.id)+'"><p class="seg-kicker">'+(closed?'CLOSED':'OPEN')+' POLL · '+E(fmt(p.updated_at))+'</p><h4>'+E(p.question)+'</h4>'+
   (voted||closed?'<div class="seg-poll-results" data-results="'+E(p.id)+'">Loading recorded votes…</div>':
   user?'<div class="seg-poll-answers">'+options.map((x,i)=>'<button type="button" data-vote="'+i+'" data-poll-id="'+E(p.id)+'">'+E(x)+'</button>').join('')+'</div>':
   '<p>Sign into your EliteChel account to vote. Voting results appear after you vote or when the poll closes.</p><a class="seg-action" href="management.html">EliteChel account sign-in →</a>')+
   '</article>';
 }).join('');
 for(const p of polls){
  if(prior.has(p.id)||p.status!=='open')updatePollResult(p);
 }
 node.querySelectorAll('button[data-vote]').forEach(button=>button.addEventListener('click',async()=>{
  const id=button.dataset.pollId,p=polls.find(x=>x.id===id),choice=Number(button.dataset.vote);
  if(!user||!p||p.status!=='open'||!Number.isInteger(choice)||choice<0||choice>=p.options.length)return;
  button.disabled=true;
  let status=node.querySelector('[data-poll-status="'+id+'"]');
  if(!status){status=document.createElement('p');status.dataset.pollStatus=id;button.parentNode.after(status)}
  status.textContent='Recording your vote…';
  const {error}=await fanClient().from('ecm_s55_rivalry_votes').insert({poll_id:id,voter_id:user.id,choice});
  if(error){status.textContent=error.code==='23505'?'You have already voted in this poll.':'Vote was not recorded: '+(error.message||'Try again.');button.disabled=false;return;}
  status.textContent='Vote recorded. Showing actual results.';
  const article=node.querySelector('[data-poll="'+id+'"]'),answers=article?.querySelector('.seg-poll-answers');
  if(answers){const fresh=document.createElement('div');fresh.className='seg-poll-results';fresh.dataset.results=id;answers.replaceWith(fresh)}
  updatePollResult(p);
 }));
}
async function updatePollResult(p){
 const holder=root.querySelector('[data-results="'+p.id+'"]');if(!holder)return;
 try{
  const r=await fetch('https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/rpc/ecm_s55_poll_results',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_poll_id:p.id}),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Results temporarily unavailable');
  const data=await r.json(),total=Number(data?.total||0),counts=Array.isArray(data?.counts)?data.counts:[];
  holder.innerHTML='<small>'+total+' recorded vote'+(total===1?'':'s')+'</small>'+
   p.options.map((x,i)=>{const n=Number(counts[i]||0),pct=total>0?Math.round(n*100/total):0;return'<div class="seg-poll-result"><div><span>'+E(x)+'</span><strong>'+pct+'% · '+n+'</strong></div><div class="seg-poll-track"><i style="width:'+pct+'%"></i></div></div>'}).join('');
 }catch{holder.textContent='Verified vote counts are temporarily unavailable.'}
}

function stageCard(s,team){
 const label=s.state==='PENDING'||s.state==='LOCKED'?'Opponent TBD':s.state==='BYE'?'Confirmed bye':s.opponent?.name||'Opponent TBD';
 const cls=labelClass(s.state);
 return'<article class="seg-road-stage is-'+cls+'"><p class="seg-kicker">'+E(s.title)+'</p><h4>'+E(s.state==='BYE'?'BYE · ADVANCE':s.state==='LOCKED'?'LOCKED':s.state==='ADVANCED'?'SURVIVE & ADVANCE':s.state)+'</h4><div class="seg-stage-opp">'+(s.opponent?thumb(s.opponent.id):'')+'<strong>'+E(label)+'</strong></div><p>'+((s.score&&s.slot?.kind==='series')?'Series '+s.score.for+'–'+s.score.against:'')+'</p><p>'+(s.state==='PENDING'?'Future opponent not confirmed':s.state==='LOCKED'?'Playoff journey finished before this round':s.state==='BYE'?'Officially seeded through this round':s.state==='ADVANCED'?'Series winner confirmed':s.state==='ELIMINATED'?'Series loss confirmed':s.state==='ACTIVE'?'Currently competing':'Waiting for a verified matchup')+'</p>'+(s.slot?.id?'<a class="seg-action" href="'+rivalryLink(s.slot)+'">View Rivalry Report →</a>':'')+'</article>';
}
function renderRoad(){
 const teams=Object.values(state.data.teams||{}).filter(t=>(state.league==='ALL'||t.league===state.league)&&t.name.toLowerCase().includes(state.search)).sort(sortTeams);
 const id=C.validId(qs.get('team'))||Number(teams[0]?.id);
 const team=state.data.teams[id];
 const tiles='<div class="seg-tilegrid">'+teams.map(t=>'<button type="button" class="seg-tile" data-team="'+t.id+'" aria-pressed="'+String(Number(t.id)===id)+'">'+thumb(t.id)+'<span>'+E(t.nick||t.name)+'</span></button>').join('')+'</div>';
 if(!team){root.innerHTML='<p class="seg-empty">Choose a playoff team to view its confirmed journey.</p>'+tiles;return;}
 const status=C.teamState(state.data,id),steps=C.journey(state.data,id),published=ed('road',id);
 $('segTitle').textContent=team.name+' · Road to the Cup';
 root.innerHTML='<section class="seg-road-header">'+thumb(id)+'<div><p class="seg-kicker">'+E(team.league)+' · PLAYOFF JOURNEY</p><h3>'+E(team.name)+'</h3><p>'+E(status.reason)+'</p><span class="seg-status '+labelClass(status.status)+'">'+E(status.status)+'</span></div><button type="button" class="seg-share" data-share>Share Your Road</button></section><div class="seg-road">'+steps.map(s=>stageCard(s,team)).join('')+'</div>'+
 (published?.body?'<section class="seg-panel" style="margin-top:20px"><h3>TEAM PLAYOFF STORY</h3><p>'+E(published.body).replace(/\n/g,'</p><p>')+'</p><small>Editorial analysis · '+E(fmt(published.updated_at))+'</small></section>':'')+
 '<section class="seg-panel" style="margin-top:22px"><h3>FIND YOUR TEAM</h3><p>Choose any officially listed playoff team. The path always comes from the existing bracket.</p>'+tiles+'</section>';
 root.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{qs.set('team',b.dataset.team);history.replaceState(null,'','road-to-cup.html?'+qs.toString());renderRoad()}));
 root.querySelector('[data-share]').addEventListener('click',()=>shareCurrent(team.name+' · Road to the Cup'));
}
function shareCurrent(title){
 const u=location.href;if(navigator.share){navigator.share({title,url:u}).catch(()=>{});return}
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(u).then(()=>{const el=root.querySelector('[data-share]');if(el)el.textContent='Link copied'}).catch(()=>{});}
}
function render(){if(!state.data)return;if(view==='pressure')renderPressure();else if(view==='rivalry')renderRivalry();else if(view==='road')renderRoad();}
async function getJSON(url,opts={}){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(18000),...opts});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
async function load(){
 const result=await Promise.allSettled([getJSON(bracketUrl),getJSON(snapUrl),getJSON(BASE+'ecm_s55_segment_editorial?select=kind,target_id,label,previous_label,reason,body,players,moment,featured,published,updated_at&season=eq.55&published=is.true',{headers:{apikey:KEY}}),getJSON(BASE+'ecm_lgchl_s55_playoff_public_players?select=lg_user_id,lg_team_id,gamertag,player_kind,gp,goals,assists,points,save_pct,gaa,verified&verified=is.true&limit=1000',{headers:{apikey:KEY}})]);
 const candidates=result.slice(0,2).map((r,i)=>r.status==='fulfilled'&&r.value?.teams&&r.value?.leagues&&r.value?.matchups?{data:r.value,source:i?'snapshot':'live'}:null).filter(Boolean).sort((a,b)=>Date.parse(b.data.fetched_at||0)-Date.parse(a.data.fetched_at||0));
 if(!candidates.length){$('segUpdated').textContent='Playoff bracket unavailable';root.innerHTML='<p class="seg-empty">Official playoff results are unavailable. No team status or series score has been invented. <a href="index.html#bracket">Return to the bracket.</a></p>';return;}
 state.data=candidates[0].data;state.source=candidates[0].source;state.editorial=result[2].status==='fulfilled'&&Array.isArray(result[2].value)?result[2].value:[];state.players=result[3].status==='fulfilled'&&Array.isArray(result[3].value)?result[3].value:[];
 const age=Date.parse(state.data.fetched_at||'');const delayed=state.data.stale||state.source==='snapshot';
 $('segUpdated').textContent=sourceLabel()+' · '+(Number.isFinite(age)?fmt(state.data.fetched_at):'time unverified')+(delayed?' · delayed source':'');
 $('segSource').textContent='All scores, advancement and team IDs come from the existing official Season 55 playoff bracket. '+(delayed?'Source is a saved or delayed snapshot: results may have changed. ':'')+'Automated pressure labels use only series scores and verified final games. “Built Different” and featured stories require authorized editorial publication. No playoff player totals are fabricated.';
 selectors(view);render();if(view==='rivalry'&&qs.get('series'))renderPolls().catch(()=>{});
}
load();
setInterval(()=>{if(!document.hidden)load()},180000);
})();