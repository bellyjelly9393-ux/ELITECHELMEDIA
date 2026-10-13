/* Calgary Hitmen War Room Headquarters (hitmen-hq.html).
   Read-only. Nothing on this page writes to the database, and it does not read or call
   any VOD tables, functions or pages (the VOD Control Center is only linked).
   Public reads (WMDesk.read, publishable key): lgchl_standings_current, lgchl_games,
   lg_player_season_stats, media_posts (published recaps).
   Signed-in management reads (VVHLBackend.db, same RLS as the other War Room pages):
   hitmen_schedule_games, hitmen_opponent_pregame_reports, hitmen_battle_plans,
   hitmen_opponent_refresh_runs, lg_game_box_scores, team_player_lockers.
   Access rule matches management-guard.js on Hitmen pages: admin/commissioner, or an
   active Calgary membership with role owner, gm, agm or scout. */
(() => {
  'use strict';
  const D = window.WMDesk, B = window.VVHLBackend;
  if (!D || !B) return;
  const { $, esc, nb, F, etDate, ordinal, logo, read, tint } = D;
  D.menu();

  const TEAM = 'b0bcbdda-da9d-419d-8f61-b34937966d49';
  const CGY = 412, SEASON = 55;
  const HITMEN_ROLES = new Set(['owner', 'gm', 'agm', 'scout']);
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
    if (!started) { started = true; load(state, role); }
  }

  /* ---------- helpers ---------- */
  const q = async p => { const { data, error } = await p; if (error) throw error; return data || []; };
  const safe = p => p.then(v => ({ ok: true, v }), e => ({ ok: false, e }));
  const rec = t => t.w + '-' + t.l + '-' + t.otl;
  const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const whenTxt = v => F.day.format(new Date(v)) + ' · ' + F.time.format(new Date(v)) + ' ET';
  const range = ns => {
    if (!ns.length) return '';
    const out = []; let a = ns[0], b = ns[0];
    for (const n of ns.slice(1)) { if (n === b + 1) b = n; else { out.push(a === b ? a : a + '–' + b); a = b = n; } }
    out.push(a === b ? a : a + '–' + b);
    return out.join(', ');
  };
  const chip = (cls, txt) => '<span class="chip ' + cls + '">' + esc(txt) + '</span>';

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

  /* ---------- load ---------- */
  async function load(state, role) {
    who(state, role);
    const [standR, gamesR] = await Promise.all([
      safe(read('lgchl_standings_current', { select: 'lg_team_id,name,league,conference,division,gp,w,l,otl,pts,gf,ga,gd,streak,last10,home,away,logo_path,standings_at' })),
      safe(read('lgchl_games', { select: 'lg_game_id,week,game_at,status,home_lg_team_id,away_lg_team_id,home_score,away_score', season: 'eq.' + SEASON, or: '(home_lg_team_id.eq.' + CGY + ',away_lg_team_id.eq.' + CGY + ')', order: 'game_at.asc', limit: '300' }))
    ]);
    if (!standR.ok || !gamesR.ok) {
      const msg = '<p class="hq-loading">The official LG ' + (!standR.ok ? 'standings' : 'schedule') + ' could not load right now. Refresh to try again.</p>';
      $('hqStrip').innerHTML = msg; $('gnGrid').innerHTML = msg; $('lastNight').innerHTML = ''; $('ready').innerHTML = msg;
      return;
    }
    const stand = standR.v, games = gamesR.v;
    const byId = new Map(stand.map(t => [t.lg_team_id, t]));
    const cgy = byId.get(CGY);
    const whlEast = stand.filter(t => cgy && t.league === cgy.league && t.conference === cgy.conference)
      .sort((a, b) => b.pts - a.pts || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga) || a.name.localeCompare(b.name));
    const confLabel = cgy ? cgy.league + ' ' + cgy.conference : 'Conference';
    const rank = whlEast.findIndex(t => t.lg_team_id === CGY) + 1;

    const finals = games.filter(g => g.status === 'final' && g.home_score != null && g.away_score != null);
    const gameNo = new Map(finals.map((g, i) => [g.lg_game_id, i + 1]));
    const upcoming = games.filter(g => g.status !== 'final' && Date.parse(g.game_at) > Date.now() - 3 * 3600e3);
    const nextNight = upcoming.length ? upcoming.filter(g => etDate(g.game_at) === etDate(upcoming[0].game_at)) : [];
    const lastNightDate = finals.length ? etDate(finals[finals.length - 1].game_at) : null;
    const lastNight = lastNightDate ? finals.filter(g => etDate(g.game_at) === lastNightDate) : [];
    const oppOf = g => g.home_lg_team_id === CGY ? g.away_lg_team_id : g.home_lg_team_id;
    const isHome = g => g.home_lg_team_id === CGY;
    const cs = g => isHome(g) ? g.home_score : g.away_score;
    const os = g => isHome(g) ? g.away_score : g.home_score;

    renderStrip(cgy, rank, confLabel, nextNight[0], byId);
    renderRace(whlEast);
    renderLast(lastNight, lastNightDate, byId, oppOf, isHome, cs, os);
    tint(document);

    /* private reads; any one failing leaves its row marked as unavailable */
    const sinceYmd = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const [schedR, repR, planR, runR, boxR, statR, recapR, lockR] = await Promise.all([
      safe(q(db.from('hitmen_schedule_games').select('id,scheduled_at,opponent_name,status').eq('team_id', TEAM).eq('season', SEASON))),
      safe(q(db.from('hitmen_opponent_pregame_reports').select('id,opponent_name,scheduled_game_id,created_at').eq('team_id', TEAM).eq('season', SEASON).order('created_at', { ascending: false }).limit(300))),
      safe(q(db.from('hitmen_battle_plans').select('id,opponent_name,game_date,schedule_game_id,status,updated_at').eq('team_id', TEAM).gte('game_date', sinceYmd))),
      safe(q(db.from('hitmen_opponent_refresh_runs').select('requested_at,finished_at').eq('team_id', TEAM).order('requested_at', { ascending: false }).limit(1))),
      safe(finals.length ? q(db.from('lg_game_box_scores').select('lg_game_id,captured_at').in('lg_game_id', finals.map(g => g.lg_game_id))) : Promise.resolve([])),
      safe(read('lg_player_season_stats', { select: 'fetched_at', lg_team_id: 'eq.' + CGY, season: 'eq.' + SEASON, season_type: 'eq.regular', order: 'fetched_at.desc', limit: '1' })),
      safe(read('media_posts', { select: 'id,source_metrics', published: 'eq.true', post_type: 'eq.recap', 'source_metrics->>team': 'eq.Calgary Hitmen', limit: '200' })),
      safe(q(db.from('team_player_lockers').select('roster_class').eq('team_id', TEAM).eq('season', SEASON)))
    ]);

    /* schedule rows (War Room ids) matched to official LG games by puck-drop time */
    const schedAt = new Map((schedR.ok ? schedR.v : []).map(s => [Date.parse(s.scheduled_at), s]));
    const schedFor = g => schedAt.get(Date.parse(g.game_at)) || null;
    const lastFinalAt = finals.length ? Date.parse(finals[finals.length - 1].game_at) : 0;

    function prepFor(g) {
      const s = schedFor(g), opp = byId.get(oppOf(g));
      const reports = repR.ok ? repR.v.filter(r => (s && r.scheduled_game_id === s.id) || (opp && strip(r.opponent_name) === strip(opp.name))) : null;
      const latest = reports && reports[0];
      const plan = planR.ok && s ? planR.v.find(p => p.schedule_game_id === s.id) : null;
      const rep = reports === null ? ['info', 'Reports unavailable']
        : !latest ? ['crit', 'No pregame report']
        : Date.parse(latest.created_at) >= lastFinalAt ? ['ok', 'Report ' + F.md.format(new Date(latest.created_at))]
        : ['warn', 'Report ' + F.md.format(new Date(latest.created_at)) + ' · stale'];
      const pl = !planR.ok ? ['info', 'Plans unavailable'] : plan ? ['ok', 'Battle plan saved'] : ['warn', 'No battle plan'];
      return { rep, pl, fresh: rep[0] === 'ok', planned: !!plan };
    }

    const rankOf = id => whlEast.findIndex(t => t.lg_team_id === id) + 1;
    const rosterAt = runR.ok && runR.v[0]?.finished_at ? runR.v[0].finished_at : null;
    renderNext(nextNight, byId, oppOf, isHome, finals, cs, os, prepFor, rankOf, rosterAt);

    /* ---------- readiness ---------- */
    const rows = [];
    if (lastNight.length) {
      rows.push(['ok', 'Last game night finals', lastNight.length + ' of ' + lastNight.length + ' posted',
        F.longDay.format(new Date(lastNight[0].game_at)) + ': ' + lastNight.map(g => (cs(g) > os(g) ? 'W ' : 'L ') + cs(g) + '–' + os(g) + ' ' + (byId.get(oppOf(g))?.name || 'opponent')).join(', ') + '.']);
    }
    const stAt = stand.reduce((m, t) => Math.max(m, Date.parse(t.standings_at) || 0), 0);
    rows.push([stAt >= lastFinalAt ? 'ok' : 'warn', 'Standings', stAt ? whenTxt(stAt) : 'Unknown',
      stAt >= lastFinalAt ? 'LG standings import after the latest final. Calgary ' + (cgy ? rec(cgy) + ', ' + cgy.pts + ' points.' : '') : 'The last standings import is older than the latest final.']);
    if (statR.ok && statR.v[0]) {
      const at = Date.parse(statR.v[0].fetched_at);
      const fresh = at >= lastFinalAt;
      rows.push([fresh ? 'ok' : 'warn', 'Calgary player stats', fresh ? whenTxt(at) : 'Before latest games',
        'LG season stats imported ' + whenTxt(at) + '. ' + (fresh ? 'Includes the latest game night.' : 'The next import picks up the latest game night.')]);
    } else rows.push(['info', 'Calgary player stats', 'Unavailable', 'The LG player stats import could not be checked.']);
    if (runR.ok && runR.v[0]) {
      const r = runR.v[0];
      rows.push([r.finished_at ? 'ok' : 'warn', 'Opponent rosters + EA logs', r.finished_at ? whenTxt(r.finished_at) : 'Running',
        r.finished_at ? 'Latest opponent refresh finished ' + whenTxt(r.finished_at) + '.' : 'An opponent refresh was requested ' + whenTxt(r.requested_at) + ' and has not finished.']);
    } else rows.push(['info', 'Opponent rosters + EA logs', 'Unavailable', 'The opponent refresh log could not be checked.']);
    if (nextNight.length) {
      const preps = nextNight.map(g => [g, prepFor(g)]);
      const name = g => byId.get(oppOf(g))?.name || 'opponent';
      const stale = preps.filter(([, p]) => !p.fresh);
      rows.push([!repR.ok ? 'info' : stale.length ? 'warn' : 'ok', 'Next night pregame reports', !repR.ok ? 'Unavailable' : stale.length ? stale.length + ' of ' + preps.length + ' need a run' : 'Current',
        !repR.ok ? 'Pregame reports could not be checked.' : stale.length ? 'Needs a current report: ' + stale.map(([g]) => name(g)).join(', ') + '.' : 'Every opponent has a report written after the latest final.']);
      const unplanned = preps.filter(([, p]) => !p.planned);
      rows.push([!planR.ok ? 'info' : unplanned.length ? 'warn' : 'ok', 'Next night battle plans', !planR.ok ? 'Unavailable' : unplanned.length ? (unplanned.length === preps.length ? 'Not started' : unplanned.length + ' to go') : 'Saved',
        !planR.ok ? 'Battle plans could not be checked.' : unplanned.length ? 'No battle plan saved for ' + unplanned.map(([g]) => name(g)).join(', ') + '. Plans are built once lineups are posted.' : 'A battle plan is saved for every game.']);
    }
    /* recaps first: a final with no box score still counts as covered once its recap is published
       (week 1 recaps were written from the public log before box-score capture existed). */
    let hasRecap = null;
    if (recapR.ok) {
      const ids = new Set(recapR.v.map(p => String(p.source_metrics?.lg_game_id || '')));
      const byDate = recapR.v.map(p => [p.source_metrics?.game_date, strip(p.source_metrics?.opponent)]);
      hasRecap = g => ids.has(String(g.lg_game_id)) || byDate.some(([d, o]) => d === etDate(g.game_at) && o && strip(byId.get(oppOf(g))?.name) === o);
    }
    if (boxR.ok) {
      const have = new Set(boxR.v.map(b => b.lg_game_id));
      const noBox = finals.filter(g => !have.has(g.lg_game_id));
      const blocking = noBox.filter(g => !hasRecap || !hasRecap(g)).map(g => gameNo.get(g.lg_game_id));
      const covered = noBox.length - blocking.length;
      const lastCap = boxR.v.reduce((m, b) => Math.max(m, Date.parse(b.captured_at) || 0), 0);
      rows.push([blocking.length ? 'crit' : 'ok', 'LG box scores', blocking.length ? 'Games ' + range(blocking) + ' missing' : 'Up to date',
        (lastCap ? 'Last capture ' + whenTxt(lastCap) + '. ' : '') +
        (blocking.length ? 'Run the LG capture so recaps and player game reports can be written.' : 'Every Calgary final has a verified box score or a published recap.') +
        (covered ? ' ' + covered + ' earlier game' + (covered === 1 ? ' was' : 's were') + ' recapped from the public log without one.' : ''),
        blocking.length ? ['lg-capture.html?mode=authsync', 'Open LG capture →'] : null]);
    } else rows.push(['info', 'LG box scores', 'Unavailable', 'Box scores could not be checked.']);
    if (hasRecap) {
      const missing = finals.filter(g => !hasRecap(g)).map(g => gameNo.get(g.lg_game_id));
      rows.push([missing.length ? 'warn' : 'ok', 'Game recaps', missing.length ? 'Games ' + range(missing) + ' missing' : 'Up to date',
        missing.length ? 'Those games have the automatic final notice only. Full recaps are written from the box scores above.' : 'Every final has a published recap on the Postgame Desk.']);
    } else rows.push(['info', 'Game recaps', 'Unavailable', 'Published recaps could not be checked.']);
    $('ready').innerHTML = '<div class="leaders-head"><span>Data and prep</span><small>Checked ' + esc(whenTxt(Date.now())) + '</small></div>' +
      rows.map(r => '<div class="ready-row"><b>' + esc(r[1]) + '</b>' + chip(r[0], r[2]) + '<p>' + esc(r[3]) + (r[4] ? ' <a href="' + esc(r[4][0]) + '">' + esc(r[4][1]) + '</a>' : '') + '</p></div>').join('');

    if (lockR.ok && lockR.v.length) {
      const act = lockR.v.filter(l => l.roster_class === 'active_roster').length, tc = lockR.v.filter(l => l.roster_class === 'tc').length;
      $('roomLocker').textContent = act + ' active stalls · ' + tc + ' training camp';
    }
  }

  /* ---------- renderers ---------- */
  function renderStrip(cgy, rank, confLabel, next, byId) {
    if (!cgy) { $('hqStrip').innerHTML = '<p class="hq-loading">Calgary is not in the current standings import.</p>'; return; }
    let nextTile = '';
    if (next) {
      const o = byId.get(next.home_lg_team_id === CGY ? next.away_lg_team_id : next.home_lg_team_id);
      const src = logo(o?.logo_path);
      nextTile = '<a class="next card tinted" href="#gnTitle" data-logo="' + src + '"><span class="wm" aria-hidden="true" style="--logo:url(\'' + src + '\')"></span><span class="next-logo" aria-hidden="true"><img src="' + src + '" width="52" height="52" alt=""></span><span class="next-play" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 10 10"><path d="M1 1l4 4-4 4M5 1l4 4-4 4" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></span><span class="next-txt"><small>Next game</small><b>' + (next.home_lg_team_id === CGY ? 'vs ' : 'at ') + esc(o?.name || 'TBA') + '</b><span>' + esc(whenTxt(next.game_at)) + '</span></span></a>';
    }
    $('hqStrip').innerHTML =
      '<div class="stat"><small>Record</small><b>' + cgy.w + '<em>-</em>' + cgy.l + '<em>-</em>' + cgy.otl + '</b></div>' +
      '<div class="stat"><small>Points</small><b>' + cgy.pts + '</b></div>' +
      '<div class="stat"><small>Goals for</small><b>' + cgy.gf + '</b></div>' +
      '<div class="stat"><small>Goals against</small><b>' + cgy.ga + '</b></div>' +
      '<div class="stat"><small>' + esc(confLabel) + '</small><b class="gold">' + (rank ? ordinal(rank) : '–') + '</b></div>' + nextTile;
  }

  function renderRace(rows) {
    if (!rows.length) { $('race').innerHTML = '<p class="hq-loading">Standings unavailable.</p>'; return; }
    const top = rows[0].pts || 1;
    $('race').innerHTML = rows.map((t, i) => {
      const me = t.lg_team_id === CGY;
      return '<div class="lrow' + (me ? ' me' : '') + '" style="--pw:' + Math.round(t.pts / top * 100) + '%;--pwn:' + (me ? 1 : .35) + '"><i>' + (i + 1) + '</i><img class="rl" src="' + logo(t.logo_path) + '" alt=""><b>' + esc(t.name) + '</b><em>' + rec(t) + '</em><strong>' + t.pts + '</strong></div>';
    }).join('');
  }

  function renderLast(list, ymd, byId, oppOf, isHome, cs, os) {
    if (!list.length) { $('lastNight').innerHTML = '<p class="hq-loading">No finals yet this season.</p>'; return; }
    const w = list.filter(g => cs(g) > os(g)).length;
    $('lnEyebrow').textContent = F.longDay.format(new Date(list[0].game_at)) + ' · ' + w + '-' + (list.length - w) + ' night';
    $('lastNight').innerHTML = list.map(g => {
      const o = byId.get(oppOf(g)), win = cs(g) > os(g), src = logo(o?.logo_path);
      return '<div class="res card tinted ' + (win ? 'w' : 'l') + '" style="--tc:' + (win ? '139,227,166' : '255,123,123') + '"><img src="' + src + '" width="44" height="44" alt=""><div style="min-width:0"><small>' + esc(F.time.format(new Date(g.game_at))) + ' ET · ' + (isHome(g) ? 'Home' : 'Away') + '</small><b>' + (isHome(g) ? 'vs ' : 'at ') + esc(o?.name || 'Opponent') + '</b></div><div class="sc">' + nb(cs(g) + '–' + os(g)) + '<i>' + (win ? 'Win' : 'Loss') + '</i></div></div>';
    }).join('');
  }

  let cdTarget = null;
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    if (!cdTarget) return;
    const t = Math.max(0, Math.floor((Date.parse(cdTarget) - Date.now()) / 1000));
    $('cdD').textContent = pad(Math.floor(t / 86400)); $('cdH').textContent = pad(Math.floor(t % 86400 / 3600));
    $('cdM').textContent = pad(Math.floor(t % 3600 / 60)); $('cdS').textContent = pad(t % 60);
  }
  setInterval(tick, 1000);

  function renderNext(list, byId, oppOf, isHome, finals, cs, os, prepFor, rankOf, rosterAt) {
    if (!list.length) {
      $('gnTitleA').textContent = 'Season'; $('gnSub').textContent = 'No upcoming Calgary games in the official LG schedule.';
      $('cdLabel').textContent = 'no game scheduled'; $('gnGrid').innerHTML = ''; return;
    }
    const first = list[0];
    $('gnEyebrow').textContent = 'Next game night · Week ' + (first.week || '–') + ' · ' + F.longDay.format(new Date(first.game_at));
    $('gnTitleA').textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'long' }).format(new Date(first.game_at)) + '’s';
    $('gnTitleB').textContent = list.length === 3 ? 'three' : list.length === 1 ? 'game' : 'games';
    $('gnScout').textContent = 'Scout ' + new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'long' }).format(new Date(first.game_at));
    $('gnSub').textContent = list.length + ' game' + (list.length === 1 ? '' : 's') + ' · times Eastern · official LG schedule';
    const fo = byId.get(oppOf(first));
    $('cdLabel').textContent = (isHome(first) ? 'vs ' : 'at ') + (fo?.name || 'TBA') + ' · ' + F.time.format(new Date(first.game_at)) + ' ET';
    $('cdSr').textContent = 'Puck drop ' + whenTxt(first.game_at);
    cdTarget = first.game_at; tick();
    $('gnGrid').innerHTML = list.map((g, i) => {
      const o = byId.get(oppOf(g)), src = logo(o?.logo_path), home = isHome(g);
      const series = finals.filter(f => oppOf(f) === oppOf(g));
      const w = series.filter(f => cs(f) > os(f)).length, l = series.length - w;
      const p = prepFor(g);
      const seriesTxt = series.length ? 'Calgary is ' + w + '-' + l + ' against them: ' + series.map(f => (cs(f) > os(f) ? 'W ' : 'L ') + cs(f) + '–' + os(f) + ' on ' + F.md.format(new Date(f.game_at))).join(', ') + '.' : 'First meeting this season.';
      const sk = /^-?(\d+)\s*([A-Za-z]+)$/.exec(String(o?.streak || '').trim());
      const run = sk && +sk[1] > 0 ? ' ' + (/^w/i.test(sk[2]) ? 'Won ' : 'Lost ') + sk[1] + ' coming in.' : '';
      const diff = o ? (o.gf >= o.ga ? 'have outscored opponents ' + o.gf + '–' + o.ga : 'have been outscored ' + o.ga + '–' + o.gf) : '';
      const blurb = o ? esc(o.name) + ' are ' + rec(o) + ' and ' + diff + '.' + run + ' ' : '';
      const split = home ? ['On road', o?.away] : ['At home', o?.home];
      return '<article class="ow card tinted' + (i === 0 ? ' is-now' : '') + '" data-logo="' + src + '"><span class="wm wm-lg" aria-hidden="true" style="--logo:url(\'' + src + '\')"></span>' +
        '<header class="ow-top"><img src="' + src + '" width="56" height="56" alt=""><div><span class="ow-time">Game ' + (i + 1) + ' · ' + esc(F.time.format(new Date(g.game_at))) + ' ET · ' + (home ? 'Home' : 'Away') + '</span><h3>' + (home ? 'vs ' : 'at ') + esc(o?.name || 'TBA') + '</h3></div>' +
        '<span class="ow-h2h' + (w < l ? ' dn' : '') + '"><b>' + w + '-' + l + '</b><small>Calgary H2H</small></span></header>' +
        (o ? '<dl class="ow-stats"><div><dt>Record</dt><dd>' + rec(o) + '</dd></div><div><dt>' + 'WHL East' + '</dt><dd>' + (rankOf(o.lg_team_id) ? ordinal(rankOf(o.lg_team_id)) : '–') + '</dd></div><div><dt>Last 10</dt><dd>' + esc(o.last10 || '–') + '</dd></div><div><dt>' + split[0] + '</dt><dd>' + esc(split[1] || '–') + '</dd></div><div><dt>GF / GA</dt><dd>' + o.gf + ' / ' + o.ga + '</dd></div></dl>' : '') +
        '<p>' + blurb + esc(seriesTxt) + '</p>' +
        '<div class="prep">' + chip(p.rep[0], p.rep[1]) + chip(p.pl[0], p.pl[1]) + (rosterAt ? chip('info', 'Roster ' + whenTxt(rosterAt).replace(' ET', '')) : '') + '</div>' +
        '<a class="ow-link" href="hitmen-scouting.html?opp=' + encodeURIComponent(o?.name || '') + '">Open opponent file →</a></article>';
    }).join('');
    tint($('gnGrid'));
  }

  /* start once the helpers above exist */
  window.addEventListener('vvhl-auth-change', e => gate(e.detail));
  if (B.state?.user) gate(B.state);
})();
