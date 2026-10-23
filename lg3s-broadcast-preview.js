/* LG3s broadcast dashboard. Live panels read the parser-backed public Supabase views (verified results only);
   the saved season snapshot supplies nation names and a fallback table. No invented scores or affiliations. */
(()=>{'use strict';const root=document.getElementById('lg3Broadcast');if(!root)return;
const base='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const key='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const TZ='America/Toronto',SEASON_MONDAY=Date.UTC(2026,9,19);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=q=>fetch(base+q,{headers:{apikey:key},cache:'no-store'}).then(r=>{if(!r.ok)throw Error(q.split('?')[0]+' '+r.status);return r.json()});
const flagUrl=id=>'assets/lg3s/flags/'+Number(id)+'.svg';
const flagVar=id=>'--flag:url(\''+flagUrl(id)+'\')';
const bannerVar=id=>'--flag:url(\'assets/lg3s/banners/'+Number(id)+'.svg\')';
const crest=id=>'assets/lg3s/team'+Number(id)+'.svg';
const profile=id=>'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid='+Number(id)+'&leagueid=154&seasonid=1';
const gameLink=id=>{const n=Number(id);return Number.isSafeInteger(n)&&n>0?'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+n:null};
const dayKey=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:TZ});
const fmtDay=d=>new Date(d).toLocaleDateString('en-US',{timeZone:TZ,weekday:'short',month:'short',day:'numeric'});
const fmtTime=d=>new Date(d).toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'})+' ET';
const fmtNight=k=>new Date(k+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
const weekOf=d=>Math.max(1,Math.floor((new Date(d).getTime()-SEASON_MONDAY)/604800000)+1);
const flag=(id,name)=>id?'<span class="lg3-flag ecm-cloth ecm-drape-sm" role="img" aria-label="'+esc(name)+' flag" style="'+flagVar(id)+'"></span>':'<span class="lg3-flag"></span>';
const ordinal=n=>n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th');
const signed=n=>(n>0?'+':'')+n;
const sortTable=(a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||String(a.nation).localeCompare(String(b.nation));

let gamesDown=false,teams=[],byId=new Map(),idByName=new Map(),standings=[],rankOf=new Map(),games=[],skaters=[],goalies=[];

function tableFromGames(list){const t=new Map(teams.map(x=>[x.id,{lg_team_id:x.id,nation:x.name,group_code:x.group,gp:0,w:0,l:0,otl:0,pts:0,gf:0,ga:0,gd:0}]));
list.forEach(g=>{const a=t.get(g.away_lg_team_id),h=t.get(g.home_lg_team_id);if(!a||!h)return;const as=+g.away_score,hs=+g.home_score,ot=g.decided_in&&g.decided_in!=='REG';
[[a,as,hs],[h,hs,as]].forEach(([r,f,x])=>{r.gp++;r.gf+=f;r.ga+=x;r.gd=r.gf-r.ga;if(f>x){r.w++;r.pts+=2}else if(ot){r.otl++;r.pts+=1}else r.l++})});
return [...t.values()].sort(sortTable)}

function renderRankings(previous){const prev=new Map((previous||[]).map((r,i)=>[r.lg_team_id,i+1]));
$('lg3Rankings').innerHTML=standings.map((t,i)=>{const was=prev.get(t.lg_team_id),mv=was?was-(i+1):0;
const cell=!previous?'<span class="lg3-mv eq">'+signed(t.gd)+'</span>':mv>0?'<span class="lg3-mv up" title="Up '+mv+' since last game night">▲ +'+mv+'</span>':mv<0?'<span class="lg3-mv dn" title="Down '+(-mv)+' since last game night">▼ '+mv+'</span>':'<span class="lg3-mv eq">0</span>';
return '<tr><td class="rk">'+(i+1)+'</td><td class="l"><span class="lg3-nation">'+flag(t.lg_team_id,t.nation)+esc(t.nation)+'</span></td><td>'+t.w+'-'+t.l+'-'+t.otl+'</td><td class="pts">'+t.pts+'</td><td>'+cell+'</td></tr>'}).join('')}

/* ---- latest scores ---- */
let nights=[],nightIdx=0,showAll=false;const SCORE_ROWS=6;
function renderScores(){const night=nights[nightIdx];if(!night){$('lg3Scores').innerHTML='<p class="lg3-empty">'+(gamesDown?'Verified scores temporarily unavailable.':'No verified final scores available yet.')+'</p>';return}
const rows=games.filter(g=>g.is_verified&&g.game_night_date===night&&g.away_score!=null&&g.home_score!=null);
$('lg3Scores').innerHTML=rows.slice(0,showAll?rows.length:SCORE_ROWS).map(g=>{const a=+g.away_score,h=+g.home_score,url=gameLink(g.lg_game_id),tag=url?'a':'div';
return '<'+tag+' class="lg3-sr"'+(url?' href="'+url+'" target="_blank" rel="noopener noreferrer" title="Official game report"':'')+'>'+flag(g.away_lg_team_id,g.away_nation)+'<span class="n '+(a>h?'w':'lo')+'">'+esc(g.away_nation)+'</span><span class="sc"><b>'+a+'</b><i>-</i><b>'+h+'</b></span><span class="n r '+(h>a?'w':'lo')+'">'+esc(g.home_nation)+'</span>'+flag(g.home_lg_team_id,g.home_nation)+'<span class="st">'+(g.decided_in&&g.decided_in!=='REG'?esc(g.decided_in):'FINAL')+'</span></'+tag+'>'}).join('')+(rows.length>SCORE_ROWS?'<button type="button" class="lg3-more" data-more>'+(showAll?'SHOW FEWER ↑':'SHOW ALL '+rows.length+' FINALS ↓')+'</button>':'');
$('lg3Nights').innerHTML=nights.slice(0,6).map((d,i)=>'<button type="button" data-i="'+i+'" aria-pressed="'+(i===nightIdx)+'">'+esc(fmtNight(d).toUpperCase())+'</button>').join('')}
$('lg3Nights').addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b)return;nightIdx=+b.dataset.i;showAll=false;renderScores()});
$('lg3Scores').addEventListener('click',e=>{if(!e.target.closest('[data-more]'))return;showAll=!showAll;renderScores()});

