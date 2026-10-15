/* Calgary Hitmen War Room rooms: Scouting (hitmen-scouting.html), Lineup Lab (hitmen-lineup.html),
   Locker Room (hitmen-locker.html) and My Stall (hitmen-stall.html). The room is <body data-room>.
   Read-only, same as Headquarters (hitmen-hq.js): editing stays on the full tools each room links to.
   Public reads (WMDesk.read, publishable key): lgchl_standings_current, lgchl_games, lg_player_season_stats.
   Signed-in management reads (VVHLBackend.db, same RLS as the other War Room pages):
   hitmen_opponent_player_stats, hitmen_opponent_roster_players, hitmen_opponent_pregame_reports,
   lineups, lineup_slots, hitmen_battle_plans, team_player_lockers, team_line_weekly_reports,
   team_player_game_reports, storage hitmen-player-images (signed URL for your own stall photo).
   Access rule matches hitmen-hq.js: admin/commissioner, or an active Calgary membership with role
   owner, gm, agm or scout. */
(() => {
  'use strict';
  const D = window.WMDesk, B = window.VVHLBackend;
  if (!D || !B) return;
  const { $, esc, nb, F, etDate, ordinal, logo, read, tint } = D;
  D.menu();

  const TEAM = 'b0bcbdda-da9d-419d-8f61-b34937966d49';
  const CGY = 412, SEASON = 55;
  const HITMEN_ROLES = new Set(['owner', 'gm', 'agm', 'scout']);
  const ROOM = document.body.dataset.room;
  const db = B.db;

  /* ---------- access ---------- */
  function access(state) {
    if (!state?.user) return null;
    const pr = String(state.profile?.role || '').toLowerCase();
    if (pr === 'admin' || pr === 'commissioner') return pr;
    const m = (state.memberships || []).find(x => x.team_id === TEAM && x.active !== false && HITMEN_ROLES.has(String(x.role || '').toLowerCase()));
    return m ? String(m.role).toLowerCase() : null;
  }
  let started = false;
  function gate(state) {
    const role = access(state);
    $('hqApp').hidden = !role;
    $('hqGate').hidden = !!role;
    if (!role) {
      $('hqLocked').innerHTML = !state?.user
        ? '<b>Sign in to continue.</b> The War Room is limited to Calgary Hitmen management (Owner, GM, AGM or Scout).'
        : '<b>Calgary Hitmen management access not assigned.</b> This page is limited to authorized Owner, GM, AGM or Scout accounts.';
      return;
    }
    if (!started) { started = true; who(state, role); load(state).catch(e => fail(e)); }
  }
  function fail(e) {
    console.error(e);
    const box = $('roomBody');
    if (box) box.innerHTML = '<p class="hq-loading">This room could not load right now. Refresh to try again.</p>';
  }

  /* ---------- helpers ---------- */
  const q = async p => { const { data, error } = await p; if (error) throw error; return data || []; };
  const safe = p => p.then(v => ({ ok: true, v }), e => ({ ok: false, e }));
  const rec = t => t.w + '-' + t.l + '-' + t.otl;
  const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const whenTxt = v => F.day.format(new Date(v)) + ' · ' + F.time.format(new Date(v)) + ' ET';
  const weekday = v => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'long' }).format(new Date(v));
  const chip = (cls, txt) => '<span class="chip ' + cls + '">' + esc(txt) + '</span>';
  const sign = n => n == null || n === '' ? '–' : (Number(n) > 0 ? '+' : '') + n;
  const pct3 = v => { if (v == null || v === '') return '–'; let n = Number(v); if (n > 1) n /= 100; return n.toFixed(3).replace(/^0/, ''); };
  const fix2 = v => v == null || v === '' ? '–' : Number(v).toFixed(2);
  const streakTxt = s => { const m = /^-?(\d+)\s*([A-Za-z]+)$/.exec(String(s || '').trim()); return m && +m[1] > 0 ? (/^w/i.test(m[2]) ? 'Won ' : 'Lost ') + m[1] : '–'; };
  const POS = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];
  const posTint = p => p === 'G' ? '120,160,255' : /D$/.test(p) ? '200,210,225' : '212,42,42';

  async function who(state, role) {
    const label = { admin: 'Admin', commissioner: 'Commissioner', owner: 'Owner', gm: 'GM', agm: 'AGM', scout: 'Scout' }[role] || role;
    let name = state.profile?.display_name || state.user?.email || '';
    try {
      const l = await q(db.from('team_player_lockers').select('gamertag').eq('team_id', TEAM).eq('season', SEASON).eq('user_id', state.user.id).limit(1));
      if (l[0]?.gamertag) name = l[0].gamertag;
    } catch { /* keep the profile name */ }
    $('hqWhoName').textContent = name;
    $('hqWhoRole').textContent = label + ' · signed in';
    $('hqWho').hidden = false;
  }

  /* ---------- official LG league data shared by every room ---------- */
  async function league() {
    const [standR, gamesR] = await Promise.all([
      safe(read('lgchl_standings_current', { select: 'lg_team_id,name,league,conference,gp,w,l,otl,pts,gf,ga,streak,last10,home,away,logo_path,standings_at' })),
      safe(read('lgchl_games', { select: 'lg_game_id,week,game_at,status,home_lg_team_id,away_lg_team_id,home_score,away_score', season: 'eq.' + SEASON, or: '(home_lg_team_id.eq.' + CGY + ',away_lg_team_id.eq.' + CGY + ')', order: 'game_at.asc', limit: '300' }))
    ]);
    const stand = standR.ok ? standR.v : [], games = gamesR.ok ? gamesR.v : [];
    const byId = new Map(stand.map(t => [t.lg_team_id, t]));
    const cgy = byId.get(CGY);
    const conf = stand.filter(t => cgy && t.league === cgy.league && t.conference === cgy.conference)
      .sort((a, b) => b.pts - a.pts || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga) || a.name.localeCompare(b.name));
    const finals = games.filter(g => g.status === 'final' && g.home_score != null && g.away_score != null);
    const upcoming = games.filter(g => g.status !== 'final' && Date.parse(g.game_at) > Date.now() - 3 * 3600e3);
    const nextNight = upcoming.length ? upcoming.filter(g => etDate(g.game_at) === etDate(upcoming[0].game_at)) : [];
    const isHome = g => g.home_lg_team_id === CGY;
    const oppOf = g => isHome(g) ? g.away_lg_team_id : g.home_lg_team_id;
    const cs = g => isHome(g) ? g.home_score : g.away_score;
    const os = g => isHome(g) ? g.away_score : g.home_score;
    const byName = new Map(stand.map(t => [strip(t.name), t]));
    return {
      ok: standR.ok && gamesR.ok, stand, byId, byName, cgy, conf, finals, upcoming, nextNight, isHome, oppOf, cs, os,
      lastFinalAt: finals.length ? Date.parse(finals[finals.length - 1].game_at) : 0,
      rankOf: id => { const i = conf.findIndex(t => t.lg_team_id === id); return i < 0 ? '–' : ordinal(i + 1); },
      series: id => finals.filter(f => oppOf(f) === id)
    };
  }
  async function seasonStats() {
    const r = await safe(read('lg_player_season_stats', { select: 'lg_user_id,player_kind,games_played,stats,fetched_at', lg_team_id: 'eq.' + CGY, season: 'eq.' + SEASON, season_type: 'eq.regular' }));
    const rows = r.ok ? r.v : [];
    return { map: new Map(rows.map(s => [Number(s.lg_user_id), s])), at: rows.reduce((m, s) => Math.max(m, Date.parse(s.fetched_at) || 0), 0) };
  }
  const statLine = (s, short) => {
    if (!s) return '';
    const x = s.stats || {};
    if (s.player_kind === 'goalie') return (s.games_played ?? x.ggp ?? '–') + ' GP · ' + (x.record || '–') + ' · ' + pct3(x.savep) + ' SV%';
    return short ? (x.goals ?? 0) + ' G · ' + (x.assists ?? 0) + ' A · ' + (x.points ?? 0) + ' P'
      : (s.games_played ?? x.gp ?? '–') + ' GP · ' + (x.goals ?? 0) + '-' + (x.assists ?? 0) + '-' + (x.points ?? 0) + ' · ' + sign(x.plusminus);
  };
  async function lockers() {
    return q(db.from('team_player_lockers').select('id,player_id,user_id,gamertag,position,secondary_position,jersey_number,jersey_name,management_role,roster_class,lg_user_id,handedness,height_label,country_code,chel_player_image_path')
      .eq('team_id', TEAM).eq('season', SEASON).order('gamertag'));
  }

  async function load(state) {
    const L = await league();
    if (!L.ok) { $('roomBody').innerHTML = '<p class="hq-loading">The official LG standings or schedule could not load right now. Refresh to try again.</p>'; return; }
    if (ROOM === 'scouting') return scouting(L);
    if (ROOM === 'lineup') return lineup(L);
    if (ROOM === 'locker') return locker(L, state);
    if (ROOM === 'stall') return stall(L, state);
  }

  /* =================================================================== Scouting */
  async function scouting(L) {
    const opps = (L.nextNight.length ? L.nextNight : L.upcoming.slice(0, 3)).map(g => ({ g, t: L.byId.get(L.oppOf(g)) })).filter(o => o.t);
    if (!opps.length) { $('roomBody').innerHTML = '<p class="hq-empty">No upcoming Calgary games in the official LG schedule.</p>'; return; }
    const first = opps[0].g;
    $('scEye').textContent = (L.nextNight.length ? weekday(first.game_at) + '’s opponents' : 'Next opponents') + ' · ' + F.longDay.format(new Date(first.game_at));
    const want = strip(new URLSearchParams(location.search).get('opp'));
    let cur = Math.max(0, opps.findIndex(o => strip(o.t.name) === want));
    const cache = new Map();

    const renderSeg = () => {
      $('oppSeg').innerHTML = opps.map((o, i) => '<button type="button" role="tab" aria-selected="' + (i === cur) + '" data-i="' + i + '"><img src="' + logo(o.t.logo_path) + '" alt=""><span style="color:inherit;font-size:inherit;margin:0">' + esc(o.t.name.replace(/\s+\S+$/, '')) + '</span></button>').join('');
    };
    $('oppSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      cur = +b.dataset.i; renderSeg(); show();
      history.replaceState(null, '', '?opp=' + encodeURIComponent(opps[cur].t.name));
    });
    renderSeg();

    async function fetchOpp(name) {
      if (cache.has(name)) return cache.get(name);
      const p = Promise.all([
        safe(q(db.from('hitmen_opponent_player_stats').select('gamertag,position,source,games_played,goals,assists,points,plus_minus,goalie_save_pct,goalie_gaa,source_updated_at').eq('team_id', TEAM).eq('season', SEASON).eq('opponent_name', name))),
        safe(q(db.from('hitmen_opponent_roster_players').select('gamertag,position,roster_role,source_updated_at').eq('team_id', TEAM).eq('season', SEASON).eq('opponent_name', name).eq('active', true))),
        safe(q(db.from('hitmen_opponent_pregame_reports').select('id,report,created_at,evidence_summary').eq('team_id', TEAM).eq('season', SEASON).eq('opponent_name', name).order('created_at', { ascending: false }).limit(1)))
      ]);
      cache.set(name, p);
      return p;
    }

    async function show() {
      const { g, t } = opps[cur], home = L.isHome(g);
      const series = L.series(t.lg_team_id), w = series.filter(f => L.cs(f) > L.os(f)).length, l = series.length - w;
      const h2hTxt = series.length ? series.map(f => (L.cs(f) > L.os(f) ? 'W ' : 'L ') + L.cs(f) + '–' + L.os(f) + ' · ' + F.md.format(new Date(f.game_at))).join(' / ') : 'First meeting';
      const src = logo(t.logo_path);
      const head = '<div class="card tinted" data-logo="' + src + '" style="padding:0"><span class="wm wm-lg" aria-hidden="true" style="--logo:url(\'' + src + '\')"></span>' +
        '<div class="file-head"><img src="' + src + '" alt=""><div style="min-width:0"><span class="when">' + esc(whenTxt(g.game_at)) + ' · ' + (home ? 'at home' : 'on the road') + '</span><h2>' + (home ? 'vs ' : 'at ') + esc(t.name) + '</h2></div>' +
        '<div class="h2h"><small>Calgary H2H</small><b style="color:' + (w >= l ? 'var(--ok)' : 'var(--crit)') + '">' + w + '-' + l + '</b><span>' + esc(h2hTxt) + '</span></div></div>' +
        '<dl class="file-stats"><div><dt>Record</dt><dd>' + rec(t) + '</dd></div><div><dt>WHL East</dt><dd>' + L.rankOf(t.lg_team_id) + '</dd></div><div><dt>Last 10</dt><dd>' + esc(t.last10 || '–') + '</dd></div><div><dt>' + (home ? 'On road' : 'At home') + '</dt><dd>' + esc((home ? t.away : t.home) || '–') + '</dd></div><div><dt>GF / GA</dt><dd>' + t.gf + '/' + t.ga + '</dd></div><div><dt>Streak</dt><dd>' + streakTxt(t.streak) + '</dd></div></dl></div>';
      $('oppFile').innerHTML = head + '<p class="hq-loading">Loading the opponent file…</p>';
      tint($('oppFile'));
      const [statR, rosR, repR] = await fetchOpp(t.name);
      if (opps[cur].t !== t) return;

      /* players: LG CHL season lines first, EA club totals only where LG has nothing */
      const roster = rosR.ok ? rosR.v : [];
      const posOf = new Map(roster.map(r => [strip(r.gamertag), r.position]));
      const best = new Map();
      (statR.ok ? statR.v : []).forEach(r => { const k = strip(r.gamertag); if (k && (!best.has(k) || (r.source === 'lg_chl' && best.get(k).source !== 'lg_chl'))) best.set(k, r); });
      const rows = [...best.values()];
      const lgOnly = rows.some(r => r.source === 'lg_chl');
      const pool = lgOnly ? rows.filter(r => r.source === 'lg_chl') : rows;
      const isG = r => r.goalie_save_pct != null || (posOf.get(strip(r.gamertag)) || r.position) === 'G';
      const skaters = pool.filter(r => !isG(r) && r.points != null).sort((a, b) => b.points - a.points || b.goals - a.goals).slice(0, 5);
      const goalies = pool.filter(r => isG(r) && r.goalie_save_pct != null).sort((a, b) => (b.games_played || 0) - (a.games_played || 0)).slice(0, 2);
      const max = Math.max(1, ...skaters.map(d => d.points || 0));
      const danger = '<div class="leaders card danger" aria-label="Danger players"><div class="leaders-head"><span>Danger players</span><small>' + (lgOnly ? 'LG CHL season stats' : 'EA club totals') + ' · GP · G-A-P · +/-</small></div>' +
        (skaters.length ? skaters.map((d, i) => '<div class="lrow" style="--pw:' + Math.round((d.points || 0) / max * 100) + '%"><i>' + (i + 1) + '</i><span class="pos">' + esc(posOf.get(strip(d.gamertag)) || d.position || '–') + '</span><b>' + esc(d.gamertag) + '</b><em>' + (d.games_played ?? '–') + ' GP · ' + (d.goals ?? 0) + '-' + (d.assists ?? 0) + '-' + (d.points ?? 0) + ' · ' + sign(d.plus_minus) + '</em><strong>' + (d.points ?? 0) + '</strong></div>').join('')
          : '<p class="hq-empty">' + (statR.ok ? 'No player stats imported for ' + esc(t.name) + ' yet. Run the opponent refresh in Opponent Intelligence.' : 'Player stats could not load.') + '</p>') +
        (goalies.length ? '<div class="gk">' + goalies.map(gk => '<div><small>Goalie · ' + (gk.games_played ?? '–') + ' GP · ' + fix2(gk.goalie_gaa) + ' GAA</small><b>' + esc(gk.gamertag) + '</b><span>' + pct3(gk.goalie_save_pct) + '</span></div>').join('') + '</div>' : '') + '</div>';

      /* pregame report: the "What can hurt us" and "Plan to win" sections */
      const rep = repR.ok ? repR.v[0] : null;
      let report;
      if (!rep) {
        report = '<div class="report card" aria-label="Pregame report"><div class="leaders-head"><span>Pregame report</span>' + chip(repR.ok ? 'crit' : 'info', repR.ok ? 'No report' : 'Unavailable') + '</div>' +
          '<p class="hq-empty">' + (repR.ok ? 'No pregame report is saved for ' + esc(t.name) + ' yet.' : 'Pregame reports could not load.') + '</p>' +
          '<div class="report-foot"><span class="src">Reports are written in Opponent Intelligence.</span><a class="btn btn-gold btn-sm" href="hitmen-opponents.html">Write a report <span class="arr">→</span></a></div></div>';
      } else {
        const text = String(rep.report || '');
        const parts = text.split(/^##\s+/m);
        const section = re => { const p = parts.find(x => re.test(x.split('\n')[0])); return p ? p.split('\n').slice(1).map(s => s.trim()).filter(s => /^[-*•]\s+/.test(s)).map(s => s.replace(/^[-*•]\s+/, '')) : []; };
        const lede = (parts[0].split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)[1] || '').slice(0, 320);
        const hurt = section(/hurt/i), plan = section(/plan/i);
        const fresh = Date.parse(rep.created_at) >= L.lastFinalAt;
        report = '<div class="report card" aria-label="Pregame report"><div class="leaders-head"><span>Pregame report</span>' + chip(fresh ? 'ok' : 'warn', F.day.format(new Date(rep.created_at)) + (fresh ? ' · current' : ' · before the latest games')) + '</div>' +
          '<div class="report-body">' + (lede ? '<p class="lede">' + esc(lede) + '</p>' : '') +
          (hurt.length ? '<h4>What can hurt us</h4><ul>' + hurt.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
          (plan.length ? '<h4>Plan to win</h4><ul>' + plan.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
          (!hurt.length && !plan.length ? '<p class="lede">' + esc(text.slice(0, 600)) + '</p>' : '') + '</div>' +
          '<div class="report-foot"><span class="src">Written ' + esc(whenTxt(rep.created_at)) + ' · excerpt</span><a class="btn btn-gold btn-sm" href="hitmen-scouting-report.html?report=' + encodeURIComponent(rep.id) + '">' + (fresh ? 'Full report' : 'Full report · older evidence') + ' <span class="arr">→</span></a></div></div>';
      }

      /* LG roster by position; training camp faded */
      const order = ['C', 'LW', 'RW', 'LD', 'RD', 'G'];
      const groups = order.map(p => [p, roster.filter(r => r.position === p).sort((a, b) => (a.roster_role === 'Training Camp') - (b.roster_role === 'Training Camp') || String(a.gamertag).localeCompare(String(b.gamertag)))]).filter(x => x[1].length);
      const rosAt = roster.reduce((m, r) => Math.max(m, Date.parse(r.source_updated_at) || 0), 0);
      const rosterHtml = roster.length
        ? '<div class="band-head"><div><p class="eyebrow opp-eye">LG roster · ' + roster.length + ' players · faded = training camp' + (rosAt ? ' · ' + esc(whenTxt(rosAt)) : '') + '</p></div></div>' +
          '<div class="roster">' + groups.map(([p, list]) => '<div class="roster-col"><h5>' + p + '</h5>' + list.map(r => { const tc = r.roster_role === 'Training Camp'; return '<div class="rp' + (tc ? ' tc' : '') + '"><span>' + esc(r.gamertag) + '</span><i>' + (tc ? 'TC' : 'ACT') + '</i></div>'; }).join('') + '</div>').join('') + '</div>'
        : '<p class="hq-empty">' + (rosR.ok ? 'No LG roster imported for ' + esc(t.name) + ' yet.' : 'The LG roster could not load.') + '</p>';

      const six = rep?.evidence_summary?.lineups?.opponent;
      const posted = '<div class="report card"><div class="leaders-head"><span>Tonight’s opponent six</span></div>' + (six ? '<a class="posted-report-link" href="hitmen-scouting-report.html?report=' + encodeURIComponent(rep.id) + '"><div class="hq-opp-six">' + POS.map(p => '<span><i>' + p + '</i> ' + esc(six[p] || 'Not posted') + '</span>').join('') + '</div><b>Open pregame scouting report →</b></a>' : '<p class="hq-empty">No posted opponent six captured yet.</p>') + '</div>';
      $('oppFile').innerHTML = head + posted + '<div class="scout-grid">' + report + danger + '</div>' + '<div class="report-foot"><a class="btn btn-line btn-sm" href="hitmen-lineup.html?game=' + Number(g.lg_game_id) + '#opponentHistory">Opponent intelligence · all games played →</a></div>' + rosterHtml;
      tint($('oppFile'));
    }
    show();
  }

  /* =================================================================== Lineup Lab */
  async function lineup(L) {
    const games = L.nextNight;
    if (!games.length) { $('roomBody').innerHTML = '<p class="hq-empty">No upcoming game night is scheduled.</p>'; return; }
    const date = etDate(games[0].game_at);
    const [lockR, statS, lineR, schedR, repR, planR] = await Promise.all([
      safe(lockers()), seasonStats(),
      safe(q(db.from('lineups').select('id,game_date,game_label,opponent_name,status,updated_at').eq('team_id', TEAM).eq('lineup_type', 'game').eq('game_date', date).order('updated_at', { ascending: false }))),
      safe(q(db.from('hitmen_schedule_games').select('id,scheduled_at,opponent_name').eq('team_id', TEAM).eq('season', SEASON))),
      safe(q(db.from('hitmen_opponent_pregame_reports').select('id,scheduled_game_id,opponent_name,report,evidence_summary,created_at').eq('team_id', TEAM).eq('season', SEASON).order('created_at', { ascending: false }).limit(300))),
      safe(q(db.from('hitmen_battle_plans').select('schedule_game_id,opponent_name,keys_to_win,matchup_assignments,reminders,status,updated_at').eq('team_id', TEAM).eq('game_date', date).order('updated_at', { ascending: false })))
    ]);
    const lock = lockR.ok ? lockR.v : [], byPlayer = new Map(lock.map(l => [l.player_id, l]));
    const byTag = new Map(lock.map(l => [strip(l.gamertag), l]));
    const lines = lineR.ok ? lineR.v : [];
    const slotsR = lines.length ? await safe(q(db.from('lineup_slots').select('lineup_id,slot,player_id,jersey_number').in('lineup_id', lines.map(x => x.id)))) : { ok: true, v: [] };
    const schedAt = new Map((schedR.ok ? schedR.v : []).map(s => [Date.parse(s.scheduled_at), s]));
    const model = games.map(g => {
      const t = L.byId.get(L.oppOf(g)), sg = schedAt.get(Date.parse(g.game_at));
      const candidates = (repR.ok ? repR.v : []).filter(r => sg && r.scheduled_game_id === sg.id);
      const report = candidates.find(r => r.evidence_summary?.lineups?.calgary && r.evidence_summary?.lineups?.opponent) || candidates[0];
      const line = lines.find(l => strip(l.opponent_name) === strip(t?.name));
      const six = report?.evidence_summary?.lineups?.calgary || Object.fromEntries((slotsR.ok ? slotsR.v : []).filter(s => line && s.lineup_id === line.id && /^L1_/.test(s.slot)).map(s => [s.slot.slice(3), byPlayer.get(s.player_id)?.gamertag]));
      const plan = (planR.ok ? planR.v : []).find(p => sg && p.schedule_game_id === sg.id);
      return { g, t, report, six, plan };
    });
    const want = new URLSearchParams(location.search).get('game');
    let selected = Math.max(0, model.findIndex(m => String(m.g.lg_game_id) === want));
    const historyCache = new Map();
    const fullHref = m => m.report ? 'hitmen-scouting-report.html?report=' + encodeURIComponent(m.report.id) : 'hitmen-scouting.html?opp=' + encodeURIComponent(m.t?.name || '');
    const reportHtml = report => String(report || '').split(/\n+/).map(line => /^##\s/.test(line) ? '<h4>' + esc(line.replace(/^##\s*/, '')) + '</h4>' : '<p class="ctx">' + esc(line.replace(/^[-*]\s*/, '• ')) + '</p>').join('');
    const sixHtml = (six, own) => POS.map(pos => {
      const tag = six?.[pos], lk = tag && byTag.get(strip(tag));
      const st = own && lk?.lg_user_id ? statS.map.get(Number(lk.lg_user_id)) : null;
      const source = !own && model[selected].report?.evidence_summary?.posted_player_stats?.find(p => p.position === pos);
      const stats = st ? statLine(st) : source?.line || '';
      return '<div class="slot card tinted" style="--tc:' + posTint(pos) + '"><div class="sp"><i>' + pos + '</i>' + (own && lk?.jersey_number ? '<span class="num">#' + esc(lk.jersey_number) + '</span>' : '') + '</div><b>' + esc(tag || 'Not posted') + '</b>' + (stats ? '<span class="line">' + esc(stats) + '</span>' : '') + '</div>';
    });
    async function showHistory(m) {
      const host = $('opponentHistory');
      host.innerHTML = '<p class="hq-loading">Loading opponent intelligence…</p>';
      const id = m.t?.lg_team_id;
      if (!id) { host.innerHTML = '<p class="hq-empty">Opponent unavailable.</p>'; return; }
      if (!historyCache.has(id)) historyCache.set(id, safe(read('lgchl_games', { select: 'lg_game_id,game_at,status,home_lg_team_id,away_lg_team_id,home_score,away_score', season: 'eq.' + SEASON, or: '(home_lg_team_id.eq.' + id + ',away_lg_team_id.eq.' + id + ')', order: 'game_at.desc', limit: '300' })));
      const r = await historyCache.get(id);
      if (model[selected] !== m) return;
      const finals = (r.ok ? r.v : []).filter(g => g.status === 'final');
      host.innerHTML = '<div class="leaders-head"><span>Opponent intelligence · ' + esc(m.t.name) + '</span><small>' + m.t.gp + ' GP · ' + rec(m.t) + ' · ' + m.t.pts + ' PTS</small></div><div class="report-foot"><span class="src">All completed Season 55 games · official LG results</span><a class="btn btn-line btn-sm" href="hitmen-scouting.html?opp=' + encodeURIComponent(m.t.name) + '">Full opponent file →</a></div>' +
        (r.ok ? '<div class="opponent-results">' + finals.map(g => {
          const home = g.home_lg_team_id === id, foe = L.byId.get(home ? g.away_lg_team_id : g.home_lg_team_id);
          const a = home ? g.home_score : g.away_score, b = home ? g.away_score : g.home_score;
          return '<a href="https://www.leaguegaming.com/forums/index.php?leaguegaming/league&amp;action=league&amp;page=game&amp;gameid=' + Number(g.lg_game_id) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(F.md.format(new Date(g.game_at))) + '</span><b>' + (home ? 'vs ' : 'at ') + esc(foe?.name || 'Opponent') + '</b><span>' + (a > b ? 'W ' : 'L ') + a + '–' + b + '</span></a>';
        }).join('') + '</div>' : '<p class="hq-empty">Opponent results could not load.</p>');
    }
    function render() {
      const m = model[selected], {g,t,report,six,plan} = m;
      $('nightTabs').innerHTML = model.map((m,i) => '<button type="button" role="tab" aria-selected="' + (i === selected) + '" data-i="' + i + '"><small>Game ' + (i+1) + ' · ' + esc(F.time.format(new Date(m.g.game_at))) + ' ET</small><b>' + (L.isHome(m.g) ? 'vs ' : 'at ') + esc(m.t?.name || 'Opponent') + '</b></button>').join('');
      $('labEye').textContent = weekday(g.game_at) + ' · ' + whenTxt(g.game_at) + ' · ' + (L.isHome(g) ? 'Home' : 'Away');
      $('labTitle').innerHTML = 'Tonight’s <em>six</em>';
      const complete = POS.every(p => six?.[p]);
      $('labChip').innerHTML = chip(complete ? 'ok' : 'warn', complete ? 'Posted LG lineup' : 'Lineup not posted');
      const cards = sixHtml(six, true);
      $('sixF').innerHTML = cards.slice(0,3).join(''); $('sixD').innerHTML = cards.slice(3,5).join(''); $('sixG').innerHTML = cards[5];
      $('rink').querySelector('.rink-head b').textContent = 'Calgary · Game ' + (selected+1);
      $('rinkSrc').textContent = 'Posted positions for this game · LG season stats';
      const dressed = new Set(Object.values(six || {}).map(strip));
      $('bench').innerHTML = lock.filter(l => l.roster_class === 'active_roster' && !dressed.has(strip(l.gamertag))).map(l => '<span>' + esc(l.gamertag) + '<i>' + esc(l.position || '') + '</i></span>').join('');
      $('sheetBody').innerHTML = '<h4>' + esc(t?.name || 'Opponent') + ' · posted six</h4><a class="posted-report-link" href="' + fullHref(m) + '"><div class="opponent-six">' + sixHtml(report?.evidence_summary?.lineups?.opponent, false).join('') + '</div><b>Open pregame scouting report →</b></a>' +
        (report ? '<details class="pregame-excerpt"><summary>Pregame scouting report</summary>' + reportHtml(report.report) + '</details>' : '<p class="ctx">No pregame report saved for this game yet.</p>') +
        '<h4>Battle plan</h4>' + (plan ? '<p class="ctx pre-wrap">' + esc(plan.keys_to_win || '') + '</p><h4>Assignments</h4><p class="ctx pre-wrap">' + esc(plan.matchup_assignments || '') + '</p>' : '<p class="ctx">No battle plan saved for this game yet.</p>');
      $('labNote').textContent = report?.evidence_summary?.captured_at ? 'Lineups checked ' + whenTxt(report.evidence_summary.captured_at) + '. Check LG for changes before puck drop.' : 'Each game uses its own saved lineup and pregame report.';
      showHistory(m);
    }
    $('nightTabs').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; selected = Number(b.dataset.i); render(); history.replaceState(null, '', '?game=' + model[selected].g.lg_game_id); });
    render();
  }

  /* =================================================================== Locker Room */
  async function locker(L, state) {
    const [lockR, statS, lineR] = await Promise.all([
      safe(lockers()), seasonStats(),
      safe(q(db.from('team_line_weekly_reports').select('week,line_label,record,goals_for,goals_against,summary,next_adjustments,updated_at').eq('team_id', TEAM).eq('season', SEASON).order('week', { ascending: false }).limit(12)))
    ]);
    if (!lockR.ok) { $('stalls').innerHTML = '<p class="hq-empty">The locker room could not load.</p>'; return; }
    const lock = lockR.v, active = lock.filter(l => l.roster_class === 'active_roster'), tc = lock.filter(l => l.roster_class === 'tc');
    const me = state.user?.id;
    $('lrEye').textContent = active.length + ' active stalls · ' + active.filter(l => l.user_id).length + ' claimed through Discord';
    const nums = {}; active.forEach(a => { if (a.jersey_number) (nums[a.jersey_number] = nums[a.jersey_number] || []).push(a.gamertag); });
    const dup = Object.entries(nums).filter(([, v]) => v.length > 1);
    if (dup.length) $('dupChip').innerHTML = chip('warn', dup.map(([n, v]) => '#' + n + ' used twice: ' + v.join(', ')).join(' · ')); else $('dupChip').hidden = true;
    $('stalls').innerHTML = active.map(a => {
      const st = a.lg_user_id ? statS.map.get(Number(a.lg_user_id)) : null, mine = me && a.user_id === me;
      return '<a class="stall card' + (mine ? ' me' : '') + '" href="hitmen-stall.html' + (mine ? '' : '?player=' + encodeURIComponent(a.gamertag)) + '"><span class="hs-host" data-hs="' + esc(a.id) + '"></span><span class="pos">' + esc(a.position || '–') + (a.jersey_number ? ' · #' + esc(a.jersey_number) : '') + '</span><b>' + esc(a.gamertag) + '</b><span class="pts">' + esc(statLine(st, true) || 'No LG stats on file') + '</span><span class="tags">' + (a.management_role ? '<span class="role">' + esc(a.management_role) + '</span>' : '') + (a.user_id ? '' : '<span class="open">Unclaimed</span>') + (mine ? '<span>You</span>' : '') + '</span></a>';
    }).join('') || '<p class="hq-empty">No active stalls for Season ' + SEASON + ' yet.</p>';
    if (window.HitmenStall) active.forEach(a => { const h = $('stalls').querySelector('[data-hs="' + CSS.escape(String(a.id)) + '"]'); if (h) HitmenStall.mount(h, { mini: true, empty: !a.jersey_number, name: a.jersey_name || a.gamertag, number: a.jersey_number || '' }); });
    $('tcEye').textContent = tc.length + ' training camp players';
    $('tcList').innerHTML = tc.map(t => '<span><i>' + esc(t.position || '') + '</i>' + esc(t.gamertag) + '</span>').join('') || '<span>No training camp stalls</span>';
    const reports = lineR.ok ? lineR.v : [];
    const wk = reports[0]?.week, latest = reports.filter(r => r.week === wk);
    $('linePerf').innerHTML = latest.length
      ? '<div class="leaders-head"><span>Line performance</span><small>Week ' + esc(wk) + '</small></div>' + latest.map(r => '<div class="ready-row"><b>' + esc(r.line_label || 'Line') + '</b>' + chip('info', (r.record || '–') + (r.goals_for != null ? ' · ' + r.goals_for + '–' + r.goals_against : '')) + '<p>' + esc(r.summary || r.next_adjustments || '') + '</p></div>').join('')
      : '<div class="ready-row"><b>Line performance</b>' + chip('info', lineR.ok ? 'Empty' : 'Unavailable') + '<p>' + (lineR.ok ? 'No weekly line reports are saved for Season ' + SEASON + ' yet. Once lines are reviewed each week, their record, goals for and against, and notes show here.' : 'Line reports could not load.') + '</p></div>';
  }

  /* =================================================================== My Stall */
  async function stall(L, state) {
    const [lockR, statS] = await Promise.all([safe(lockers()), seasonStats()]);
    /* ?player=<gamertag> opens a teammate's stall (read-only); otherwise your own */
    const pick = strip(new URLSearchParams(location.search).get('player'));
    const own = lockR.ok ? lockR.v.find(l => l.user_id === state.user?.id) : null;
    const me = pick && lockR.ok ? lockR.v.find(l => strip(l.gamertag) === pick) || own : own;
    const mine = !!me && me === own;
    if (!me) {
      $('roomBody').innerHTML = '<section class="wr-sec blood band"><div class="wr-in"><div class="ready card" style="max-width:720px"><div class="ready-row"><b>No stall linked</b>' + chip('warn', 'Season ' + SEASON) + '<p>' + (lockR.ok ? 'Your account is not linked to a Calgary stall this season. Claim your stall through Discord, then it shows here. Any player’s stall opens from the Locker Room.' : 'Stalls could not load.') + '</p></div></div>' +
        '<div class="rooms-actions"><a class="btn btn-gold btn-sm" href="hitmen-locker.html">Open the Locker Room <span class="arr">→</span></a></div></div></section>';
      return;
    }
    if (!mine) {
      document.querySelector('.sub-in a[href="hitmen-stall.html"]')?.removeAttribute('aria-current');
      $('meEdit').hidden = true;
      const jp = $('meJersey').closest('.panel');
      jp.querySelector('h4').textContent = 'Jersey';
      jp.querySelector('p').hidden = true;
    }
    const st = me.lg_user_id ? statS.map.get(Number(me.lg_user_id)) : null, x = st?.stats || {};
    const role = me.management_role || 'Player';
    $('meTitle').textContent = me.gamertag;
    $('meMeta').textContent = [me.jersey_number ? '#' + me.jersey_number : '', me.position, me.management_role].filter(Boolean).join(' · ');
    $('meEye').textContent = (mine ? 'My stall · ' : 'Stall · ') + (me.roster_class === 'tc' ? 'training camp' : 'active roster');
    document.title = (mine ? 'My Stall' : me.gamertag) + ' | Calgary Hitmen War Room';
    const plate = me.jersey_name || me.gamertag;
    if (window.HitmenStall) HitmenStall.mount($('stallArt'), { empty: !me.jersey_number, name: plate, number: me.jersey_number || '' });
    if (me.chel_player_image_path) {
      try {
        const r = await db.storage.from('hitmen-player-images').createSignedUrl(me.chel_player_image_path, 3600);
        if (r.data?.signedUrl) $('stallArt').insertAdjacentHTML('afterend', '<img class="me-photo" src="' + esc(r.data.signedUrl) + '" alt="' + esc(me.gamertag) + ' CHEL player">');
      } catch { /* the stall art stays on its own */ }
    }
    const stats = !st ? [] : st.player_kind === 'goalie'
      ? [['Games', st.games_played ?? x.ggp], ['Record', x.record, 1], ['Save %', pct3(x.savep), 1], ['GAA', fix2(x.gaa)], ['Shots against', x.sog], ['Goals against', x.ga], ['Shutouts', x.gso], ['Breakaway saves', x.brks]]
      : [['Games', st.games_played ?? x.gp], ['Goals', x.goals, 1], ['Assists', x.assists], ['Points', x.points, 1], ['Plus / minus', sign(x.plusminus)], ['Shots', x.shots], ['Faceoff %', x.fop == null ? '–' : x.fop], ['Takeaways', x.takeaway]];
    $('meStats').innerHTML = stats.length ? stats.map(s => '<div><small>' + s[0] + '</small><b' + (s[2] ? ' class="gold"' : '') + '>' + esc(s[1] ?? '–') + '</b></div>').join('') : '<div style="grid-column:1/-1"><small>LG season stats</small><b style="font-size:22px">None on file yet</b></div>';
    $('meSrc').textContent = st ? 'Official LG season stats · LGCHL Season ' + SEASON + ' regular season · imported ' + whenTxt(st.fetched_at) : 'No LG season line is linked to this stall yet.';
    const cap = s => s ? s[0].toUpperCase() + s.slice(1) : 'Not set';
    $('meBio').innerHTML = '<dt>Position</dt><dd>' + esc(me.position || 'Not set') + (me.secondary_position ? ' / ' + esc(me.secondary_position) : '') + '</dd><dt>Shoots</dt><dd>' + esc(cap(me.handedness)) + '</dd><dt>Jersey</dt><dd>' + esc(plate) + (me.jersey_number ? ' · #' + esc(me.jersey_number) : '') + '</dd><dt>Role</dt><dd>' + esc(role) + '</dd><dt>Height</dt><dd>' + esc(me.height_label || 'Not set') + '</dd><dt>Country</dt><dd>' + esc(me.country_code || 'Not set') + '</dd>';
    $('meJersey').innerHTML = '<dt>Nameplate</dt><dd>' + esc(plate) + '</dd><dt>Number</dt><dd>' + esc(me.jersey_number || 'Not set') + '</dd>';

    const grR = await safe(q(db.from('team_player_game_reports').select('game_date,opponent_name,result,stats,coach_summary,improvements,strengths').eq('team_id', TEAM).eq('season', SEASON).eq('locker_id', me.id).order('game_date', { ascending: false }).limit(18)));
    /* a game can have a box-score report and a coach review: merge them into one card */
    const byGame = new Map();
    (grR.ok ? grR.v : []).forEach(r => {
      const k = (r.game_date || '') + '|' + strip(r.opponent_name);
      const m = byGame.get(k);
      if (!m) { byGame.set(k, { ...r, stats: r.stats || {} }); return; }
      m.result = m.result || r.result;
      if (!Object.keys(m.stats).length || (r.stats?.source && !m.stats.source)) m.stats = r.stats || m.stats;
      m.coach_summary = m.coach_summary || r.coach_summary; m.improvements = m.improvements || r.improvements; m.strengths = m.strengths || r.strengths;
    });
    const games = [...byGame.values()].slice(0, 6);
    $('meGames').innerHTML = games.length ? games.map(g => {
      const s = g.stats || {}, win = /^W/i.test(g.result || ''), loss = /^(L|OTL)/i.test(g.result || '');
      const tc = win ? '139,227,166' : loss ? '255,123,123' : '200,210,225';
      const parts = [s.goals != null && s.goals + ' G', s.assists != null && s.assists + ' A', s.shots != null && s.shots + ' shots', s.plus_minus != null && sign(s.plus_minus).replace('-', '−'), s.takeaways != null && s.takeaways + ' takeaways', s.source_stats?.['PAS%'] && s.source_stats['PAS%'] + '% passing'].filter(Boolean);
      const note = g.coach_summary || g.improvements || g.strengths;
      return '<div class="panel card tinted" style="--tc:' + tc + '"><span class="src">' + esc(g.game_date ? whenTxt(g.game_date) : '') + '</span><h4>' + esc(g.opponent_name || 'Game') + (g.result ? ' · <span style="color:' + (win ? 'var(--ok)' : loss ? 'var(--crit)' : 'inherit') + '">' + esc(g.result) + '</span>' : '') + '</h4>' +
        (parts.length ? '<p style="color:var(--gold-hi);font-family:var(--f-ui);font-size:17px;letter-spacing:.03em">' + esc(parts.join(' · ')) + '</p>' : '') + (note ? '<p>Coach note: ' + esc(note) + '</p>' : '') + '</div>';
    }).join('') : '<p class="hq-empty">' + (grR.ok ? 'No game reports are saved for your stall yet. They are written from LG box scores after each game night.' : 'Game reports could not load.') + '</p>';
  }

  window.addEventListener('vvhl-auth-change', e => gate(e.detail));
  if (B.state?.user) gate(B.state);
})();
