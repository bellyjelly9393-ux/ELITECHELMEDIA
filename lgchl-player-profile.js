/* LGCHL public player quick-view. Public season totals only; never load scouting or VOD data. */
(() => {
  'use strict';
  const D = window.WMDesk;
  if (!D) return;
  const { esc } = D;
  const metrics = Object.freeze({
    points:'points', goals:'goals', assists:'assists', shots:'shots', hits:'hits',
    blocked_shots:'blocked shots', takeaways:'takeaways', save_pct:'save percentage', gaa:'goals-against average'
  });
  const numeric = v => v !== null && v !== undefined && String(v).trim() !== '' && Number.isFinite(Number(v));
  const n = v => numeric(v) ? Number(v) : 0;
  const fmt = v => numeric(v) ? Number(v).toLocaleString('en-US') : '—';
  const rate = (v, digits=2) => numeric(v) ? Number(v).toFixed(digits) : '—';
  const logo = id => Number.isSafeInteger(Number(id)) && Number(id) > 0
    ? 'assets/lgchl/s55/team' + Number(id) + '.png'
    : 'assets/wildman/home/lgchl-logo.webp';
  const stamp = v => v && Number.isFinite(Date.parse(v))
    ? new Intl.DateTimeFormat('en-CA', {month:'short', day:'numeric', year:'numeric', timeZone:'America/Toronto'}).format(new Date(v))
    : 'Date unavailable';

  function story(p, metric, rank) {
    const gp = n(p.gp), tag = String(p.gamertag || 'This player');
    const board = Number.isInteger(rank) && rank > 0 && metrics[metric]
      ? ' Currently ranked No. ' + rank + ' on the ' + metrics[metric] + ' board.'
      : '';
    if (p.player_kind === 'goalie' || metric === 'save_pct' || metric === 'gaa') {
      if (!gp) return 'Season 55 goalie totals are not available yet.';
      const a = numeric(p.save_pct) ? 'a ' + (n(p.save_pct) * 100).toFixed(1) + '% save percentage' : 'a recorded season';
      const b = numeric(p.gaa) ? ' and a ' + rate(p.gaa) + ' goals-against average' : '';
      return tag + ' has ' + gp + ' ' + (gp === 1 ? 'appearance' : 'appearances') +
        ' this season, with ' + a + b + '.' + board;
    }
    if (!gp || !numeric(p.points)) return 'Season 55 scoring totals are not yet available for this player.';
    const points = n(p.points), goals = n(p.goals), assists = n(p.assists);
    const ppg = points / gp;
    const lead = gp >= 5 && ppg >= 2 ? 'A two-point-per-game pace is taking shape.' :
      gp >= 5 && ppg >= 1.5 ? 'A productive stretch of the season so far.' :
      'Here is the Season 55 scoring picture.';
    const base = lead + ' ' + tag + ' has ' + points + ' points (' + goals + ' goals, ' + assists +
      ' assists) through ' + gp + ' games, averaging ' + ppg.toFixed(2) + ' points per game.' + board;
    const h = window.WMLgPlayerBadges?.history(p);
    if (!h || gp < 10) return base;
    const previous = numeric(h.prev_ppg) && numeric(h.prev_gp) && Number(h.prev_gp) >= 10
      ? ' Last season: ' + Number(h.prev_ppg).toFixed(2) + ' points per game in ' + h.prev_gp + ' LGCHL games.' : '';
    const career = numeric(h.career_best_ppg) && ppg >= Number(h.career_best_ppg) + .20
      ? ' This year\'s current pace is above his or her previous LGCHL high of ' + Number(h.career_best_ppg).toFixed(2) +
        ' points per game. The season is still in progress.' : '';
    return base + previous + career;
  }
  function stat(label, value) {
    return '<div class="lg-profile-stat"><small>' + esc(label) + '</small><b>' + esc(String(value)) + '</b></div>';
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'lg-profile-dialog';
  dialog.setAttribute('aria-labelledby', 'lgProfileTitle');
  dialog.innerHTML = '<div class="lg-profile-shell"><button class="lg-profile-close" type="button" aria-label="Close player profile">×</button><div id="lgProfileContent"></div></div>';
  document.body.appendChild(dialog);
  dialog.querySelector('.lg-profile-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  function open(p, context={}) {
    if (!p || !p.gamertag) return;
    const metric = Object.hasOwn(metrics, context.metric) ? context.metric : 'points';
    const rank = Number(context.rank);
    const isGoalie = p.player_kind === 'goalie' || metric === 'save_pct' || metric === 'gaa';
    const stats = isGoalie
      ? stat('Games', fmt(p.gp)) + stat('Save %', numeric(p.save_pct) ? (n(p.save_pct) * 100).toFixed(1) + '%' : '—') + stat('GAA', rate(p.gaa))
      : stat('Games', fmt(p.gp)) + stat('Goals', fmt(p.goals)) + stat('Assists', fmt(p.assists)) +
        stat('Points', fmt(p.points)) + stat('Points / game', n(p.gp) > 0 && numeric(p.points) ? (n(p.points) / n(p.gp)).toFixed(2) : '—') +
        stat('Shots', fmt(p.shots));
    const name = esc(String(p.gamertag));
    const team = esc(String(p.team_name || 'Team unavailable'));
    const position = esc(String(p.position || (isGoalie ? 'G' : 'Position unavailable')));
    const earned = window.WMLgPlayerBadges?.chips(p,true) || '';
    const badge = Number.isInteger(rank) && rank > 0
      ? '<span class="lg-profile-rank">No. ' + rank + ' · ' + esc(metrics[metric]) + '</span>'
      : '';
    dialog.querySelector('#lgProfileContent').innerHTML =
      '<div class="lg-profile-hero">' +
        '<div class="lg-profile-logo"><img src="' + logo(p.lg_team_id) + '" alt="' + team + ' logo" onerror="this.onerror=null;this.src=\'assets/wildman/home/lgchl-logo.webp\'"></div>' +
        '<div class="lg-profile-identity"><small>ELITECHEL MEDIA · LGCHL SEASON 55</small><h2 id="lgProfileTitle">' + name + '</h2>' +
        '<p>' + team + ' · ' + position + '</p>' + badge + (earned ? '<div class="lg-player-badges">' + earned + '</div>' : '') + '</div>' +
      '</div>' +
      '<div class="lg-profile-stat-grid">' + stats + '</div>' +
      '<section class="lg-profile-story" aria-labelledby="lgProfileStoryTitle"><small>THE SEASON STORY</small>' +
        '<h3 id="lgProfileStoryTitle">Season 55 at a glance</h3><p>' + esc(story(p, metric, rank)) + '</p>' +
      '</section>' +
      '<p class="lg-profile-source">Verified imported season totals · Updated ' + esc(stamp(p.fetched_at)) +
      '. Previous-season comparisons and last-five game lines will only be shown after their public source data is verified.</p>';
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!context.enriched && numeric(p.lg_user_id) && window.WMLgPlayerBadges) {
      const active = p.gamertag + '|' + p.lg_user_id;
      dialog.dataset.activePlayer = active;
      window.WMLgPlayerBadges.load([p],D.read).then(ok => {
        if (ok && dialog.open && dialog.dataset.activePlayer === active)
          open(p,{...context,enriched:true});
      });
    }
  }
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-lg-profile]');
    if (!button) return;
    try {
      const payload = JSON.parse(decodeURIComponent(button.dataset.lgProfile));
      if (payload && payload.p) open(payload.p, {metric:payload.metric,rank:payload.rank});
    } catch { /* Ignore malformed profile attributes rather than displaying invented details. */ }
  });
  window.WMLgPlayerProfile = Object.freeze({open});
})();