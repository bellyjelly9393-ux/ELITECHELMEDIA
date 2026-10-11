(() => {
  'use strict';
  const API = 'https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const CGY = 412;
  const $ = id => document.getElementById(id);
  const nb = v => String(v ?? '').replace(/(\d)[-–](\d)/g, '$1\u2011$2');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short', month: 'short', day: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' });
  const fmtShort = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', year: 'numeric' });
  const when = v => { const d = new Date(v); return Number.isNaN(+d) ? 'Date pending' : fmtDay.format(d) + ' · ' + fmtTime.format(d) + ' ET'; };

  async function read(table, params) {
    const r = await fetch(API + table + '?' + new URLSearchParams(params), {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
      signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
    });
    if (!r.ok) throw new Error(table + ' unavailable');
    return r.json();
  }

  /* ---------- menu ---------- */
  const nav = $('nav'), mb = $('menuBtn');
  const closeMenu = () => { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-label', 'Open menu'); };
  mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', String(o)); mb.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); mb.focus(); } });
  document.addEventListener('click', e => { if (!e.target.closest('.top')) closeMenu(); });

  /* ---------- channel rail ---------- */
  const rail = $('rail');
  $('railNext').addEventListener('click', () => {
    const max = rail.scrollWidth - rail.clientWidth;
    rail.scrollBy({ left: rail.scrollLeft >= max - 4 ? -max : 220, behavior: 'smooth' });
  });

  async function broadcasts() {
    try {
      const sources = await read('tournament_automation_sources', { select: 'url,display_label,provider,metadata,slot_order', active: 'eq.true', public_visible: 'eq.true', order: 'slot_order.asc', limit: '12' });
      const valid = sources.filter(s => { try { const u = new URL(s.url); return u.protocol === 'https:' && ['twitch.tv', 'www.twitch.tv', 'youtube.com', 'www.youtube.com', 'youtu.be'].includes(u.hostname); } catch { return false; } });
      if (!valid.length) { $('broadcast-status').textContent = 'No public channels assigned yet · Multiview is open'; return; }
      $('broadcast-status').textContent = 'Live across LGCHL, tournaments and more · ' + valid.length + ' channel' + (valid.length === 1 ? '' : 's') + ' configured';
      rail.innerHTML = valid.map(s => '<a class="stream" href="game-center.html?channel=' + encodeURIComponent(s.metadata?.channel_key || 'hitmen') + '"><div class="stream-pic"><span class="stream-tag">' + esc(String(s.provider || 'Watch').toUpperCase()) + '</span></div><div class="stream-cap"><b>' + esc(s.display_label || 'Network broadcast') + '</b><span>Channel ready · open to watch</span></div></a>').join('') +
        '<a class="stream" href="multiview.html"><div class="stream-pic"><span class="stream-tag">MULTI</span></div><div class="stream-cap"><b>Build your multiview</b><span>Twitch + YouTube</span></div></a>';
    } catch { $('broadcast-status').textContent = 'Channel feed unavailable · Multiview remains available'; }
  }

  /* ---------- season, next game, opponents, power index ---------- */
  const powerScore = s => { const gp = Math.max(1, Number(s.gp || 1)); return 100 * (.70 * Math.min(1, s.pts / (2 * gp)) + .20 * Math.max(0, Math.min(1, ((s.gf - s.ga) / gp + 3) / 6)) + .10 * Math.max(0, Math.min(1, (s.gf / gp) / 6))); };
  const leagueOf = t => { const d = String(t?.division || ''); return d.startsWith('QMJHL') ? 'QMJHL' : d.startsWith('OHL') ? 'OHL' : d.startsWith('WHL') ? 'WHL' : 'LGCHL'; };
  const logoImg = (t, cls) => t?.logo_path ? '<img class="' + cls + '" src="' + esc(t.logo_path.replace(/^\//, '')) + '" width="52" height="52" loading="lazy" alt="' + esc(t.name) + ' logo">' : '';

  const logoUrl = t => t?.logo_path ? esc(t.logo_path.replace(/^\//, '')) : '';
  const wm = t => t?.logo_path ? '<span class="wm" aria-hidden="true" style="--logo:url(\'' + logoUrl(t) + '\')"></span>' : '';
  const teamsP = read('lgchl_teams', { select: 'lg_team_id,name,abbr,division,logo_path', season: 'eq.55' });
  teamsP.catch(() => {});

  // pull each club's dominant colour out of its logo so its card glows in team colours
  const colorCache = new Map();
  function teamColor(src) {
    if (colorCache.has(src)) return colorCache.get(src);
    const p = new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 24;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 24, 24);
          const d = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
            if (A < 200 || mx < 50 || mx - mn < 45) continue; // skip transparent, dark and grey pixels
            r += R; g += G; b += B; n++;
          }
          res(n > 8 ? Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) : null);
        } catch { res(null); }
      };
      img.onerror = () => res(null);
      img.src = src;
    });
    colorCache.set(src, p); return p;
  }
  function tintCards(root) {
    root.querySelectorAll('[data-logo]').forEach(el => teamColor(el.dataset.logo).then(c => { if (c) el.style.setProperty('--tc', c); }));
  }

  let countdownTarget = 0;
  function tick() {
    const cd = $('countdown'); if (!countdownTarget) return;
    const d = countdownTarget - Date.now();
    cd.hidden = false;
    if (d <= 0) { cd.textContent = d > -3 * 3600e3 ? 'Game night · live now' : 'Final pending'; return; }
    const dd = Math.floor(d / 864e5), hh = Math.floor(d % 864e5 / 36e5), mm = Math.floor(d % 36e5 / 6e4);
    cd.textContent = 'Puck drop in ' + (dd ? dd + 'd ' : '') + String(hh).padStart(2, '0') + 'h ' + String(mm).padStart(2, '0') + 'm';
  }
  setInterval(tick, 30000);

  async function season() {
    try {
      const [snap, teams, games] = await Promise.all([
        read('lgchl_standings_snapshots', { select: 'lg_team_id,gp,w,l,otl,pts,gf,ga,taken_at', season: 'eq.55', order: 'taken_at.desc', limit: '1000' }),
        teamsP,
        read('lgchl_games', { select: 'lg_game_id,game_at,status,home_lg_team_id,away_lg_team_id,home_score,away_score', season: 'eq.55', or: '(home_lg_team_id.eq.' + CGY + ',away_lg_team_id.eq.' + CGY + ')', order: 'game_at.asc', limit: '200' })
      ]);
      const byId = new Map(teams.map(t => [t.lg_team_id, t]));
      const latest = new Map(); snap.forEach(s => { if (!latest.has(s.lg_team_id)) latest.set(s.lg_team_id, s); });

      const cal = latest.get(CGY);
      if (cal) {
        $('stRecord').innerHTML = esc(cal.w) + '<em>-</em>' + esc(cal.l) + '<em>-</em>' + esc(cal.otl);
        $('stPts').textContent = cal.pts;
        $('stGF').textContent = cal.gf;
        $('stGA').textContent = cal.ga;
        const diff = cal.gf - cal.ga; $('stDiff').textContent = (diff > 0 ? '+' : '') + diff;
        $('standings-stamp').textContent = 'Official LG standings import · ' + when(cal.taken_at) + ' · ' + cal.gp + ' GP';
      } else $('standings-stamp').textContent = 'No Season 55 standings import available yet.';

      const isFinal = g => g.status === 'final' && g.home_score !== null && g.away_score !== null;
      const oppId = g => g.home_lg_team_id === CGY ? g.away_lg_team_id : g.home_lg_team_id;

      // next game
      const next = games.find(g => !isFinal(g) && Date.parse(g.game_at) >= Date.now() - 3 * 3600e3);
      if (next) {
        const o = byId.get(oppId(next)), home = next.home_lg_team_id === CGY;
        $('nextBadge').innerHTML = logoImg(o, 'nl');
        $('nextName').textContent = (home ? 'vs ' : 'at ') + (o?.name || 'Opponent pending');
        $('nextWhen').textContent = when(next.game_at);
        countdownTarget = Date.parse(next.game_at); tick();
      } else { $('nextName').textContent = 'No upcoming games listed'; }

      // opponents
      const opp = new Map();
      games.forEach(g => {
        const id = oppId(g); if (!opp.has(id)) opp.set(id, { id, team: byId.get(id), gp: 0, w: 0, l: 0, otl: 0, gf: 0, ga: 0, next: null });
        const r = opp.get(id);
        if (isFinal(g)) {
          const home = g.home_lg_team_id === CGY, us = home ? g.home_score : g.away_score, them = home ? g.away_score : g.home_score;
          r.gp++; r.gf += us; r.ga += them;
          if (us > them) r.w++; else r.l++;
        } else if (!r.next && Date.parse(g.game_at) >= Date.now() - 3 * 3600e3) r.next = g;
      });
      renderOpponents([...opp.values()].filter(r => r.team), next ? oppId(next) : null);

      // power index
      const rank = [...latest.values()].filter(s => s.gp >= 5).map(s => ({ ...s, score: powerScore(s) })).sort((a, b) => b.score - a.score || b.pts - a.pts);
      $('power').innerHTML = rank.slice(0, 4).map((s, i) => '<div class="lrow' + (s.lg_team_id === CGY ? ' me' : '') + '" style="--pw:' + Math.max(8, Math.min(100, s.score)).toFixed(1) + '%"><i>' + (i + 1) + '</i>' + (logoImg(byId.get(s.lg_team_id), 'rl') || '<span></span>') + '<b>' + esc(byId.get(s.lg_team_id)?.name || 'Team ' + s.lg_team_id) + '</b><em>' + esc(s.w + '-' + s.l + '-' + s.otl) + '</em><strong>' + s.score.toFixed(1) + '</strong></div>').join('') || '<div class="lrow"><i>—</i><b>No qualifying standings yet</b><em></em><strong></strong></div>';
      $('power-stamp').textContent = 'Wildman model · min 5 GP' + (snap.length ? ' · ' + fmtShort.format(new Date(snap[0].taken_at)) : '');
    } catch {
      $('standings-stamp').textContent = 'Standings unavailable right now — try reloading.';
      $('nextName').textContent = 'Schedule unavailable';
      $('oppSub').textContent = 'Opponent list unavailable right now.';
      $('power').innerHTML = '<div class="lrow"><i>—</i><span></span><b>Power index unavailable</b><em></em><strong></strong></div>';
    }
  }

  let OPP = [], nextOppId = null, lgSel = 'ALL', expanded = false;
  const LIMIT = 12, grid = $('oppGrid'), more = $('oppMore');
  function renderOpponents(list, nid) {
    OPP = list.map(r => ({ ...r, lg: leagueOf(r.team) })).sort((a, b) => (a.next ? Date.parse(a.next.game_at) : 9e15) - (b.next ? Date.parse(b.next.game_at) : 9e15));
    nextOppId = nid;
    $('oppSub').textContent = OPP.length + ' clubs on the Hitmen Season 55 schedule';
    ['ALL', 'WHL', 'OHL', 'QMJHL'].forEach(lg => { const el = document.querySelector('[data-count="' + lg + '"]'); if (el) el.textContent = OPP.filter(t => lg === 'ALL' || t.lg === lg).length; });
    drawOpp();
  }
  function drawOpp() {
    const list = OPP.filter(t => lgSel === 'ALL' || t.lg === lgSel);
    const shown = expanded ? list : list.slice(0, LIMIT);
    grid.innerHTML = shown.map(t => {
      const isNext = t.id === nextOppId;
      const rec = t.gp
        ? '<b class="' + (t.w > t.l + t.otl ? 'up' : t.w < t.l + t.otl ? 'dn' : '') + '">' + t.w + '-' + (t.l + t.otl) + '</b><small>H2H · ' + t.gf + '–' + t.ga + '</small>'
        : '<span class="pill-new">First meeting</span>';
      const nxt = t.next ? (isNext ? '<em>Next · </em>' : '') + esc(when(t.next.game_at)) : 'Season series complete';
      return '<article class="team card' + (isNext ? ' is-next' : '') + '"' + (t.team.logo_path ? ' data-logo="' + logoUrl(t.team) + '"' : '') + '>' + wm(t.team) + (logoImg(t.team, 'logo') || '<span class="logo"></span>') +
        '<div class="team-name"><b>' + esc(t.team.name) + '</b><small>' + esc(t.lg) + ' · ' + nxt + '</small></div><div class="team-rec">' + rec + '</div></article>';
    }).join('');
    tintCards(grid);
    more.hidden = list.length <= LIMIT;
    more.firstChild.textContent = expanded ? 'Show fewer ' : 'Show all ' + list.length + ' ';
  }
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    lgSel = b.dataset.lg; expanded = false;
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    drawOpp();
  }));
  more.addEventListener('click', () => { expanded = !expanded; drawOpp(); });

  /* ---------- stories ---------- */
  async function stories() {
    try {
      const posts = await read('media_posts', { select: 'id,title,body,source_metrics,published_at', published: 'eq.true', post_type: 'eq.recap', 'source_metrics->>team': 'eq.Calgary Hitmen', order: 'published_at.desc', limit: '30' });
      const byName = new Map((await teamsP.catch(() => [])).map(t => [String(t.name).toLowerCase(), t]));
      const sortKey = p => Date.parse(p.source_metrics?.sort_at || p.source_metrics?.ended_utc || p.source_metrics?.game_date || p.published_at);
      posts.sort((a, b) => sortKey(b) - sortKey(a));
      const href = p => { const id = Number(p.source_metrics?.lg_game_id); return 'hitmen-media.html' + (Number.isSafeInteger(id) && id > 0 ? '#game-' + id : '#hmRecapList'); };
      const dateOf = p => { const d = p.source_metrics?.game_date ? new Date(p.source_metrics.game_date + 'T12:00:00Z') : new Date(p.published_at); return Number.isNaN(+d) ? '' : fmtShort.format(d); };
      const mins = p => Math.max(1, Math.round(String(p.body || '').split(/\s+/).length / 220));
      if (!posts.length) { $('featureSlot').innerHTML = '<p class="empty">Published Hitmen stories will appear here after game night.</p>'; return; }

      const p = posts[0], m = p.source_metrics || {};
      const lede = m.dek || (p.body || '').split(/\n\s*\n/).find(x => x.trim() && !x.startsWith('##')) || '';
      const score = m.calgary_score != null && m.opponent_score != null ? m.calgary_score + '–' + m.opponent_score : (m.final || '');
      const star = Array.isArray(m.three_stars) && m.three_stars[0] ? m.three_stars[0] : null;
      const ks = m.key_stats || {};
      const rows = [['Shots', ks.shots], ['Faceoffs', ks.faceoffs], ['Power play', ks.power_play], ['Time on attack', ks.zone_time]].filter(r => r[1]);
      $('featureSlot').innerHTML =
        '<a class="feature card" href="' + href(p) + '"><div class="jersey" aria-hidden="true">' +
        '<span class="res">' + esc(m.result === 'W' ? 'Hitmen win' : m.result === 'L' ? 'Final' : 'Recap') + (/OT/i.test(m.final || '') ? ' · OT' : '') + '</span>' +
        '<span class="no">' + esc(score || 'S55') + '</span>' +
        '<span class="name">' + esc(m.opponent ? 'vs ' + m.opponent : 'LGCHL Season 55') + '</span></div>' +
        '<div class="feat-body"><span class="tag">Game recap</span><h3>' + esc(nb(p.title)) + '</h3><p>' + esc(lede.slice(0, 220)) + (lede.length > 220 ? '…' : '') + '</p>' +
        (rows.length ? '<div class="boxscore"><table><thead><tr><th>Stat</th><th>CGY – OPP</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(String(r[1]).replace(' - ', ' – ')) + '</td></tr>').join('') + '</tbody></table></div>' : '') +
        (star ? '<p class="star">★ ' + esc(star.player) + ' · ' + esc(star.line) + '</p>' : '') +
        '<div class="meta"><span>' + esc(dateOf(p)) + '</span><span>Season 55</span><span>' + mins(p) + ' min read</span></div></div></a>';

      $('sideStories').innerHTML = posts.slice(1, 4).map(q => {
        const n = q.source_metrics || {}, s = n.calgary_score != null && n.opponent_score != null ? n.calgary_score + '–' + n.opponent_score : (n.final || 'S55');
        const opp = String(n.opponent || '').split(' ').slice(-1)[0];
        const ot = byName.get(String(n.opponent || '').toLowerCase());
        return '<a class="mini card" href="' + href(q) + '">' + wm(ot) + '<div class="mini-score' + (n.result === 'L' ? ' loss' : '') + '"><b>' + esc(s) + '</b><small>' + esc((n.result === 'W' ? 'W' : n.result === 'L' ? 'L' : '') + (/OT/i.test(n.final || '') ? ' OT' : '') + (opp ? ' · ' + opp.slice(0, 10).toUpperCase() : '')) + '</small></div>' +
          '<div><h4>' + esc(nb(q.title)) + '</h4><div class="meta"><span>' + esc(dateOf(q)) + '</span><span>' + mins(q) + ' min read</span></div></div></a>';
      }).join('');
    } catch { $('featureSlot').innerHTML = '<p class="empty">Published stories could not load. Visit Hitmen Media for coverage.</p>'; }
  }

  /* ---------- hero sparkle ---------- */
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('canvas[data-scene]').forEach(cv => {
    const ctx = cv.getContext('2d'), scene = cv.dataset.scene, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let parts = [], W = 0, H = 0, visible = true;
    function size() {
      const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = scene === 'arena' ? 70 : 30; parts = [];
      for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + .3, v: Math.random() * .35 + .08, a: Math.random() });
      draw(0);
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        if (!reduce) { p.y -= p.v; p.x += Math.sin(t / 1000 + p.a * 6) * .15; if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; } }
        const al = .35 + .4 * Math.sin(t / 700 + p.a * 10);
        ctx.fillStyle = scene === 'arena' ? 'rgba(255,214,120,' + al.toFixed(2) + ')' : 'rgba(200,220,255,' + (al * .6).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(cv);
    const loop = t => { if (visible) draw(t); requestAnimationFrame(loop); };
    size(); addEventListener('resize', size);
    if (!reduce) requestAnimationFrame(loop);
  });

  season(); stories(); broadcasts();
})();
