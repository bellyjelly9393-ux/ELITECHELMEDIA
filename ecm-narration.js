/* ECM narration player, separate from Hitmen Radio.
   Public media: supply {approved:true,src:"assets/narration/...mp3",voice_label:"..."}.
   Private reports: a signed URL returned after authorization, never a public asset URL. */
(function () {
  'use strict';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function publicPath(src) {
    var path = String(src || '').trim();
    // Public narration is an explicitly reviewed, repository-owned MP3 asset.
    // No arbitrary URLs, traversal, query strings, or unreviewed sources.
    return /^assets\/narration\/[A-Za-z0-9/_-]+\.mp3$/.test(path) && !path.includes('//') ? path : '';
  }
  function build(src, title, voiceLabel) {
    if (!src) return '';
    var voice = voiceLabel ? '<span class="ecm-narration-voice">' + esc(voiceLabel) + '</span>' : '';
    return '<section class="ecm-narration" aria-label="' + esc(title) + '">' +
      '<div class="ecm-narration-top"><span class="ecm-narration-symbol" aria-hidden="true">▶</span>' +
      '<div><strong>' + esc(title) + '</strong><small>Audio edition · AI-generated narration</small></div>' +
      voice + '</div>' +
      '<audio controls preload="metadata" aria-label="' + esc(title) + '">' +
      '<source src="' + esc(src) + '" type="audio/mpeg">' +
      'Your browser does not support audio playback.</audio></section>';
  }
  function publicPlayer(audio, title) {
    if (!audio || audio.approved !== true) return '';
    var src = publicPath(audio.src);
    return src ? build(src, title || 'Listen to this report', audio.voice_label || '') : '';
  }
  // Only pass URLs supplied by authenticated Supabase Storage createSignedUrl().
  function signedPlayer(url, title, voiceLabel) {
    try {
      var parsed = new URL(String(url), location.origin);
      if (parsed.protocol !== 'https:') return '';
      return build(parsed.href, title || 'Listen to scouting report', voiceLabel || '');
    } catch (_) { return ''; }
  }
  window.ECMNarration = Object.freeze({ publicPlayer: publicPlayer, signedPlayer: signedPlayer });
})();