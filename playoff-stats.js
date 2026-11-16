/* Season 55 postseason-only statistics. Never mix regular season totals into playoff results.
   Source: existing public /api/lgchl-playoffs with an explicitly dated snapshot fallback.
   Skater/goalie rows require a separate, verified playoff game-stat import. */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const safeUrl=v=>typeof v==='string'&&/^https:\/\/www\.leaguegaming\.com\//i.test(v)?v:null;
const fmtDate=s=>{const d=new Date(s);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d):'Schedule pending';};
function completedGame(g){
 return g&&String(g.status).toLowerCase()==='final'&&safeId(g.id)&&safeId(g.away)&&safeId(g.home)&&
 [g.away_score,g.home_score].every(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0)&&Number(g.away_score)!==Number(g.home_score);
}
function playoffSlots(data){
 const slots=[];
 for(const league of data?.leagues||[]){
  for(const conf of league.conferences||[])for(const round of conf.rounds||[])slots.push(...(round.slots||[]));
  if(league.final)slots.push(league.final);
 }
 if(data?.championship?.semi)slots.push(data.championship.semi);
 if(data?.championship?.final)slots.push(data.championship.final);
 return slots;
}
function aggregateTeams(data){
 const teams=Object.values(data?.teams||{}).filter(t=>safeId(t.id)).map(t=>({
   id:Number(t.id),name:String(t.name||t.nick||'Team'),nick:String(t.nick||t.name||'Team'),league:String(t.league||''),
   logo:String(t.logo||('assets/lgchl/s55/team'+Number(t.id)+'.png')),gp:0,w:0,l:0,gf:0,ga:0,gd:0
 }));
 const byId=new Map(teams.map(t=>[t.id,t])),seen=new Set();
 for(const match of playoffSlots(data)){
   for(const g of match.games||[]){
     if(!completedGame(g)||seen.has(Number(g.id)))continue;
     seen.add(Number(g.id));
     const away=byId.get(Number(g.away)),home=byId.get(Number(g.home));
     if(!away||!home)continue;
     const a=Number(g.away_score),h=Number(g.home_score);
     away.gp++;home.gp++;away.gf+=a;away.ga+=h;home.gf+=h;home.ga+=a;
     if(a>h){away.w++;home.l++;}else if(h>a){home.w++;away.l++;}
   }
 }
 return teams.map(t=>({...t,gd:t.gf-t.ga})).sort((a,b)=>b.w-a.w||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));
}
function verifiedPlayerRows(feed,kind){
 const rows=(feed?.[kind]||[]).filter(p=>p&&p.verified===true&&safeId(p.lg_user_id)&&safeId(p.lg_team_id)&&p.source_url&&p.source_checked_at&&/^https:\/\/(www\.)?leaguegaming\.com\//i.test(p.source_url)&&Number.isFinite(Number(p.gp))&&Number(p.gp)>0);
 return rows.sort((a,b)=>kind==='skaters'?Number(b.points||0)-Number(a.points||0)||Number(b.goals||0)-Number(a.goals||0):Number(b.save_pct||0)-Number(a.save_pct||0)||Number(a.gaa||99)-Number(b.gaa||99));
}
function nextSeries(data){
 return playoffSlots(data).filter(m=>m?.kind==='series').map(m=>{
  const sides=(m.sides||[]).slice(0,2).map(x=>({...x,team:data.teams?.[x.team_id]||null}));
  const future=(m.games||[]).filter(g=>g.status==='scheduled'&&g.at&&Date.parse(g.at)>=Date.now()-3600000).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
  return{id:m.id,sides,game:future,match:m};
 }).filter(m=>m.sides.length===2&&m.sides.every(s=>s.team)&&m.game).sort((a,b)=>Date.parse(a.game.at)-Date.parse(b.game.at)).slice(0,12);
}
if(typeof module!=='undefined'&&module.exports){module.exports={aggregateTeams,verifiedPlayerRows,completedGame,nextSeries};return;}
const $=id=>document.getElementById(id);
const state={mode:'teams',league:'ALL',search:'',data:null,feed:null,source:'',spotlights:{skaters:new Map(),goalies:new Map()},error:''};
const logo=t=>{const id=safeId(t.id||t.lg_team_id);return id?'assets/lgchl/s55/team'+id+'.png':'assets/brand/ecm-crest.webp';};
const personCard=(p,kind)=>{
 const id=safeId(p.lg_user_id),team=safeId(p.lg_team_id),value=kind==='skaters'?Number(p.points):Number(p.save_pct)*100;
 const sub=kind==='skaters'?('GP '+Number(p.gp)+' · G '+Number(p.goals||0)+' · A '+Number(p.assists||0)):('GP '+Number(p.gp)+' · GAA '+(p.gaa!==null&&p.gaa!==undefined&&Number.isFinite(Number(p.gaa))?Number(p.gaa).toFixed(2):'—'));
 const score=Number.isFinite(value)?(kind==='skaters'?String(value):value.toFixed(1)+'%'):'—';
 return '<article class="ps-team-card" style="--ps-crest:url('+logo({id:team})+')"><div class="ps-identity"><img src="'+logo({id:team})+'" alt="" loading="lazy"><div><h3>'+esc(p.gamertag||'Player')+'</h3><p>'+esc(p.team_name||'Playoff team')+' · '+esc(sub)+'</p></div></div><strong class="ps-value">'+esc(score)+'<small>'+(kind==='skaters'?'PTS':'SV%')+'</small></strong><a class="ps-link" href="player-cards.html?league=lgchl&amp;id='+id+'&amp;kind='+(kind==='skaters'?'skater':'goalie')+'">Season 55 Hockey Card →</a></article>';
};
function render(){
 const q=state.search.toLowerCase(),box=$('psContent');
 if(state.mode==='teams'){
   const teams=aggregateTeams(state.data||{}).filter(t=>(state.league==='ALL'||t.league===state.league)&&t.name.toLowerCase().includes(q));
   box.innerHTML=teams.length?teams.map(t=>'<article class="ps-team-card" style="--ps-crest:url('+logo(t)+')"><div class="ps-identity"><img src="'+logo(t)+'" loading="lazy" alt=""><div><h3>'+esc(t.name)+'</h3><p>'+esc(t.league)+' · '+t.gp+' playoff games played · '+t.w+'–'+t.l+'</p></div></div><strong class="ps-value">'+t.w+'–'+t.l+'<small>PLAYOFF RECORD</small></strong><div class="ps-mini">GF '+t.gf+' · GA '+t.ga+' · GD '+(t.gd>0?'+':'')+t.gd+'</div><a class="ps-link" href="lgchl-team.html?team='+t.id+'">Team Room →</a></article>').join(''):'<p class="ps-empty">No playoff teams match these filters, or the verified bracket feed is unavailable.</p>';
 }else{
   const rows=verifiedPlayerRows(state.feed,state.mode).filter(p=>(state.league==='ALL'||p.league===state.league)&&[p.gamertag,p.team_name].some(x=>String(x||'').toLowerCase().includes(q)));
   box.innerHTML=rows.length?rows.map(p=>personCard(p,state.mode)).join(''):'<div class="ps-empty"><h3>Verified playoff '+(state.mode==='skaters'?'skater':'goalie')+' records pending</h3><p>The regular-season feed cannot be used as playoff totals. Player-specific postseason rankings will appear after an approved game-by-game import with source box scores.</p><a class="ps-link" href="league-leaderboards.html?league=lgchl">Browse Season 55 regular-season archive →</a></div>';
 }
}
async function readRegularSeasonWatch(kind){
 const rows=[],base='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/wm_lgchl_s55_player_leaders',key='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
 // This selects only published season totals; it never masquerades as playoff statistics.
 for(let off=0;off<(kind==='skater'?1500:500);off+=500){
  const q=new URLSearchParams({select:'lg_team_id,gamertag,player_kind,gp,points,goals,assists,save_pct,gaa',player_kind:'eq.'+kind,gp:'gte.8',order:kind==='skater'?'points.desc.nullslast':'save_pct.desc.nullslast',limit:'500',offset:String(off)});
  const r=await fetch(base+'?'+q,{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('season_watch_'+r.status);
  const part=await r.json();rows.push(...part);if(part.length<500)break;
 }
 const best=new Map();
 for(const p of rows){
  const team=safeId(p.lg_team_id),gp=Number(p.gp);if(!team||!(gp>=8))continue;
  if(kind==='skater'&&!Number.isFinite(Number(p.points)))continue;
  if(kind==='goalie'&&!(Number(p.save_pct)>0&&Number(p.save_pct)<=1))continue;
  const score=kind==='skater'?Number(p.points)/gp:Number(p.save_pct);
  if(!best.has(team)||score>best.get(team).score)best.set(team,{...p,score});
 }
 return best;
}
function renderMatchups(){
 const games=nextSeries(state.data||{});$('psMatchStatus').textContent=games.length?'Upcoming matchups from '+(state.source==='live'?'live bracket feed':'saved bracket snapshot')+'. Predictions are editorial previews, not official odds.':'No upcoming verified series dates in the current feed.';
 $('psMatchups').innerHTML=games.map(m=>{
  const a=m.sides[0],b=m.sides[1],ta=a.team,tb=b.team,seedA=Number(a.seed||ta.seed),seedB=Number(b.seed||tb.seed);
  const favored=seedA>0&&seedB>0&&seedA!==seedB?(seedA<seedB?ta:tb):null;
  const angle=favored?esc(favored.name)+' enters as the higher seed. The opening games will show whether that advantage translates into results.':'The teams begin the series with everything to prove. Game results will establish the early edge.';
  const skA=state.spotlights.skaters.get(Number(ta.id)),skB=state.spotlights.skaters.get(Number(tb.id));
  const gaA=state.spotlights.goalies.get(Number(ta.id)),gaB=state.spotlights.goalies.get(Number(tb.id));
  const scorer=p=>p?esc(p.gamertag)+' ('+Number(p.points)+' PTS in '+Number(p.gp)+' GP)':'not yet verified';
  const keeper=p=>p?esc(p.gamertag)+' ('+(Number(p.save_pct)*100).toFixed(1)+'% SV in '+Number(p.gp)+' GP)':'not yet verified';
  const watch=skA||skB||gaA||gaB?'<div class="ps-watch"><strong>REGULAR-SEASON PLAYERS TO WATCH</strong><p>Scoring: '+scorer(skA)+' · '+scorer(skB)+'</p><p>Goalies: '+keeper(gaA)+' · '+keeper(gaB)+'</p><small>Historical regular-season evidence only; playoff lineup availability is not confirmed.</small></div>':'';
  const href=safeUrl(m.game.url);
  return '<article class="ps-match-card"><p class="ps-overline">'+esc(String(ta.league||tb.league))+' · UPCOMING SERIES</p><div class="ps-vs"><img src="'+logo(ta)+'" alt="" loading="lazy"><h3>'+esc(ta.name)+' <span>VS</span> '+esc(tb.name)+'</h3><img src="'+logo(tb)+'" alt="" loading="lazy"></div><p>'+angle+'</p>'+watch+'<p class="ps-kickoff">Next listed game: '+esc(fmtDate(m.game.at))+'</p>'+(href?'<a class="ps-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">Official game details ↗</a>':'')+'</article>';
 }).join('');
}
async function load(){
 try{
  const [live,snapshot,players]=await Promise.allSettled([
    fetch('/api/lgchl-playoffs',{cache:'no-store',signal:AbortSignal.timeout(18000)}).then(r=>{if(!r.ok)throw Error(String(r.status));return r.json();}),
    fetch('assets/lgchl/playoffs/s55.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(String(r.status));return r.json();}),
    fetch('https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/ecm_lgchl_s55_playoff_public_players?select=season,lg_user_id,lg_team_id,player_kind,gamertag,team_name,league,gp,goals,assists,points,saves,shots_against,goals_against,save_pct,gaa,verified,source_url,source_checked_at&verified=is.true&limit=1000',{headers:{apikey:'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP'},cache:'no-store',signal:AbortSignal.timeout(17000)}).then(async r=>{if(!r.ok)throw Error(String(r.status));const rows=await r.json();return{skaters:rows.filter(p=>p.player_kind==='skater'),goalies:rows.filter(p=>p.player_kind==='goalie')}})

  ]);
  const candidates=[live,snapshot].map((r,i)=>r.status==='fulfilled'&&r.value?.ok&&r.value?.teams&&r.value?.leagues?.length?{data:r.value,source:i===0?'live':'snapshot'}:null).filter(Boolean).sort((a,b)=>Date.parse(b.data.fetched_at||0)-Date.parse(a.data.fetched_at||0));
  if(!candidates.length)throw Error('bracket_unavailable');
  state.data=candidates[0].data;state.source=candidates[0].source;
  state.feed=players.status==='fulfilled'?players.value:{skaters:[],goalies:[]};
  const verifiedCount=verifiedPlayerRows(state.feed,'skaters').length+verifiedPlayerRows(state.feed,'goalies').length;
  const stamp=state.data.fetched_at&&Number.isFinite(Date.parse(state.data.fetched_at))?fmtDate(state.data.fetched_at):'time unknown';
  $('psFreshness').textContent='Bracket: '+(state.source==='live'?'live feed':'saved snapshot')+' · fetched '+stamp+(state.data.stale?' · STALE':'')+' · '+verifiedCount+' verified playoff player records.';
  render();renderMatchups();
  // Secondary enrichment cannot delay or block the primary playoff scoreboard.
  Promise.allSettled([readRegularSeasonWatch('skater'),readRegularSeasonWatch('goalie')]).then(([s,g])=>{
   state.spotlights={skaters:s.status==='fulfilled'?s.value:new Map(),goalies:g.status==='fulfilled'?g.value:new Map()};
   renderMatchups();
  }).catch(()=>{});
 }catch(e){$('psFreshness').textContent='Playoff data unavailable. No results or player stats were invented.';state.data=null;render();$('psMatchStatus').textContent='Upcoming schedule temporarily unavailable.';console.warn(e);}
}
document.querySelectorAll('.ps-tabs button').forEach(btn=>btn.addEventListener('click',()=>{
 state.mode=btn.dataset.mode;document.querySelectorAll('.ps-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));render();
}));
$('psLeague').addEventListener('change',()=>{state.league=$('psLeague').value;render();});
$('psSearch').addEventListener('input',()=>{state.search=$('psSearch').value.trim();render();});
load();
})(typeof window==='undefined'?null:window);
