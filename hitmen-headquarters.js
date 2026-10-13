/* Public team desk. Only official posted lineup snapshots and published media are shown.
   No account tokens, management drafts, or training-camp data are requested here. */
(() => {
 const media=document.getElementById('hqMedia'),weekly=document.getElementById('hqWeekly');
 if(media)media.innerHTML='<div class="hn-section-head"><div><span class="hn-k">CALGARY MEDIA DESK</span><h2 class="hn-h2">Media write-ups</h2></div><a class="hq-inline" href="hitmen-media.html#recaps">All game recaps →</a></div><p class="hn-lede">Read the latest published game stories, results and player features.</p><span id="hmRecapCount" class="wr-chip">Loading recaps</span><div id="hmRecapList" class="hm-recap-grid" data-first="2" aria-live="polite"><p>Loading published Calgary write-ups…</p></div><button id="hmRecapMore" class="small-btn" type="button" hidden>More write-ups</button>';
 if(!weekly)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const positions=['LW','C','RW','LD','RD','G'];
 const six=(title,players)=>'<details><summary>'+title+'</summary><ul>'+positions.map(p=>'<li><b>'+p+'</b> '+esc(players[p]||'Not confirmed')+'</li>').join('')+'</ul></details>';
 weekly.innerHTML='<p role="status">Loading Calgary’s posted lineups…</p>';
 fetch('data/hitmen/season-55-week-3-posted-lineups.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Lineups unavailable');return r.json();}).then(data=>{
  if(data.team_id!==412||data.season!==55||!Array.isArray(data.games))throw Error('Unexpected team snapshot');
  const games=data.games,checked=games.filter(g=>g.status==='verified_posted_lineups'&&g.lineups).length;
  weekly.innerHTML='<div class="hn-section-head"><div><span class="hn-k">SEASON 55 · WEEK '+esc(data.week)+' · OCT 11–13</span><h2 class="hn-h2">Weekly game prep</h2></div><span class="wr-chip">'+checked+' / '+games.length+' lineups verified</span></div><p class="hn-lede">Official LG posted six for both teams. Lineups can change before puck drop; check the source for the latest. Unavailable names are never filled from the full roster.</p><div class="hq-week-grid">'+games.map(g=>{
   const date=new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(g.scheduled_at));
   const valid=g.status==='verified_posted_lineups'&&g.lineups;
   const url='https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+Number(g.lg_game_id);
   return '<article class="hq-game" id="prep-'+Number(g.lg_game_id)+'"><span class="hn-k">'+esc(date)+' ET</span><h3>'+esc(g.opponent_name)+'</h3><p>'+ (valid?'Both posted lineups verified':'Awaiting signed-in lineup capture')+'</p>'+(valid?six('Calgary’s six',g.lineups.calgary)+six('Opponent’s six',g.lineups.opponent):'<p>LG’s public page did not expose player names when checked. The saved team preview remains available to authorized scouting accounts.</p>')+'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Official LG game →</a><br><a href="hitmen-scouting-report.html?game='+encodeURIComponent(g.scheduled_game_id)+'">Pregame scouting report →</a><p>Checked '+esc(new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(g.captured_at)))+' ET</p></article>';
  }).join('')+'</div>';
 }).catch(()=>{weekly.innerHTML='<p role="status">Weekly lineups could not load. <a href="hitmen-opponents.html">Open opponent scouting</a> or refresh this page.</p>';});
})();