/* LGCHL Media desk: extra league segments (lgchl-media.html).
   Public read-only data only: the standings/schedule already loaded by lgchl-media.js, the public
   season leaders view, and the public night/week/trending views (LG season totals compared over time). Every line is built from those numbers. */
(() => {
  'use strict';
  const D = window.WMDesk;
  if (!D) return;
  const { $, esc, read, ordinal, tint, F } = D;
  const logo = id => Number.isSafeInteger(Number(id)) && Number(id) > 0 ? 'assets/lgchl/s55/team' + Number(id) + '.png' : 'assets/wildman/home/lgchl-logo.webp';
  const wm = id => '<span class="wm" aria-hidden="true" style="--logo:url(\'' + logo(id) + '\')"></span>';
  const sgn = v => { const n = Number(v); if (!Number.isFinite(n)) return '—'; return n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0'; };
  const empty = t => '<p class="empty">' + esc(t) + '</p>';
  const show = (id, on) => { const el = $(id); if (el) el.hidden = !on; };

  /* ---------- Playoff Race Watch: conference cutoff, no invented clinching rules ---------- */
  function renderRaces(standings) {
    const box = $('lgRaces');
    if (!box) return;
    if (!Array.isArray(standings) || !standings.length) {
      box.innerHTML = empty('Standings are unavailable. Playoff positions cannot be verified.');
      return;
    }
    const groups = new Map();
    standings.forEach(t => {
      if (!t || !t.league || !t.conference) return;
      const k = t.league + ' · ' + t.conference;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    });
    const order = ['OHL', 'WHL', 'QMJHL'];
    const keys = [...groups.keys()].sort((a, b) => order.indexOf(a.split(' · ')[0]) - order.indexOf(b.split(' · ')[0]) || a.localeCompare(b));
    box.innerHTML = keys.map(k => {
      const sorted = groups.get(k).slice().filter(t => Number.isFinite(Number(t.conference_rank)) && Number.isFinite(Number(t.pts)))
        .sort((a, b) => Number(a.conference_rank) - Number(b.conference_rank));
      const cutoff = sorted.find(t => Number(t.conference_rank) === 4);
      const chasing = sorted.find(t => Number(t.conference_rank) === 5);
      const rows = sorted.slice(0, 6);
      const gap = cutoff && chasing ? Number(cutoff.pts) - Number(chasing.pts) : null;
      const note = gap === null ? 'Cutoff comparison unavailable until fourth and fifth place are verified.'
        : gap === 0 ? 'Fourth and fifth are tied on points. Tiebreakers are not verified.'
        : 'Fifth place trails fourth by ' + gap + ' point' + (gap === 1 ? '' : 's') + '.';
      return '<article class="card tinted lg-race lg-playoff-race" data-logo="' + logo((cutoff || rows[0] || {}).lg_team_id) + '">' +
        '<div class="lg-playoff-race-head"><p class="lg-race-tag">' + esc(k) + '</p><span class="lg-playoff-label">CUTOFF WATCH</span></div>' +
        '<ol class="lg-race-list num">' + rows.map(t => {
          const rank = Number(t.conference_rank);
          const state = rank === 4 ? ' lg-cutoff-team' : rank === 5 ? ' lg-chasing-team' : '';
          const label = rank === 4 ? '4TH' : rank === 5 ? '5TH' : '';
          return '<li class="' + state.trim() + '"><span class="lg-race-rk">' + rank + '</span><img src="' + logo(t.lg_team_id) + '" alt="" loading="lazy"><b>' + esc(t.nickname || t.name) + '</b><span class="lg-race-pts">' + esc(t.pts) + '</span><small>' + label + '</small></li>';
        }).join('') + '</ol>' +
        '<p class="lg-race-line">' + esc(note) + '</p>' +
        '<p class="lg-playoff-disclaimer">Standings positions only · Not a clinching or elimination prediction</p></article>';
    }).join('');
    if (!keys.length) box.innerHTML = empty('Conference standings unavailable.');
    tint(box);
  }

  /* ---------- Heaters & Skids: the players playing unreal, and the ones in trouble ---------- */
  async function renderPlayerStreaks(teams) {
    const hot = $('lgHeaters'), cold = $('lgSkids');
    if (!hot || !cold) return;
    let rows = [], recent = false;
    try {
      const r = await read('lgchl_public_trending_players', { select: 'gamertag,position,lg_team_id,gp,goals,assists,points,plus_minus,shots', player_kind: 'eq.skater', gp: 'gte.2', limit: '2000' });
      if (r.length >= 40) { rows = r; recent = true; }
    } catch { /* recent form not available yet */ }
    if (!recent) {
      try {
        rows = await read('wm_lgchl_s55_player_leaders', { select: 'gamertag,position,lg_team_id,team_name,gp,goals,assists,points,plus_minus,shots', player_kind: 'eq.skater', gp: 'gte.6', shots: 'gt.0', limit: '2000' });
      } catch { show('lgStreakSec', false); return; }
    }
    rows = rows.filter(p => Number(p.gp) > 0 && Number(p.shots) > 0);
    if (!rows.length) { show('lgStreakSec', false); return; }
    const pick = (list, n, maxD) => {
      const out = [], teamsSeen = new Set(); let d = 0;
      for (const p of list) {
        if (out.length >= n) break;
        const isD = /D$/.test(String(p.position || ''));
        if (teamsSeen.has(Number(p.lg_team_id)) || (isD && maxD != null && d >= maxD)) continue;
        out.push(p); teamsSeen.add(Number(p.lg_team_id)); if (isD) d++;
      }
      return out;
    };
    const ppgOf = p => Number(p.points) / Number(p.gp);
    // Playing unreal: best points per game. NCAA watch: worst plus-minus. One per team, max two D on the cold side.
    const heaters = pick(rows.slice().sort((a, b) => ppgOf(b) - ppgOf(a) || Number(b.plus_minus) - Number(a.plus_minus)), 4, null);
    const skids = pick(rows.slice().sort((a, b) => Number(a.plus_minus) - Number(b.plus_minus) || ppgOf(a) - ppgOf(b)), 4, 2);
    const card = (p, win) => {
      const team = teams.get(Number(p.lg_team_id));
      const ppg = (Number(p.points) / Number(p.gp)).toFixed(2);
      return '<article class="card tinted lg-streak ' + (win ? 'is-hot' : 'is-cold') + '" data-logo="' + logo(p.lg_team_id) + '">' + wm(p.lg_team_id) +
        '<div class="lg-streak-big"><b class="lg-streak-n num">' + (win ? ppg : sgn(p.plus_minus)) + '</b><span>' + (win ? 'points per game' : 'plus-minus') + '</span></div>' +
        '<div class="lg-card-head"><img src="' + logo(p.lg_team_id) + '" alt="" loading="lazy"><div><b>' + esc(p.gamertag) + '</b><small>' + esc(p.position || '') + ' · ' + esc(team ? team.name : (p.team_name || 'LGCHL')) + '</small></div></div>' +
        '<p class="lg-line num">' + esc(p.goals) + ' G · ' + esc(p.assists) + ' A · ' + esc(p.points) + ' PTS · ' + (win ? sgn(p.plus_minus) : ppg + ' P/GP') + ' · ' + esc(p.gp) + ' GP</p></article>';
    };
    $('lgStreakEyebrow').textContent = recent ? 'Players · last two game nights' : 'Players · season so far · 6+ GP';
    hot.innerHTML = heaters.map(p => card(p, true)).join('');
    cold.innerHTML = skids.map(p => card(p, false)).join('');
    tint(hot); tint(cold);
  }

  /* ---------- Upset Alert: lower-ranked teams beating the elite ---------- */
  function renderUpsets(games, ranked) {
    const box = $('lgUpsets');
    if (!box) return;
    const rank = new Map((ranked || []).map(t => [Number(t.lg_team_id), t]));
    const finals = (games || []).filter(g => g.status === 'final' && [g.away_score, g.home_score].every(v => v != null && Number.isFinite(Number(v))) && Number(g.away_score) !== Number(g.home_score));
    if (!finals.length || !rank.size) { show('lgUpsetSec', false); return; }
    const lastWeek = Math.max(...finals.map(g => Number(g.week) || 0));
    const ups = finals.filter(g => Number(g.week) === lastWeek).map(g => {
      const awayWon = Number(g.away_score) > Number(g.home_score);
      const w = rank.get(Number(awayWon ? g.away_lg_team_id : g.home_lg_team_id)), l = rank.get(Number(awayWon ? g.home_lg_team_id : g.away_lg_team_id));
      return w && l ? { g, w, l, gap: w.rank - l.rank, ws: awayWon ? g.away_score : g.home_score, ls: awayWon ? g.home_score : g.away_score } : null;
    }).filter(x => x && x.gap >= 15).sort((a, b) => b.gap - a.gap || a.l.rank - b.l.rank);
    // one upset per beaten team keeps the board varied
    const seen = new Set(), picks = [];
    for (const u of ups) { if (picks.length < 4 && !seen.has(u.l.lg_team_id)) { picks.push(u); seen.add(u.l.lg_team_id); } }
    if (!picks.length) { show('lgUpsetSec', false); return; }
    $('lgUpsetEyebrow').textContent = 'Week ' + lastWeek + ' · biggest shocks';
    box.innerHTML = picks.map(u => '<article class="card tinted lg-card lg-upset" data-logo="' + logo(u.w.lg_team_id) + '">' + wm(u.w.lg_team_id) +
      '<div class="lg-upset-vs"><div><img src="' + logo(u.w.lg_team_id) + '" alt=""><small>No. ' + u.w.rank + '</small></div><b class="num">' + esc(u.ws) + '–' + esc(u.ls) + '</b><div><img src="' + logo(u.l.lg_team_id) + '" alt=""><small>No. ' + u.l.rank + '</small></div></div>' +
      '<h3 class="lg-upset-title">' + esc(u.w.nickname || u.w.name) + ' stun ' + esc(u.l.nickname || u.l.name) + '</h3>' +
      '<p class="lg-line">' + u.gap + ' spots apart in the power index · ' + esc(F.day.format(new Date(u.g.game_at))) + '</p></article>').join('');
    tint(box);
  }

  /* ---------- Players of the Week + Trending Now (saved season totals, compared) ---------- */
  function playerCard(p, teams, tag) {
    const team = teams.get(Number(p.lg_team_id));
    const goalie = p.player_kind === 'goalie';
    const sv = goalie && Number(p.shots_against) > 0 ? (Number(p.saves) / Number(p.shots_against)) : null;
    return '<article class="card tinted lg-card lg-form-card" data-logo="' + logo(p.lg_team_id) + '">' + wm(p.lg_team_id) +
      (tag ? '<p class="lg-potw-tag">' + esc(tag) + '</p>' : '') +
      '<div class="lg-card-head"><img src="' + logo(p.lg_team_id) + '" alt=""><div><b>' + esc(p.gamertag) + '</b><small>' + esc(p.position || (goalie ? 'G' : '')) + ' · ' + esc(team ? team.name : 'LGCHL') + '</small></div></div>' +
      (goalie
        ? '<div class="lg-jump"><b class="num">' + (sv == null ? '—' : sv.toFixed(3).replace(/^0/, '')) + '</b><span>save % · ' + esc(p.gp) + ' GP</span></div><p class="lg-line num">' + esc(p.saves) + ' saves · ' + esc(p.goals_against) + ' GA</p>'
        : '<div class="lg-jump"><b class="num">' + esc(p.points) + '</b><span>points in ' + esc(p.gp) + ' GP</span></div><p class="lg-line num">' + esc(p.goals) + ' G · ' + esc(p.assists) + ' A · ' + sgn(p.plus_minus) + ' · ' + esc(p.shots) + ' SOG</p>') +
      '</article>';
  }

  async function renderForm(teams, games) {
    const upcoming = (games || []).filter(g => g.status !== 'final').map(g => Number(g.week)).filter(Boolean);
    const nextWeek = upcoming.length ? Math.min(...upcoming) : null;
    const [wk, tr] = await Promise.allSettled([
      read('lgchl_public_week_players', { select: 'week,week_complete,player_kind,gamertag,position,lg_team_id,gp,goals,assists,points,plus_minus,shots,saves,shots_against,goals_against', order: 'points.desc,goals.desc,gamertag.asc', limit: '400' }),
      read('lgchl_public_trending_players', { select: 'player_kind,gamertag,position,lg_team_id,gp,goals,assists,points,plus_minus,shots,since_at', player_kind: 'eq.skater', order: 'points.desc,goals.desc,gp.asc,gamertag.asc', limit: '6' })
    ]);
    // Players of the Week: top 3 skaters + best goalie (min 25 shots faced).
    const week = wk.status === 'fulfilled' ? wk.value : [];
    const skaters = week.filter(p => p.player_kind === 'skater' && Number(p.points) > 0).slice(0, 3);
    const goalie = week.filter(p => p.player_kind === 'goalie' && Number(p.shots_against) >= 25)
      .sort((a, b) => Number(b.saves) / Number(b.shots_against) - Number(a.saves) / Number(a.shots_against))[0];
    if (skaters.length) {
      const w = skaters[0].week, done = skaters[0].week_complete !== false;
      $('lgWeekPlayersNote').textContent = 'Week ' + w + (done ? ' · the league\'s top performers, game week totals.' : ' so far · the league\'s top performers, updated after every game night.');
      $('lgWeekPlayers').innerHTML = skaters.map((p, i) => playerCard(p, teams, ['First star', 'Second star', 'Third star'][i])).join('') + (goalie ? playerCard(goalie, teams, 'Goalie of the week') : '');
    } else {
      $('lgWeekPlayersNote').textContent = 'Three stars and a goalie of the week, every week.';
      $('lgWeekPlayers').innerHTML = '<article class="card lg-card lg-soon"><span class="wm wm-lg lg-wm-league" aria-hidden="true"></span><p class="lg-potw-tag">Coming up</p><h3>' + (nextWeek ? 'Week ' + nextWeek + ' stars' : 'This week\'s stars') + ' drop after Tuesday\'s games</h3><p>The top three skaters and the goalie of the week, straight from the game-week totals.</p></article>';
    }
    // Trending now.
    const trend = tr.status === 'fulfilled' ? tr.value.filter(p => Number(p.points) > 0) : [];
    if (trend.length) {
      $('lgTrendNote').textContent = 'Most points over the last two game nights' + (tr.value[0] && tr.value[0].since_at ? ' (LG totals since ' + F.day.format(new Date(tr.value[0].since_at)) + ')' : '') + '.';
      $('lgTrendingRecords').innerHTML = trend.map(p => playerCard(p, teams, null)).join('');
    } else {
      $('lgTrendNote').textContent = 'The hottest sticks over the last two game nights.';
      $('lgTrendingRecords').innerHTML = '<article class="card lg-card lg-soon"><span class="wm wm-lg lg-wm-league" aria-hidden="true"></span><p class="lg-potw-tag">Coming up</p><h3>First board after Sunday night</h3><p>Who\'s piling up points right now. Updated after every game night.</p></article>';
    }
    tint($('lgWeekPlayers')); tint($('lgTrendingRecords'));
  }

  /* ---------- Players of the Night (per-night LG season-stat changes) ---------- */
  const NIGHT_COLS = 'night,night_finals,night_final_goals,player_kind,gamertag,position,lg_team_id,gp,goals,assists,points,plus_minus,shots,saves,shots_against,goals_against,since_at,through_at';
  const GOTN_MIN_SHOTS = 50;
  const skaterOrder = (a, b) => Number(b.points) - Number(a.points) || Number(b.goals) - Number(a.goals) || Number(b.shots) - Number(a.shots) || String(a.gamertag).localeCompare(String(b.gamertag));
  const svOf = p => Number(p.shots_against) > 0 ? Number(p.saves) / Number(p.shots_against) : -1;
  function pickNight(rows) {
    const night = rows.map(r => r.night).sort().pop();
    const list = rows.filter(r => r.night === night);
    const skaters = list.filter(p => p.player_kind === 'skater' && Number(p.points) > 0).sort(skaterOrder);
    const goalies = list.filter(p => p.player_kind === 'goalie' && Number(p.shots_against) >= GOTN_MIN_SHOTS)
      .sort((a, b) => svOf(b) - svOf(a) || Number(b.saves) - Number(a.saves) || String(a.gamertag).localeCompare(String(b.gamertag)));
    const goals = list.filter(p => p.player_kind === 'skater').reduce((a, p) => a + Number(p.goals || 0), 0);
    return { night, list, skaters, goalies, goals, finals: Number(list[0]?.night_finals || 0), finalGoals: Number(list[0]?.night_final_goals || 0) };
  }
  async function renderNight(teams) {
    const box = $('lgNightPlayers'); if (!box) return;
    let rows = [];
    try { rows = await read('lgchl_public_night_players', { select: NIGHT_COLS, order: 'night.desc', limit: '3000' }); } catch { rows = []; }
    if (!rows.length) {
      box.innerHTML = '<article class="card lg-card lg-soon"><span class="wm wm-lg lg-wm-league" aria-hidden="true"></span><p class="lg-potn-tag">Coming up</p><h3>Players of the Night drop after the next game night</h3><p>Three stars, the top sticks and the goalie of the night, from the LG season totals before and after each night.</p></article>';
      $('lgNightCoverage').textContent = ''; return;
    }
    const n = pickNight(rows);
    const day = F && F.day ? F.day.format(new Date(n.night + 'T16:00:00Z')) : n.night;
    $('lgNightEyebrow').textContent = 'Game night · ' + day;
    const stars = n.skaters.slice(0, 3), g = n.goalies[0];
    const multi = n.skaters.filter(p => Number(p.points) >= 2 * Math.max(1, Number(p.gp))).length;
    const leadersBy = k => n.skaters.slice().sort((a, b) => Number(b[k]) - Number(a[k]) || skaterOrder(a, b)).slice(0, 5);
    const rowsHtml = (arr, k, label) => '<ol class="lg-potn-list num">' + arr.map((p, i) => '<li><span class="lg-potn-rk">' + (i + 1) + '</span><img src="' + logo(p.lg_team_id) + '" alt="" loading="lazy"><b>' + esc(p.gamertag) + '</b><small>' + esc((teams.get(Number(p.lg_team_id)) || {}).name || 'LGCHL') + '</small><span class="lg-potn-v">' + esc(p[k]) + ' ' + label + '</span></li>').join('') + '</ol>';
    box.innerHTML = stars.map((p, i) => playerCard(p, teams, ['First star', 'Second star', 'Third star'][i])).join('') +
      (g ? playerCard(g, teams, 'Goalie of the night') : '') +
      '<article class="card lg-card lg-potn-board"><p class="lg-potn-tag">Top sticks · points</p>' + rowsHtml(leadersBy('points'), 'points', 'PTS') + '</article>' +
      '<article class="card lg-card lg-potn-board"><p class="lg-potn-tag">Top sticks · goals</p>' + rowsHtml(leadersBy('goals'), 'goals', 'G') +
      '<p class="lg-line num">' + multi + ' skater' + (multi === 1 ? '' : 's') + ' averaged two points a game or better.</p></article>';
    const pct = n.finalGoals ? Math.round(100 * n.goals / n.finalGoals) : null;
    $('lgNightCoverage').textContent = 'From LG season totals saved before and after the night: ' + n.goals + ' of ' + n.finalGoals + ' goals in ' + n.finals + ' finals accounted for' + (pct != null ? ' (' + pct + '%)' : '') +
      '. Players without a saved pre-night total are not ranked. Goalie of the night needs ' + GOTN_MIN_SHOTS + '+ shots faced.';
    tint(box);
  }

  window.LGCHLSegments = { renderRaces, renderPlayerStreaks, renderUpsets, renderForm, renderNight, pickNight };
})();
