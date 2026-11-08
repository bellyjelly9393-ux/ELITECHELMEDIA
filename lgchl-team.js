/* Public team rooms. Read-only public projections; no private locker or scouting tables. */
(()=>{'use strict';
const D=window.WMDesk;if(!D)return;
const {esc,read}=D,$=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const raw=params.get('team'),team=raw===null?412:Number(raw);
const valid=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
if(!valid(team)){$('roomName').textContent='Team not found';['roomRecord','roomPlayers','roomFinals','roomUpcoming'].forEach(id=>$(id).textContent='Choose a team from league coverage.');$('roomPlayers').setAttribute('aria-busy','false');return;}
if(document.body.dataset&&team===412&&!params.has('room')&&!document.body.dataset.roomAngles&&!document.body.dataset.roomConcept)document.body.dataset.roomTour='true';
document.body.classList.toggle('league-room',true);
document.body.classList.toggle('hitmen-room',team===412);
const logo=id=>'assets/lgchl/s55/team'+Number(id)+'.png';
const jerseyAssets={412:'assets/lgchl/jerseys/team412.webp',448:'assets/lgchl/jerseys/team448.webp',447:'assets/lgchl/jerseys/team447.webp',449:'assets/lgchl/jerseys/team449.webp',455:'assets/lgchl/jerseys/team455.webp',399:'assets/lgchl/jerseys/team399.webp',419:'assets/lgchl/jerseys/team419.webp',2604:'assets/lgchl/jerseys/team2604.webp',375:'assets/lgchl/jerseys/team375.webp',402:'assets/lgchl/jerseys/team402.webp',450:'assets/lgchl/jerseys/team450.webp',381:'assets/lgchl/jerseys/team381.webp',457:'assets/lgchl/jerseys/team457.webp',463:'assets/lgchl/jerseys/team463.webp',413:'assets/lgchl/jerseys/team413.webp',423:'assets/lgchl/jerseys/team423.webp',401:'assets/lgchl/jerseys/team401.webp',408:'assets/lgchl/jerseys/team408.webp',454:'assets/lgchl/jerseys/team454.webp',2982:'assets/lgchl/jerseys/team2982.webp',2981:'assets/lgchl/jerseys/team2981.webp',418:'assets/lgchl/jerseys/team418.webp',306:'assets/lgchl/jerseys/team306.webp',370:'assets/lgchl/jerseys/team370.webp',379:'assets/lgchl/jerseys/team379.webp',380:'assets/lgchl/jerseys/team380.webp',383:'assets/lgchl/jerseys/team383.webp',386:'assets/lgchl/jerseys/team386.webp',420:'assets/lgchl/jerseys/team420.webp',452:'assets/lgchl/jerseys/team452.webp',444:'assets/lgchl/jerseys/team444.webp',453:'assets/lgchl/jerseys/team453.webp',451:'assets/lgchl/jerseys/team451.webp',446:'assets/lgchl/jerseys/team446.webp',445:'assets/lgchl/jerseys/team445.webp',468:'assets/lgchl/jerseys/team468.webp',461:'assets/lgchl/jerseys/team461.webp',469:'assets/lgchl/jerseys/team469.webp',465:'assets/lgchl/jerseys/team465.webp',365:'assets/lgchl/jerseys/team365.webp',377:'assets/lgchl/jerseys/team377.webp',385:'assets/lgchl/jerseys/team385.webp',398:'assets/lgchl/jerseys/team398.webp',400:'assets/lgchl/jerseys/team400.webp',409:'assets/lgchl/jerseys/team409.webp',414:'assets/lgchl/jerseys/team414.webp',415:'assets/lgchl/jerseys/team415.webp',416:'assets/lgchl/jerseys/team416.webp',422:'assets/lgchl/jerseys/team422.webp',458:'assets/lgchl/jerseys/team458.webp',462:'assets/lgchl/jerseys/team462.webp',364:'assets/lgchl/jerseys/team364.webp',382:'assets/lgchl/jerseys/team382.webp',459:'assets/lgchl/jerseys/team459.webp',514:'assets/lgchl/jerseys/team514.webp',460:'assets/lgchl/jerseys/team460.webp',466:'assets/lgchl/jerseys/team466.webp',411:'assets/lgchl/jerseys/team411.webp',397:'assets/lgchl/jerseys/team397.webp',2983:'assets/lgchl/jerseys/team2983.webp',467:'assets/lgchl/jerseys/team467.webp',421:'assets/lgchl/jerseys/team421.webp'};
const jersey=id=>jerseyAssets[Number(id)]||logo(id);
if(typeof D.teamColor==='function')D.teamColor(logo(team)).then(c=>{if(c)document.body.style?.setProperty?.('--tc',c);}).catch(()=>{});
const fmt=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v).toLocaleString('en-US'):'—';
const rate=(v,d)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const date=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v))+' ET':'Time unavailable';
let players=[];
const finder=team===412?window.HitmenStallFinder?.create({input:$('roomSearch'),room:$('roomPlayers')}):null;
if(finder)window.HitmenPublicRoom=finder;
function render(){
 const q=$('roomSearch').value.toLocaleLowerCase().trim();
 const rows=finder?players:players.filter(p=>String(p.gamertag||'').toLocaleLowerCase().includes(q));
 const card=p=>{
 const goalie=p.player_kind==='goalie',url='player-cards.html?league=lgchl&id='+Number(p.lg_user_id)+'&kind='+(goalie?'goalie':'skater');
 const stats=goalie?[['GP',fmt(p.gp)],['SV%',p.save_pct==null?'—':rate(Number(p.save_pct)*100,1)+'%'],['GAA',rate(p.gaa,2)]]:[['G',fmt(p.goals)],['A',fmt(p.assists)],['PTS',fmt(p.points)]];
 const uniform=jerseyAssets[team]?'<img class="club-jersey" src="'+jersey(team)+'" alt="Verified club jersey" loading="lazy">':'<div class="concept-kit" role="img" aria-label="Non-official jersey concept with team crest"><img class="concept-crest" src="'+logo(team)+'" alt="" loading="lazy"></div><small class="concept-tag">REFERENCE FOUND · CUTOUT PENDING</small>';
 return (valid(p.lg_user_id)?'<a class="stall" href="'+url+'">':'<article class="stall">')+'<strong class="nameplate">'+esc(p.gamertag)+'</strong><div class="jersey-stage">'+uniform+'</div><div class="stall-info"><p>'+esc(p.position||(goalie?'G':'Skater'))+(p.management_role?' · '+esc(p.management_role):'')+' · '+fmt(p.gp)+' GP</p><div class="stats">'+stats.map(([k,v])=>'<span>'+k+'<b>'+esc(v)+'</b></span>').join('')+'</div><span class="open-card">'+(valid(p.lg_user_id)?'VIEW / BUILD HOCKEY CARD →':'PLAYER CARD UNAVAILABLE')+'</span></div>'+(valid(p.lg_user_id)?'</a>':'</article>');
 };
 const content=rows.map(p=>{const html=card(p);return finder?html.replace('class="stall"','class="stall" id="hitmen-stall-'+Number(p.lg_user_id)+'"'):html;}).join('');
 $('roomPlayers').innerHTML=content||'<p class="note">'+(q?'No matching players.':'No public player stats are listed for this team yet.')+'</p>';
 $('roomPlayers').setAttribute('aria-busy','false');
}
$('roomLogo').src=logo(team);
document.addEventListener('error',e=>{const image=e.target;if(image.tagName!=='IMG')return;if(image.closest('.jersey-stage')&&!image.dataset.fallback){image.dataset.fallback='true';image.src=logo(team);image.alt='Team crest';}else{image.hidden=true;}},true);
if(!finder)$('roomSearch').addEventListener('input',render);
$('roomTeam').addEventListener('change',()=>{location.href='lgchl-team.html?team='+Number($('roomTeam').value);});
async function standings(){
 try{const rows=await read('lgchl_standings_current',{select:'lg_team_id,name,gp,w,l,otl,pts,standings_at',order:'name.asc'});
 const t=rows.find(t=>Number(t.lg_team_id)===team);if(!t)throw Error();
 $('roomName').textContent=t.name;document.title=t.name+' Team Room | Elite Chel Media';
 $('roomRecord').textContent=[t.w,t.l,t.otl].map(fmt).join('–')+' · '+fmt(t.pts)+' PTS · '+fmt(t.gp)+' GP';
 }catch{$('roomRecord').textContent='Team standings are unavailable.';}
}
async function roster(){
 try{
 const response=await fetch('assets/lgchl/rosters/main-rosters-s55.json?v=20261105');
 if(!response.ok)throw Error('Roster unavailable');
 const snapshot=await response.json(),entry=snapshot.teams[String(team)];
 if(snapshot.season!==55||!entry||!Array.isArray(entry.players))throw Error('Roster unavailable');
 const clubs=Object.entries(snapshot.teams).filter(([id,c])=>valid(id)&&c&&typeof c.name==='string').map(([id,c])=>({id:Number(id),name:c.name})).sort((a,b)=>a.name.localeCompare(b.name));
 $('roomTeam').innerHTML=clubs.map(c=>'<option value="'+c.id+'"'+(c.id===team?' selected':'')+'>'+esc(c.name)+'</option>').join('');
 $('roomName').textContent=entry.name;$('arenaTeamName').textContent=entry.name;$('roomRadioLink').hidden=team!==412;
 document.title=entry.name+' Team Room | Elite Chel Media';
 const main=entry.players.filter(p=>p.roster_class==='active_roster'&&valid(p.lg_user_id));
 if(finder&&main.length&&(main.length!==17||new Set(main.map(p=>Number(p.lg_user_id))).size!==17))throw Error('Expected the verified 17-player roster');
 let rows=[];
 try{if(main.length)rows=await read('wm_lgchl_s55_player_leaders',{select:'lg_user_id,player_kind,gp,goals,assists,points,save_pct,gaa,fetched_at',lg_user_id:'in.('+main.map(p=>Number(p.lg_user_id)).join(',')+')',limit:'1000'});}catch{/* Roster membership remains visible when stats are unavailable. */}
 const unique=new Map();for(const p of rows){const key=p.lg_user_id+':'+p.player_kind,old=unique.get(key);if(!old||String(p.fetched_at)>String(old.fetched_at))unique.set(key,p);}
 players=main.map(p=>({...unique.get(p.lg_user_id+':'+p.player_kind),...p}));
 $('playersTitle').textContent='Main roster · '+players.length;
 $('rosterNote').textContent='Select your stall to view or build your hockey card. Main-roster players only · LG roster snapshot: '+snapshot.as_of+'. The 62-team jersey reference collection is sourced. Finished locker cutouts display where available; remaining jerseys use marked crest concepts while their references are cleaned and reviewed. Imported Season 55 totals may include previous teams; — means unavailable.';
 render();
 finder?.setPlayers(main);
 }catch{finder?.unavailable();$('roomPlayers').textContent='Current main roster is unavailable. Please try again later.';$('roomPlayers').setAttribute('aria-busy','false');}
}

