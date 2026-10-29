/* Decorative playback indicator. Native player, episode loading and controls stay authoritative. */
(function () {
  'use strict';
  var studio = document.getElementById('hitmanNightly');
  if (!studio) return;
  var active = new Set();
  function update(event) {
    var media = event.target;
    if (!media.matches || !media.matches('video, audio')) return;
    if (event.type === 'playing') active.add(media);
    else active.delete(media);
    active.forEach(function (item) {
      if (!studio.contains(item) || item.paused || item.ended) active.delete(item);
    });
    var playing = active.size > 0;
    studio.dataset.playing = String(playing);
    var label = studio.querySelector('[data-hrs-status]');
    if (label) label.textContent = playing ? 'NOW PLAYING' : 'READY TO PLAY';
  }
  // Capture also covers dynamically generated single and multi-feature players.
  ['playing', 'pause', 'waiting', 'stalled', 'ended', 'emptied', 'error'].forEach(function (name) {
    studio.addEventListener(name, update, true);
  });
})();
