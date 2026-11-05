/* Public team rooms. Read-only public projections; no private locker or scouting tables. */
(()=>{'use strict';
const D=window.WMDesk;if(!D)return;
const {esc,read}=D,$=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const raw=params.get('team'),team=raw===null?412:Number(raw);
const valid=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
if(!valid(team)){$('roomName').textContent='Team not found';['roomRecord','roomPlayers','roomFinals','roomUpcoming'].forEach(id=>$(id).textContent='Choose a team from league coverage.');$('roomPlayers').setAttribute('aria-busy','false');return;}
const logo=id=>'assets/lgchl/s55/team'+Number(id)+'.png';
const jersey=id=>Number(id)===412?'assets/war-room/jersey-home.webp':logo(id);
const fmt=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v).toLocaleString('en-US'):'—';
const rate=(v,d)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const date=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v))+' ET':'Time unavailable';
let players=[];
function render(){
 const q=$('roomSearch').value.toLocaleLowerCase().trim();
 const rows=players.filter(p=>String(p.gamertag||'').toLocaleLowerCase().includes(q));
 $('roomPlayers').innerHTML=rows.map(p=>{
 const goalie=p.player_kind==='goalie',url='lgchl-player.html?id='+Number(p.lg_user_id)+'&kind='+(goalie?'goalie':'skater');
 const stats=goalie?[['GP',fmt(p.gp)],['SV%',p.save_pct==null?'—':rate(Number(p.save_pct)*100,1)+'%'],['GAA',rate(p.gaa,2)]]:[['G',fmt(p.goals)],['A',fmt(p.assists)],['PTS',fmt(p.points)]];
 return '<a class="stall" href="'+url+'"><strong class="nameplate">'+esc(p.gamertag)+'</strong><div class="jersey-stage"><img src="'+jersey(team)+'" alt="'+(team===412?'Calgary Hitmen jersey':'Team crest')+'" loading="lazy"></div><div class="stall-info"><p>'+esc(p.position||(goalie?'G':'Skater'))+' · '+fmt(p.gp)+' GP</p><div class="stats">'+stats.map(([k,v])=>'<span>'+k+'<b>'+esc(v)+'</b></span>').join('')+'</div><span class="open-card">OPEN PLAYER CARD →</span></div></a>';
 }).join('')||'<p class="note">'+(q?'No matching players.':'No public player stats are listed for this team yet.')+'</p>';
 $('roomPlayers').setAttribute('aria-busy','false');
}
$('roomLogo').src=logo(team);
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.hidden=true;}},true);
$('roomSearch').addEventListener('input',render);
$('roomTeam').addEventListener('change',()=>{location.href='lgchl-team.html?team='+Number($('roomTeam').value);});
async function standings(){
 try{const rows=await read('lgchl_standings_current',{select:'lg_team_id,name,gp,w,l,otl,pts,standings_at',order:'name.asc'});
 $('roomTeam').innerHTML=rows.filter(t=>valid(t.lg_team_id)).map(t=>'<option value="'+Number(t.lg_team_id)+'"'+(Number(t.lg_team_id)===team?' selected':'')+'>'+esc(t.name)+'</option>').join('');
 const t=rows.find(t=>Number(t.lg_team_id)===team);if(!t)throw Error();
 $('roomName').textContent=t.name;document.title=t.name+' Team Room | Elite Chel Media';
 $('roomRecord').textContent=[t.w,t.l,t.otl].map(fmt).join('–')+' · '+fmt(t.pts)+' PTS · '+fmt(t.gp)+' GP';
 }catch{$('roomRecord').textContent='Team standings are unavailable.';if(team!==412)$('roomName').textContent='LGCHL team '+team;}
}
async function roster(){
 try{const rows=await read('wm_lgchl_s55_player_leaders',{select:'lg_user_id,gamertag,player_kind,position,lg_team_id,gp,goals,assists,points,save_pct,gaa,fetched_at',lg_team_id:'eq.'+team,order:'gamertag.asc',limit:'1000'});
 const unique=new Map();for(const p of rows){if(!valid(p.lg_user_id)||!['goalie','skater'].includes(p.player_kind))continue;const key=p.lg_user_id+':'+p.player_kind,old=unique.get(key);if(!old||Number(p.gp)>Number(old.gp)||(Number(p.gp)===Number(old.gp)&&String(p.fetched_at)>String(old.fetched_at)))unique.set(key,p);}
 players=[...unique.values()].sort((a,b)=>(a.player_kind==='goalie')-(b.player_kind==='goalie')||String(a.gamertag).localeCompare(String(b.gamertag)));render();
 }catch{$('roomPlayers').textContent='Player cards are unavailable. Please try again later.';$('roomPlayers').setAttribute('aria-busy','false');}
}
function game(g,final){
 const label=(g.away_nick||g.away_abbr||'Away')+' vs '+(g.home_nick||g.home_abbr||'Home');
 return '<a class="game-row" href="lgchl-game.html?id='+Number(g.lg_game_id)+'"><strong>'+esc(label)+(final?' · '+fmt(g.away_score)+'–'+fmt(g.home_score):'')+'</strong><small>'+esc(date(g.game_at))+' · '+(final?'Final':'Scheduled')+' · Open Game Centre →</small></a>';
}
async function games(){
 const base={select:'lg_game_id,game_at,status,away_nick,away_abbr,home_nick,home_abbr,away_score,home_score',season:'eq.55',or:'(away_lg_team_id.eq.'+team+',home_lg_team_id.eq.'+team+')',limit:'6'};
 const results=await Promise.allSettled([read('lgchl_games_board',{...base,status:'eq.final',order:'game_at.desc'}),read('lgchl_games_board',{...base,status:'neq.final',game_at:'gte.'+new Date().toISOString(),order:'game_at.asc'})]);
 results.forEach((r,i)=>{const el=$(i?'roomUpcoming':'roomFinals');el.innerHTML=r.status==='fulfilled'?r.value.filter(g=>valid(g.lg_game_id)&&(!i?String(g.status).toLowerCase()==='final':String(g.status).toLowerCase()==='scheduled')).map(g=>game(g,!i)).join('')||'<p class="note">'+(i?'No upcoming games are listed.':'No final results are listed.')+'</p>':'<p class="note">Games are unavailable. Please try again later.</p>';});
}
standings();roster();games();
})();