function game(g,final){
 if(team===412&&(['360','angles'].includes(params.get('room'))||document.body.dataset.roomTour==='true'||document.body.dataset.roomAngles==='true')){
  const side=which=>{const id=Number(g[which+'_lg_team_id']),name=g[which+'_nick']||g[which+'_abbr']||'Team';return '<div class="tour-match-team">'+(valid(id)?'<img src="'+logo(id)+'" alt="'+esc(name)+' crest" width="46" height="46" loading="lazy">':'')+'<b>'+esc(g[which+'_abbr']||name)+'</b><small>'+esc(name)+'</small></div>';};
  const label=(g.away_nick||'Away')+' vs '+(g.home_nick||'Home');
  return '<a class="game-row tour-match-card" href="lgchl-game.html?id='+Number(g.lg_game_id)+'" aria-label="'+esc(label+(final?' '+fmt(g.away_score)+' to '+fmt(g.home_score):' scheduled')+'. Open game centre')+'"><div class="tour-match-meta"><span>'+esc(date(g.game_at))+'</span><b>'+(final?'FINAL':'UPCOMING')+'</b></div><div class="tour-match-teams">'+side('away')+'<strong class="tour-match-score">'+(final?fmt(g.away_score)+'<i>–</i>'+fmt(g.home_score):'<i>VS</i>')+'</strong>'+side('home')+'</div><span class="tour-match-open">GAME CENTRE <span aria-hidden="true">↗</span></span></a>';
 }
 const away=g.away_nick||g.away_abbr||'Away',home=g.home_nick||g.home_abbr||'Home',score=final?fmt(g.away_score)+' – '+fmt(g.home_score):'VS';
 const mark=(id,name)=>'<span class="game-team">'+(valid(id)?'<img src="'+logo(id)+'" alt="" loading="lazy">':'')+'<strong>'+esc(name)+'</strong></span>';
 return '<a class="game-row" href="lgchl-game.html?id='+Number(g.lg_game_id)+'" aria-label="'+esc(away+' '+score+' '+home+' · '+date(g.game_at))+'"><span class="game-time">'+esc(date(g.game_at))+'<small>'+ (final?'FINAL':'UPCOMING')+'</small></span>'+mark(g.away_lg_team_id,away)+'<span class="game-score'+(final?' is-final':'')+'">'+esc(score)+'</span>'+mark(g.home_lg_team_id,home)+'</a>';
}
async function games(){
 const base={select:'lg_game_id,game_at,status,away_nick,away_abbr,home_nick,home_abbr,away_score,home_score,away_lg_team_id,home_lg_team_id',season:'eq.55',or:'(away_lg_team_id.eq.'+team+',home_lg_team_id.eq.'+team+')',limit:'6'};
 const results=await Promise.allSettled([read('lgchl_games_board',{...base,status:'eq.final',order:'game_at.desc'}),read('lgchl_games_board',{...base,status:'neq.final',game_at:'gte.'+new Date().toISOString(),order:'game_at.asc'})]);
 results.forEach((r,i)=>{const el=$(i?'roomUpcoming':'roomFinals');el.innerHTML=r.status==='fulfilled'?r.value.filter(g=>valid(g.lg_game_id)&&(!i?String(g.status).toLowerCase()==='final':String(g.status).toLowerCase()==='scheduled')).map(g=>game(g,!i)).join('')||'<p class="note">'+(i?'No upcoming games are listed.':'No final results are listed.')+'</p>':'<p class="note">Games are unavailable. Please try again later.</p>';});
}
standings();roster();games();
})();