/* ---- upcoming, featured, key matchups ---- */
function matchupBg(a,h){return '<div class="lg3-fm-bg" aria-hidden="true"><span class="ecm-cloth ecm-drape" style="'+flagVar(a)+'"></span><span class="ecm-cloth ecm-drape" style="'+flagVar(h)+'"></span></div>'}
function interest(g){const ra=rankOf.get(g.away_lg_team_id)||12,rh=rankOf.get(g.home_lg_team_id)||12;return ra+rh}
function renderUpcoming(){const now=Date.now();const up=games.filter(g=>g.status==='scheduled'&&new Date(g.scheduled_at).getTime()>now-3*3600e3).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.lg_game_id-b.lg_game_id);
if(!up.length){['lg3Schedule','lg3Feature','lg3Keys'].forEach(id=>$(id).innerHTML='<p class="lg3-empty">'+(gamesDown?'Schedule temporarily unavailable.':'No upcoming fixtures are published yet.')+'</p>');return}
const firstNight=dayKey(up[0].scheduled_at),pool=up.filter(g=>dayKey(g.scheduled_at)===firstNight).sort((a,b)=>interest(a)-interest(b));
const feat=pool[0],ra=rankOf.get(feat.away_lg_team_id),rh=rankOf.get(feat.home_lg_team_id);
const sameGroup=byId.get(feat.away_lg_team_id)?.group&&byId.get(feat.away_lg_team_id)?.group===byId.get(feat.home_lg_team_id)?.group;
$('lg3Week').textContent='WEEK '+weekOf(feat.scheduled_at);
const fl=gameLink(feat.lg_game_id);
$('lg3Feature').innerHTML=matchupBg(feat.away_lg_team_id,feat.home_lg_team_id)+'<span class="lg3-fm-vs" aria-hidden="true">VS</span><div class="lg3-fm-names"><span>'+esc(feat.away_nation)+'</span><span>'+esc(feat.home_nation)+'</span></div><p class="lg3-fm-when">'+esc(fmtDay(feat.scheduled_at).toUpperCase())+' &nbsp;|&nbsp; '+esc(fmtTime(feat.scheduled_at))+'</p><p class="lg3-fm-tag">'+(sameGroup?'LG3S GROUP '+esc(byId.get(feat.away_lg_team_id).group)+' SHOWDOWN':'LG3S INTERNATIONAL SHOWDOWN')+(ra&&rh?' · #'+ra+' VS #'+rh:'')+'</p><div class="lg3-fm-cta">'+(fl?'<a class="lg3-btn" href="'+fl+'" target="_blank" rel="noopener noreferrer">Game Preview →</a>':'<a class="lg3-btn" href="#schedule">Game Preview →</a>')+'</div>';
$('lg3Schedule').innerHTML=up.slice(0,5).map(g=>'<div class="lg3-ur">'+flag(g.away_lg_team_id,g.away_nation)+'<span class="n">'+esc(g.away_nation)+'</span>'+flag(g.home_lg_team_id,g.home_nation)+'<span class="n">'+esc(g.home_nation)+'</span><time datetime="'+esc(g.scheduled_at)+'">'+esc(fmtDay(g.scheduled_at))+'<br>'+esc(fmtTime(g.scheduled_at))+'</time></div>').join('');
const keys=pool.slice(1,4);const extra=up.filter(g=>!pool.includes(g)).sort((a,b)=>interest(a)-interest(b));while(keys.length<3&&extra.length)keys.push(extra.shift());
$('lg3Keys').innerHTML=keys.map(g=>{const url=gameLink(g.lg_game_id);return '<a class="lg3-key" href="'+(url||'#schedule')+'"'+(url?' target="_blank" rel="noopener noreferrer"':'')+'>'+matchupBg(g.away_lg_team_id,g.home_lg_team_id)+'<span class="lg3-key-vs" aria-hidden="true">VS</span><span class="lg3-key-names"><span>'+esc(g.away_nation)+'</span><span>'+esc(g.home_nation)+'</span></span><time datetime="'+esc(g.scheduled_at)+'">'+esc(fmtDay(g.scheduled_at).replace(/^\w+, /,'').toUpperCase())+' &nbsp;|&nbsp; '+esc(fmtTime(g.scheduled_at))+'</time></a>'}).join('')}

