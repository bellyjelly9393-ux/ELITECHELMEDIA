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
  let data;
  function renderNations() {
    $('thNations').innerHTML=data.teams.map(t=>'<a href="'+teamUrl(t.id)+'" target="_blank" rel="noopener noreferrer" class="th-nation-chip" title="LeagueGaming '+esc(t.name)+' roster">'+teamMark(t,34)+'<span>'+esc(t.name)+'</span></a>').join('');
  }
  async function start(){
    const response=await fetch('lg3s-season1-data.json?v=20261021-2',{cache:'no-store'});
    if(!response.ok)throw Error('Snapshot unavailable');
    data=await response.json();
    if(!Array.isArray(data.teams)||data.teams.length!==12||data.games.length!==30||data.players.length<200)throw Error('Incomplete league snapshot');
    renderNations();

  }
  start().catch(err=>{
    console.error('LG3s public media snapshot:',err);
    if($('thGames'))$('thGames').innerHTML='<p class="th-caption">The saved fixture board is temporarily unavailable. Check <a href="https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=standing&leagueid=154&seasonid=1" target="_blank" rel="noopener noreferrer">official LeagueGaming</a> for the latest schedule.</p>';

    // The independent verified leaderboard feed owns its error state.
  });
})();

