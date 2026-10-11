/* Hitmen recap article (hitmen-recap.html?id=<media_posts.id> or ?game=<lg_game_id>).
   Renders one published recap from media_posts exactly as written, with its stored box-score
   fields, three stars and source. Nothing is added that is not in the post or the official LG
   schedule (used only for the opponent logo/record and the next-game tile). */
(() => {
  'use strict';
  const D = window.WMDesk; if (!D) return;
  const { $, esc, nb, F, ordinal, read, tint, recapSortKey, recapScore, recapParagraphs, recapLede, recapHref, lgGameUrl, recapDate } = D;
  const CGY = 412;
  D.menu();

  const params = new URLSearchParams(location.search);
  const id = params.get('id'), game = Number(params.get('game'));
  const root = $('recapRoot');
  const SELECT = 'id,title,body,source_metrics,published_at';
  const base = { select: SELECT, published: 'eq.true', post_type: 'eq.recap', 'source_metrics->>team': 'eq.Calgary Hitmen' };
  const notFound = msg => { root.innerHTML = '<section class="article band"><div class="article-in"><div><h1 class="sec-title" style="font-size:44px">Recap <em>not found</em></h1><p class="empty">' + esc(msg) + '</p><a class="btn btn-gold btn-sm" href="hitmen-postgame.html#archive">Every Hitmen recap <span class="arr">→</span></a></div></div></section>'; };

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const postP = id && uuid.test(id) ? read('media_posts', Object.assign({ id: 'eq.' + id, limit: '1' }, base))
    : Number.isSafeInteger(game) && game > 0 ? read('media_posts', Object.assign({ 'source_metrics->>lg_game_id': 'eq.' + game, limit: '1' }, base))
      : Promise.resolve([]);
  const allP = read('media_posts', Object.assign({ order: 'published_at.desc', limit: '80' }, base, { select: 'id,title,body,source_metrics,published_at' }));
  const teamsP = read('lgchl_teams', { select: 'lg_team_id,name,abbr,division,logo_path', season: 'eq.55' });
  const standP = read('lgchl_standings_current', { select: 'lg_team_id,name,league,conference,gp,w,l,otl,pts,conference_rank' });
  const gamesP = read('lgchl_games', { select: 'lg_game_id,game_at,status,home_lg_team_id,away_lg_team_id,home_score,away_score', season: 'eq.55', or: '(home_lg_team_id.eq.' + CGY + ',away_lg_team_id.eq.' + CGY + ')', order: 'game_at.asc', limit: '200' });
  [allP, teamsP, standP, gamesP].forEach(p => p.catch(() => {}));

  const half = s => { const x = String(s || '').split(/\s+(?:vs|-|–)\s+/); return x.length === 2 ? x : [String(s || ''), '']; };
  const findTeam = (teams, name) => teams.find(t => t.name.toLowerCase() === String(name || '').toLowerCase());

  async function render() {
    let post;
    try { post = (await postP)[0]; } catch { notFound('The recap could not load right now. Refresh to try again.'); return; }
    if (!post) { notFound('This recap is not published or the link is incomplete.'); return; }
    let teams = [], stand = [], games = [], all = [];
    try { teams = await teamsP; } catch {}
    try { stand = await standP; } catch {}
    try { games = await gamesP; } catch {}
    try { all = await allP; } catch {}

    const m = post.source_metrics || {}, r = recapScore(m), opp = findTeam(teams, m.opponent), oppS = opp && stand.find(s => s.lg_team_id === opp.lg_team_id);
    const lg = Number(m.lg_game_id), g = Number.isSafeInteger(lg) && lg > 0 ? games.find(x => x.lg_game_id === lg) : null;
    const cgyHome = g ? g.home_lg_team_id === CGY : null;
    const { paras, source } = recapParagraphs(post.body);
    document.title = post.title + ' | Hitmen Postgame Desk';
    const ks = m.key_stats || {};
    const strip = [['Shots', ks.shots, false], ['Faceoffs', ks.faceoffs, false], ['Power play', ks.power_play, true], ['Attack time', ks.zone_time, true], ['Passing', ks.passing, true]]
      .filter(x => x[1]).slice(0, 5)
      .map((x, i) => '<div class="stat"><small>' + x[0] + '</small><b' + (i === 4 ? ' class="gold"' : '') + '>' + esc(x[2] ? half(x[1])[0] : String(x[1]).replace('-', '–')) + '</b></div>').join('');
    const upcoming = games.filter(x => x.status !== 'final' && Date.parse(x.game_at) > Date.now())[0];
    let next = '';
    if (upcoming) {
      const oid = upcoming.home_lg_team_id === CGY ? upcoming.away_lg_team_id : upcoming.home_lg_team_id, ot = teams.find(t => t.lg_team_id === oid), olg = ot ? D.logo(ot.logo_path) : '';
      next = '<a class="next card tinted" href="hitmen-media.html#tonight"' + (olg ? ' data-logo="' + olg + '"' : '') + '>' + (olg ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + olg + '\')"></span><span class="next-logo" aria-hidden="true"><img src="' + olg + '" width="52" height="52" alt=""></span>' : '') +
        '<span class="next-play" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 10 10"><path d="M1 1l4 4-4 4M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></span><span class="next-txt"><small>Next game</small><b>' + (upcoming.home_lg_team_id === CGY ? 'vs ' : 'at ') + esc(ot?.name || 'Opponent pending') + '</b><span>' + esc(F.day.format(new Date(upcoming.game_at)) + ' · ' + F.time.format(new Date(upcoming.game_at)) + ' ET') + '</span></span></a>';
    }
    const oppLogo = opp ? D.logo(opp.logo_path).replace('/48/', '/') .replace('.webp', '.png') : '';
    const result = r.win ? 'Final' + (r.extra ? ' · ' + (r.extra === 'OT' ? 'Overtime' : 'Shootout') : '') : r.res === 'OTL' ? 'Final · Overtime' : 'Final';
    const body = paras.map(p => p.startsWith('## ') ? '<h2>' + esc(p.slice(3)) + '</h2>' : '<p>' + esc(p) + '</p>').join('').replace('<p>', '<p class="first">');
    const stars = (m.three_stars || []).slice(0, 3).map((s, i) => '<div class="star-row"><i>' + (i + 1) + '</i><div><b>' + esc(s.player) + '</b><span>' + esc(s.line) + '</span></div><em>' + esc(s.team || '') + '</em></div>').join('');
    const boxRows = [['Shots', ks.shots], ['Faceoffs', ks.faceoffs], ['Power play', ks.power_play], ['Time on attack', ks.zone_time], ['Passing', ks.passing], ['Takeaways / giveaways', ks.takeaways_giveaways]].filter(x => x[1]);
    const sameNight = all.filter(p => p.id !== post.id && p.source_metrics?.game_date && p.source_metrics.game_date === m.game_date).sort((a, b) => recapSortKey(a) - recapSortKey(b));
    const nightRows = sameNight.map(p => {
      const pm = p.source_metrics || {}, pr = recapScore(pm), t = findTeam(teams, pm.opponent), tl = t ? D.logo(t.logo_path) : '';
      return '<a class="wg card tinted" href="' + recapHref(p) + '"' + (tl ? ' data-logo="' + tl + '"' : '') + '>' + (tl ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + tl + '\')"></span><img src="' + tl + '" alt="">' : '<span></span>') +
        '<span><b>' + esc(pm.opponent || 'Opponent') + '</b><small>' + (pm.game_no ? 'Game ' + esc(pm.game_no) : '') + '</small></span><span class="r ' + (pr.win ? 'up' : 'dn') + '">' + esc(pr.text) + '<small>' + esc(pr.res === 'W' ? 'W' + (pr.extra ? ' ' + pr.extra : '') : pr.res === 'OTL' ? 'L ' + (pr.extra || 'OT') : 'L') + '</small></span></a>';
    }).join('');
    const srcText = source || (m.source_label ? m.source_label + '.' : 'Published by the Hitmen Media desk.');

    root.innerHTML =
      '<section class="hit rh" aria-label="Final score"><div class="band"><div class="hit-in">' +
        '<div class="side-team"><img src="assets/lgchl/s55/team412.png" width="150" height="150" alt="Calgary Hitmen crest"><b>Hitmen</b><small>' + esc((m.record ? m.record + ' after this game' : 'Calgary') + (cgyHome == null ? '' : cgyHome ? ' · Home' : ' · Away')) + '</small></div>' +
        '<div class="board"><p class="eyebrow">' + esc(result) + '</p><p class="score-line" aria-label="Calgary ' + esc(r.cs) + ', ' + esc(m.opponent || 'opponent') + ' ' + esc(r.os) + '"><span>' + esc(r.cs) + '</span><span class="dash">–</span><span>' + esc(r.os) + '</span></p><p class="season">' + (m.game_no ? 'Game <span class="num">' + esc(m.game_no) + '</span> · ' : '') + 'Season <span class="num">' + esc(m.season || 55) + '</span></p></div>' +
        '<div class="side-team opp">' + (opp ? '<img src="' + oppLogo + '" width="150" height="150" alt="' + esc(opp.name) + ' logo" onerror="this.onerror=null;this.src=\'' + D.logo(opp.logo_path) + '\'">' : '') + '<b>' + esc(m.opponent || 'Opponent') + '</b><small>' + esc(oppS ? oppS.w + '-' + oppS.l + '-' + oppS.otl + ' this season' : (m.opponent || '')) + '</small></div>' +
      '</div></div>' + (strip || next ? '<div class="hit-strip band">' + strip + next + '</div>' : '') +
      '<p class="stamp band num">' + (strip ? 'Calgary first · ' : '') + esc(m.source_label || 'Published recap') + (Number.isSafeInteger(lg) && lg > 0 ? ' · Game ' + lg : '') + '</p></section>' +
      '<section class="article band" aria-label="Recap"><div class="article-in"><article>' +
        '<div class="story-head"><span class="sec-rule" aria-hidden="true"></span><p class="eyebrow opp-eye">Calgary Hitmen · Game recap</p><h1 class="sec-title rh-title">' + esc(nb(post.title)) + '</h1>' +
        (m.dek ? '<p class="dek">' + esc(m.dek) + '</p>' : '') +
        '<div class="meta"><span>' + esc(recapDate(m)) + '</span><span>Hitmen Media desk</span><span>Published ' + esc(F.md.format(new Date(post.published_at))) + '</span>' + (/LeagueGaming/i.test(m.source_label || source) ? '<span class="verified">Verified LG box score</span>' : '') + '</div></div>' +
        '<div class="body-copy">' + body + '</div>' +
        '<div class="source card"><span class="eyebrow opp-eye" style="font-size:15px">Source</span><p class="src-line">' + esc(srcText) + '</p>' + (Number.isSafeInteger(lg) && lg > 0 ? '<a class="btn btn-line btn-sm" href="' + lgGameUrl(lg) + '" target="_blank" rel="noopener noreferrer" style="justify-self:start"><span class="btxt">Official LG box score</span> <span class="arr">↗</span></a>' : '') + '</div>' +
      '</article><aside class="aside" aria-label="Game details">' +
        (stars ? '<div class="leaders card" id="recapStars"><div class="leaders-head"><span>Three stars</span><small>As published</small></div>' + stars + '</div>' : '') +
        (boxRows.length ? '<div class="leaders card aside-card"><div class="leaders-head"><span>Box score</span><small>CGY – ' + esc(opp?.abbr || 'OPP') + '</small></div><div class="boxscore"><table><thead><tr><th>Stat</th><th>CGY – ' + esc(opp?.abbr || 'OPP') + '</th></tr></thead><tbody>' + boxRows.map(x => '<tr><td>' + x[0] + '</td><td>' + esc(x[1]) + '</td></tr>').join('') + '</tbody></table></div></div>' : '') +
        (nightRows ? '<div class="wrap-games"><p class="eyebrow opp-eye" style="font-size:15px">Same night · ' + esc(recapDate(m)) + '</p>' + nightRows + '</div>' : '') +
        '<div class="leaders card"><div class="leaders-head"><span>Game film</span><small>Hitmen staff only</small></div><p class="film"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="7" width="10" height="7"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>Film for Calgary games is reviewed privately in the Hitmen Film Room.</p></div>' +
      '</aside></div></section>';
    tint(root);

    // More stories: the next recaps that are not this one.
    const more = all.filter(p => p.id !== post.id).sort((a, b) => recapSortKey(b) - recapSortKey(a));
    if (more.length) {
      const f = more[0], fm = f.source_metrics || {}, fr = recapScore(fm), lede = recapLede(f);
      $('moreFeature').innerHTML = '<a class="feature card" href="' + recapHref(f) + '"><div class="jersey" aria-hidden="true"><span class="res">' + esc(fr.win ? 'Hitmen win' + (fr.extra ? ' · ' + fr.extra : '') : fr.res === 'OTL' ? 'Overtime loss' : 'Hitmen loss') + '</span><span class="no">' + esc(fr.text) + '</span><span class="name">vs ' + esc(fm.opponent || 'Opponent') + '</span></div><div class="feat-body"><span class="tag">Game recap</span><h3>' + esc(nb(f.title)) + '</h3><p>' + esc(lede.length > 220 ? lede.slice(0, 218) + '…' : lede) + '</p><div class="meta"><span>' + esc(recapDate(fm)) + '</span>' + (fm.game_no ? '<span>Game ' + esc(fm.game_no) + '</span>' : '') + '</div></div></a>';
      $('moreSide').innerHTML = more.slice(1, 4).map(q => {
        const qm = q.source_metrics || {}, qr = recapScore(qm), t = findTeam(teams, qm.opponent), tl = t ? D.logo(t.logo_path) : '';
        return '<a class="mini card tinted" href="' + recapHref(q) + '"' + (tl ? ' data-logo="' + tl + '"' : '') + '>' + (tl ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + tl + '\')"></span>' : '') + '<div class="mini-score' + (qr.win ? '' : ' loss') + '"><b>' + esc(qr.text) + '</b><small>' + esc((qr.res === 'W' ? 'W' : qr.res === 'OTL' ? 'L OT' : 'L') + ' · ' + String(qm.opponent || '').split(' ').slice(-1)[0].toUpperCase()) + '</small></div><div><h4>' + esc(nb(q.title)) + '</h4><div class="meta"><span>' + esc(recapDate(qm)) + '</span>' + (qm.game_no ? '<span>Game ' + esc(qm.game_no) + '</span>' : '') + '</div></div></a>';
      }).join('');
      $('moreStories').hidden = false; tint($('moreSide'));
    }
  }
  render();
})();
