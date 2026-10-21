/* LGCHL written write-ups ("This week in the LGCHL"). Data-driven like the Hitmen Radio player:
   <section data-writeups="assets/lgchl-writeups/writeups.json">. Newest week first; older weeks stay selectable.
   Deep links: #lgWriteups, #wu-<item id>, #week-<week id>. Content is site-authored HTML from the repo manifest. */
(function () {
  var s = document.querySelector('section[data-writeups]');
  if (!s) return;
  var tabs = s.querySelector('.wu-weeks'), body = s.querySelector('.wu-body');
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(d) { var p = d.split('-'); return new Date(+p[0], p[1] - 1, +p[2]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function render(w, openId) {
    body.innerHTML = '<p class="wu-range">' + esc(w.range) + '</p>' + w.items.map(function (it, i) {
      var open = openId ? it.id === openId : i === 0;
      return '<details class="card wu-item" id="' + esc(it.id) + '"' + (open ? ' open' : '') + '><summary><span class="wu-kind">' + esc(it.kind) + ' · ' + esc(fmt(it.date)) + '</span><span class="wu-title">' + esc(it.title) + '</span></summary><div class="wu-text">' + it.html + '</div></details>';
    }).join('');
    [].forEach.call(tabs.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.week === w.id ? 'true' : 'false'); });
  }
  fetch(s.dataset.writeups, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    var weeks = j.weeks || [];
    if (!weeks.length) { body.innerHTML = '<p class="empty">No write-ups yet.</p>'; return; }
    tabs.innerHTML = weeks.map(function (w) { return '<button type="button" data-week="' + esc(w.id) + '">' + esc(w.label) + '</button>'; }).join('');
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; weeks.forEach(function (w) { if (w.id === b.dataset.week) render(w); }); });
    var h = location.hash.slice(1), wk = weeks[0], item = null;
    weeks.forEach(function (w) { if (h === 'week-' + w.id) wk = w; w.items.forEach(function (it) { if (it.id === h) { wk = w; item = h; } }); });
    render(wk, item);
    if (item) { var el = document.getElementById(item); if (el) el.scrollIntoView(); }
  }).catch(function () { body.innerHTML = '<p class="empty">Write-ups are unavailable right now.</p>'; });
})();
