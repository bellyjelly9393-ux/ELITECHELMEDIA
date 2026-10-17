/* LGCHL full power rankings (lgchl-power.html).
   Public read-only views only (lgchl_standings_current, lgchl_standings_snapshots, lgchl_games_board),
   same publishable-key reads as lgchl-media.js. Same formula as the LGCHL Media desk. */
(() => {
  'use strict';
  const D = window.WMDesk;
  if (!D) return;
  const { $, esc, read, ordinal, tint, menu } = D;
  menu();

  const DAY = 864e5;
  const iso = ms => new Date(ms).toISOString();
  const logo = id => Number.isSafeInteger(Number(id)) && Number(id) > 0 ? 'assets/lgchl/s55/team' + Number(id) + '.png' : 'assets/wildman/home/lgchl-logo.webp';
  const wm = id => '<span class="wm" aria-hidden="true" style="--logo:url(\'' + logo(id) + '\')"></span>';
  const sgn = v => { if (v == null || v === '' || !Number.isFinite(Number(v))) return '—'; const n = Number(v); return n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0'; };
  const record = t => [t.w, t.l, t.otl].map(v => v == null ? '—' : v).join('-');
  const streak = s => { const m = /^-?(\d+)\s*([WL])/i.exec(String(s || '').trim()); return m ? { n: Number(m[1]), win: m[2].toUpperCase() === 'W', label: m[2].toUpperCase() + m[1] } : null; };

  function powerScore(s) {
    const gp = Math.max(1, Number(s.gp || 1)), pts = Number(s.pts || 0), gf = Number(s.gf || 0), ga = Number(s.ga || 0);
    return 100 * (.70 * Math.min(1, pts / (2 * gp)) + .20 * Math.max(0, Math.min(1, ((gf - ga) / gp + 3) / 6)) + .10 * Math.max(0, Math.min(1, (gf / gp) / 6)));
  }
  function rankTeams(rows) {
    return rows.filter(s => Number(s.gp) >= 5 && ['pts', 'gf', 'ga'].every(k => s[k] != null && Number.isFinite(Number(s[k]))))
      .map(s => ({ ...s, score: powerScore(s), gd: Number(s.gf || 0) - Number(s.ga || 0) }))
      .sort((a, b) => b.score - a.score || b.gd - a.gd || Number(b.gf) - Number(a.gf))
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  const state = { ranked: [], league: 'all' };

  const moveHtml = t => t.move == null || t.move === 0 ? '<span class="lg-mv eq">—</span>'
    : t.move > 0 ? '<span class="lg-mv up">▲' + t.move + '</span>' : '<span class="lg-mv dn">▼' + Math.abs(t.move) + '</span>';

  function podium(rows) {
    return rows.slice(0, 3).map(t => {
      const st = streak(t.streak);
      return '<article class="card tinted lg-pr-pod" data-logo="' + logo(t.lg_team_id) + '">' + wm(t.lg_team_id) +
        '<div class="lg-pr-pod-rank"><b>' + t.rank + '</b>' + moveHtml(t) + '</div>' +
        '<div class="lg-feat-head"><img src="' + logo(t.lg_team_id) + '" width="100" height="100" alt="' + esc(t.name) + ' logo"><div><small>' + esc(t.league) + ' · ' + esc(t.conference) + '</small><b>' + esc(t.name) + '</b></div></div>' +
        '<div class="lg-tiles num"><div class="lg-tile"><small>Record</small><b>' + esc(record(t)) + '</b></div><div class="lg-tile"><small>Points</small><b>' + esc(t.pts) + '</b></div>' +
        '<div class="lg-tile"><small>Goal diff</small><b>' + sgn(t.gd) + '</b></div><div class="lg-tile"><small>Streak</small><b>' + esc(st ? st.label : '—') + '</b></div></div>' +
        '<div class="lg-pr-score"><span>Index</span><b>' + t.score.toFixed(1) + '</b><div class="lg-bar"><i style="width:' + Math.min(100, t.score).toFixed(1) + '%"></i></div></div></article>';
    }).join('');
  }

  function row(t) {
    const st = streak(t.streak);
    return '<li class="card tinted lg-pr-row" data-logo="' + logo(t.lg_team_id) + '">' + wm(t.lg_team_id) +
      '<div class="lg-pr-rk"><b>' + t.rank + '</b>' + moveHtml(t) + '</div>' +
      '<div class="lg-team"><img src="' + logo(t.lg_team_id) + '" alt="" loading="lazy"><div><b>' + esc(t.name) + '</b><small>' + esc(t.abbr) + ' · ' + esc(t.league) + ' ' + esc(t.conference || '') + (t.conference_rank ? ' · ' + ordinal(t.conference_rank) : '') + '</small></div></div>' +
      '<dl class="lg-pr-stats num">' +
        '<div><dt>Record</dt><dd>' + esc(record(t)) + '</dd></div>' +
        '<div><dt>PTS</dt><dd>' + esc(t.pts) + '</dd></div>' +
        '<div><dt>GD</dt><dd class="' + (t.gd > 0 ? 'up' : t.gd < 0 ? 'dn' : '') + '">' + sgn(t.gd) + '</dd></div>' +
        '<div><dt>L10</dt><dd>' + esc(t.last10 || '—') + '</dd></div>' +
        '<div><dt>Strk</dt><dd class="' + (st ? (st.win ? 'up' : 'dn') : '') + '">' + esc(st ? st.label : '—') + '</dd></div>' +
      '</dl>' +
      '<div class="lg-score-cell"><b>' + t.score.toFixed(1) + '</b><div class="lg-bar"><i style="width:' + Math.min(100, t.score).toFixed(1) + '%"></i></div></div></li>';
  }

  function render() {
    const rows = state.league === 'all' ? state.ranked : state.ranked.filter(t => t.league === state.league);
    const pod = $('lgPrPodium'), list = $('lgPrList');
    if (!rows.length) { pod.innerHTML = ''; list.innerHTML = '<li class="empty">Standings are unavailable right now.</li>'; return; }
    pod.innerHTML = podium(rows);
    list.innerHTML = rows.slice(3).map(row).join('');
    $('lgPrCount').textContent = (state.league === 'all' ? 'All ' + rows.length + ' LGCHL teams' : rows.length + ' ' + state.league + ' teams') + ' · overall rank shown';
    tint(pod); tint(list);
  }

  async function main() {
    const now = Date.now();
    const [standings, games] = await Promise.all([
      read('lgchl_standings_current', { select: 'lg_team_id,name,abbr,nickname,league,conference,gp,w,l,otl,pts,gf,ga,gd,streak,last10,conference_rank' }),
      read('lgchl_games_board', { select: 'week,game_at,status', season: 'eq.55', and: '(game_at.gte.' + iso(now - 9 * DAY) + ',game_at.lte.' + iso(now + DAY) + ')', order: 'game_at.asc', limit: '1000' }).catch(() => [])
    ]);
    const ranked = rankTeams(standings);
    let week = null;
    const finals = games.filter(g => g.status === 'final');
    if (finals.length) {
      const last = Math.max(...finals.map(g => Date.parse(g.game_at)));
      week = finals.find(g => Date.parse(g.game_at) === last).week;
      const weekStart = Math.min(...games.filter(g => g.week === week).map(g => Date.parse(g.game_at)));
      try {
        const snaps = await read('lgchl_standings_snapshots', { select: 'lg_team_id,taken_at,gp,pts,gf,ga', season: 'eq.55', taken_at: 'lt.' + iso(weekStart), order: 'taken_at.desc', limit: '1000' });
        const seen = new Map();
        snaps.forEach(s => { if (!seen.has(s.lg_team_id)) seen.set(s.lg_team_id, s); });
        const prev = new Map(rankTeams([...seen.values()]).map(t => [Number(t.lg_team_id), t.rank]));
        ranked.forEach(t => { const p = prev.get(Number(t.lg_team_id)); t.prev = p ?? null; t.move = p ? p - t.rank : null; });
      } catch { /* movement stays blank */ }
    }
    if (week) $('lgPrEyebrow').textContent = 'Elitechel power index · after Week ' + week;
    $('lgPrNote').textContent = 'Score = 70% points percentage + 20% goal differential per game + 10% goals per game. Minimum 5 GP. ' +
      (week ? 'Move compares with the standings before Week ' + week + '. ' : '') + 'No subjective boosts, for any team.';
    state.ranked = ranked;
    const wanted = new URLSearchParams(location.search).get('league');
    if (['OHL', 'WHL', 'QMJHL'].includes(wanted)) state.league = wanted;
    document.querySelectorAll('#lgPrTabs button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.league === state.league));
      b.addEventListener('click', () => {
        state.league = b.dataset.league;
        document.querySelectorAll('#lgPrTabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        render();
      });
    });
    render();
  }

  main().catch(() => { $('lgPrList').innerHTML = '<li class="empty">Standings are unavailable right now.</li>'; });
})();
