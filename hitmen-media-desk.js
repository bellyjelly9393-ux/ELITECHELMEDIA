/* Hitmen Media desk (hitmen-media.html).
   Reads only public data: lgchl_games (official LG schedule + finals), lgchl_standings_current
   (official LG standings import), lgchl_teams, lg_player_season_stats (imported LG regular-season
   stats) and published media_posts. Opponent write-ups are assembled only from those numbers;
   nothing is estimated or invented. Keeps #recaps, #hmRecapList and #game-<lg_game_id> anchors. */
(() => {
  'use strict';
  const D = window.WMDesk; if (!D) return;
  const { $, esc, nb, F, etDate, ordinal, logo, read, tint, recapSortKey, recapScore, recapLede, recapHref, lgGameUrl, recapDate } = D;
  const CGY = 412;
  D.menu();

  const teamsP = read('lgchl_teams', { select: 'lg_team_id,name,abbr,division,logo_path', season: 'eq.55' });
  const standP = read('lgchl_standings_current', { select: 'lg_team_id,name,abbr,league,conference,division,logo_path,gp,w,l,otl,pts,gf,ga,gd,streak,last10,home,away,conference_rank,standings_at' });
  const gamesP = read('lgchl_games', { select: 'lg_game_id,week,game_at,status,home_lg_team_id,away_lg_team_id,home_score,away_score', season: 'eq.55', or: '(home_lg_team_id.eq.' + CGY + ',away_lg_team_id.eq.' + CGY + ')', order: 'game_at.asc', limit: '200' });
  const recapsP = read('media_posts', { select: 'id,title,body,source_metrics,published_at', published: 'eq.true', post_type: 'eq.recap', 'source_metrics->>team': 'eq.Calgary Hitmen', order: 'published_at.desc', limit: '80' });
  const roomP = read('media_posts', { select: 'id,title,body,source_metrics,published_at', published: 'eq.true', post_type: 'eq.announcement', 'source_metrics->>team': 'eq.Calgary Hitmen', order: 'published_at.desc', limit: '30' });
  [teamsP, standP, gamesP, recapsP, roomP].forEach(p => p.catch(() => {}));

  const rec = s => s ? s.w + '-' + s.l + '-' + s.otl : '—';
  const isFinal = g => g.status === 'final' && g.home_score != null && g.away_score != null;
  const isHome = g => g.home_lg_team_id === CGY;
  const oppId = g => isHome(g) ? g.away_lg_team_id : g.home_lg_team_id;
  const cgyGoals = g => isHome(g) ? [g.home_score, g.away_score] : [g.away_score, g.home_score];
  const when = v => F.day.format(new Date(v)) + ' · ' + F.time.format(new Date(v)) + ' ET';
  const teamTile = t => t?.logo_path ? logo(t.logo_path) : '';
  const shortName = name => String(name || '').split(' ').slice(-1)[0];

  function streakPhrase(s) {
    const m = String(s || '').match(/^-?(\d+)\s*([WL])$/i); if (!m) return '';
    const n = Number(m[1]), w = m[2].toUpperCase() === 'W';
    if (n >= 2) return w ? ', and have won ' + n + ' straight' : ', and have lost ' + n + ' straight';
    return w ? ', and won their most recent game' : ', and lost their most recent game';
  }

  function writeup(o, home, series) {
    const out = [];
    const where = o.league && o.conference ? ' in the ' + o.league + ' ' + o.conference + ' Conference' : '';
    const goals = o.gd > 0 ? 'have outscored opponents ' + o.gf + '–' + o.ga : o.gd < 0 ? 'have been outscored ' + o.ga + '–' + o.gf : 'have scored and allowed ' + o.gf + ' goals';
    out.push('The ' + o.name + ' are ' + ordinal(o.conference_rank) + where + ' at ' + rec(o) + ' and ' + goals + '.');
    out.push(home ? 'They are ' + o.away + ' on the road.' : 'They are ' + o.home + ' at home, where this game is played.');
    if (o.last10) out.push('They are ' + o.last10 + ' in their last 10' + streakPhrase(o.streak) + '.');
    if (!series.length) out.push('This is Calgary’s first meeting with them this season.');
    else {
      const w = series.filter(x => x.win).length, l = series.length - w;
      out.push('Calgary is ' + w + '-' + l + ' against them this season: ' + series.map(x => (x.win ? 'W ' : 'L ') + x.cs + '–' + x.os + ' on ' + x.date).join(', ') + '.');
    }
    return out.join(' ');
  }

  /* ---------- tonight: countdown + opponent write-ups ---------- */
  let cdTarget = null;
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    if (!cdTarget) return;
    const t = Math.max(0, Math.floor((Date.parse(cdTarget.game_at) - Date.now()) / 1000));
    if (t <= 0) { tonight.refresh(); return; }
    $('cdD').textContent = pad(Math.floor(t / 86400)); $('cdH').textContent = pad(Math.floor(t % 86400 / 3600));
    $('cdM').textContent = pad(Math.floor(t % 3600 / 60)); $('cdS').textContent = pad(t % 60);
  }
  setInterval(tick, 1000);

  const tonight = { games: [], teams: new Map(), stand: new Map(), all: [], refresh() {} };

  async function renderTonight() {
    let games, teams, stand;
    try { [games, teams, stand] = await Promise.all([gamesP, teamsP, standP]); }
    catch { $('tnSub').textContent = 'The schedule could not load right now. Refresh to try again.'; $('owGrid').innerHTML = '<p class="empty">Tonight’s opponents could not load.</p>'; $('cdLabel').textContent = 'schedule unavailable'; return; }
    const T = new Map(teams.map(t => [t.lg_team_id, t])), S = new Map(stand.map(s => [s.lg_team_id, s]));
    Object.assign(tonight, { teams: T, stand: S, all: games });
    const now = Date.now();
    const upcoming = games.filter(g => !isFinal(g) && Date.parse(g.game_at) > now - 4 * 3600e3);
    if (!upcoming.length) {
      $('tnSub').textContent = 'No upcoming Calgary games in the imported LG schedule.'; $('owGrid').innerHTML = '<p class="empty">The next game night appears here once LG posts the schedule.</p>';
      $('cdLabel').textContent = 'no game scheduled'; return;
    }
    const day = etDate(upcoming[0].game_at), isToday = day === etDate(now);
    const night = games.filter(g => etDate(g.game_at) === day);
    tonight.games = night;
    $('tnTitleA').textContent = isToday ? 'Tonight’s' : 'Next';
    $('tonightTitle').lastElementChild.textContent = isToday ? 'games' : 'game night';
    $('tnEyebrow').textContent = 'Game night · ' + F.longDay.format(new Date(night[0].game_at)) + (night[0].week ? ' · Week ' + night[0].week : '');
    $('tnSub').textContent = night.length + ' game' + (night.length === 1 ? '' : 's') + ' · times Eastern · official LG schedule';

    const finals = games.filter(isFinal);
    $('owGrid').innerHTML = night.map((g, i) => {
      const id = oppId(g), o = S.get(id), t = T.get(id) || o, home = isHome(g);
      const name = t?.name || o?.name || 'Opponent';
      const series = finals.filter(f => oppId(f) === id).map(f => { const [cs, os] = cgyGoals(f); return { cs, os, win: cs > os, date: F.md.format(new Date(f.game_at)) }; });
      const w = series.filter(x => x.win).length, l = series.length - w;
      let corner;
      if (isFinal(g)) { const [cs, os] = cgyGoals(g); corner = '<span class="ow-h2h' + (cs > os ? '' : ' dn') + '"><b>' + (cs > os ? 'W ' : 'L ') + cs + '–' + os + '</b><small>Final</small></span>'; }
      else corner = '<span class="ow-h2h' + (l > w ? ' dn' : '') + '"><b>' + w + '-' + l + '</b><small>Calgary H2H</small></span>';
      const stats = o ? '<dl class="ow-stats"><div><dt>Record</dt><dd>' + esc(rec(o)) + '</dd></div><div><dt>' + esc((o.league || '') + ' ' + (o.conference || '').replace('ern', '')) + '</dt><dd>' + esc(ordinal(o.conference_rank)) + '</dd></div><div><dt>Last 10</dt><dd>' + esc(o.last10 || '—') + '</dd></div><div><dt>' + (home ? 'On road' : 'At home') + '</dt><dd>' + esc((home ? o.away : o.home) || '—') + '</dd></div><div><dt>GF / GA</dt><dd>' + esc(o.gf + ' / ' + o.ga) + '</dd></div></dl>' : '';
      const copy = o ? '<p>' + esc(writeup(o, home, series)) + '</p>' : '<p>Standings for this opponent have not been imported yet.</p>';
      const lg = teamTile(t);
      return '<article class="ow card tinted" id="ow-' + Number(g.lg_game_id) + '"' + (lg ? ' data-logo="' + lg + '"' : '') + ' data-team="' + id + '">' +
        (lg ? '<span class="wm wm-lg" aria-hidden="true" style="--logo:url(\'' + lg + '\')"></span>' : '') +
        '<header class="ow-top">' + (lg ? '<img src="' + lg + '" width="56" height="56" alt="' + esc(name) + ' logo">' : '<span></span>') +
        '<div><span class="ow-time">Game ' + (i + 1) + ' · ' + esc(F.time.format(new Date(g.game_at))) + ' ET · ' + (home ? 'Home' : 'Away') + '</span><h3>' + (home ? 'vs ' : 'at ') + esc(name) + '</h3></div>' + corner + '</header>' +
        stats + copy + '<p class="ow-lead" data-leaders="' + id + '"><span>Leading scorers</span>Loading imported LG stats…</p>' +
        '<a class="ow-link" href="' + lgGameUrl(g.lg_game_id) + '" target="_blank" rel="noopener noreferrer">Official LG game page ↗</a></article>';
    }).join('');
    tint($('owGrid'));
    leaders(night.map(oppId));

    tonight.refresh = () => {
      const next = night.find(g => !isFinal(g) && Date.parse(g.game_at) > Date.now());
      document.querySelectorAll('.ow').forEach(c => c.classList.toggle('is-now', !!next && c.id === 'ow-' + next.lg_game_id));
      cdTarget = next || null;
      if (next) {
        const o = T.get(oppId(next));
        $('cdLabel').textContent = (isHome(next) ? 'vs ' : 'at ') + (o?.name || 'opponent') + ' · ' + F.time.format(new Date(next.game_at)) + ' ET';
        $('cdLg').href = lgGameUrl(next.lg_game_id);
        $('cdSr').textContent = 'Next puck drop ' + when(next.game_at);
        tick();
      } else {
        ['cdD', 'cdH', 'cdM', 'cdS'].forEach(k => { $(k).textContent = '00'; });
        $('cdLabel').textContent = night.every(isFinal) ? 'all games final' : 'games in progress · finals post after each game';
        $('cdLg').href = lgGameUrl(night[night.length - 1].lg_game_id);
      }
    };
    tonight.refresh();
  }

  async function leaders(ids) {
    const uniq = [...new Set(ids)].filter(Boolean);
    const fill = (id, html) => document.querySelectorAll('[data-leaders="' + id + '"]').forEach(el => { el.innerHTML = '<span>Leading scorers</span>' + html; });
    try {
      const rows = await read('lg_player_season_stats', { select: 'lg_team_id,gamertag,games_played,goals:stats->>goals,assists:stats->>assists,points:stats->>points', league_code: 'eq.LGCHL', season: 'eq.55', season_type: 'eq.regular', player_kind: 'eq.skater', lg_team_id: 'in.(' + uniq.join(',') + ')', limit: '200' });
      uniq.forEach(id => {
        const top = rows.filter(r => r.lg_team_id === id).map(r => ({ ...r, p: Number(r.points) || 0, g: Number(r.goals) || 0, a: Number(r.assists) || 0 }))
          .sort((a, b) => b.p - a.p || b.g - a.g).slice(0, 2).filter(r => r.p > 0);
        fill(id, top.length ? top.map(r => esc(r.gamertag) + ' · ' + r.p + ' PTS (' + r.g + ' G, ' + r.a + ' A)').join(' · ') : 'Player stats not yet imported for this team.');
      });
    } catch { uniq.forEach(id => fill(id, 'Player stats unavailable right now.')); }
  }

  /* ---------- season strip, next tile, coming up, race ---------- */
  async function renderSeason() {
    let games, teams, stand;
    try { [games, teams, stand] = await Promise.all([gamesP, teamsP, standP]); }
    catch { $('stStamp').textContent = 'Standings unavailable right now. Try reloading.'; $('raceRows').innerHTML = '<p class="empty" style="padding:12px 14px">Standings unavailable right now.</p>'; return; }
    const T = new Map(teams.map(t => [t.lg_team_id, t])), me = stand.find(s => s.lg_team_id === CGY);
    if (me) {
      $('stRecord').innerHTML = me.w + '<em>-</em>' + me.l + '<em>-</em>' + me.otl;
      $('stPts').textContent = me.pts; $('stGF').textContent = me.gf; $('stGA').textContent = me.ga;
      $('stRankLbl').textContent = ((me.league || '') + ' ' + (me.conference || '')).trim() || 'Conference';
      $('stRank').textContent = ordinal(me.conference_rank);
      $('stStamp').textContent = 'Official LG standings import · ' + when(me.standings_at) + ' · ' + me.gp + ' GP';
    } else $('stStamp').textContent = 'No Season 55 standings import available yet.';

    const now = Date.now(), upcoming = games.filter(g => !isFinal(g) && Date.parse(g.game_at) > now);
    const next = upcoming[0];
    if (next) {
      const o = T.get(oppId(next)), lg = teamTile(o);
      $('nextName').textContent = (isHome(next) ? 'vs ' : 'at ') + (o?.name || 'Opponent pending');
      $('nextWhen').textContent = when(next.game_at);
      if (lg) { $('nextBadge').innerHTML = '<img src="' + lg + '" width="52" height="52" alt="">'; $('nextWm').style.setProperty('--logo', "url('" + lg + "')"); $('nextTile').dataset.logo = lg; tint($('nextTile').parentNode); }
      $('nextTile').hidden = false;
    }

    // Coming up: the next six games after the featured game night.
    const nightDay = (games.find(g => !isFinal(g) && Date.parse(g.game_at) > now - 4 * 3600e3) || {}).game_at;
    const after = nightDay ? upcoming.filter(g => etDate(g.game_at) !== etDate(nightDay)).slice(0, 6) : [];
    if (after.length) {
      const S = new Map(stand.map(s => [s.lg_team_id, s]));
      $('cuSub').textContent = 'Next ' + after.length + ' games after game night · times Eastern';
      $('cuGrid').innerHTML = after.map(g => {
        const id = oppId(g), t = T.get(id), s = S.get(id), lg = teamTile(t), league = String(t?.division || '').split(' ')[0];
        return '<article class="team card"' + (lg ? ' data-logo="' + lg + '"' : '') + '>' + (lg ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + lg + '\')"></span><img class="logo" src="' + lg + '" width="52" height="52" loading="lazy" alt="' + esc(t.name) + ' logo">' : '<span></span>') +
          '<div class="team-name"><b>' + (isHome(g) ? 'vs ' : 'at ') + esc(t?.name || 'Opponent pending') + '</b><small>' + esc(league ? league + ' · ' : '') + esc(when(g.game_at)) + '</small></div><div class="team-rec"><b>' + esc(s ? rec(s) : '—') + '</b><small>Season</small></div></article>';
      }).join('');
      $('comingUp').hidden = false; tint($('cuGrid'));
    }

    // The race: Calgary's conference from the standings import.
    if (me) {
      const conf = stand.filter(s => s.league === me.league && s.conference === me.conference).sort((a, b) => a.conference_rank - b.conference_rank);
      const top = conf.slice(0, 6); if (!top.includes(me)) top.push(me);
      const lead = Math.max(1, ...conf.map(s => s.pts));
      $('raceHead').textContent = me.league + ' ' + me.conference;
      $('raceRows').innerHTML = top.map(s => '<div class="lrow' + (s === me ? ' me' : '') + '" style="--pw:' + Math.round(100 * s.pts / lead) + '%"><i>' + s.conference_rank + '</i>' + (s.logo_path ? '<img class="rl" src="' + logo(s.logo_path) + '" alt="">' : '<span></span>') + '<b>' + esc(s.name) + '</b><em>' + esc(rec(s)) + '</em><strong>' + s.pts + '</strong></div>').join('');
      const above = conf.find(s => s.conference_rank === me.conference_rank - 1);
      $('raceCopy').textContent = 'Calgary sits ' + ordinal(me.conference_rank) + ' in the ' + me.league + ' ' + me.conference + ' Conference with ' + me.pts + ' points' +
        (above ? ', ' + (above.pts - me.pts) + ' point' + (above.pts - me.pts === 1 ? '' : 's') + ' behind the ' + above.name + ' for ' + ordinal(above.conference_rank) + '.' : ', first in the conference.');
    }
  }

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

  renderTonight(); renderSeason(); renderStories(); renderNightWrap();
})();
