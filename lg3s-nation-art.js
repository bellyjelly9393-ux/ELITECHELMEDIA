/* LG3s nation background art. Only slugs listed here have art; anything else
   (unknown or future nations) returns null so callers keep the neutral background. */
(function () {
  'use strict';
  const AVAILABLE = new Set(['canada','germany','great-britain','italy','japan','kazakhstan','latvia','poland','slovakia','sweden','switzerland','usa']);
  const ALIAS = { 'united-states': 'usa', 'us': 'usa', 'gb': 'great-britain', 'uk': 'great-britain', 'united-kingdom': 'great-britain' };
  const slug = n => { const s = String(n || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''); return ALIAS[s] || s; };
  function src(name, size) { const s = slug(name); return AVAILABLE.has(s) ? 'assets/lg3s/nations/' + s + '-' + (size === 'hero' ? 'hero' : 'card') + '.webp' : null; }
  function css(name, size) { const u = src(name, size); return u ? 'url("' + u + '")' : 'none'; }
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* Reusable split matchup banner, built in code from the per-nation art (no per-pairing images).
     opts: { away:{name,mark,label}, home:{name,mark,label}, final:{away,home,note}|null, meta, size:'card'|'hero' }
     mark is trusted crest HTML from the caller; scores come only from verified data. */
  function matchup(o) {
    const size = o.size === 'hero' ? 'hero' : 'card';
    const fin = o.final && Number.isFinite(+o.final.away) && Number.isFinite(+o.final.home) ? o.final : null;
    const side = (t, cls, won) => '<div class="lg3m-side ' + cls + (won ? ' is-win' : '') + '">' + (t.mark || '') + '<strong>' + esc(t.name) + '</strong>' + (t.label ? '<small>' + esc(t.label) + '</small>' : '') + '</div>';
    const center = fin
      ? '<div class="lg3m-center is-final"><span class="lg3m-score"><b>' + Number(fin.away) + '</b><i>–</i><b>' + Number(fin.home) + '</b></span><small>' + esc(fin.note || 'FINAL') + '</small></div>'
      : '<div class="lg3m-center"><span class="lg3m-vs">VS</span></div>';
    return '<div class="lg3m lg3m-' + size + '" style="--ma:' + esc(css(o.away.name, size)) + ';--mh:' + esc(css(o.home.name, size)) + '">' +
      '<span class="lg3m-bg" aria-hidden="true"><i class="lg3m-a"></i><i class="lg3m-h"></i><em></em></span>' +
      side(o.away, 'lg3m-away', fin && +fin.away > +fin.home) + center + side(o.home, 'lg3m-home', fin && +fin.home > +fin.away) +
      (o.meta ? '<p class="lg3m-meta">' + esc(o.meta) + '</p>' : '') + '</div>';
  }
  window.LG3S_NATION_ART = { slug, src, css, has: n => AVAILABLE.has(slug(n)), matchup };
})();
