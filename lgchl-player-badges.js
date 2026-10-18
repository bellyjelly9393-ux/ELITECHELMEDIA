/* ELITECHEL MEDIA public player badges. Only verified public statistics.
   Historical data loads from a narrow, security-invoker, read-only view after migration.
   No scouting, AI inference, or private/VOD table access. */
(() => {
  'use strict';
  const D = window.WMDesk;
  if (!D) return;
  const {esc, read} = D;
  const records = new Map();
  const numeric = x => x !== undefined && x !== null && String(x).trim() !== '' && Number.isFinite(Number(x));
  const n = x => numeric(x) ? Number(x) : null;
  const id = p => p && numeric(p.lg_user_id) && Number(p.lg_user_id) > 0
    ? String(p.lg_user_id) + '|' + (p.player_kind || 'skater') : null;
  const svg = body => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  const defs = Object.freeze([
    {key:'hot',icon:svg('<path d="M8.5 14.5A7 7 0 0 1 10 6c.4 2.5 1.5 4 3 5 .5-3 1-4.5 3-7 1.3 3 3 5.5 3 9a7 7 0 1 1-11.5 1.5Z"/>'),label:'Hot Start',detail:'5–20 GP and at least 2.00 points per game in the current LGCHL season.'},
    {key:'career',icon:svg('<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>'),label:'Career-Year Watch',detail:'6+ GP in S55; season points-per-game pace at least 0.30 above their best previous 10+ GP LGCHL season.'},
    {key:'rise',icon:svg('<path d="m3 17 6-6 4 4 7-8M14 7h6v6"/>'),label:'On the Rise',detail:'6+ GP in S55 and 10+ GP in S54; scoring rate improved by at least 0.50 points/game from Season 54.'},
    {key:'streak',icon:svg('<path d="m13 2-9 12h7l-1 8 10-12h-7l0-8"/>'),label:'Point Streak',detail:'Three or more consecutive appearances with a point, once complete verified game logs are available.'},
    {key:'wall',icon:svg('<path d="M3 4h18v16H3zM3 10h18M3 16h18M9 4v6M15 10v6M9 16v4"/>'),label:'Brick Wall',detail:'Goalie with at least 8 GP and an 85.0% or better save percentage.'}
  ]);
  function earned(p) {
    if (!p) return [];
    const gp = n(p.gp), pts = n(p.points), ppg = gp > 0 && pts !== null ? pts / gp : null;
    if (p.player_kind === 'goalie') return gp >= 8 && n(p.save_pct) >= .85 ? ['wall'] : [];
    const found = [];
    if (ppg !== null && gp >= 5 && gp <= 20 && ppg >= 2) found.push('hot');
    const history = records.get(id(p));
    if (history && ppg !== null && gp >= 6) {
      if (n(history.career_best_ppg) !== null && ppg >= Number(history.career_best_ppg) + .30) found.push('career');
      if (n(history.prev_gp) >= 10 && n(history.prev_ppg) !== null &&
          ppg >= Number(history.prev_ppg) + .50) found.push('rise');
    }
    // Deliberately no 'streak' without a complete, verified per-game sequence.
    return found;
  }
  function chips(p, expanded=false) {
    return earned(p).map(key => {
      const x=defs.find(d=>d.key===key);
      return '<span class="lg-player-badge lg-player-badge-' + x.key +
        '" title="' + esc(x.label + ': ' + x.detail) + '" aria-label="' + esc(x.label) + '">' +
        '<span aria-hidden="true">' + x.icon + '</span>' + (expanded ? '<span>' + esc(x.label) + '</span>' : '') + '</span>';
    }).join('');
  }
  function legend() {
    return '<details class="lg-badge-legend"><summary>What do the player emblems mean?</summary>' +
      '<div class="lg-badge-legend-grid">' + defs.map(x => '<div><span class="lg-player-badge lg-player-badge-' + x.key +
      '" aria-hidden="true">' + x.icon + '</span><div><b>' + esc(x.label) + '</b><small>' + esc(x.detail) + '</small></div></div>').join('') +
      '</div><p>Badges are earned from verified statistics. Historical and streak badges stay hidden when their required records are unavailable. A season pace is not a completed career record.</p></details>';
  }
  function refresh(root=document) {
    root.querySelectorAll('button[data-lg-profile]').forEach(button => {
      let p;
      try { p=JSON.parse(decodeURIComponent(button.dataset.lgProfile)).p; }
      catch { return; }
      let slot=button.nextElementSibling;
      if (!slot || !slot.classList.contains('lg-player-badges')) {
        slot=document.createElement('span');
        slot.className='lg-player-badges';
        button.insertAdjacentElement('afterend',slot);
      }
      slot.innerHTML=chips(p);
      slot.hidden=!slot.innerHTML;
    });
  }
  async function load(rows,reader=read) {
    const ids=[...new Set((rows || []).map(p=>n(p.lg_user_id)).filter(x=>x!==null && x>0))];
    if (!ids.length) return false;
    try {
      // The view only exposes aggregated, non-sensitive LGCHL season comparisons.
      // Query by official stable LG user ID, never by the current gamertag.
      for(let i=0;i<ids.length;i+=80) {
        const chunk=ids.slice(i,i+80);
        const data=await reader('lgchl_public_player_badges',{
          select:'lg_user_id,player_kind,prev_gp,prev_ppg,career_best_ppg',
          lg_user_id:'in.(' + chunk.join(',') + ')',
          limit:String(chunk.length*2)
        });
        for(const x of data) {
          const key=id(x);
          if(key) records.set(key,x);
        }
      }
      refresh();
      return true;
    } catch {
      // A missing/migrating public history view is not an excuse to use raw scouting tables.
      return false;
    }
  }
  window.WMLgPlayerBadges=Object.freeze({earned,chips,legend,refresh,load,history:p=>records.get(id(p))||null});
})();