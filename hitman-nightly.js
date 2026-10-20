/* Hitmen Radio — Nightly Show player + archive. Data lives in assets/hitman-radio/nightly/episodes.json (see README there). */
(function () {
 /* Works on any page: every <section class="hn" data-manifest="..."> becomes a player. Episode links use #ep-YYYY-MM-DD. */
 document.querySelectorAll('section.hn[data-manifest]').forEach(function (s) {
  var v = s.querySelector('video'), lbl = s.querySelector('[data-hn-date]'), hl = s.querySelector('[data-hn-headline]'),
      cr = s.querySelector('[data-hn-credits]'), arch = s.querySelector('[data-hn-archive]'), WEEKS = 3, eps = [];
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function linkify(t) { return esc(t).replace(/\btwitch\.tv\/([A-Za-z0-9_]+)/g, '<a href="https://twitch.tv/$1" target="_blank" rel="noopener">twitch.tv/$1</a>'); }
  function d(x) { return new Date(x + 'T12:00:00'); }
  function weekStart(x) { var t = d(x), k = (t.getDay() + 6) % 7; t.setDate(t.getDate() - k); return t; }
  function fmt(t) { return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function play(ep, scroll) {
    if (!ep) return;
    v.pause(); v.removeAttribute('src'); while (v.firstChild) v.removeChild(v.firstChild);
    v.poster = ep.poster || ''; var src = document.createElement('source'); src.src = ep.video; src.type = 'video/mp4'; v.appendChild(src); v.load();
    if (lbl) lbl.textContent = ep.label || ep.date;
    if (hl) hl.textContent = ep.headline || '';
    if (cr) { cr.innerHTML = ep.credits ? linkify(ep.credits) : ''; cr.hidden = !ep.credits; }
    s.querySelectorAll('.hn-ep').forEach(function (b) { b.setAttribute('aria-current', b.dataset.ep === ep.date ? 'true' : 'false'); });
    var f = s.querySelector('[data-hn-featured]'); if (f && eps[0]) f.hidden = ep.date === eps[0].date;
    if (scroll) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function defEp() { var want = s.dataset.default; return (want && eps.filter(function (e) { return e.date === want; })[0]) || eps[0]; }
  function byHash() { var m = /^#ep-(\d{4}-\d{2}-\d{2})$/.exec(location.hash); return m && eps.filter(function (e) { return e.date === m[1]; })[0]; }
  function render() {
    var def = defEp(), past = eps.filter(function (e) { return e !== def; }); if (!past.length) { arch.hidden = true; return; }
    var groups = [], cur = null;
    past.forEach(function (e) { var w = weekStart(e.date).getTime(); if (!cur || cur.w !== w) groups.push(cur = { w: w, list: [] }); cur.list.push(e); });
    var html = '<h3 class="hn-arch-title">Catch up — past episodes</h3>';
    groups.forEach(function (g, i) {
      var end = new Date(g.w); end.setDate(end.getDate() + 6);
      html += '<div class="hn-week"' + (i >= WEEKS ? ' data-older hidden' : '') + '><p class="hn-week-lbl">Week of ' + fmt(new Date(g.w)) + ' – ' + fmt(end) + '</p><div class="hn-row">';
      g.list.forEach(function (e) {
        html += '<a class="hn-ep" href="#ep-' + esc(e.date) + '" data-ep="' + esc(e.date) + '"><img src="' + esc(e.poster) + '" alt="" loading="lazy" width="320" height="180"><span><b>' + esc(e.label || e.date) + '</b><small>' + esc(e.headline || '') + '</small></span></a>';
      });
      html += '</div></div>';
    });
    if (groups.length > WEEKS) html += '<button type="button" class="hn-more">Show more</button>';
    arch.innerHTML = html; arch.hidden = false;
    var more = arch.querySelector('.hn-more');
    if (more) more.addEventListener('click', function () { arch.querySelectorAll('[data-older]').forEach(function (n) { n.hidden = false; }); more.remove(); });
  }
  window.addEventListener('hashchange', function () { var e = byHash(); if (e) play(e, true); });
  fetch(s.dataset.manifest, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    eps = (j.episodes || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var featured = s.querySelector('[data-hn-featured]'); render();
    // Featured card for the newest episode at the head of the archive area, so the latest is always one tap away.
    if (featured && eps[0]) { featured.href = '#ep-' + eps[0].date; featured.dataset.ep = eps[0].date; featured.textContent = 'Back to latest (' + (eps[0].label || eps[0].date) + ')'; }
    var h = byHash(); play(h || defEp(), false);
    // Re-anchor after async page content shifts layout (keeps #id / #ep- links landing under the sticky menu).
    if (h || location.hash === '#' + s.id || (s.dataset.alias && location.hash === '#' + s.dataset.alias)) [0, 600, 1500].forEach(function (t) { setTimeout(function () { s.scrollIntoView({ block: 'start' }); }, t); });
  }).catch(function () { var f = s.querySelector('[data-hn-fallback]'); if (f) f.hidden = false; });
 });
})();