/* ---- league leaders ---- */
let stat='p';
function renderLeaders(){const goalie=stat==='sv_pct'||stat==='gaa_per_game';
const cols=goalie?['#','Player','Team','GP','SV','SV%','GAA']:['#','Player','Team','GP','G','A','PTS'];
$('lg3LeadersHead').innerHTML='<tr>'+cols.map((c,i)=>'<th'+(i===1?' class="l"':'')+'>'+c+'</th>').join('')+'</tr>';
let list;if(goalie){const min=Math.max(1,Math.ceil(Math.max(0,...goalies.map(g=>+g.gp||0))/2));list=goalies.filter(g=>(+g.gp||0)>=min&&g[stat]!=null).sort((a,b)=>stat==='gaa_per_game'?a[stat]-b[stat]:b[stat]-a[stat]||b.gp-a.gp)}
else list=skaters.slice().sort((a,b)=>(b[stat]-a[stat])||(b.p-a.p)||(a.gp-b.gp)||String(a.gamertag).localeCompare(String(b.gamertag)));
$('lg3Leaders').innerHTML=list.slice(0,10).map((p,i)=>{const nation=goalie?(p.nations_played_for||[])[0]:p.nation,id=goalie?idByName.get(nation):p.lg_team_id;
const cells=goalie?[p.gp,p.sv,(+p.sv_pct).toFixed(3).replace(/^0/,''),(+p.gaa_per_game).toFixed(2)]:[p.gp,p.g,p.a,p.p];
return '<tr><td class="rk">'+(i+1)+'</td><td class="l"><a href="'+profile(p.lg_user_id)+'" target="_blank" rel="noopener noreferrer">'+esc(p.gamertag)+'</a></td><td>'+flag(id,nation)+'</td>'+cells.map((c,j)=>'<td'+(j===cells.length-1&&!goalie?' class="pts"':'')+'>'+esc(c)+'</td>').join('')+'</tr>'}).join('')||'<tr><td colspan="7" class="lg3-empty">No verified statistics yet.</td></tr>'}
root.querySelector('.lg3-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-stat]');if(!b)return;stat=b.dataset.stat;root.querySelectorAll('.lg3-tabs button').forEach(x=>x.setAttribute('aria-selected',String(x===b)));renderLeaders()});

