/* Hitmen Radio studio set (homepage): lights the on-air lamp + waveform while any episode video is playing, and drives the transport button. */
(function () {
  'use strict';
  var s = document.getElementById('hitmanNightly'); if (!s || !s.classList.contains('hn-studio')) return;
  var btn = s.querySelector('[data-hs-play]'), label = btn && btn.querySelector('[data-hs-label]'), active = null;
  function vids() { return [].slice.call(s.querySelectorAll('video')); }
  function playing() { return vids().some(function (v) { return !v.paused && !v.ended; }); }
  function sync() {
    var on = playing(); s.classList.toggle('is-live', on);
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); if (label) label.textContent = on ? 'Pause' : 'Play'; }
  }
  // media events don't bubble: listen in the capture phase so featured cards added later are covered too.
  ['play', 'playing', 'pause', 'ended', 'emptied'].forEach(function (t) {
    s.addEventListener(t, function (e) { if (e.target.tagName === 'VIDEO') { if (t === 'play' || t === 'playing') active = e.target; sync(); } }, true);
  });
  if (btn) btn.addEventListener('click', function () {
    var v = (active && s.contains(active) && active) || vids()[0]; if (!v) return;
    if (playing()) vids().forEach(function (x) { x.pause(); }); else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  });
})();
