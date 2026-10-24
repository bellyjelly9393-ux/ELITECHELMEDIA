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
  function key(e) { return e.id || e.date; }
  function load(vid, ep) {
    vid.pause(); vid.removeAttribute('src'); while (vid.firstChild) vid.removeChild(vid.firstChild);
    vid.poster = ep.poster || '';
    // Optional lighter phone file: browsers that honour <source media> pick it on small screens; others use the main file.
    if (ep.videoPhone) { var ps = document.createElement('source'); ps.src = ep.videoPhone; ps.type = 'video/mp4'; ps.media = '(max-width: 860px)'; vid.appendChild(ps); }
    var src = document.createElement('source'); src.src = ep.video; src.type = 'video/mp4'; vid.appendChild(src); vid.load();
  }
  var dual = null; // { cards: [{ el, video, ep }] } when 2+ episodes are featured together
  function playDual(ep, scroll) {
    var c = dual.cards.filter(function (x) { return key(x.ep) === key(ep); })[0];
    if (!c) { c = dual.cards.filter(function (x) { return (x.ep.type || 'nightly') === (ep.type || 'nightly'); })[0] || dual.cards[0]; fill(c, ep); }
    s.querySelectorAll('.hn-ep').forEach(function (b) { b.setAttribute('aria-current', dual.cards.some(function (x) { return key(x.ep) === b.dataset.ep; }) ? 'true' : 'false'); });
    if (scroll) c.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function fill(c, ep) {
    c.ep = ep; c.el.id = 'ep-' + key(ep); load(c.video, ep);
    c.el.querySelector('[data-k=kind]').textContent = ep.type === 'recap' ? 'Weekly recap' : ep.type === 'preview' ? 'Week ahead preview' : 'Nightly show';
    c.el.querySelector('[data-k=title]').textContent = ep.title || (ep.type === 'recap' ? 'Hitmen Radio — Weekly Recap' : ep.type === 'preview' ? 'Hitmen Radio — Week Ahead' : 'Hitmen Radio — Nightly Show');
    c.el.querySelector('[data-k=date]').textContent = ep.label || ep.date;
    c.el.querySelector('[data-k=headline]').textContent = ep.headline || '';
    var ds = c.el.querySelector('[data-k=desc]'); ds.textContent = ep.description || ''; ds.hidden = !ep.description;
    var cr = c.el.querySelector('[data-k=credits]'); cr.innerHTML = ep.credits ? linkify(ep.credits) : ''; cr.hidden = !ep.credits;
  }
  function buildDual(list) {
    var box = document.createElement('div'); box.className = 'hn-dual' + (list.length === 1 ? ' hn-solo' : '');
    box.innerHTML = '<div class="hn-dual-head"><div class="hn-head"><img class="hn-mark" src="assets/brand/elitechel-mark-48@2x.png" width="36" height="36" alt=""><span class="hn-brand">EliteChel Media</span></div>' +
      '<h2 class="hn-title">Hitmen Radio <em>— ' + (list.length > 1 ? 'Dual Feature' : 'New Episode') + '</em></h2><p class="hn-dual-sub">' + (list.length > 1 ? list.length + ' new episodes today' : 'Latest episode') + '</p></div><div class="hn-dual-grid"></div>';
    var grid = box.querySelector('.hn-dual-grid'), cards = [];
    list.forEach(function (ep) {
      var el = document.createElement('article'); el.className = 'hn-card hn-card-' + esc(ep.type || 'nightly');
      el.innerHTML = '<div class="hn-frame"><video class="hn-video" controls playsinline preload="metadata" width="1280" height="720"></video></div>' +
        '<div class="hn-card-copy"><p class="hn-kind" data-k="kind"></p><h3 class="hn-card-title" data-k="title"></h3>' +
        '<span class="hn-date"><i aria-hidden="true"></i><span data-k="date"></span></span><p class="hn-headline" data-k="headline"></p>' +
        '<p class="hn-desc" data-k="desc"></p><p class="hn-credit" data-k="credits" hidden></p></div>';
      grid.appendChild(el); var c = { el: el, video: el.querySelector('video') }; c.video.setAttribute('aria-label', ep.title || 'Hitmen Radio video'); fill(c, ep); cards.push(c);
    });
    var inn = s.querySelector('.hn-in'); inn.hidden = true; inn.style.display = 'none';
    s.insertBefore(box, arch);
    // Keep the section's aria-labelledby target meaningful.
    var t = s.querySelector('.hn-in .hn-title'); if (t) { var id = t.id; t.removeAttribute('id'); box.querySelector('.hn-title').id = id; }
    return { cards: cards };
  }
  function play(ep, scroll) {
    if (!ep) return;
    if (dual) return playDual(ep, scroll);
    load(v, ep);
    if (lbl) lbl.textContent = ep.label || ep.date;
    if (hl) hl.textContent = ep.headline || '';
    if (cr) { cr.innerHTML = ep.credits ? linkify(ep.credits) : ''; cr.hidden = !ep.credits; }
    s.querySelectorAll('.hn-ep').forEach(function (b) { b.setAttribute('aria-current', b.dataset.ep === key(ep) ? 'true' : 'false'); });
    var f = s.querySelector('[data-hn-featured]'); if (f && eps[0]) f.hidden = eps.length < 2 || key(ep) === key(eps[0]);
    if (scroll) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function defEp() { var want = s.dataset.default; return (want && eps.filter(function (e) { return key(e) === want; })[0]) || eps[0]; }
  function byHash() { var m = /^#ep-(\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?)$/.exec(location.hash); return m && eps.filter(function (e) { return key(e) === m[1]; })[0]; }
  function render() {
    var def = defEp(), past = eps.filter(function (e) { return dual ? !dual.cards.some(function (c) { return c.ep === e; }) : e !== def; }); if (!past.length) { arch.hidden = true; return; }
    var groups = [], cur = null;
    past.forEach(function (e) { var w = weekStart(e.date).getTime(); if (!cur || cur.w !== w) groups.push(cur = { w: w, list: [] }); cur.list.push(e); });
    var html = '<h3 class="hn-arch-title">Catch up — past episodes</h3>';
    groups.forEach(function (g, i) {
      var end = new Date(g.w); end.setDate(end.getDate() + 6);
      html += '<div class="hn-week"' + (i >= WEEKS ? ' data-older hidden' : '') + '><p class="hn-week-lbl">Week of ' + fmt(new Date(g.w)) + ' – ' + fmt(end) + '</p><div class="hn-row">';
      g.list.forEach(function (e) {
        html += '<a class="hn-ep" href="#ep-' + esc(key(e)) + '" data-ep="' + esc(key(e)) + '"><img src="' + esc(e.poster) + '" alt="" loading="lazy" width="320" height="180"><span><b>' + esc(e.label || e.date) + '</b><small>' + esc(e.headline || '') + '</small></span></a>';
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
    // Featured list: "featured": ["id", ...] in episodes.json. 2+ resolvable ids (and no data-default pin) = side-by-side double feature; 1 id = single featured card with title/description.
    var fl = (j.featured || []).map(function (id) { return eps.filter(function (e) { return key(e) === id; })[0]; }).filter(Boolean);
    if (fl.length >= 1 && fl.indexOf(eps[0]) >= 0 && !s.dataset.default) dual = buildDual(fl);
    var featured = s.querySelector('[data-hn-featured]'); render();
    // Featured card for the newest episode at the head of the archive area, so the latest is always one tap away.
    if (featured && eps[0]) { featured.href = '#ep-' + key(eps[0]); featured.dataset.ep = key(eps[0]); featured.textContent = 'Back to latest (' + (eps[0].label || eps[0].date) + ')'; }
    var h = byHash(); if (dual) { if (h) play(h, false); } else play(h || defEp(), false);
    // Re-anchor after async page content shifts layout (keeps #id / #ep- links landing under the sticky menu).
    if (h && dual) { var hc = h; [0, 600, 1500].forEach(function (t) { setTimeout(function () { var el = document.getElementById('ep-' + key(hc)); (el || s).scrollIntoView({ block: 'start' }); }, t); }); }
    else if (h || location.hash === '#' + s.id || (s.dataset.alias && location.hash === '#' + s.dataset.alias)) [0, 600, 1500].forEach(function (t) { setTimeout(function () { s.scrollIntoView({ block: 'start' }); }, t); });
  }).catch(function () { var f = s.querySelector('[data-hn-fallback]'); if (f) f.hidden = false; });
 });
})();
