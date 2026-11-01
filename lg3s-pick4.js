/* LG3s "Pick Your 4": weekly fantasy game in its own section (#pick4) on lg3s-media.html.
   Sign-in is Discord (Supabase Auth). Picks are saved only through the lg3s_p4_save RPC, which enforces the lock, the
   categories, the salary cap and the four-nation rule server-side. Scores come from live views over verified game lines.
   Other people's picks stay hidden until the week locks (the board view enforces that too). */
(function () {
  'use strict';
  var root = document.getElementById('pick4'); if (!root || !window.supabase) return;
  var URL_ = 'https://lrgllzvwgvqagcpiyvfd.supabase.co', KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  var PROD = 'https://wildmanhockey-elitechelmedia.app';
  var db = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
  var SLOTS = [
    { id: 'superstar', label: 'Superstar', blurb: 'The proven top scorers.' },
    { id: 'breakout', label: 'Breakout Player', blurb: 'The next tier, ready to pop.' },
    { id: 'diamond', label: 'Diamond in the Rough', blurb: 'Bargain bin, $8 or less.' },
    { id: 'goalie', label: 'Goalie', blurb: 'Saves and wins.' }
  ];
  var S = { week: null, pool: [], byId: {}, scores: {}, mine: null, draft: {}, name: '', user: null, tab: 'picks', cat: 'superstar', nation: '', sort: 'price', q: '', boardW: [], boardS: [] };
  var $ = function (s) { return root.querySelector(s); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var NA = function () { return window.LG3S_NATION_ART; };
  var dot = function (n) { var c = NA() ? NA().color(n) : '#9aa7b3'; return '<i class="p4-dot" style="--c:' + esc(c) + '"></i>'; };
  var money = function (n) { return '$' + Number(n || 0); };
  var num = function (n, d) { var x = Number(n); return Number.isFinite(x) ? x.toFixed(d == null ? 1 : d) : '—'; };
  var DKEY = 'p4:draft';
  function locked() { return S.week && Date.now() >= new Date(S.week.lock_at).getTime(); }
  function lockText(w) {
    var d = new Date(w.lock_at);
    return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }) + ' ET';
  }
  function countdown() {
    var el = $('[data-p4-count]'); if (!el || !S.week) return;
    var ms = new Date(S.week.lock_at).getTime() - Date.now();
    if (ms <= 0) { el.textContent = S.week.status === 'final' ? 'Week final' : 'Locked · scoring live'; return; }
    var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
    el.textContent = 'Locks in ' + (h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h + 'h ' + m + 'm');
  }
  function saveDraft() { try { localStorage.setItem(DKEY, JSON.stringify({ week: S.week && S.week.week, draft: S.draft, name: S.name })); } catch (e) {} }
  function loadDraft() { try { var d = JSON.parse(localStorage.getItem(DKEY) || 'null'); if (d && S.week && d.week === S.week.week) { S.draft = d.draft || {}; S.name = d.name || ''; } } catch (e) {} }

  function cost() { return SLOTS.reduce(function (t, s) { var p = S.byId[S.draft[s.id]]; return t + (p ? p.price : 0); }, 0); }
  function nationsUsed(except) { var u = {}; SLOTS.forEach(function (s) { if (s.id !== except) { var p = S.byId[S.draft[s.id]]; if (p) u[p.nation] = s.label; } }); return u; }
  function problems() {
    var out = [], n = {}, c = cost();
    SLOTS.forEach(function (s) { var p = S.byId[S.draft[s.id]]; if (!p) out.push('Pick a ' + s.label + '.'); else { if (n[p.nation]) out.push('Two picks from ' + p.nation + '. All four must be from different nations.'); n[p.nation] = 1; } });
    if (S.week && c > S.week.cap) out.push('Over the cap by ' + money(c - S.week.cap) + '.');
    var nm = (S.name || '').trim(); if (nm.length < 3 || nm.length > 24 || !/^[A-Za-z0-9 ._'-]+$/.test(nm)) out.push('Team name: 3-24 letters, numbers, spaces or . _ \' -');
    return out;
  }

  function statLine(p) {
    return p.kind === 'goalie'
      ? (p.saves || 0) + ' saves on ' + (p.shots_against || 0) + (p.shots_against ? ' (' + (p.saves / p.shots_against).toFixed(3).replace(/^0/, '') + ')' : '')
      : (p.goals || 0) + 'G ' + (p.assists || 0) + 'A, ' + (p.shots || 0) + ' SOG, ' + (p.hits || 0) + ' hits';
  }
  function hot(p) { return p.gp >= 4 && Number(p.fp_last3) >= 1.15 * Number(p.fp_season); }
  function poolRows() {
    var used = nationsUsed(S.cat), q = S.q.toLowerCase();
    var rows = S.pool.filter(function (p) { return p.category === S.cat && (!S.nation || p.nation === S.nation) && (!q || p.gamertag.toLowerCase().indexOf(q) >= 0); });
    rows.sort(function (a, b) { return S.sort === 'fp' ? b.fp_season - a.fp_season : S.sort === 'last3' ? b.fp_last3 - a.fp_last3 : b.price - a.price || b.fp_season - a.fp_season; });
    if (!rows.length) return '<p class="p4-empty">No players match.</p>';
    return rows.map(function (p) {
      var sel = S.draft[S.cat] === p.lg_user_id, clash = used[p.nation];
      return '<button type="button" class="p4-row' + (sel ? ' is-sel' : '') + (clash ? ' is-clash' : '') + '" data-pick="' + p.lg_user_id + '"' + (locked() ? ' disabled' : '') +
        (clash ? ' title="You already have a ' + esc(p.nation) + ' pick (' + esc(clash) + ')"' : '') + '>' +
        '<span class="p4-who"><b>' + esc(p.gamertag) + (hot(p) ? ' <span class="p4-hot" title="Last 3 games 15%+ above season average">🔥</span>' : '') + '</b><small>' + dot(p.nation) + esc(p.nation) + ' · ' + p.gp + ' GP · ' + esc(statLine(p)) + '</small></span>' +
        '<span class="p4-fig"><b>' + num(p.fp_season) + '</b><small>FP/GP</small></span>' +
        '<span class="p4-fig"><b>' + num(p.fp_last3) + '</b><small>LAST 3</small></span>' +
        '<span class="p4-price">' + money(p.price) + '</span></button>';
    }).join('');
  }
  function slotCard(s) {
    var p = S.byId[S.draft[s.id]], sc = p && S.scores[p.lg_user_id];
    var pts = locked() && p ? '<span class="p4-pts">' + num(sc ? sc.points : 0) + '<small>PTS · ' + (sc ? sc.gp : 0) + ' GP</small></span>' : '';
    return '<div class="p4-slot' + (p ? ' is-filled' : '') + (S.cat === s.id && !locked() ? ' is-active' : '') + '" data-slot="' + s.id + '" role="button" tabindex="0">' +
      '<span class="p4-slot-k">' + esc(s.label) + '</span>' +
      (p ? '<b>' + esc(p.gamertag) + '</b><small>' + dot(p.nation) + esc(p.nation) + ' · ' + money(p.price) + '</small>' + pts +
           (locked() ? '' : '<span class="p4-x" data-clear="' + s.id + '" aria-label="Remove">×</span>')
         : '<b class="p4-pick-me">Choose</b><small>' + esc(s.blurb) + '</small>') + '</div>';
  }

  function renderPicks() {
    var w = S.week, el = $('[data-p4-panel="picks"]');
    if (!w) { el.innerHTML = '<p class="p4-empty">The next week\'s player pool isn\'t open yet. Check back soon.</p>'; return; }
    var c = cost(), over = c > w.cap, lk = locked(), probs = problems();
    var total = lk ? SLOTS.reduce(function (t, s) { var sc = S.scores[S.draft[s.id]]; return t + (sc ? Number(sc.points) : 0); }, 0) : 0;
    var auth = S.user
      ? '<p class="p4-auth">Signed in as <b>' + esc(S.user.user_metadata && (S.user.user_metadata.full_name || S.user.user_metadata.name) || 'Discord user') + '</b> · <button type="button" class="p4-link" data-signout>Sign out</button></p>'
      : '<div class="p4-signin"><p>Sign in with Discord to lock in your picks. You can build your lineup first, and it\'ll wait for you.</p><button type="button" class="p4-btn p4-discord" data-signin>Sign in with Discord</button></div>';
    el.innerHTML =
      (lk ? '<div class="p4-banner">' + (S.mine ? 'Your lineup is locked. Total so far: <b>' + num(total) + ' pts</b>. Points update as games are verified.' : 'Picks for this week are locked. You can still follow the board, and next week opens after these games.') + '</div>' : auth) +
      '<div class="p4-lineup">' + SLOTS.map(slotCard).join('') + '</div>' +
      (lk ? '' :
        '<div class="p4-bar"><div class="p4-cap' + (over ? ' is-over' : '') + '"><span>Salary <b>' + money(c) + '</b> of ' + money(w.cap) + '</span><i style="--p:' + Math.min(100, c / w.cap * 100) + '%"></i></div>' +
        '<label class="p4-name">Team name <input type="text" maxlength="24" data-p4-name value="' + esc(S.name) + '" placeholder="Your team name"></label>' +
        '<button type="button" class="p4-btn" data-save' + (probs.length || !S.user ? ' disabled' : '') + '>' + (S.mine ? 'Update picks' : 'Lock in picks') + '</button></div>' +
        '<p class="p4-msg" data-p4-msg>' + esc(S.user ? (probs[0] || (S.mine ? 'Saved. You can change picks until the lock.' : 'Ready to lock in.')) : 'Sign in to save.') + '</p>' +
        '<div class="p4-tools"><div class="p4-cats" role="tablist">' + SLOTS.map(function (s) { return '<button type="button" role="tab" data-cat="' + s.id + '" aria-selected="' + (S.cat === s.id) + '">' + esc(s.label) + ' <small>' + S.pool.filter(function (p) { return p.category === s.id; }).length + '</small></button>'; }).join('') + '</div>' +
        '<div class="p4-filters"><input type="search" data-p4-q placeholder="Search gamertag" value="' + esc(S.q) + '"><select data-p4-nation><option value="">All nations</option>' +
          Array.from(new Set(S.pool.map(function (p) { return p.nation; }))).sort().map(function (n) { return '<option' + (n === S.nation ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
          '<select data-p4-sort><option value="price"' + (S.sort === 'price' ? ' selected' : '') + '>Sort: price</option><option value="fp"' + (S.sort === 'fp' ? ' selected' : '') + '>Sort: FP per game</option><option value="last3"' + (S.sort === 'last3' ? ' selected' : '') + '>Sort: last 3 games</option></select></div></div>' +
        '<div class="p4-pool">' + poolRows() + '</div>');
  }
  function renderWeek() {
    var el = $('[data-p4-panel="week"]'), w = S.week;
    if (!w) { el.innerHTML = ''; return; }
    if (!S.boardW.length) { el.innerHTML = '<p class="p4-empty">No entries yet for Week ' + w.week + '. Be the first.</p>'; return; }
    el.innerHTML = '<p class="p4-note">' + (locked() ? 'Live points from verified games. Picks are revealed now that the week is locked.' : 'Picks are revealed when the week locks (' + esc(lockText(w)) + ').') + '</p>' +
      '<div class="p4-table-wrap"><table class="p4-table"><thead><tr><th>#</th><th>Team</th><th>Points</th><th>Picks</th></tr></thead><tbody>' +
      S.boardW.map(function (r) {
        var picks = r.picks ? r.picks.map(function (p) { return '<span class="p4-chip">' + dot(p.nation) + esc(p.gamertag) + ' <b>' + num(p.points) + '</b></span>'; }).join('') : '<span class="p4-muted">Hidden until lock</span>';
        return '<tr><td>' + r.rank + '</td><td>' + esc(r.display_name) + '</td><td><b>' + num(r.points) + '</b></td><td>' + picks + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function renderSeason() {
    var el = $('[data-p4-panel="season"]');
    var prize = '<div class="p4-prize"><b>Season prize.</b> The top 2 on the overall board at the end of the season win a prize. The more people who play, the bigger the prizes get, so bring your friends.</div>';
    if (!S.boardS.length) { el.innerHTML = prize + '<p class="p4-empty">The season board starts with the first locked week.</p>'; return; }
    el.innerHTML = prize + '<div class="p4-table-wrap"><table class="p4-table"><thead><tr><th>#</th><th>Team</th><th>Total</th><th>Weeks</th><th>Best week</th></tr></thead><tbody>' +
      S.boardS.map(function (r) { return '<tr' + (r.rank <= 2 ? ' class="is-prize"' : '') + '><td>' + r.rank + (r.rank <= 2 ? ' <span class="p4-trophy" title="Prize spot">🏆</span>' : '') + '</td><td>' + esc(r.display_name) + '</td><td><b>' + num(r.points) + '</b></td><td>' + r.weeks + '</td><td>' + num(r.best_week) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function renderStatus() {
    var w = S.week, el = $('[data-p4-status]'); if (!el) return;
    el.innerHTML = w ? '<span><b>Week ' + w.week + '</b></span><span>Locks ' + esc(lockText(w)) + '</span><span data-p4-count></span><span>Cap ' + money(w.cap) + '</span><span>' + Number(w.entries || 0) + ' ' + (Number(w.entries) === 1 ? 'entry' : 'entries') + '</span>' : '<span>Opening soon</span>';
    countdown();
  }
  function render() {
    renderStatus(); renderPicks(); renderWeek(); renderSeason();
    [].forEach.call(root.querySelectorAll('[data-p4-tab]'), function (b) { var on = b.dataset.p4Tab === S.tab; b.setAttribute('aria-selected', on); });
    [].forEach.call(root.querySelectorAll('[data-p4-panel]'), function (p) { p.hidden = p.dataset.p4Panel !== S.tab; });
  }

  async function loadWeek() {
    var r = await db.from('lg3s_p4_weeks_public').select('*').order('week', { ascending: false });
    if (r.error) throw r.error;
    var weeks = r.data || [];
    S.week = weeks.find(function (w) { return w.status !== 'final'; }) || weeks[0] || null;
    if (!S.week) return;
    var wk = S.week.week;
    var res = await Promise.all([
      db.from('lg3s_p4_pool_public').select('*').eq('week', wk),
      db.from('lg3s_p4_player_scores').select('lg_user_id,points,gp').eq('week', wk),
      db.from('lg3s_p4_board_week').select('*').eq('week', wk).order('rank'),
      db.from('lg3s_p4_board_season').select('*').order('rank').limit(100)
    ]);
    res.forEach(function (x) { if (x.error) throw x.error; });
    S.pool = res[0].data || []; S.byId = {}; S.pool.forEach(function (p) { S.byId[p.lg_user_id] = p; });
    S.scores = {}; (res[1].data || []).forEach(function (s) { S.scores[s.lg_user_id] = s; });
    S.boardW = res[2].data || []; S.boardS = res[3].data || [];
  }
  async function loadMine() {
    S.mine = null; if (!S.user || !S.week) return;
    var r = await db.from('lg3s_p4_entries').select('*').eq('week', S.week.week).maybeSingle();
    if (r.data) { S.mine = r.data; S.draft = { superstar: r.data.superstar, breakout: r.data.breakout, diamond: r.data.diamond, goalie: r.data.goalie }; S.name = r.data.display_name; }
  }
  async function refresh() {
    try { await loadWeek(); loadDraft(); await loadMine(); if (locked() && !S.mine) S.draft = {};
      if (!S.name && S.user) { var m = S.user.user_metadata || {}; S.name = String(m.full_name || m.name || '').replace(/[^A-Za-z0-9 ._'-]/g, '').slice(0, 24); }
    } catch (e) { console.warn('Pick Your 4', e); $('[data-p4-panel="picks"]').innerHTML = '<p class="p4-empty">Pick Your 4 is unavailable right now.</p>'; return; }
    render();
  }

  root.addEventListener('click', async function (e) {
    var t = e.target.closest('button,[data-slot],[data-clear]'); if (!t) return;
    if (t.dataset.p4Tab) { S.tab = t.dataset.p4Tab; render(); return; }
    if (t.dataset.clear) { e.stopPropagation(); delete S.draft[t.dataset.clear]; S.cat = t.dataset.clear; saveDraft(); renderPicks(); return; }
    if (t.dataset.slot && !locked()) { S.cat = t.dataset.slot; renderPicks(); return; }
    if (t.dataset.cat) { S.cat = t.dataset.cat; renderPicks(); return; }
    if (t.dataset.pick) {
      var p = S.byId[t.dataset.pick]; if (!p) return;
      var clash = nationsUsed(p.category)[p.nation];
      if (clash) { var m = $('[data-p4-msg]'); if (m) m.textContent = 'You already have a ' + p.nation + ' pick (' + clash + '). Four different nations.'; return; }
      S.draft[p.category] = p.lg_user_id; saveDraft();
      var next = SLOTS.find(function (s) { return !S.draft[s.id]; }); if (next) S.cat = next.id;
      renderPicks(); return;
    }
    if (t.hasAttribute('data-signin')) {
      saveDraft(); try { localStorage.setItem('p4:return', '1'); } catch (x) {}
      var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      await db.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: (local ? location.origin : PROD) + location.pathname + '#pick4', scopes: 'identify' } });
      return;
    }
    if (t.hasAttribute('data-signout')) { await db.auth.signOut(); return; }
    if (t.hasAttribute('data-save')) {
      var msg = $('[data-p4-msg]'), probs = problems(); if (probs.length) { msg.textContent = probs[0]; return; }
      t.disabled = true; msg.textContent = 'Saving…';
      var r = await db.rpc('lg3s_p4_save', { p_week: S.week.week, p_superstar: S.draft.superstar, p_breakout: S.draft.breakout, p_diamond: S.draft.diamond, p_goalie: S.draft.goalie, p_name: S.name.trim() });
      if (r.error) { msg.textContent = r.error.message || 'Could not save.'; t.disabled = false; return; }
      try { localStorage.removeItem(DKEY); } catch (x) {}
      await refresh(); var m2 = $('[data-p4-msg]'); if (m2) m2.textContent = 'Locked in. You can change picks until ' + lockText(S.week) + '.';
    }
  });
  root.addEventListener('input', function (e) {
    if (e.target.matches('[data-p4-name]')) { S.name = e.target.value; saveDraft(); var b = $('[data-save]'), probs = problems(), m = $('[data-p4-msg]'); if (b) b.disabled = !!probs.length || !S.user; if (m && S.user) m.textContent = probs[0] || 'Ready to lock in.'; }
    if (e.target.matches('[data-p4-q]')) { S.q = e.target.value; $('.p4-pool').innerHTML = poolRows(); }
  });
  root.addEventListener('change', function (e) {
    if (e.target.matches('[data-p4-nation]')) { S.nation = e.target.value; $('.p4-pool').innerHTML = poolRows(); }
    if (e.target.matches('[data-p4-sort]')) { S.sort = e.target.value; $('.p4-pool').innerHTML = poolRows(); }
  });
  root.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.slot) { e.preventDefault(); e.target.click(); } });

  db.auth.onAuthStateChange(function (_ev, session) {
    var u = session ? session.user : null, changed = (u && u.id) !== (S.user && S.user.id);
    S.user = u; if (changed) refresh();
    try { if (u && localStorage.getItem('p4:return')) { localStorage.removeItem('p4:return'); root.scrollIntoView(); } } catch (e) {}
  });
  setInterval(function () { countdown(); if (S.week && locked() && $('[data-save]')) render(); }, 30000);
  db.auth.getSession().then(function (r) { S.user = r.data.session ? r.data.session.user : null; refresh(); });
})();
