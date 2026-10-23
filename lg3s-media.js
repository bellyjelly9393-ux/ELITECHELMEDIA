/* Elitechel Media LG3s public league desk. Read-only static snapshot. No video/DB writes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = id => 'assets/lg3s/team' + Number(id) + '.svg';
  const teamUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league_page&page=team_page&teamid=' + Number(id) + '&leagueid=154&seasonid=1';
  const userUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid=' + Number(id) + '&leagueid=154&seasonid=1';
  const gameUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' + Number(id);
  const salary = n => n == null ? 'No contract' : '$' + (n / 1e6).toFixed(2).replace(/0+$/,'').replace(/\.$/,'') + 'M';
  const shortTime = t => ({'20:00':'8:00 PM','20:35':'8:35 PM','21:10':'9:10 PM'})[t] || esc(t);
  const teamMark = (t, size = 48) => '<img src="' + icon(t.id) + '" width="' + size + '" height="' + size + '" loading="lazy" alt="' + esc(t.name) + ' team crest">';
  const btn = $('menuBtn'), nav = $('nav');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', e => { if(e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }});
    document.addEventListener('keydown', e => { if(e.key === 'Escape'){nav.classList.remove('open');btn.setAttribute('aria-expanded','false');}});
  }
  let data, tm, chosenDay='2026-10-21', boardMode='official', playerLimit=40;
  function team(id){ return tm.get(Number(id)); }

  function renderNations() {
    $('thNations').innerHTML = data.teams.map(t => '<a href="' + teamUrl(t.id) + '" target="_blank" rel="noopener noreferrer" class="th-nation-chip" title="LeagueGaming ' + esc(t.name) + ' roster">' + teamMark(t,34) + '<span>' + esc(t.name) + '</span></a>').join('');
  }
  function gameCard(g){
    const a=team(g.away),h=team(g.home),p=g.pick ? team(g.pick):null;
    const marquee=/MARQUEE|HEADLINER|STAR DUEL|STYLE CLASH/.test(g.tag);
    const classes='th-game th-game-v2' + (marquee?' th-game-feature':'');
    return '<a class="' + classes + '" href="' + gameUrl(g.id) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(a.name) + ' at ' + esc(h.name) + ', ' + shortTime(g.time) + ' Eastern, official game">' +
      '<img class="th-game-wm" src="' + icon(h.id) + '" loading="lazy" alt="" aria-hidden="true">' +
      '<div class="th-game-top"><span class="th-game-day">' + esc(g.tag) + '</span><strong>GAME ' + esc(String(g.id).slice(-3)) + '</strong><span class="th-action">LG GAME CENTRE ↗</span></div>' +
      '<div class="th-teams"><div>' + teamMark(a,68) + '<strong>' + esc(a.name) + '</strong><small>AWAY</small></div><span class="th-vs">AT</span><div>' + teamMark(h,68) + '<strong>' + esc(h.name) + '</strong><small>HOME</small></div></div>' +
      '<div class="th-game-foot"><span>THE MATCHUP</span><p>' + esc(g.preview) + '</p></div>' +
      '<div class="th-game-verdict">' + (p ? '<span>ECM PICK · <b>' + esc(p.name) + '</b></span><span class="th-pick-label">EDITORIAL PREDICTION</span>' : '<span>THURSDAY · PREVIEW ONLY</span><span class="th-pick-label">NO PICK POSTED</span>') + '</div>' +
      '</a>';
  }
  function renderGames(){
    const games=data.games.filter(g => chosenDay==='all'||g.date===chosenDay);
    const blocks=new Map;
    for(const g of games){const key=g.date+'|'+g.time;if(!blocks.has(key))blocks.set(key,[]);blocks.get(key).push(g);}
    $('thGames').innerHTML=[...blocks.entries()].map(([key,arr])=>{
      const [date,time]=key.split('|'),label=date==='2026-10-21'?'WEDNESDAY · OCT 21':'THURSDAY · OCT 22';
      return '<div class="th-wave"><header class="th-wave-header"><span class="th-wave-time">' + shortTime(time) + ' <small>ET</small></span><span>' + label + '</span><span>' + arr.length + ' MATCHUPS</span></header><div class="th-games">' + arr.map(gameCard).join('') + '</div></div>';
    }).join('');
    const all=chosenDay==='all',isWed=chosenDay==='2026-10-21';
    $('thSelectedNight').textContent=all?'FULL OPENING WEEK · OCT 21–22':isWed?'OPENING NIGHT · WEDNESDAY, OCT 21':'NIGHT TWO · THURSDAY, OCT 22';
    $('thNightStat').textContent=(all?'30':isWed?'18':'12')+' VERIFIED FIXTURES · '+(all?'FIVE':isWed?'THREE':'TWO')+' WAVES';
    document.querySelectorAll('.th-switch button[data-date]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.date===chosenDay)));
  }
  function standingsTable(group){
    const teams=data.teams.filter(t=>t.group===group);
    if(boardMode==='forecast'){
      const project=new Map(data.projection.records.map(p=>[p.id,p]));
      teams.sort((a,b)=>project.get(b.id).w-project.get(a.id).w||a.name.localeCompare(b.name));
      return '<div class="th-standing-group"><header class="th-standing-title"><strong>GROUP ' + group + '</strong><span>ECM PREDICTION · AFTER NIGHT ONE</span></header><div class="th-table-scroll"><table class="th-table"><thead><tr><th>TEAM</th><th>W</th><th>L</th><th>PROJECTED RECORD</th></tr></thead><tbody>'+teams.map(t=>{
        const p=project.get(t.id);
        return '<tr><td><a class="th-team-link" href="'+teamUrl(t.id)+'" target="_blank" rel="noopener noreferrer">'+teamMark(t,32)+esc(t.name)+'</a></td><td class="num">'+p.w+'</td><td class="num">'+p.l+'</td><td class="th-record">'+p.w+'–'+p.l+'</td></tr>';
      }).join('')+'</tbody></table></div></div>';
    }
    return '<div class="th-standing-group"><header class="th-standing-title"><strong>GROUP '+group+'</strong><span>OFFICIAL PRESEASON STANDINGS</span></header><div class="th-table-scroll"><table class="th-table"><thead><tr><th>TEAM</th><th>GP</th><th>W</th><th>L</th><th>OTW</th><th>OTL</th><th>PTS</th><th>GF</th><th>GA</th><th>GD</th></tr></thead><tbody>'+teams.map(t=>
    '<tr><td><a class="th-team-link" href="'+teamUrl(t.id)+'" target="_blank" rel="noopener noreferrer">'+teamMark(t,32)+esc(t.name)+'</a></td>'+['gp','w','l','otw','otl','pts','gf','ga','gd'].map(k=>'<td class="num">'+Number(t[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></div>';
  }
  function renderStandings(){
    $('thStandings').innerHTML=standingsTable('A')+standingsTable('B');
    $('thStandingsNote').textContent=boardMode==='forecast'?
    'ECM forecast: straight-up predictions for the 18 Wednesday games (three per nation). This is not an official record, a betting market, or a simulation of goal scores. Teams tied on projected wins are not ranked by a fabricated tiebreaker.':
    'Official LeagueGaming Season 1 standings, captured October 21, 2026 before posted opening results. All teams start 0–0; this snapshot does not update automatically after the games.';
    $('thStandingsAsOf').textContent=boardMode==='forecast'?'EDITORIAL · NOT OFFICIAL':'OFFICIAL SNAPSHOT · OCT 21';
    document.querySelectorAll('.th-board-mode').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.boardMode===boardMode)));
  }
  function renderPlayers(){ /* Replaced by verified LG3s live leaderboard module. */ }
  async function start(){
    const response=await fetch('lg3s-season1-data.json?v=20261021-2',{cache:'no-store'});
    if(!response.ok)throw Error('Snapshot unavailable');
    data=await response.json();
    if(!Array.isArray(data.teams)||data.teams.length!==12||data.games.length!==30||data.players.length<200)throw Error('Incomplete league snapshot');
    tm=new Map(data.teams.map(t=>[t.id,t]));
    renderNations();renderGames();renderStandings();
    // Nation choices are populated from verified statistical leader views.
    renderPlayers();
    document.querySelectorAll('.th-switch button[data-date]').forEach(b=>b.addEventListener('click',()=>{chosenDay=b.dataset.date;renderGames();}));
    document.querySelectorAll('.th-board-mode').forEach(b=>b.addEventListener('click',()=>{boardMode=b.dataset.boardMode;renderStandings();}));
    // Leaderboard event handlers are owned by lg3s-live-leaders.js.
    // Pagination is owned by the verified leaderboard module.
  }
  start().catch(err=>{
    console.error('LG3s public media snapshot:',err);
    if($('thGames'))$('thGames').innerHTML='<p class="th-caption">The saved fixture board is temporarily unavailable. Check <a href="https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=standing&leagueid=154&seasonid=1" target="_blank" rel="noopener noreferrer">official LeagueGaming</a> for the latest schedule.</p>';
    if($('thStandings'))$('thStandings').innerHTML='<p class="th-caption">Official group snapshot unavailable.</p>';
    if($('thPlayerRows'))$('thPlayerRows').innerHTML='<tr><td colspan="6">Roster snapshot unavailable right now.</td></tr>';
  });
})();
