/* LG3s broadcast dashboard.
 * Reads the public LG3s Supabase views (games, standings, skater + goalie leaders) and the local
 * team/roster file. Static, framework-free; every panel renders on its own so one failure never
 * blanks the page.
 */
(() => {
  'use strict';
  const root = document.getElementById('lg3Broadcast');
  if (!root) return;

  const BASE = 'https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const TZ = 'America/Toronto';
  const SEASON_START = Date.UTC(2026, 9, 21);

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async q => {
    const r = await fetch(BASE + q, { headers: { apikey: KEY }, cache: 'no-store' });
    if (!r.ok) throw Error(q.split('?')[0] + ' ' + r.status);
    return r.json();
  };
  const slug = n => String(n || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const crest = id => 'assets/lg3s/team' + Number(id) + '.svg';
  const crestImg = (id, cls = '') => '<img class="lg3-crest ' + cls + '" src="' + crest(id) + '" alt="" width="28" height="28" loading="lazy" decoding="async">';
  const profile = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid=' + Number(id) + '&leagueid=154&seasonid=1';
  const safeUrl = u => /^https:\/\/www\.leaguegaming\.com\//.test(String(u || '')) ? String(u) : null;
  const day = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const time = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  const night = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  const nightShort = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).toUpperCase();
  const weekOf = d => Math.floor((Date.parse(d + 'T00:00:00Z') - SEASON_START) / 604800000) + 1;
  const signed = n => (n > 0 ? '+' : '') + n;
  const wait = (id, msg) => { const n = $(id); if (n) n.innerHTML = '<p class="lg3-wait">' + esc(msg) + '</p>'; };
  const guard = (id, msg, fn) => { try { fn(); } catch (e) { console.error('LG3s dashboard:', id, e); wait(id, msg); } };

  /* ---------- data ---------- */
  const nowIso = new Date().toISOString();
  const GAME_COLS = 'lg_game_id,scheduled_at,game_night_date,away_lg_team_id,away_nation,home_lg_team_id,home_nation,';
  const local = fetch('lg3s-season1-data.json?v=20261021-2', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const pRecent = api('lg3s_public_games?select=' + GAME_COLS + 'away_score,home_score,decided_in,source_url&is_verified=eq.true&away_score=not.is.null&home_score=not.is.null&order=scheduled_at.desc,lg_game_id.desc&limit=60');
  const pUpcoming = api('lg3s_public_games?select=' + GAME_COLS + 'source_url&status=eq.scheduled&scheduled_at=gte.' + encodeURIComponent(nowIso) + '&order=scheduled_at.asc,lg_game_id.asc&limit=30');
  const pStandings = api('lg3s_public_official_standings?select=*').then(r => (r.length ? r : api('lg3s_public_standings?select=*')));
  const pSkaters = api('lg3s_public_skater_leaders?select=lg_user_id,gamertag,lg_team_id,nation,gp,g,a,p,plus_minus&order=p.desc,g.desc&limit=120');
  const pGoalies = api('lg3s_public_goalie_leaders?select=lg_user_id,gamertag,nations_played_for,gp,sa,ga,sv,sv_pct,gaa_per_game&limit=60');
  const settle = p => p.then(v => v, e => { console.error('LG3s dashboard data:', e); return null; });

  Promise.all([local, settle(pRecent), settle(pUpcoming), settle(pStandings), settle(pSkaters), settle(pGoalies)])
    .then(([data, recent, upcoming, standings, skaters, goalies]) => {
      const teams = new Map((data && Array.isArray(data.teams) ? data.teams : []).map(t => [t.id, { id: t.id, name: t.name, group: t.group }]));
      const nameOf = (id, fallback) => teams.get(id)?.name || fallback || '';
      const byName = new Map([...teams.values()].map(t => [t.name, t]));
      const positions = new Map((data && Array.isArray(data.players) ? data.players : []).map(p => [String(p.n).toLowerCase(), p.p]));

      recent = Array.isArray(recent) ? recent.filter(g => g.away_score != null && g.home_score != null) : null;
      upcoming = Array.isArray(upcoming) ? upcoming.filter(g => !g.scheduled_at || g.scheduled_at >= nowIso) : null;

      /* League-wide table: points, then goal differential, then goals for. Groups come from the team file. */
      const table = (Array.isArray(standings) ? standings : []).map(s => ({
        id: s.lg_team_id, name: nameOf(s.lg_team_id, s.nation), group: teams.get(s.lg_team_id)?.group || '',
        gp: +s.gp || 0, w: +s.w || 0, l: +s.l || 0, otl: +s.otl || 0, pts: +s.pts || 0,
        gf: +s.gf || 0, ga: +s.ga || 0, gd: +s.gd || 0, streak: s.streak || '', at: s.captured_at || null
      })).filter(t => t.name)
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
        .map((t, i) => ({ ...t, rank: i + 1, rec: t.w + '-' + t.l + '-' + t.otl }));
      const rankOf = new Map(table.map(t => [t.id, t]));

      /* Featured + key matchups: the first upcoming game night, best combined points first. */
      const nextNightDate = upcoming && upcoming.length ? upcoming[0].game_night_date : null;
      const nextNight = nextNightDate ? upcoming.filter(g => g.game_night_date === nextNightDate) : [];
      const strength = g => (rankOf.get(g.away_lg_team_id)?.pts || 0) + (rankOf.get(g.home_lg_team_id)?.pts || 0);
      const gap = g => Math.abs((rankOf.get(g.away_lg_team_id)?.pts || 0) - (rankOf.get(g.home_lg_team_id)?.pts || 0));
      const marquee = nextNight.slice().sort((a, b) => strength(b) - strength(a) || gap(a) - gap(b) || a.scheduled_at.localeCompare(b.scheduled_at));
      const featured = marquee[0] || null;

      const teamLine = id => { const t = rankOf.get(id); return t ? t.rec + ' · ' + t.pts + ' PTS' : ''; };
      const art = name => byName.has(name) ? 'url("assets/lg3s/art/nation-' + slug(name) + '.webp")' : 'none';

      /* ---------- featured matchup ---------- */
      guard('lg3Feature', 'The next featured matchup is unavailable right now.', () => {
        if (!featured) { wait('lg3Feature', 'The next featured matchup will appear once the schedule is posted.'); return; }
        const a = nameOf(featured.away_lg_team_id, featured.away_nation), h = nameOf(featured.home_lg_team_id, featured.home_nation);
        const url = safeUrl(featured.source_url);
        $('lg3FeatureMeta').textContent = 'WEEK ' + weekOf(featured.game_night_date);
        $('lg3Feature').innerHTML =
          '<' + (url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div') + ' class="lg3-fm" style="--a:' + art(a) + ';--h:' + art(h) + '">' +
          '<span class="lg3-fm-bg" aria-hidden="true"><i></i><i></i></span>' +
          '<span class="lg3-fm-row">' +
          '<span class="lg3-fm-team">' + crestImg(featured.away_lg_team_id, 'lg3-crest-xl') + '<b>' + esc(a) + '</b><small>' + esc(teamLine(featured.away_lg_team_id)) + '</small></span>' +
          '<span class="lg3-fm-vs">VS</span>' +
          '<span class="lg3-fm-team">' + crestImg(featured.home_lg_team_id, 'lg3-crest-xl') + '<b>' + esc(h) + '</b><small>' + esc(teamLine(featured.home_lg_team_id)) + '</small></span>' +
          '</span>' +
          '<span class="lg3-fm-when">' + esc(day(featured.scheduled_at).toUpperCase()) + '<i aria-hidden="true">|</i>' + esc(time(featured.scheduled_at)) + ' ET</span>' +
          '<span class="lg3-fm-tag">LG3S INTERNATIONAL SHOWDOWN</span>' +
          (url ? '<span class="lg3-btn">GAME CENTRE <span aria-hidden="true">↗</span></span>' : '') +
          (url ? '</a>' : '</div>');
      });

      /* ---------- latest scores ---------- */
      guard('lg3Scores', 'Scores are unavailable right now.', () => {
        if (!recent) { wait('lg3Scores', 'Scores are unavailable right now.'); return; }
        if (!recent.length) { wait('lg3Scores', 'Final scores appear here after the first game night.'); return; }
        const dates = [...new Set(recent.map(g => g.game_night_date))].sort().reverse().slice(0, 3);
        const draw = d => {
          $('lg3Nights').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.night === d)));
          $('lg3Scores').innerHTML = recent.filter(g => g.game_night_date === d).map(g => {
            const as = +g.away_score, hs = +g.home_score, url = safeUrl(g.source_url);
            const ot = /OT|SO/i.test(String(g.decided_in || '')) ? String(g.decided_in).toUpperCase() : 'FINAL';
            const tag = url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div';
            return '<' + tag + ' class="lg3-score">' +
              '<span class="lg3-st' + (as > hs ? ' win' : '') + '">' + crestImg(g.away_lg_team_id) + '<span>' + esc(nameOf(g.away_lg_team_id, g.away_nation)) + '</span></span>' +
              '<span class="lg3-sc"><b' + (as > hs ? ' class="win"' : '') + '>' + as + '</b><i>–</i><b' + (hs > as ? ' class="win"' : '') + '>' + hs + '</b></span>' +
              '<span class="lg3-st lg3-st-h' + (hs > as ? ' win' : '') + '"><span>' + esc(nameOf(g.home_lg_team_id, g.home_nation)) + '</span>' + crestImg(g.home_lg_team_id) + '</span>' +
              '<span class="lg3-fin">' + ot + '</span>' +
              (url ? '</a>' : '</div>');
          }).join('');
          $('lg3Scores').scrollTop = 0;
        };
        $('lg3Nights').innerHTML = dates.map(d => '<button type="button" data-night="' + esc(d) + '" aria-pressed="false">' + esc(nightShort(d)) + '</button>').join('');
        $('lg3Nights').addEventListener('click', e => { const b = e.target.closest('button[data-night]'); if (b) draw(b.dataset.night); });
        draw(dates[0]);
      });

      /* ---------- upcoming games ---------- */
      guard('lg3Upcoming', 'The schedule is unavailable right now.', () => {
        if (!upcoming) { wait('lg3Upcoming', 'The schedule is unavailable right now.'); return; }
        if (!upcoming.length) { wait('lg3Upcoming', 'The next game night will appear once it is scheduled.'); return; }
        $('lg3Upcoming').innerHTML = upcoming.slice(0, 6).map(g => {
          const url = safeUrl(g.source_url), tag = url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div';
          return '<' + tag + ' class="lg3-game">' +
            '<span class="lg3-st">' + crestImg(g.away_lg_team_id) + '<span>' + esc(nameOf(g.away_lg_team_id, g.away_nation)) + '</span></span>' +
            '<span class="lg3-st">' + crestImg(g.home_lg_team_id) + '<span>' + esc(nameOf(g.home_lg_team_id, g.home_nation)) + '</span></span>' +
            '<span class="lg3-when"><b>' + esc(day(g.scheduled_at)) + '</b><small>' + esc(time(g.scheduled_at)) + ' ET</small></span>' +
            (url ? '</a>' : '</div>');
        }).join('');
      });

      /* ---------- power rankings ---------- */
      guard('lg3Rankings', 'Standings are unavailable right now.', () => {
        if (!table.length) { wait('lg3Rankings', 'Standings are unavailable right now.'); return; }
        const updated = table[0].at ? new Date(table[0].at).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : '';
        $('lg3Rankings').innerHTML = '<table class="lg3-table"><caption class="sr-only">LG3s league-wide power rankings</caption><thead><tr><th scope="col">#</th><th scope="col">NATION</th><th scope="col" class="c">W-L-OTL</th><th scope="col" class="c">PTS</th><th scope="col" class="c">GD</th></tr></thead><tbody>' +
          table.map(t => '<tr><td class="lg3-rk">' + t.rank + '</td><td><button type="button" class="lg3-nat" data-team="' + t.id + '" aria-label="Show ' + esc(t.name) + ' in the nation spotlight">' + crestImg(t.id) + '<span>' + esc(t.name) + '</span>' + (t.group ? '<small>' + esc(t.group) + '</small>' : '') + '</button></td>' +
            '<td class="c num">' + t.rec + '</td><td class="c num lg3-pts">' + t.pts + '</td><td class="c num"><span class="lg3-gd ' + (t.gd > 0 ? 'up' : t.gd < 0 ? 'dn' : 'eq') + '">' + (t.gd > 0 ? '▲' : t.gd < 0 ? '▼' : '•') + ' ' + signed(t.gd) + '</span></td></tr>').join('') +
          '</tbody></table><p class="lg3-foot">Ranked league-wide by points, then goal differential.' + (updated ? ' Updated ' + esc(updated) + '.' : '') + '</p>';
      });

      /* ---------- league leaders ---------- */
      guard('lg3Leaders', 'Leaders are unavailable right now.', () => {
        const sk = Array.isArray(skaters) ? skaters : null, gl = Array.isArray(goalies) ? goalies.filter(g => +g.sa >= 20) : null;
        const SETS = {
          p: [['gp', 'GP'], ['g', 'G'], ['a', 'A'], ['p', 'PTS']], g: [['gp', 'GP'], ['g', 'G'], ['a', 'A'], ['p', 'PTS']],
          a: [['gp', 'GP'], ['g', 'G'], ['a', 'A'], ['p', 'PTS']], plus_minus: [['gp', 'GP'], ['g', 'G'], ['p', 'PTS'], ['plus_minus', '+/-']],
          sv_pct: [['gp', 'GP'], ['sv', 'SV'], ['ga', 'GA'], ['sv_pct', 'SV%']]
        };
        const fmt = (k, v) => k === 'sv_pct' ? (v == null ? '—' : Number(v).toFixed(3).replace(/^0/, '')) : k === 'plus_minus' ? signed(+v || 0) : (v ?? '—');
        const draw = stat => {
          $('lg3LeaderTabs').querySelectorAll('[data-stat]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.stat === stat)));
          const goalie = stat === 'sv_pct', src = goalie ? gl : sk;
          if (!src) { wait('lg3Leaders', 'Leaders are unavailable right now.'); return; }
          const rows = src.slice().sort((x, y) => (Number(y[stat]) || 0) - (Number(x[stat]) || 0) || (goalie ? (+y.sv || 0) - (+x.sv || 0) : (+y.p || 0) - (+x.p || 0)) || String(x.gamertag).localeCompare(String(y.gamertag))).slice(0, 10);
          if (!rows.length) { wait('lg3Leaders', 'Leaders appear after the first game reports.'); return; }
          const cols = SETS[stat];
          $('lg3Leaders').innerHTML = '<table class="lg3-table lg3-lead"><caption class="sr-only">LG3s ' + (goalie ? 'goalie save percentage' : 'skater') + ' leaders</caption><thead><tr><th scope="col">#</th><th scope="col">PLAYER</th><th scope="col" class="c">TEAM</th>' +
            cols.map(([k, l]) => '<th scope="col" class="c' + (k === stat ? ' hl' : '') + '">' + l + '</th>').join('') + '</tr></thead><tbody>' +
            rows.map((p, i) => {
              const nation = goalie ? (p.nations_played_for || [])[0] : p.nation, team = byName.get(nation);
              return '<tr><td class="lg3-rk">' + (i + 1) + '</td><td class="lg3-pl"><a href="' + profile(p.lg_user_id) + '" target="_blank" rel="noopener noreferrer">' + esc(p.gamertag) + '</a></td>' +
                '<td class="c">' + (team ? crestImg(team.id) + '<span class="sr-only">' + esc(nation) + '</span>' : esc(nation || '')) + '</td>' +
                cols.map(([k]) => '<td class="c num' + (k === stat ? ' hl' : '') + '">' + esc(fmt(k, p[k])) + '</td>').join('') + '</tr>';
            }).join('') + '</tbody></table>';
        };
        $('lg3LeaderTabs').addEventListener('click', e => { const b = e.target.closest('[data-stat]'); if (b) draw(b.dataset.stat); });
        draw('p');
      });

      /* ---------- nation spotlight ---------- */
      guard('lg3Spotlight', 'The nation spotlight is unavailable right now.', () => {
        const order = table.length ? table : [...teams.values()].map((t, i) => ({ ...t, rank: i + 1, rec: '', pts: 0, gd: 0, gp: 0, streak: '' }));
        if (!order.length) { wait('lg3Spotlight', 'The nation spotlight is unavailable right now.'); return; }
        /* Pull the existing editorial copy from the Contenders cards so there is one source of truth. */
        const editorial = new Map();
        document.querySelectorAll('#watch .th-feature').forEach(card => {
          const m = (card.querySelector('.th-feature-flag img')?.getAttribute('src') || '').match(/team(\d+)\.svg$/);
          if (!m) return;
          const id = +m[1], t = teams.get(id);
          if (t && !card.id) card.id = 'nation-' + slug(t.name);
          editorial.set(id, { id: card.id, h: card.querySelector('h3')?.textContent.trim() || '', p: card.querySelector('p')?.textContent.trim() || '' });
        });
        const clip = s => { if (s.length <= 210) return s; const cut = s.slice(0, 210), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! ')); return end > 90 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…'; };
        const streak = s => { const m = String(s).match(/(\d+)\s*([WL])/i); return m ? m[2].toUpperCase() + m[1] : '—'; };
        let idx = 0;
        const draw = () => {
          const t = order[idx], ed = editorial.get(t.id);
          const top = (Array.isArray(skaters) ? skaters : []).filter(p => +p.lg_team_id === t.id || p.nation === t.name).sort((x, y) => (+y.p || 0) - (+x.p || 0) || (+y.g || 0) - (+x.g || 0)).slice(0, 4);
          $('lg3SpotCount').textContent = (idx + 1) + '/' + order.length;
          $('lg3Spotlight').style.setProperty('--art', art(t.name));
          $('lg3Spotlight').innerHTML =
            '<div class="lg3-sp-hero">' + crestImg(t.id, 'lg3-crest-xl') + '<div><h3>' + esc(t.name) + '</h3><p>' + (t.pts || t.gp ? '#' + t.rank + ' IN LG3S' : 'LG3S SEASON 1') + (t.group ? ' · GROUP ' + esc(t.group) : '') + '</p></div></div>' +
            (t.gp ? '<dl class="lg3-sp-stats"><div><dt>RECORD</dt><dd>' + t.rec + '</dd></div><div><dt>PTS</dt><dd>' + t.pts + '</dd></div><div><dt>GD</dt><dd>' + signed(t.gd) + '</dd></div><div><dt>STREAK</dt><dd>' + streak(t.streak) + '</dd></div></dl>' : '') +
            '<p class="lg3-sp-label">TOP PERFORMERS</p>' +
            (top.length ? '<div class="lg3-sp-cards">' + top.map(p => {
              const pos = positions.get(String(p.gamertag).toLowerCase());
              return '<a class="lg3-pc" href="' + profile(p.lg_user_id) + '" target="_blank" rel="noopener noreferrer">' + (pos ? '<span class="lg3-pc-pos">' + esc(pos) + '</span>' : '') +
                '<span class="lg3-pc-num">' + (+p.p || 0) + '</span><span class="lg3-pc-unit">PTS</span><b>' + esc(p.gamertag) + '</b><span class="lg3-pc-line">' + (+p.g || 0) + ' G · ' + (+p.a || 0) + ' A</span></a>';
            }).join('') + '</div>' : '<p class="lg3-wait">Player stats for ' + esc(t.name) + ' appear after the next game report.</p>') +
            (ed && ed.p ? '<p class="lg3-sp-copy">' + esc(clip(ed.p)) + '</p>' : '') +
            '<a class="lg3-btn" href="#' + esc(ed?.id || 'watch') + '">VIEW FULL NATION PROFILE <span aria-hidden="true">→</span></a>';
        };
        const go = d => { idx = (idx + d + order.length) % order.length; draw(); };
        $('lg3SpotPrev').addEventListener('click', () => go(-1));
        $('lg3SpotNext').addEventListener('click', () => go(1));
        $('lg3Rankings').addEventListener('click', e => {
          const b = e.target.closest('.lg3-nat'); if (!b) return;
          const i = order.findIndex(t => t.id === +b.dataset.team); if (i < 0) return;
          idx = i; draw();
          if (window.matchMedia('(max-width: 1100px)').matches) $('spotlight').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        });
        draw();
      });

      /* ---------- key matchups ---------- */
      guard('lg3Keys', 'Key matchups are unavailable right now.', () => {
        const picks = marquee.slice(1, 4);
        if (!picks.length) { wait('lg3Keys', 'Key matchups will appear once the next game night is scheduled.'); return; }
        $('lg3Keys').innerHTML = picks.map(g => {
          const a = nameOf(g.away_lg_team_id, g.away_nation), h = nameOf(g.home_lg_team_id, g.home_nation), url = safeUrl(g.source_url);
          const ra = rankOf.get(g.away_lg_team_id), rh = rankOf.get(g.home_lg_team_id);
          const tag = url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div';
          return '<' + tag + ' class="lg3-km" style="--a:' + art(a) + ';--h:' + art(h) + '"><span class="lg3-km-bg" aria-hidden="true"><i></i><i></i></span>' +
            '<span class="lg3-km-row"><span class="lg3-km-t">' + crestImg(g.away_lg_team_id, 'lg3-crest-lg') + '<b>' + esc(a) + '</b></span><em>VS</em><span class="lg3-km-t">' + crestImg(g.home_lg_team_id, 'lg3-crest-lg') + '<b>' + esc(h) + '</b></span></span>' +
            '<span class="lg3-km-when">' + esc(day(g.scheduled_at).toUpperCase()) + '<i aria-hidden="true">|</i>' + esc(time(g.scheduled_at)) + ' ET</span>' +
            (ra && rh ? '<span class="lg3-km-note">#' + ra.rank + ' vs #' + rh.rank + ' · ' + ra.pts + ' PTS vs ' + rh.pts + ' PTS</span>' : '') +
            (url ? '</a>' : '</div>');
        }).join('');
      });

      /* ---------- latest news (written from the numbers above) ---------- */
      guard('lg3News', 'Headlines are unavailable right now.', () => {
        const cards = [];
        const card = (href, name, crestId, kicker, head, when, dek) => cards.push('<a class="lg3-nc" href="' + href + '"><span class="lg3-nc-thumb" style="--art:' + art(name) + '">' + (crestId ? crestImg(crestId, 'lg3-crest-lg') : '') + '</span><span class="lg3-nc-body"><small>' + esc(kicker) + '</small><b>' + esc(head) + '</b>' + (when ? '<time>' + esc(when) + '</time>' : '') + '<span>' + esc(dek) + '</span></span></a>');
        if (recent && recent.length) {
          const d = recent[0].game_night_date, games = recent.filter(g => g.game_night_date === d);
          const big = games.slice().sort((x, y) => Math.abs(y.away_score - y.home_score) - Math.abs(x.away_score - x.home_score))[0];
          const awayWon = +big.away_score > +big.home_score;
          const W = nameOf(awayWon ? big.away_lg_team_id : big.home_lg_team_id), L = nameOf(awayWon ? big.home_lg_team_id : big.away_lg_team_id);
          const ws = Math.max(+big.away_score, +big.home_score), ls = Math.min(+big.away_score, +big.home_score), m = ws - ls;
          const verb = m >= 5 ? 'rolls past' : m === 1 ? 'edges' : 'beats';
          card('#scoreboard', W, awayWon ? big.away_lg_team_id : big.home_lg_team_id, 'GAME RECAP', W + ' ' + verb + ' ' + L + ', ' + ws + '–' + ls, night(d), games.length + ' games went final. ' + W + ' posted the biggest margin of the night at +' + m + '.');
        }
        if (Array.isArray(skaters) && skaters.length) {
          const s = skaters.slice().sort((x, y) => (+y.p || 0) - (+x.p || 0) || (+y.g || 0) - (+x.g || 0)), p1 = s[0], p2 = s[1];
          const team = byName.get(p1.nation);
          card('#leaders', p1.nation, team?.id, 'PLAYER SPOTLIGHT', p1.gamertag + ' leads LG3s with ' + p1.p + ' points', recent && recent[0] ? night(recent[0].game_night_date) : '', p1.g + ' goals and ' + p1.a + ' assists for ' + p1.nation + '.' + (p2 ? ' ' + p2.gamertag + ' is next with ' + p2.p + '.' : ''));
        }
        if (table.length > 1) {
          const [A, B] = table, tied = A.pts === B.pts;
          card('#power', A.name, A.id, 'STANDINGS', tied ? A.name + ' and ' + B.name + ' tied on top at ' + A.pts + ' points' : A.name + ' sets the pace with ' + A.pts + ' points', A.at ? day(A.at) : '', A.name + ' is ' + A.rec + ' with a ' + signed(A.gd) + ' goal differential. ' + B.name + ' follows at ' + B.rec + '.');
        }
        if (nextNight.length) {
          const first = nextNight.slice().sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
          const fa = featured ? nameOf(featured.away_lg_team_id) : '', fh = featured ? nameOf(featured.home_lg_team_id) : '';
          card('#upcoming', fh || nameOf(first.home_lg_team_id), featured ? featured.home_lg_team_id : first.home_lg_team_id, 'SCHEDULE', 'Week ' + weekOf(nextNightDate) + ' opens with ' + nextNight.length + ' games', night(nextNightDate), 'First puck drops at ' + time(first.scheduled_at) + ' ET.' + (fa ? ' Featured: ' + fa + ' vs ' + fh + '.' : ''));
        }
        if (!cards.length) { wait('lg3News', 'Headlines appear after the first game night.'); return; }
        $('lg3News').innerHTML = cards.join('');
      });
    })
    .catch(e => {
      console.error('LG3s dashboard:', e);
      ['lg3Feature', 'lg3Scores', 'lg3Upcoming', 'lg3Rankings', 'lg3Leaders', 'lg3Spotlight', 'lg3Keys', 'lg3News'].forEach(id => wait(id, 'Temporarily unavailable.'));
    });
})();
