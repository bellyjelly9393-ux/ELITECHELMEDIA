/* Public LG3s verified leaderboards. Data comes from the existing parser-backed Supabase public views. No LG sign-in, privileged keys, or writes. */
(()=>{'use strict';
const root=document.getElementById('rosters');if(!root)return;
const base='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const key='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const profile=id=>'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid='+Number(id)+'&leagueid=154&seasonid=1';
let skaters=[],goalies=[],limit=10;const unavailable=new Set();
const get=async name=>{const r=await fetch(base+name+'?select=*',{headers:{apikey:key},cache:'no-store'});if(!r.ok)throw Error(name+' '+r.status);return r.json()};
const num=v=>Number(v)||0;
const fmt=(v,d=0)=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
function mode(){return $('thPlayerStatus').value}
function render(){
const goalie=mode()==='goalies',src=goalie?goalies:skaters;
if(unavailable.has(mode())){$('thPlayerRows').innerHTML='<tr><td colspan="10">This verified leaderboard is temporarily unavailable. Try the other leaderboard.</td></tr>';$('thPlayerCount').textContent='VERIFIED FEED UNAVAILABLE';$('thPlayersMore').hidden=true;return;}
const metric=$('thPlayerSort').value,search=$('thPlayerSearch').value.trim().toLowerCase(),nation=$('thPlayerTeam').value;
const data=src.filter(p=>{const nations=goalie?(p.nations_played_for||[]):[p.nation];return (nation==='all'||nations.includes(nation))&&(!search||String(p.gamertag).toLowerCase().includes(search))});
data.sort((a,b)=>{const av=a[metric]==null?null:Number(a[metric]),bv=b[metric]==null?null:Number(b[metric]);if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return -1;return (metric==='gaa_per_game'?(av-bv):(bv-av))||num(b.gp)-num(a.gp)||String(a.gamertag).localeCompare(String(b.gamertag))});
const columns=goalie?['#','PLAYER','NATION','GP','SA','SV','GA','SV%','GA/G']:['#','PLAYER','NATION','GP','G','A','PTS','+/-','SHOTS','HITS'];
$('thLeadersHead').innerHTML='<tr>'+columns.map(c=>'<th scope="col">'+c+'</th>').join('')+'</tr>';
$('thPlayerRows').innerHTML=data.slice(0,limit).map((p,i)=>{const cells=goalie?[p.gp,p.sa,p.sv,p.ga,p.sv_pct!=null&&Number(p.sa)>0?fmt(Number(p.sv_pct)*100,1)+'%':'—',fmt(p.gaa_per_game,2)]:[p.gp,p.g,p.a,p.p,p.plus_minus,p.shots,p.hits];const nations=goalie?(p.nations_played_for||[]).join(', '):p.nation;return '<tr><td class="th-num-rank">'+(i+1)+'</td><td><a class="th-player-name" target="_blank" rel="noopener noreferrer" href="'+profile(p.lg_user_id)+'">'+esc(p.gamertag)+' ↗</a></td><td>'+esc(nations)+'</td>'+cells.map(x=>'<td class="num">'+esc(x??'—')+'</td>').join('')+'</tr>'}).join('')||'<tr><td colspan="'+columns.length+'">No verified player statistics match these filters.</td></tr>';
$('thPlayerCount').textContent='SHOWING '+Math.min(limit,data.length)+' OF '+data.length+' VERIFIED '+(goalie?'GOALIES':'SKATERS');
$('thPlayersMore').hidden=limit>=data.length;
}
function changeMode(){const goalie=mode()==='goalies';$('thPlayerSort').innerHTML=(goalie?[['sv_pct','Save percentage'],['sv','Saves'],['gaa_per_game','Lowest goals against per game'],['sa','Shots against'],['gp','Games played']]:[['p','Points'],['g','Goals'],['a','Assists'],['plus_minus','Plus/minus'],['shots','Shots'],['hits','Hits'],['gp','Games played']]).map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('');limit=10;render()}
Promise.allSettled([get('lg3s_public_skater_leaders'),get('lg3s_public_goalie_leaders')]).then(results=>{
const s=results[0].status==='fulfilled'?results[0].value:[],g=results[1].status==='fulfilled'?results[1].value:[];
if(results[0].status==='rejected')unavailable.add('skaters');if(results[1].status==='rejected')unavailable.add('goalies');
if(results.every(r=>r.status==='rejected'))throw Error('Verified leader views unavailable');
skaters=s;goalies=g;
$('thRosterStats').textContent='VERIFIED GAME REPORTS · '+s.length+' SKATERS · '+g.length+' GOALIES · FETCHED '+new Date().toLocaleString('en-US',{timeZone:'America/Toronto'})+' ET';
const nations=[...new Set([...s.map(p=>p.nation),...g.flatMap(p=>p.nations_played_for||[])].filter(Boolean))].sort();
$('thPlayerTeam').innerHTML='<option value="all">All nations</option>'+nations.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');
$('thPlayerStatus').addEventListener('change',changeMode);
$('thPlayerSearch').addEventListener('input',()=>{limit=10;render()});
$('thPlayerTeam').addEventListener('change',()=>{limit=10;render()});
$('thPlayerSort').addEventListener('change',render);
$('thPlayerPosition').closest('label').hidden=true;
$('thPlayersMore').addEventListener('click',()=>{limit+=30;render()});
changeMode();
}).catch(e=>{$('thPlayersMore').hidden=true;$('thPlayerCount').textContent='VERIFIED FEEDS TEMPORARILY UNAVAILABLE';console.error('LG3s verified leaderboard unavailable',e);$('thPlayerRows').innerHTML='<tr><td colspan="10">Verified leaderboards temporarily unavailable. No unverified stats are shown.</td></tr>';});
})();
