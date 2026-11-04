/* LGCHL Night in Review (lgchl-media.html #lgRecaps). Data: assets/lgchl-recaps/index.json -> <date>.json,
   built from the night's markdown by tools/lgchl-recaps-build.py. Newest night first; deep links #recap-<game>. */
(function () {
  var s = document.querySelector('section[data-recaps]');
  if (!s) return;
  var base = s.dataset.recaps.replace(/[^/]*$/, ''), nights = s.querySelector('.rc-nights'), body = s.querySelector('.rc-body');
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ORD = ['', '1st', '2nd', '3rd'];
  /* Team logos: assets/logos/chl/<slug>.png (see assets/logos/chl/index.json). Any team without a logo, or whose
     image fails to load, shows text initials in the same slot. */
  function slugify(n) { return String(n || '').toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function initials(n) { return String(n || '').replace(/[^A-Za-z0-9 \-.]/g, '').split(/[\s\-.]+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase(); }
  function logo(t, cls) {
    if (!t || !t.name) return '';
    var ini = '<span class="rc-ini" aria-hidden="true">' + esc(initials(t.name)) + '</span>';
    return '<span class="rc-logo' + (cls ? ' ' + cls : '') + (t.logo ? '' : ' is-ini') + '" title="' + esc(t.name) + '">' + (t.logo ? '<img src="' + esc(t.logo) + '" alt="" width="96" height="96" loading="lazy" decoding="async">' : '') + ini + '</span>';
  }
  function teamOf(name, logoPath) { name = String(name || '').split(',')[0].trim(); return { name: name, logo: logoPath === undefined ? 'assets/logos/chl/' + slugify(name) + '.png' : logoPath }; }
  function sides(g) {
    if (g.away && g.home) return g;
    var m = /^(.+?) (\d+) @ (.+?) (\d+)(?: \((\w+)\))?$/.exec(g.matchup || '');
    if (m) { g.away = teamOf(m[1]); g.away.score = m[2]; g.home = teamOf(m[3]); g.home.score = m[4]; g.decision = m[5]; }
    return g;
  }
  function matchHead(g) {
    sides(g);
    if (!g.away) return '<span class="rc-match">' + esc(g.matchup || '') + (g.game ? ' · Game ' + esc(g.game) : '') + '</span>';
    function side(t) { return '<span class="rc-side">' + logo(t) + '<span class="rc-tn">' + esc(t.name) + '</span><b class="rc-sc">' + esc(t.score) + '</b></span>'; }
    return '<span class="rc-match">' + side(g.away) + '<span class="rc-at">@</span>' + side(g.home) + '<span class="rc-gm">' + (g.decision ? esc(g.decision) + ' · ' : '') + 'Game ' + esc(g.game) + '</span></span>';
  }
  function starMark(n) { return '<span class="rc-star" aria-label="' + ORD[n] + ' star">' + new Array(n + 1).join('&#9733;') + '</span>'; }
  function starList(st, note) {
    if (!st.length) return note ? '<p class="rc-note">' + esc(note) + '</p>' : '';
    return '<ol class="rc-stars">' + st.map(function (x) { return '<li>' + starMark(x.n) + '<span class="rc-ord">' + ORD[x.n] + ' Star</span><strong>' + esc(x.player) + '</strong><span class="rc-team">' + logo(teamOf(x.team, x.logo), 'rc-logo-s') + esc(x.team) + '</span><span class="rc-line">' + esc(x.line) + '</span></li>'; }).join('') + '</ol>';
  }
  function gameCard(g) {
    return '<details class="rc-game" id="recap-' + esc(g.game || '') + '"><summary>' + matchHead(g) + '<span class="rc-title">' + esc(g.title) + '</span></summary><div class="wu-text">' + g.html + '<h4>Three Stars</h4>' + starList(g.stars, g.starsNote) + '</div></details>';
  }
  function hasFinal(g) { return g.final !== false && !!g.game; } /* no-final games (e.g. 918376) are not shown */
  function render(d) {
    d.slots = d.slots.map(function (x) { return { slot: x.slot, games: x.games.filter(hasFinal) }; }).filter(function (x) { return x.games.length; });
    d.hitmen.games = d.hitmen.games.filter(hasFinal);
    var slotBtns = '<div class="rc-filter" role="group" aria-label="Filter by time slot"><button type="button" data-slot="all" aria-pressed="true">All slots</button>' + d.slots.map(function (x, i) { return '<button type="button" data-slot="' + i + '" aria-pressed="false">' + esc(x.slot) + ' (' + x.games.length + ')</button>'; }).join('') + '</div>';
    body.innerHTML =
      '<div class="rc-top"><div class="rc-block rc-league"><p class="rc-kicker">League Three Stars of the Night</p><div class="wu-text">' + d.threeStars + '</div></div>' +
      '<div class="rc-block rc-hitmen"><p class="rc-kicker">' + logo(teamOf('Calgary Hitmen', d.hitmenLogo || 'assets/logos/chl/calgary-hitmen.png'), 'rc-logo-l') + '' + esc(d.hitmen.title || 'Hitmen Watch') + '</p><div class="wu-text">' + d.hitmen.html + '</div><div class="rc-list">' + d.hitmen.games.map(gameCard).join('') + '</div></div></div>' +
      '<details class="rc-block rc-intro"><summary>About tonight\'s data</summary><div class="wu-text">' + d.intro + '</div></details>' +
      '<h3 class="rc-h">Game-by-game recaps</h3>' + slotBtns +
      d.slots.map(function (x, i) { return '<div class="rc-slot" data-slot="' + i + '"><p class="rc-slot-h">' + esc(x.slot) + ' slot · ' + x.games.length + ' games</p><div class="rc-list">' + x.games.map(gameCard).join('') + '</div></div>'; }).join('');
    (d.threeStarsTeams || []).forEach(function (t, i) { var p = body.querySelectorAll('.rc-league .rc-num')[i]; if (p) { p.classList.add('rc-num-logo'); p.insertAdjacentHTML('afterbegin', logo(t, 'rc-logo-m')); } });
    body.querySelector('.rc-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      [].forEach.call(this.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      [].forEach.call(body.querySelectorAll('.rc-slot'), function (el) { el.hidden = b.dataset.slot !== 'all' && el.dataset.slot !== b.dataset.slot; });
    });
    var h = location.hash.slice(1); if (/^recap-/.test(h)) { var el = document.getElementById(h); if (el) { el.open = true; el.scrollIntoView(); } }
  }
  body.addEventListener('error', function (e) { var im = e.target; if (im.tagName === 'IMG' && im.parentNode.classList.contains('rc-logo')) { im.parentNode.classList.add('is-ini'); im.remove(); } }, true);
  function load(n) {
    [].forEach.call(nights.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.file === n.file ? 'true' : 'false'); });
    fetch(base + n.file, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(render).catch(function () { body.innerHTML = '<p class="empty">This night\'s recaps are unavailable right now.</p>'; });
  }
  fetch(s.dataset.recaps, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    var list = j.nights || [];
    if (!list.length) { body.innerHTML = '<p class="empty">No recaps yet.</p>'; return; }
    nights.innerHTML = list.map(function (n) { return '<button type="button" data-file="' + esc(n.file) + '">' + esc(n.label) + '</button>'; }).join('');
    nights.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) list.forEach(function (n) { if (n.file === b.dataset.file) load(n); }); });
    load(list[0]);
  }).catch(function () { body.innerHTML = '<p class="empty">Recaps are unavailable right now.</p>'; });
})();