/* ---- nation spotlight ---- */
let spot=0,spotOrder=[];
function renderSpotlight(){const t=spotOrder[spot];if(!t)return;const id=t.lg_team_id,rank=standings.findIndex(x=>x.lg_team_id===id)+1;
const lineup=skaters.filter(p=>p.lg_team_id===id).sort((a,b)=>b.p-a.p||b.g-a.g).slice(0,4);
$('lg3SpotCount').textContent=(spot+1)+'/'+spotOrder.length;
const el=$('lg3Spotlight');el.style.cssText=flagVar(id);
const top=lineup[0];
const copy=esc(t.nation)+' sits '+ordinal(rank)+' in the power rankings at '+t.w+'-'+t.l+'-'+t.otl+' ('+t.pts+' PTS)'+(t.group_code?' in Group '+esc(t.group_code):'')+', with a '+signed(t.gd)+' goal differential.'+(top?' '+esc(top.gamertag)+' leads the nation with '+top.p+' points ('+top.g+'G, '+top.a+'A) in '+top.gp+' games.':'');
el.innerHTML='<span class="lg3-spot-banner ecm-cloth ecm-drape" style="'+bannerVar(id)+'" aria-hidden="true"></span><div class="lg3-spot-head">'+flag(id,t.nation)+'<h3>'+esc(t.nation)+'</h3></div><span class="lg3-ribbon">Week '+weekOf(Date.now())+' Top Scorers</span><div class="lg3-cards">'+(lineup.length?lineup.map(p=>'<a class="lg3-card" href="'+profile(p.lg_user_id)+'" target="_blank" rel="noopener noreferrer"><span class="lg3-card-img ecm-cloth" style="'+flagVar(id)+'"><img src="'+crest(id)+'" alt="" loading="lazy"></span><b title="'+esc(p.gamertag)+'">'+esc(p.gamertag)+'</b><small>'+p.g+'G · '+p.a+'A</small><span>'+p.p+' PTS</span></a>').join(''):'<p class="lg3-empty lg3-wide">'+(skaters.length?'No verified skater lines yet.':'Verified player lines are not available right now.')+'</p>')+'</div><p class="lg3-spot-copy">'+copy+'</p><div class="lg3-spot-cta"><a class="lg3-btn" href="#rosters" data-nation="'+esc(t.nation)+'">View Full Nation Profile →</a></div>'}
$('lg3SpotNext').addEventListener('click',()=>{if(!spotOrder.length)return;spot=(spot+1)%spotOrder.length;renderSpotlight()});
$('lg3Spotlight').addEventListener('click',e=>{const a=e.target.closest('[data-nation]');const sel=$('thPlayerTeam');if(!a||!sel)return;const n=a.dataset.nation;if([...sel.options].some(o=>o.value===n)){sel.value=n;sel.dispatchEvent(new Event('change'))}});

/* ---- latest news (built only from verified data and published ECM coverage) ---- */
function renderNews(){const cards=[];const night=nights[0];
if(night){const rows=games.filter(g=>g.is_verified&&g.game_night_date===night&&g.away_score!=null);const big=rows.slice().sort((a,b)=>Math.abs(b.away_score-b.home_score)-Math.abs(a.away_score-a.home_score))[0];
if(big){const aw=big.away_score>big.home_score,wid=aw?big.away_lg_team_id:big.home_lg_team_id,w=aw?big.away_nation:big.home_nation,l=aw?big.home_nation:big.away_nation,hi=Math.max(big.away_score,big.home_score),lo=Math.min(big.away_score,big.home_score);
cards.push({k:'Game Recap',t:esc(w)+' Rolls Past '+esc(l)+' '+hi+'-'+lo,d:fmtNight(night),p:'The largest margin of the '+fmtNight(night)+' slate. '+rows.length+' verified finals are posted from official game reports.',h:gameLink(big.lg_game_id)||'#scoreboard',id:wid,ext:!!gameLink(big.lg_game_id)})}}
const ps=skaters.slice().sort((a,b)=>b.p-a.p||b.g-a.g)[0];
if(ps)cards.push({k:'Player Spotlight',t:'Points Leader: '+esc(ps.gamertag),d:'Season 1',p:esc(ps.gamertag)+' has '+ps.p+' points ('+ps.g+'G, '+ps.a+'A) in '+ps.gp+' games for '+esc(ps.nation)+', tops among all verified skaters.',h:'#leagueLeaders',id:ps.lg_team_id});
if(standings.length>1){const a=standings[0],b=standings[1];cards.push({k:'Storyline',t:'The Battle for the Top Spot',d:'Power Rankings',p:esc(a.nation)+' ('+a.pts+' PTS) and '+esc(b.nation)+' ('+b.pts+' PTS) lead the field'+(a.pts===b.pts?', level on points with goal differential the tiebreaker.':'.'),h:'#powerRankings',id:a.lg_team_id})}
cards.push({k:'League Update',t:'KnifeVet22 Tops the Bid Book',d:'Oct 19, 2026',p:'Italy\'s $8.25M winning bid is the largest in the official Season 1 bidding recap.',h:'#bidding',id:822});
$('lg3News').innerHTML=cards.slice(0,4).map(c=>'<a class="lg3-story" href="'+c.h+'"'+(c.ext?' target="_blank" rel="noopener noreferrer"':'')+'><span class="lg3-story-img ecm-cloth ecm-drape-sm" style="'+flagVar(c.id)+'"><img src="'+crest(c.id)+'" alt="" loading="lazy"></span><span><span class="lg3-story-k">'+c.k+'</span><strong>'+c.t+'</strong><time>'+esc(c.d)+'</time></span><p>'+c.p+'</p></a>').join('')}

