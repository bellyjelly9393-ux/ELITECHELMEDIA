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
  const defs = Object.freeze([
    {key:'hot',icon:'🔥',label:'Hot Start',detail:'5–15 GP and at least 2.00 points per game in the current LGCHL season.'},
    {key:'career',icon:'🏆',label:'Career-Year Watch',detail:'10+ GP; season points-per-game pace at least 0.20 above their best previous 10+ GP LGCHL season.'},
    {key:'rise',icon:'📈',label:'On the Rise',detail:'10+ GP in S54 and S55; scoring rate improved by at least 0.35 points/game from Season 54.'},
    {key:'streak',icon:'⚡',label:'Point Streak',detail:'Three or more consecutive appearances with a point, once complete verified game logs are available.'},
    {key:'wall',icon:'🧱',label:'Brick Wall',detail:'Goalie with at least 8 GP and an 85.0% or better save percentage.'}
  ]);
  function earned(p) {
    if (!p) return [];
    const gp = n(p.gp), pts = n(p.points), ppg = gp > 0 && pts !== null ? pts / gp : null;
    if (p.player_kind === 'goalie') return gp >= 8 && n(p.save_pct) >= .85 ? ['wall'] : [];
    const found = [];
    if (ppg !== null && gp >= 5 && gp <= 15 && ppg >= 2) found.push('hot');
    const history = records.get(id(p));
    if (history && ppg !== null && gp >= 10) {
      if (n(history.career_best_ppg) !== null && ppg >= Number(history.career_best_ppg) + .20) found.push('career');
      if (n(history.prev_gp) >= 10 && n(history.prev_ppg) !== null &&
          ppg >= Number(history.prev_ppg) + .35) found.push('rise');
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