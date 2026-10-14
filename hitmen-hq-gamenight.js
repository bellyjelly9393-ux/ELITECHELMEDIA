/* Calgary Hitmen War Room Headquarters: game-night tools (hitmen-hq.html).
   Moved here from the old Game Center page (hitmen-workspace.html), which now redirects to Headquarters.
   Weekly game prep reads the posted-lineups snapshot (public JSON). Game Night Series reads and writes
   team_competitive_sessions / team_competitive_games as the signed-in management user (same RLS as before).
   Element ids (activeSession, sessionStream, hitmenStatus, ...) are kept because hitmen-game-center-sync.js
   and hitmen-vod-handoff.js hook into them. */
(() => {
  'use strict';
  const TEAM_NAME = 'Calgary Hitmen', SEASON = 'Season 55';
  const ROLES = ['owner', 'gm', 'agm', 'scout'];
  const db = () => window.VVHLBackend?.db;
  const auth = () => window.VVHLBackend?.state || {};
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => Number(v) || 0;
  const S = { team: null, sessions: [], games: [], loading: false, weekly: false };

  function setStatus(text, tone = '') {
    const el = $('hitmenStatus'); if (!el) return;
    el.hidden = !text; el.textContent = text; el.className = ('hq-status ' + tone).trim();
  }
  function allowed() {
    const st = auth(); if (!st.user) return false;
    const pr = String(st.profile?.role || '').toLowerCase();
    if (pr === 'admin' || pr === 'commissioner') return true;
    return (st.memberships || []).some(m => m.team_id === S.team?.id && m.active !== false && ROLES.includes(String(m.role || '').toLowerCase()));
  }

  /* ---------- weekly game prep (posted lineups) ---------- */
  const positions = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];
  const six = (title, p) => '<details class="six"><summary>' + esc(title) + '</summary><ul>' + positions.map(k => '<li><b>' + k + '</b> ' + esc(p?.[k] || 'Not confirmed') + '</li>').join('') + '</ul></details>';
  const fmt = (v, o) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', ...o }).format(new Date(v));
  async function loadWeekly() {
    const root = $('hqWeekly'); if (!root || S.weekly) return;
    S.weekly = true;
    try {
      const r = await fetch('data/hitmen/season-55-week-3-posted-lineups.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('Lineups unavailable');
      const data = await r.json();
      if (data.team_id !== 412 || data.season !== 55 || !Array.isArray(data.games)) throw new Error('Unexpected team snapshot');
      const checked = data.games.filter(g => g.status === 'verified_posted_lineups' && g.lineups).length;
      $('hqWeeklyTag').textContent = 'Week ' + data.week + ' · ' + checked + ' / ' + data.games.length + ' lineups verified';
      root.innerHTML = data.games.map(g => {
        const ok = g.status === 'verified_posted_lineups' && g.lineups;
        const lg = 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' + Number(g.lg_game_id);
        return '<article class="card hq-prep" id="prep-' + Number(g.lg_game_id) + '">' +
          '<small>' + esc(fmt(g.scheduled_at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + ' ET</small>' +
          '<h3>' + esc(g.opponent_name) + '</h3>' +
          '<p>' + (ok ? 'Both posted lineups verified' : 'Awaiting signed-in lineup capture') + '</p>' +
          (ok ? six('Calgary’s six', g.lineups.calgary) + six('Opponent’s six', g.lineups.opponent) : '<p>LG’s public page did not expose player names when checked. The saved team preview stays available to authorized scouting accounts.</p>') +
          '<div class="prep-links"><a href="' + esc(lg) + '" target="_blank" rel="noopener noreferrer">Official LG game →</a>' +
          '<a href="hitmen-scouting-report.html?game=' + encodeURIComponent(g.scheduled_game_id) + '">Pregame scouting report →</a></div>' +
          '<small>Checked ' + esc(fmt(g.captured_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + ' ET</small></article>';
      }).join('');
    } catch {
      root.innerHTML = '<p class="hq-loading">Weekly lineups could not load. <a href="hitmen-scouting.html">Open scouting</a> or refresh this page.</p>';
    }
  }

  /* ---------- game night series ---------- */
  const sessionGames = id => S.games.filter(g => g.session_id === id).sort((a, b) => a.game_number - b.game_number);
  function renderActive() {
    const root = $('activeSession'); if (!root) return;
    const s = S.sessions.find(x => x.status !== 'complete') || S.sessions[0];
    if (!s) { root.innerHTML = '<p class="hq-loading">No game-night series yet. Create tonight’s BO3 above.</p>'; return; }
    const need = Math.floor(n(s.best_of) / 2) + 1;
    root.innerHTML = '<div class="gn-session"><div class="gn-head"><div><small>' + esc(String(s.status).toUpperCase()) + ' · BEST OF ' + n(s.best_of) + ' · FIRST TO ' + need + '</small><h4>' + esc(s.label) + '</h4></div>' +
      '<div class="gn-score">HITMEN ' + n(s.team_wins) + '–' + n(s.opponent_wins) + ' OPP</div></div>' +
      (s.opponent_label ? '<p>Opponent / lobby: <b>' + esc(s.opponent_label) + '</b></p>' : '') +
      '<div class="gn-actions">' + (s.stream_url ? '<a class="small-btn" href="' + esc(s.stream_url) + '" target="_blank" rel="noopener">Open Stream</a>' : '') +
      (s.status !== 'complete' ? '<button class="small-btn" type="button" data-pause-session="' + esc(s.id) + '">' + (s.status === 'paused' ? 'Resume' : 'Pause') + ' Session</button>' : '') + '</div>' +
      '<div class="gn-games">' + sessionGames(s.id).map(g => {
        const done = ['final', 'not_required'].includes(g.status);
        return '<div class="gn-game ' + (g.status === 'not_required' ? 'off' : '') + '"><span><b>Game ' + g.game_number + '</b><small class="gs-' + esc(g.status) + '">' + esc(String(g.status).replace('_', ' ')) + '</small></span>' +
          '<span>' + (g.status === 'not_required' ? 'Series already clinched' : 'Game-night matchup') + '</span>' +
          '<input class="field" type="number" min="0" value="' + n(g.team_score) + '" aria-label="Hitmen score" data-team-score="' + esc(g.id) + '" ' + (done ? 'disabled' : '') + '>' +
          '<input class="field" type="number" min="0" value="' + n(g.opponent_score) + '" aria-label="Opponent score" data-opp-score="' + esc(g.id) + '" ' + (done ? 'disabled' : '') + '>' +
          (g.status === 'scheduled' ? '<button class="small-btn" type="button" data-start-game="' + esc(g.id) + '">Start</button>' : '') +
          (g.status === 'live' ? '<button class="small-btn primary" type="button" data-final-game="' + esc(g.id) + '">Final</button>' : '') +
          (g.status === 'final' ? '<b>✓</b>' : '') + '</div>';
      }).join('') + '</div></div>';
    root.querySelectorAll('[data-start-game]').forEach(b => b.addEventListener('click', () => startGame(b.dataset.startGame)));
    root.querySelectorAll('[data-final-game]').forEach(b => b.addEventListener('click', () => finalGame(b.dataset.finalGame)));
    root.querySelectorAll('[data-pause-session]').forEach(b => b.addEventListener('click', () => togglePause(s)));
  }
  function renderHistory() {
    const root = $('sessionHistory'); if (!root) return;
    root.innerHTML = S.sessions.length
      ? S.sessions.slice(0, 12).map(s => '<div class="gn-hist"><span><b>' + esc(s.label) + '</b><small>' + esc(s.season_label) + ' · BO' + n(s.best_of) + ' · ' + esc(s.status) + '</small></span><b class="num">' + n(s.team_wins) + '–' + n(s.opponent_wins) + '</b></div>').join('')
      : '<p class="hq-loading">No Hitmen sessions tracked yet.</p>';
  }
  async function loadAll() {
    if (S.loading || !db() || !auth().user) return;
    S.loading = true;
    try {
      if (!S.team) {
        const t = await db().from('teams').select('id,name').eq('name', TEAM_NAME).maybeSingle();
        if (t.error) throw t.error;
        S.team = t.data;
      }
      if (!S.team || !allowed()) return;
      loadWeekly();
      const ses = await db().from('team_competitive_sessions').select('*').eq('team_id', S.team.id).order('created_at', { ascending: false });
      if (ses.error) throw ses.error;
      S.sessions = ses.data || [];
      const ids = S.sessions.map(x => x.id);
      if (ids.length) {
        const g = await db().from('team_competitive_games').select('*').in('session_id', ids).order('game_number');
        if (g.error) throw g.error;
        S.games = g.data || [];
      } else S.games = [];
      renderActive(); renderHistory();
    } catch (e) { console.error(e); setStatus(e.message || 'Could not load game-night tools.', 'error'); }
    finally { S.loading = false; }
  }
  async function createSession() {
    const bestOf = Number($('sessionBestOf').value) || 3, label = $('sessionLabel').value.trim() || 'Calgary Hitmen Game Night';
    try {
      const r = await db().from('team_competitive_sessions').insert({ team_id: S.team.id, season_label: SEASON, session_type: 'regular', label, opponent_label: $('sessionOpponent').value.trim() || null, best_of: bestOf, stream_url: $('sessionStream').value.trim() || null, status: 'scheduled', created_by: auth().user.id }).select('id').single();
      if (r.error) throw r.error;
      const g = await db().from('team_competitive_games').insert(Array.from({ length: bestOf }, (_, i) => ({ session_id: r.data.id, game_number: i + 1, status: 'scheduled' })));
      if (g.error) throw g.error;
      await loadAll(); setStatus('BO' + bestOf + ' game-night series created. Use the real stream and actual game results tonight.', 'success');
    } catch (e) { setStatus(e.message || 'Could not create game-night series.', 'error'); }
  }
  async function startGame(id) {
    try {
      const r = await db().from('team_competitive_games').update({ status: 'live', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      if (r.error) throw r.error;
      await loadAll(); setStatus('Game marked LIVE.', 'success');
    } catch (e) { setStatus(e.message || 'Could not start game.', 'error'); }
  }
  async function finalGame(id) {
    const t = n(document.querySelector('[data-team-score="' + CSS.escape(id) + '"]')?.value), o = n(document.querySelector('[data-opp-score="' + CSS.escape(id) + '"]')?.value);
    if (t === o) return setStatus('A final hockey game cannot be tied. Enter the actual winner.', 'error');
    try {
      const r = await db().from('team_competitive_games').update({ status: 'final', team_score: t, opponent_score: o, final_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      if (r.error) throw r.error;
      await new Promise(res => setTimeout(res, 250)); await loadAll();
      setStatus('Game finalized. Series score and if-necessary logic recalculated automatically.', 'success');
    } catch (e) { setStatus(e.message || 'Could not finalize game.', 'error'); }
  }
  async function togglePause(s) {
    const status = s.status === 'paused' ? 'scheduled' : 'paused';
    try {
      const r = await db().from('team_competitive_sessions').update({ status, updated_at: new Date().toISOString() }).eq('id', s.id);
      if (r.error) throw r.error;
      await loadAll(); setStatus(status === 'paused' ? 'Session paused. It will resume from the same series state.' : 'Session resumed.', 'success');
    } catch (e) { setStatus(e.message || 'Could not change session status.', 'error'); }
  }

  $('createSession')?.addEventListener('click', createSession);
  window.addEventListener('vvhl-auth-change', () => setTimeout(loadAll, 50));
  const boot = () => { if (auth().user) loadAll(); else setTimeout(() => auth().user && loadAll(), 1200); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
