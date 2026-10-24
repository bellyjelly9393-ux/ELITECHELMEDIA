/* International broadcast presentation. Saved fixtures are dated; predictions are editorial. */
(()=>{'use strict';const $=id=>document.getElementById(id);if(!$('lg3Broadcast'))return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mark=t=>'<img src="assets/lg3s/flag'+Number(t.id)+'.svg" alt="'+esc(t.name)+' flag">';
const gameUrl=id=>'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+Number(id);
const profile=id=>'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid='+Number(id)+'&leagueid=154&seasonid=1';
const et=g=>g.date+' · '+g.time+' ET';
fetch('lg3s-season1-data.json?v=20261021-2',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('snapshot');return r.json()}).then(d=>{
if(!Array.isArray(d.teams)||d.teams.length!==12||!d.games?.length)throw Error('Incomplete snapshot');
const teams=new Map(d.teams.map(t=>[t.id,t]));
$('arenaNations').innerHTML=d.teams.map(t=>'<div class="lg3-arena-banner"><div class="lg3-arena-cloth" style="--flag:url(assets/lg3s/flag'+Number(t.id)+'.svg)"></div><span class="lg3-arena-name">'+esc(t.name)+'</span></div>').join('');
if(window.startLG3Desk)window.startLG3Desk(d);
}).catch(()=>{['lg3Feature','lg3Schedule','lg3Rankings','lg3Spotlight','lg3Posters','lg3News'].forEach(id=>{if($(id))$(id).textContent='League snapshot temporarily unavailable. Please check official LeagueGaming coverage.'})});
})();
