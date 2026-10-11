/* Hitmen Postgame Desk (hitmen-postgame.html): every published Calgary recap, the latest
   night wrap and the full recap archive. Public reads only: published media_posts and
   lgchl_teams (logos). Keeps the #recaps, #hmRecapList and #game-<lg_game_id> anchors that the
   homepage, season center and War Room link to (hitmen-media.html forwards them here). */
(() => {
  'use strict';
  const D = window.WMDesk; if (!D) return;
  const { $, esc, nb, F, logo, read, tint, recapSortKey, recapScore, recapLede, recapHref, recapDate } = D;
  D.menu();

  const teamsP = read('lgchl_teams', { select: 'lg_team_id,name,abbr,division,logo_path', season: 'eq.55' });
  const recapsP = read('media_posts', { select: 'id,title,body,source_metrics,published_at', published: 'eq.true', post_type: 'eq.recap', 'source_metrics->>team': 'eq.Calgary Hitmen', order: 'published_at.desc', limit: '80' });
  const roomP = read('media_posts', { select: 'id,title,body,source_metrics,published_at', published: 'eq.true', post_type: 'eq.announcement', 'source_metrics->>team': 'eq.Calgary Hitmen', order: 'published_at.desc', limit: '30' });
  [teamsP, recapsP, roomP].forEach(p => p.catch(() => {}));

  const teamTile = t => t?.logo_path ? logo(t.logo_path) : '';
  const shortName = name => String(name || '').split(' ').slice(-1)[0];

  /* ---------- Postgame Desk: stories, night wrap, archive ---------- */
  function oppTeam(name, teams) { const n = String(name || '').toLowerCase(); return teams.find(t => t.name.toLowerCase() === n); }
  const resLabel = r => r.res === 'W' ? 'W' + (r.extra ? ' ' + r.extra : '') : r.res === 'OTL' ? 'L ' + (r.extra || 'OT') : 'L';

  async function renderStories() {
    let posts, teams = [];
    try { posts = await recapsP; } catch { $('featureSlot').innerHTML = '<p class="empty">Published stories could not load. Refresh to try again.</p>'; $('arSub').textContent = 'Recaps unavailable right now.'; return; }
    try { teams = await teamsP; } catch {}
    posts = posts.slice().sort((a, b) => recapSortKey(b) - recapSortKey(a));
    if (!posts.length) { $('featureSlot').innerHTML = '<p class="empty">Game stories appear here after each Calgary game.</p>'; $('arSub').textContent = 'No published recaps yet.'; return; }

    const p = posts[0], m = p.source_metrics || {}, r = recapScore(m), t = oppTeam(m.opponent, teams);
    const ks = m.key_stats || {}, rows = [['Shots', ks.shots], ['Faceoffs', ks.faceoffs], ['Power play', ks.power_play], ['Time on attack', ks.zone_time]].filter(x => x[1]);
    const star = (m.three_stars || [])[0];
    const lede = recapLede(p);
    $('featureSlot').innerHTML = '<a class="feature card" href="' + recapHref(p) + '"><div class="jersey" aria-hidden="true"><span class="res">' + esc(r.win ? 'Hitmen win' + (r.extra ? ' · ' + r.extra : '') : r.res === 'OTL' ? 'Overtime loss' : 'Hitmen loss') + '</span><span class="no">' + esc(r.text) + '</span><span class="name">vs ' + esc(m.opponent || 'Opponent') + '</span></div>' +
      '<div class="feat-body"><span class="tag">Game recap</span><h3>' + esc(nb(p.title)) + '</h3><p>' + esc(lede.length > 230 ? lede.slice(0, 228) + '…' : lede) + '</p>' +
      (rows.length ? '<div class="boxscore"><table><thead><tr><th>Stat</th><th>CGY – OPP</th></tr></thead><tbody>' + rows.map(x => '<tr><td>' + x[0] + '</td><td>' + esc(x[1]) + '</td></tr>').join('') + '</tbody></table></div>' : '') +
      (star ? '<p class="star">★ ' + esc(star.player) + ' · ' + esc(star.line) + '</p>' : '') +
      '<div class="meta"><span>' + esc(recapDate(m)) + '</span><span>Season ' + esc(m.season || 55) + '</span>' + (m.game_no ? '<span>Game ' + esc(m.game_no) + '</span>' : '') + '</div></div></a>';

    $('sideStories').innerHTML = posts.slice(1, 4).map(q => {
      const qm = q.source_metrics || {}, qr = recapScore(qm), qt = oppTeam(qm.opponent, teams), lg = teamTile(qt);
      return '<a class="mini card tinted" href="' + recapHref(q) + '"' + (lg ? ' data-logo="' + lg + '"' : '') + '>' + (lg ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + lg + '\')"></span>' : '') +
        '<div class="mini-score' + (qr.win ? '' : ' loss') + '"><b>' + esc(qr.text) + '</b><small>' + esc(resLabel(qr) + ' · ' + shortName(qm.opponent).toUpperCase()) + '</small></div>' +
        '<div><h4>' + esc(nb(q.title)) + '</h4><div class="meta"><span>' + esc(recapDate(qm)) + '</span>' + (qm.game_no ? '<span>Game ' + esc(qm.game_no) + '</span>' : '') + '</div></div></a>';
    }).join('');
    tint($('sideStories'));
    archive(posts, teams);
  }

  function archive(posts, teams) {
    const weeks = [...new Set(posts.map(p => p.source_metrics?.week).filter(w => w != null).map(String))].sort((a, b) => b - a);
    const wins = posts.filter(p => recapScore(p.source_metrics).win).length;
    const filters = [['all', 'All', posts.length], ...weeks.map(w => ['w' + w, 'Week ' + w, posts.filter(p => String(p.source_metrics?.week) === w).length]), ['win', 'Wins', wins], ['loss', 'Losses', posts.length - wins]];
    $('arSub').textContent = posts.length + ' published · verified LG box scores';
    $('arSeg').innerHTML = filters.map((f, i) => '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-f="' + f[0] + '">' + esc(f[1]) + ' <span class="num">' + f[2] + '</span></button>').join('');
    $('arGrid').innerHTML = posts.map(p => {
      const m = p.source_metrics || {}, r = recapScore(m), t = oppTeam(m.opponent, teams), lg = teamTile(t), gid = Number(m.lg_game_id);
      const anchor = Number.isSafeInteger(gid) && gid > 0 ? ' id="game-' + gid + '"' : '';
      return '<a class="rt card tinted"' + anchor + ' href="' + recapHref(p) + '" data-week="' + esc(m.week ?? '') + '" data-win="' + r.win + '"' + (lg ? ' data-logo="' + lg + '"' : '') + '>' +
        (lg ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + lg + '\')"></span><img class="logo" src="' + lg + '" width="52" height="52" loading="lazy" alt="">' : '<span></span>') +
        '<div><h3>' + esc(nb(p.title)) + '</h3><small>' + (m.game_no ? 'Game ' + esc(m.game_no) + ' · ' : '') + esc(recapDate(m)) + '</small></div>' +
        '<div class="score"><b class="' + (r.win ? 'up' : 'dn') + '">' + esc(r.text) + '</b><small>' + esc(resLabel(r)) + '</small></div></a>';
    }).join('');
    tint($('arGrid'));
    $('arSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $('arSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      const f = b.dataset.f;
      $('arGrid').querySelectorAll('.rt').forEach(a => { a.hidden = !(f === 'all' || (f === 'win' && a.dataset.win === 'true') || (f === 'loss' && a.dataset.win === 'false') || (f[0] === 'w' && f !== 'win' && a.dataset.week === f.slice(1))); });
    });
    const h = location.hash.match(/^#game-(\d+)$/);
    if (h) { const el = document.getElementById('game-' + h[1]); if (el) { el.classList.add('is-target'); el.scrollIntoView({ block: 'center' }); } }
    else if (location.hash === '#hmRecapList' || location.hash === '#recaps') document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  async function renderNightWrap() {
    let rows, teams = [], recaps = [];
    try { rows = await roomP; } catch { return; }
    try { teams = await teamsP; } catch {}
    try { recaps = await recapsP; } catch {}
    const keyOf = p => String(p.source_metrics?.media_key || '');
    const sk = p => Date.parse(p.source_metrics?.sort_at || p.published_at) || 0;
    rows = rows.filter(p => keyOf(p).startsWith('hitmen-')).sort((a, b) => sk(b) - sk(a));
    const wrap = rows.find(p => keyOf(p).includes('night-wrap')); if (!wrap) return;
    const m = wrap.source_metrics || {};
    const finals = rows.filter(p => p !== wrap && p.source_metrics?.game_date === m.game_date && p.source_metrics?.final).sort((a, b) => sk(a) - sk(b));
    const findRecap = fm => recaps.find(r => (fm.lg_game_id && Number(r.source_metrics?.lg_game_id) === Number(fm.lg_game_id)) || (r.source_metrics?.game_date === fm.game_date && String(r.source_metrics?.game_no) === String(fm.game_no)));
    const games = finals.map(f => {
      const fm = f.source_metrics || {}, t = oppTeam(fm.opponent, teams), lg = teamTile(t), win = fm.result === 'W';
      const sc = String(fm.final || '').match(/(\d+)\s*-\s*(\d+)/), txt = sc ? sc[1] + '–' + sc[2] : esc(fm.final || '');
      const lbl = fm.result === 'OTL' ? 'L OT' : fm.result || '', rc = findRecap(fm), tag = rc ? 'a' : 'div';
      return '<' + tag + ' class="wg card tinted"' + (rc ? ' href="' + recapHref(rc) + '"' : '') + (lg ? ' data-logo="' + lg + '"' : '') + '>' + (lg ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + lg + '\')"></span><img src="' + lg + '" alt="">' : '<span></span>') +
        '<span><b>' + esc(fm.opponent || 'Opponent') + '</b><small>' + (fm.game_no ? 'Game ' + esc(fm.game_no) : '') + '</small></span><span class="r ' + (win ? 'up' : 'dn') + '">' + txt + '<small>' + esc(lbl) + '</small></span></' + tag + '>';
    }).join('');
    const ldr = (m.night_leaders || []).slice(0, 3).map((x, i) => '<div class="leader card"><small>' + (i === 2 && /SV/.test(x.line) ? 'In goal' : 'Night leader') + '</small><b>' + esc(x.player) + '</b><span>' + esc(x.line) + '</span></div>').join('');
    const day = m.game_date ? F.day.format(new Date(m.game_date + 'T16:00:00Z')) : '';
    $('nwEyebrow').textContent = 'Postgame Desk · last game night' + (day ? ' · ' + day : '');
    $('nwCard').innerHTML = '<article class="wrap-card card"><div class="jersey" aria-hidden="true"><span class="res">Night record</span><span class="no">' + esc(m.night_record || '—') + '</span><span class="name">Season ' + esc(m.record || '—') + '</span></div>' +
      '<div class="feat-body"><span class="tag">' + (m.status === 'final' ? 'Night final' : 'Game night') + '</span><h3>' + esc(wrap.title) + '</h3><p>' + esc(wrap.body) + '</p>' +
      (games ? '<div class="wrap-games">' + games + '</div>' : '') + (ldr ? '<div class="leaders-row">' + ldr + '</div>' : '') + '</div></article>';
    $('nightWrap').hidden = false; tint($('nwCard'));
  }

  renderStories(); renderNightWrap();
})();
