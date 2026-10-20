/* Hitman Radio — Nightly Show. To swap nights, edit ONLY the data-* attributes on <section id="hitmanNightly"> in index.html. */
(function () {
  var s = document.getElementById('hitmanNightly'); if (!s) return;
  var d = s.dataset, v = s.querySelector('video'), lbl = s.querySelector('[data-hn-date]');
  if (lbl && d.dateLabel) lbl.textContent = d.dateLabel;
  if (v && d.video) { if (d.poster) v.poster = d.poster; var src = document.createElement('source'); src.src = d.video; src.type = 'video/mp4'; v.appendChild(src); v.load(); }
})();