/* ---- load ---- */
fetch('lg3s-season1-data.json?v=20261021-2',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('snapshot');return r.json()}).then(d=>{
teams=d.teams||[];byId=new Map(teams.map(t=>[t.id,t]));idByName=new Map(teams.map(t=>[t.name,t.id]));
standings=teams.map(t=>({lg_team_id:t.id,nation:t.name,group_code:t.group,gp:t.gp,w:t.w,l:t.l,otl:t.otl,pts:t.pts,gf:t.gf,ga:t.ga,gd:t.gd})).sort(sortTable);
return Promise.allSettled([get('lg3s_public_standings?select=*'),get('lg3s_public_games?select=lg_game_id,scheduled_at,game_night_date,away_lg_team_id,away_nation,home_lg_team_id,home_nation,status,away_score,home_score,decided_in,is_verified&order=scheduled_at.asc&limit=1000'),get('lg3s_public_skater_leaders?select=*'),get('lg3s_public_goalie_leaders?select=*')])}).then(([st,gm,sk,gl])=>{
if(st.status==='fulfilled'&&st.value.length)standings=st.value.map(r=>({...r,otl:r.otl||0,nation:r.nation||byId.get(r.lg_team_id)?.name})).sort(sortTable);
rankOf=new Map(standings.map((t,i)=>[t.lg_team_id,i+1]));
if(gm.status==='fulfilled')games=gm.value;else gamesDown=true;
if(sk.status==='fulfilled')skaters=sk.value;
if(gl.status==='fulfilled')goalies=gl.value;
const today=dayKey(Date.now());
const verified=games.filter(g=>g.is_verified&&g.away_score!=null&&g.home_score!=null);
nights=[...new Set(verified.map(g=>g.game_night_date).filter(d=>d<=today))].sort().reverse();
renderRankings(nights.length>1?tableFromGames(verified.filter(g=>g.game_night_date<nights[0])):null);
renderScores();renderUpcoming();renderLeaders();
spotOrder=standings.slice().sort((a,b)=>String(a.nation).localeCompare(String(b.nation)));spot=(weekOf(Date.now())-1)%spotOrder.length;renderSpotlight();
renderNews();
const failed=[st,gm,sk,gl].some(r=>r.status==='rejected');
if(failed){console.error('LG3s live views partially unavailable',[st,gm,sk,gl].filter(r=>r.status==='rejected').map(r=>r.reason));$('lg3DataNote').textContent='Some live league data is temporarily unavailable; affected panels show the saved Season 1 snapshot. No unverified results are shown.'}
}).catch(e=>{console.error(e);['lg3Feature','lg3Scores','lg3Schedule','lg3Spotlight','lg3Keys','lg3News'].forEach(id=>{const n=$(id);if(n)n.innerHTML='<p class="lg3-empty">League data temporarily unavailable.</p>'})});
})();
