/* LG3s broadcast dashboard.
 * Reads the public LG3s Supabase views (verified games, standings, skater + goalie leaders)
 * and the local team file for the twelve real nations and their groups.
 * Static, framework-free; every panel renders on its own so one failure never blanks the page.
 */
(() => {
  'use strict';
  const root = document.getElementById('lg3Broadcast');
  if (!root) return;

  const BASE = 'https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const TZ = 'America/Toronto';
  const SEASON_START = Date.UTC(2026, 9, 21);
  const NATIONS = new Set(['Canada', 'USA', 'Slovakia', 'Japan', 'Great Britain', 'Switzerland', 'Latvia', 'Kazakhstan', 'Poland', 'Sweden', 'Italy', 'Germany']);

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async q => {
    const r = await fetch(BASE + q, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }, cache: 'no-store' });
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
  const nightShort = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' }).toUpperCase();
  const weekOf = d => Math.floor((Date.parse(d + 'T00:00:00Z') - SEASON_START) / 604800000) + 1;
  const signed = n => (n > 0 ? '+' : '') + n;
  const wait = (id, msg) => { const n = $(id); if (n) n.innerHTML = '<p class="lg3-wait">' + esc(msg) + '</p>'; };
  const guard = (id, msg, fn) => { try { fn(); } catch (e) { console.error('LG3s dashboard:', id, e); wait(id, msg); } };
  const realGame = g => NATIONS.has(g.away_nation) && NATIONS.has(g.home_nation);
  const ptsKey = t => t.pts == null ? t.w * 2 : t.pts;
  const ptsText = t => t.pts == null ? '—' : String(t.pts);
  const recText = t => t.w + '-' + t.l + '-' + (t.pts == null ? '—' : String(t.otl));

  const nowIso = new Date().toISOString();
  const GAME_COLS = 'lg_game_id,scheduled_at,game_night_date,away_lg_team_id,away_nation,home_lg_team_id,home_nation,';
  const local = fetch('lg3s-season1-data.json?v=20261021-2', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const pRecent = api('lg3s_public_games?select=' + GAME_COLS + 'away_score,home_score,decided_in,source_url,is_verified&is_verified=eq.true&away_score=not.is.null&home_score=not.is.null&order=scheduled_at.desc,lg_game_id.desc&limit=80');
  const pPending = api('lg3s_public_games?select=' + GAME_COLS + 'source_url,status&is_verified=eq.false&status=eq.pending_verification&order=scheduled_at.desc&limit=40');
  const pUpcoming = api('lg3s_public_games?select=' + GAME_COLS + 'source_url,status&status=eq.scheduled&scheduled_at=gte.' + encodeURIComponent(nowIso) + '&order=scheduled_at.asc,lg_game_id.asc&limit=30');
  /* Computed from verified finals. The official snapshot labels every team Group A, so groups come from the season file. */
  const pStandings = api('lg3s_public_standings?select=lg_team_id,nation,gp,w,l,otw,otl,pts,gf,ga,gd');
  const pSkaters = api('lg3s_public_skater_leaders?select=lg_user_id,gamertag,lg_team_id,nation,gp,g,a,p,plus_minus&order=p.desc,g.desc&limit=120');
  const pGoalies = api('lg3s_public_goalie_leaders?select=lg_user_id,gamertag,nations_played_for,gp,sa,ga,sv,sv_pct,gaa_per_game&limit=60');
  const pRecords = api('lg3s_public_goalie_records?select=lg_user_id,gamertag,nations_played_for,gp,wins,gaa,sa,ga,sv&limit=60');
  /* Approved-recap view (migration 20261024160000) is not applied yet; re-enable the lg3s_public_recaps fetch once it exists. */
  const pNews = Promise.resolve(null);
  const settle = p => p.then(v => v, e => { console.error('LG3s dashboard data:', e); return null; });

  Promise.all([local, settle(pRecent), settle(pPending), settle(pUpcoming), settle(pStandings), settle(pSkaters), settle(pGoalies), settle(pRecords), settle(pNews)])
    .then(([data, recent, pending, upcoming, standings, skaters, goalies, records, news]) => {
      const teams = new Map((data && Array.isArray(data.teams) ? data.teams : []).filter(t => NATIONS.has(t.name)).map(t => [t.id, { id: t.id, name: t.name, group: t.group }]));
      const nameOf = (id, fallback) => teams.get(id)?.name || (NATIONS.has(fallback) ? fallback : '');
      const byName = new Map([...teams.values()].map(t => [t.name, t]));
      const positions = new Map((data && Array.isArray(data.players) ? data.players : []).map(p => [String(p.n).toLowerCase(), p.p]));
      const known = g => realGame(g) && teams.has(g.away_lg_team_id) && teams.has(g.home_lg_team_id);

      recent = Array.isArray(recent) ? recent.filter(g => known(g) && g.away_score != null && g.home_score != null) : null;
      pending = Array.isArray(pending) ? pending.filter(known) : [];
      upcoming = Array.isArray(upcoming) ? upcoming.filter(g => known(g) && (!g.scheduled_at || g.scheduled_at >= nowIso)) : null;
      skaters = Array.isArray(skaters) ? skaters.filter(p => NATIONS.has(p.nation)) : null;
      goalies = Array.isArray(goalies) ? goalies.filter(g => NATIONS.has((g.nations_played_for || [])[0])) : null;
      records = Array.isArray(records) ? records.filter(g => NATIONS.has((g.nations_played_for || [])[0])) : null;

      const table = (Array.isArray(standings) ? standings : []).map(s => {
        const team = teams.get(s.lg_team_id);
        if (!team || !NATIONS.has(s.nation) && !NATIONS.has(team.name)) return null;
        return {
          id: s.lg_team_id, name: team.name, group: team.group,
          gp: +s.gp || 0, w: +s.w || 0, l: +s.l || 0, otl: +s.otl || 0,
          pts: s.pts == null ? null : +s.pts,
          gf: +s.gf || 0, ga: +s.ga || 0, gd: +s.gd || 0
        };
      }).filter(Boolean)
        .sort((a, b) => ptsKey(b) - ptsKey(a) || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
        .map((t, i) => ({ ...t, rank: i + 1, rec: recText(t) }));
      const rankOf = new Map(table.map(t => [t.id, t]));

      const nextNightDate = upcoming && upcoming.length ? upcoming[0].game_night_date : null;
      const nextNight = nextNightDate ? upcoming.filter(g => g.game_night_date === nextNightDate) : [];
      const strength = g => ptsKey(rankOf.get(g.away_lg_team_id) || { w: 0, pts: 0 }) + ptsKey(rankOf.get(g.home_lg_team_id) || { w: 0, pts: 0 });
      const gap = g => Math.abs(ptsKey(rankOf.get(g.away_lg_team_id) || { w: 0, pts: 0 }) - ptsKey(rankOf.get(g.home_lg_team_id) || { w: 0, pts: 0 }));
      const marquee = nextNight.slice().sort((a, b) => strength(b) - strength(a) || gap(a) - gap(b) || a.scheduled_at.localeCompare(b.scheduled_at));
      const featured = marquee[0] || (upcoming && upcoming[0]) || null;

      const teamLine = id => { const t = rankOf.get(id); return t ? t.rec + ' · ' + ptsText(t) + ' PTS' : ''; };
      const art = (name, size) => (byName.has(name) && window.LG3S_NATION_ART) ? window.LG3S_NATION_ART.css(name, size || 'card') : 'none';

      guard('lg3Feature', 'The next featured matchup is unavailable right now.', () => {
        if (!featured) { wait('lg3Feature', 'The next featured matchup will appear once the schedule is posted.'); return; }
        const a = nameOf(featured.away_lg_team_id, featured.away_nation), h = nameOf(featured.home_lg_team_id, featured.home_nation);
        const url = safeUrl(featured.source_url);
        $('lg3FeatureMeta').textContent = 'WEEK ' + weekOf(featured.game_night_date);
        $('lg3Feature').innerHTML =
          '<' + (url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div') + ' class="lg3-fm" style="--a:' + art(a) + ';--h:' + art(h) + '">' +
          (window.LG3S_NATION_ART && window.LG3S_NATION_ART.matchup ? window.LG3S_NATION_ART.matchup({ size: 'hero', away: { name: a, mark: crestImg(featured.away_lg_team_id, 'lg3-crest-xl'), label: teamLine(featured.away_lg_team_id) }, home: { name: h, mark: crestImg(featured.home_lg_team_id, 'lg3-crest-xl'), label: teamLine(featured.home_lg_team_id) }, final: null, meta: day(featured.scheduled_at).toUpperCase() + ' · ' + time(featured.scheduled_at) + ' ET' }) : '') +
          '<span class="lg3-fm-tag">LG3S INTERNATIONAL</span>' +
          (url ? '<span class="lg3-btn">GAME CENTRE <span aria-hidden="true">↗</span></span>' : '') +
          (url ? '</a>' : '</div>');
      });

      guard('lg3Scores', 'Scores are unavailable right now.', () => {
        if (!recent) { wait('lg3Scores', 'Scores are unavailable right now.'); return; }
        const pool = recent.concat(pending.map(g => ({ ...g, pending: true })));
        if (!pool.length) { wait('lg3Scores', 'Final scores appear here after the first game night.'); return; }
        const dates = [...new Set(pool.map(g => g.game_night_date))].sort().reverse().slice(0, 3);
        const draw = d => {
          $('lg3Nights').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.night === d)));
          const rows = pool.filter(g => g.game_night_date === d).sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
          $('lg3Scores').innerHTML = rows.map(g => {
            const line = (id, nation, score, win) => { const bg = art(nameOf(id, nation)); return '<span class="lg3-line' + (win ? ' win' : '') + (bg !== 'none' ? ' has-nat" style="--nat:' + esc(bg) : '') + '">' + crestImg(id) + '<span>' + esc(nameOf(id, nation)) + '</span><b>' + score + '</b></span>'; };
            if (g.pending) {
              return '<div class="lg3-score is-pending">' + line(g.away_lg_team_id, g.away_nation, '—', false) + line(g.home_lg_team_id, g.home_nation, '—', false) + '<span class="lg3-fin">VERIFYING</span></div>';
            }
            const as = +g.away_score, hs = +g.home_score, url = safeUrl(g.source_url);
            const ot = /OT|SO/i.test(String(g.decided_in || '')) ? String(g.decided_in).toUpperCase() : 'FINAL';
            const tag = url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div';
            return '<' + tag + ' class="lg3-score">' + line(g.away_lg_team_id, g.away_nation, as, as > hs) + line(g.home_lg_team_id, g.home_nation, hs, hs > as) + '<span class="lg3-fin">' + ot + '</span>' + (url ? '</a>' : '</div>');
          }).join('');
          $('lg3Scores').scrollTop = 0;
        };
        $('lg3Nights').innerHTML = dates.map(d => '<button type="button" data-night="' + esc(d) + '" aria-pressed="false">' + esc(nightShort(d)) + '</button>').join('');
        $('lg3Nights').addEventListener('click', e => { const b = e.target.closest('button[data-night]'); if (b) draw(b.dataset.night); });
        draw(dates[0]);
      });

      guard('lg3Upcoming', 'The schedule is unavailable right now.', () => {
        if (!upcoming) { wait('lg3Upcoming', 'The schedule is unavailable right now.'); return; }
        if (!upcoming.length) { wait('lg3Upcoming', 'The next game night will appear once it is scheduled.'); return; }
        $('lg3Upcoming').innerHTML = upcoming.slice(0, 6).map(g => {
          const url = safeUrl(g.source_url), tag = url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div';
          const sa = art(nameOf(g.away_lg_team_id, g.away_nation)), sh = art(nameOf(g.home_lg_team_id, g.home_nation));
          return '<' + tag + ' class="lg3-game has-split" style="--ma:' + esc(sa) + ';--mh:' + esc(sh) + '">' +
            '<span class="lg3-match"><span class="lg3-line">' + crestImg(g.away_lg_team_id) + '<span>' + esc(nameOf(g.away_lg_team_id, g.away_nation)) + '</span></span>' +
            '<span class="lg3-line">' + crestImg(g.home_lg_team_id) + '<span>' + esc(nameOf(g.home_lg_team_id, g.home_nation)) + '</span></span></span>' +
            '<span class="lg3-when"><b>' + esc(day(g.scheduled_at)) + '</b><small>' + esc(time(g.scheduled_at)) + ' ET</small></span>' +
            (url ? '</a>' : '</div>');
        }).join('');
      });

      guard('lg3Rankings', 'Standings are unavailable right now.', () => {
        if (!table.length) { wait('lg3Rankings', 'Standings are unavailable right now.'); return; }
        $('lg3Rankings').innerHTML = '<div class="lg3-scroll"><table class="lg3-table"><caption class="sr-only">LG3s league-wide power rankings</caption><thead><tr><th scope="col">#</th><th scope="col">NATION</th><th scope="col" class="c">W-L-OT</th><th scope="col" class="c">PTS</th><th scope="col" class="c">+/-</th></tr></thead><tbody>' +
          table.map(t => '<tr><td class="lg3-rk">' + t.rank + '</td><td><button type="button" class="lg3-nat" data-team="' + t.id + '" aria-label="Show ' + esc(t.name) + ' in the nation spotlight">' + crestImg(t.id) + '<span>' + esc(t.name) + '</span>' + (t.group ? '<small>GRP ' + esc(t.group) + '</small>' : '') + '</button></td>' +
            '<td class="c num">' + t.rec + '</td><td class="c num lg3-pts">' + ptsText(t) + '</td><td class="c num"><span class="lg3-gd ' + (t.gd > 0 ? 'up' : t.gd < 0 ? 'dn' : 'eq') + '">' + (t.gd > 0 ? '▲' : t.gd < 0 ? '▼' : '•') + ' ' + signed(t.gd) + '</span></td></tr>').join('') +
          '</tbody></table></div><p class="lg3-foot">Groups from the season roster. PTS is 2 per regulation win. OT/SO point values are not published, so those show —.</p>';
      });

      guard('lg3Leaders', 'Leaders are unavailable right now.', () => {
        const sk = Array.isArray(skaters) ? skaters : null, gl = Array.isArray(goalies) ? goalies.filter(g => +g.sa >= 20) : null;
        const rec = Array.isArray(records) ? records.filter(g => +g.sa >= 20) : null;
        const SETS = {
          p: [['gp', 'GP'], ['g', 'G'], ['a', 'A'], ['p', 'PTS']], g: [['gp', 'GP'], ['g', 'G'], ['a', 'A'], ['p', 'PTS']],
          a: [['gp', 'GP'], ['g', 'G'], ['a', 'A'], ['p', 'PTS']], plus_minus: [['gp', 'GP'], ['g', 'G'], ['p', 'PTS'], ['plus_minus', '+/-']],
          sv_pct: [['gp', 'GP'], ['sv', 'SV'], ['ga', 'GA'], ['sv_pct', 'SV%']],
          wins: [['gp', 'GP'], ['wins', 'W'], ['ga', 'GA'], ['gaa', 'GAA']],
          gaa: [['gp', 'GP'], ['wins', 'W'], ['ga', 'GA'], ['gaa', 'GAA']]
        };
        const fmt = (k, v) => k === 'sv_pct' ? (v == null ? '—' : Number(v).toFixed(3).replace(/^0/, '')) : k === 'gaa' ? (v == null ? '—' : Number(v).toFixed(2)) : k === 'plus_minus' ? signed(+v || 0) : (v ?? '—');
        const draw = stat => {
          $('lg3LeaderTabs').querySelectorAll('[data-stat]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.stat === stat)));
          const goalie = stat === 'sv_pct' || stat === 'wins' || stat === 'gaa';
          const src = stat === 'wins' || stat === 'gaa' ? rec : goalie ? gl : sk;
          if (!src) { wait('lg3Leaders', 'Leaders are unavailable right now.'); return; }
          const rows = src.slice().sort((x, y) => {
            if (stat === 'gaa') return (Number(x.gaa) || 99) - (Number(y.gaa) || 99) || (Number(y.wins) || 0) - (Number(x.wins) || 0) || String(x.gamertag).localeCompare(String(y.gamertag));
            return (Number(y[stat]) || 0) - (Number(x[stat]) || 0) || (goalie ? (stat === 'wins' ? (Number(x.gaa) || 99) - (Number(y.gaa) || 99) : (+y.sv || 0) - (+x.sv || 0)) : (+y.p || 0) - (+x.p || 0)) || String(x.gamertag).localeCompare(String(y.gamertag));
          }).slice(0, 8);
          if (!rows.length) { wait('lg3Leaders', 'Leaders appear after the first game reports.'); return; }
          const cols = SETS[stat];
          const caption = stat === 'wins' ? 'goalie wins' : stat === 'gaa' ? 'goalie GAA' : stat === 'sv_pct' ? 'goalie save percentage' : 'skater';
          $('lg3Leaders').innerHTML = '<div class="lg3-scroll"><table class="lg3-table lg3-lead"><caption class="sr-only">LG3s ' + caption + ' leaders</caption><thead><tr><th scope="col">#</th><th scope="col">PLAYER</th><th scope="col" class="c">TEAM</th>' +
            cols.map(([k, l]) => '<th scope="col" class="c' + (k === stat ? ' hl' : '') + '">' + l + '</th>').join('') + '</tr></thead><tbody>' +
            rows.map((p, i) => {
              const nation = goalie ? (p.nations_played_for || [])[0] : p.nation, team = byName.get(nation);
              return '<tr><td class="lg3-rk">' + (i + 1) + '</td><td class="lg3-pl"><a href="' + profile(p.lg_user_id) + '" target="_blank" rel="noopener noreferrer">' + esc(p.gamertag) + '</a></td>' +
                '<td class="c">' + (team ? crestImg(team.id) + '<span class="sr-only">' + esc(nation) + '</span>' : esc(nation || '')) + '</td>' +
                cols.map(([k]) => '<td class="c num' + (k === stat ? ' hl' : '') + '">' + esc(fmt(k, p[k])) + '</td>').join('') + '</tr>';
            }).join('') + '</tbody></table></div>';
        };
        $('lg3LeaderTabs').addEventListener('click', e => { const b = e.target.closest('[data-stat]'); if (b) draw(b.dataset.stat); });
        draw('p');
      });

      guard('lg3Spotlight', 'The nation spotlight is unavailable right now.', () => {
        const order = table.length ? table : [...teams.values()].map((t, i) => ({ ...t, rank: i + 1, rec: '', pts: null, gd: 0, gp: 0, w: 0, l: 0, otl: 0 }));
        if (!order.length) { wait('lg3Spotlight', 'The nation spotlight is unavailable right now.'); return; }
        let idx = 0;
        const draw = () => {
          const t = order[idx];
          const top = (Array.isArray(skaters) ? skaters : []).filter(p => +p.lg_team_id === t.id || p.nation === t.name).sort((x, y) => (+y.p || 0) - (+x.p || 0) || (+y.g || 0) - (+x.g || 0)).slice(0, 4);
          $('lg3SpotCount').textContent = (idx + 1) + '/' + order.length;
          $('lg3Spotlight').style.setProperty('--art', art(t.name, 'hero'));
          $('lg3Spotlight').innerHTML =
            '<div class="lg3-sp-hero">' + crestImg(t.id, 'lg3-crest-xl') + '<div><h3>' + esc(t.name) + '</h3><p>' + (t.gp ? '#' + t.rank + ' IN LG3S' : 'LG3S SEASON 1') + (t.group ? ' · GROUP ' + esc(t.group) : '') + '</p></div></div>' +
            (t.gp ? '<dl class="lg3-sp-stats"><div><dt>RECORD</dt><dd>' + t.rec + '</dd></div><div><dt>PTS</dt><dd>' + ptsText(t) + '</dd></div><div><dt>GD</dt><dd>' + signed(t.gd) + '</dd></div><div><dt>GP</dt><dd>' + t.gp + '</dd></div></dl>' : '') +
            '<p class="lg3-sp-label">TOP PERFORMERS</p>' +
            (top.length ? '<div class="lg3-sp-cards">' + top.map((p, ti) => {
              const NA = window.LG3S_NATION_ART, star = ti === 0 && (+p.p || 0) > 0, pv = NA ? ' style="--pa:' + esc(NA.css(t.name, 'card')) + ';--pc:' + NA.color(t.name) + '"' : '';
              const pos = positions.get(String(p.gamertag).toLowerCase());
              return '<a class="lg3-pc' + (star ? ' is-star' : '') + '"' + pv + ' href="' + profile(p.lg_user_id) + '" target="_blank" rel="noopener noreferrer">' + (pos ? '<span class="lg3-pc-pos">' + esc(pos) + '</span>' : '') +
                '<span class="lg3-pc-num">' + (+p.p || 0) + '</span><span class="lg3-pc-unit">PTS</span><b>' + esc(p.gamertag) + '</b><span class="lg3-pc-line"><i>' + (+p.g || 0) + '</i><small>G</small><i>' + (+p.a || 0) + '</i><small>A</small></span></a>';
            }).join('') + '</div>' : '<p class="lg3-wait">Player stats for ' + esc(t.name) + ' appear after the next game report.</p>');
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

      guard('lg3Keys', 'Key matchups are unavailable right now.', () => {
        const picks = (marquee.length > 1 ? marquee.slice(1, 4) : (upcoming || []).slice(0, 3));
        if (!picks.length) { wait('lg3Keys', 'Key matchups will appear once the next game night is scheduled.'); return; }
        $('lg3Keys').innerHTML = picks.map(g => {
          const a = nameOf(g.away_lg_team_id, g.away_nation), h = nameOf(g.home_lg_team_id, g.home_nation), url = safeUrl(g.source_url);
          const ra = rankOf.get(g.away_lg_team_id), rh = rankOf.get(g.home_lg_team_id);
          const tag = url ? 'a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' : 'div';
          return '<' + tag + ' class="lg3-km" style="--a:' + art(a) + ';--h:' + art(h) + '"><span class="lg3-km-bg" aria-hidden="true"><i></i><i></i></span>' +
            '<span class="lg3-km-row"><span class="lg3-km-t">' + crestImg(g.away_lg_team_id, 'lg3-crest-lg') + '<b>' + esc(a) + '</b></span><em>VS</em><span class="lg3-km-t">' + crestImg(g.home_lg_team_id, 'lg3-crest-lg') + '<b>' + esc(h) + '</b></span></span>' +
            '<span class="lg3-km-when">' + esc(day(g.scheduled_at).toUpperCase()) + '<i aria-hidden="true">|</i>' + esc(time(g.scheduled_at)) + ' ET</span>' +
            (ra && rh ? '<span class="lg3-km-note">#' + ra.rank + ' vs #' + rh.rank + ' · ' + ptsText(ra) + ' PTS vs ' + ptsText(rh) + ' PTS</span>' : '') +
            (url ? '</a>' : '</div>');
        }).join('');
      });

      guard('lg3News', 'Headlines are unavailable right now.', () => {
        const posts = Array.isArray(news) ? news.filter(p => p && p.title && p.lg_game_id) : [];
        if (!posts.length) {
          wait('lg3News', 'No approved stories yet. Headlines show up here after an editor publishes them.');
          return;
        }
        $('lg3News').innerHTML = posts.slice(0, 4).map(p => {
          const game = (recent || []).find(g => g.lg_game_id === p.lg_game_id);
          const name = game ? nameOf(game.home_lg_team_id, game.home_nation) : '';
          return '<a class="lg3-nc" href="#recap/' + Number(p.lg_game_id) + '"><span class="lg3-nc-thumb" style="--art:' + art(name) + '"></span><span class="lg3-nc-body"><small>APPROVED RECAP</small><b>' + esc(p.title) + '</b><time>' + esc(night(p.game_night_date)) + '</time></span></a>';
        }).join('');
      });
    })
    .catch(e => {
      console.error('LG3s dashboard:', e);
      ['lg3Feature', 'lg3Scores', 'lg3Upcoming', 'lg3Rankings', 'lg3Leaders', 'lg3Spotlight', 'lg3Keys', 'lg3News'].forEach(id => wait(id, 'Temporarily unavailable.'));
    });
})();
