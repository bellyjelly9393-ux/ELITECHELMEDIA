/* LG3s nation background art. Only slugs listed here have art; anything else
   (unknown or future nations) returns null so callers keep the neutral background. */
(function () {
  'use strict';
  const AVAILABLE = new Set(['canada','germany','great-britain','italy','japan','kazakhstan','latvia','poland','slovakia','sweden','switzerland','usa']);
  const ALIAS = { 'united-states': 'usa', 'us': 'usa', 'gb': 'great-britain', 'uk': 'great-britain', 'united-kingdom': 'great-britain' };
  const slug = n => { const s = String(n || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''); return ALIAS[s] || s; };
  function src(name, size) { const s = slug(name); return AVAILABLE.has(s) ? 'assets/lg3s/nations/' + s + '-' + (size === 'hero' || size === 'banner' ? size : 'card') + '.webp' : null; }
  function css(name, size) { const u = src(name, size); return u ? 'url("' + u + '")' : 'none'; }
  const COLORS = { canada:['#e3262f','#ffffff'], usa:['#2f5bd3','#d8323c'], sweden:['#1e6fd6','#f6c600'], switzerland:['#e2231a','#ffffff'], kazakhstan:['#00a6d6','#f4c430'], germany:['#dd1d1d','#ffce00'], japan:['#d7263d','#ffffff'], italy:['#16a34a','#d8323c'], latvia:['#9e1b32','#ffffff'], poland:['#dc143c','#ffffff'], 'great-britain':['#1f4fbf','#d8323c'], slovakia:['#1f56c4','#e0313b'] };
  const color = (n, i) => (COLORS[slug(n)] || ['#9aa7b3', '#c9d3dc'])[i || 0];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* Reusable split matchup banner, built in code from the per-nation art (no per-pairing images).
     opts: { away:{name,mark,label}, home:{name,mark,label}, final:{away,home,note}|null, meta, size:'card'|'hero' }
     mark is trusted crest HTML from the caller; scores come only from verified data. */
  function matchup(o) {
    const size = o.size === 'hero' ? 'hero' : 'card';
    const fin = o.final && Number.isFinite(+o.final.away) && Number.isFinite(+o.final.home) ? o.final : null;
    const side = (t, cls, won) => '<div class="lg3m-side ' + cls + (won ? ' is-win' : '') + '"><span class="lg3m-badge">' + (t.mark || '') + '</span><span class="lg3m-plate"><strong style="--n:' + Math.max(4, ...String(t.name || '').split(/\s+/).map(w => w.length)) + '">' + esc(t.name) + '</strong>' + (t.label ? '<small>' + esc(t.label) + '</small>' : '') + '</span></div>';
    const center = fin
      ? '<div class="lg3m-center lg3m-chip is-final"><span class="lg3m-score"><b>' + Number(fin.away) + '</b><i>–</i><b>' + Number(fin.home) + '</b></span><small>' + esc(fin.note || 'FINAL') + '</small>' + (fin.fine ? '<em class="lg3m-fine">' + esc(fin.fine) + '</em>' : '') + '</div>'
      : '<div class="lg3m-center lg3m-chip"><span class="lg3m-vs">VS</span></div>';
    return '<div class="lg3m lg3m-' + size + '" style="--ma:' + esc(css(o.away.name, size)) + ';--mh:' + esc(css(o.home.name, size)) + ';--ca:' + color(o.away.name) + ';--ca2:' + color(o.away.name, 1) + ';--ch:' + color(o.home.name) + ';--ch2:' + color(o.home.name, 1) + '">' +
      '<span class="lg3m-bg" aria-hidden="true"><i class="lg3m-a"></i><i class="lg3m-h"></i><em></em></span>' +
      side(o.away, 'lg3m-away', fin && +fin.away > +fin.home) + center + side(o.home, 'lg3m-home', fin && +fin.home > +fin.away) +
      (o.meta ? '<p class="lg3m-meta">' + esc(o.meta) + '</p>' : '') + '</div>';
  }
  window.LG3S_NATION_ART = { slug, src, css, color, has: n => AVAILABLE.has(slug(n)), matchup };
})();

/* Fit nation names inside their VS-banner plate: shrink font only when the name is wider than its side. */
(function () {
  function fit(el) {
    const side = el.closest('.lg3m-side'), plate = el.closest('.lg3m-plate'); if (!side || !plate) return;
    el.style.fontSize = ''; el.style.whiteSpace = 'nowrap';
    const cs = getComputedStyle(plate), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const avail = side.clientWidth - pad - 2; if (avail <= 0) return;
    let fs = parseFloat(getComputedStyle(el).fontSize), w = el.scrollWidth;
    if (w > avail) {
      const words = el.textContent.trim().split(/\s+/);
      if (words.length > 1) { el.style.whiteSpace = 'normal'; w = Math.max(...words.map(x => { const s = document.createElement('span'); s.textContent = x; s.style.whiteSpace = 'nowrap'; el.appendChild(s); const v = s.offsetWidth; s.remove(); return v; })); el.style.whiteSpace = 'nowrap'; }
      el.style.whiteSpace = words.length > 1 ? 'normal' : 'nowrap';
      if (w > avail) el.style.fontSize = Math.max(9, Math.floor(fs * avail / w * 10) / 10) + 'px';
    }
  }
  const run = root => (root.querySelectorAll ? root : document).querySelectorAll('.lg3m-plate strong').forEach(fit);
  let t = 0; const later = () => { cancelAnimationFrame(t); t = requestAnimationFrame(() => { run(document); setTimeout(() => run(document), 250); }); };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('resize', later); document.addEventListener('DOMContentLoaded', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  document.addEventListener('toggle', later, true);
})();
