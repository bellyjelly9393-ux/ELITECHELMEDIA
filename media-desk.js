/* Shared helpers for the Wildman Media and Hitmen Media desks (wildman-media.html,
   hitmen-media.html, hitmen-recap.html). Same public Supabase REST reads and the same
   publishable key as the homepage (wildman-home.js); every table read here is public under RLS. */
(() => {
  'use strict';
  const API = 'https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const TZ = 'America/Toronto';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = o => new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: TZ }, o));
  const F = {
    day: fmt({ weekday: 'short', month: 'short', day: 'numeric' }),
    longDay: fmt({ weekday: 'long', month: 'short', day: 'numeric' }),
    time: fmt({ hour: 'numeric', minute: '2-digit' }),
    date: fmt({ month: 'short', day: 'numeric', year: 'numeric' }),
    md: fmt({ month: 'short', day: 'numeric' }),
    ymd: fmt({ year: 'numeric', month: '2-digit', day: '2-digit' })
  };
  const etDate = v => { const p = F.ymd.formatToParts(new Date(v)); const g = t => p.find(x => x.type === t)?.value; return g('year') + '-' + g('month') + '-' + g('day'); };
  const ordinal = n => { const v = Number(n); if (!Number.isFinite(v)) return ''; const s = ['th', 'st', 'nd', 'rd'], m = v % 100; return v + (s[(m - 20) % 10] || s[m] || s[0]); };
  // Keep scores like 2–1 on one line in headlines (same rule as the homepage).
  const nb = v => String(v ?? '').replace(/(\d)[-–](\d)/g, '$1\u2011$2');
  const logo = path => path ? esc(String(path).replace(/^\//, '')) : '';

  async function read(table, params) {
    const r = await fetch(API + table + '?' + new URLSearchParams(params), {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
      signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
    });
    if (!r.ok) throw new Error(table + ' unavailable');
    return r.json();
  }

  // Same logo colour sampling as the homepage so every tile glows in its club's colours.
  const colorCache = new Map();
  function teamColor(src) {
    if (colorCache.has(src)) return colorCache.get(src);
    const p = new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 24;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 24, 24);
          const d = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
            if (A < 200 || mx < 50 || mx - mn < 45) continue;
            r += R; g += G; b += B; n++;
          }
          res(n > 8 ? Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) : null);
        } catch { res(null); }
      };
      img.onerror = () => res(null);
      img.src = src;
    });
    colorCache.set(src, p); return p;
  }
  const tint = root => root.querySelectorAll('[data-logo]').forEach(el => teamColor(el.dataset.logo).then(c => { if (c) el.style.setProperty('--tc', c); }));

  // Header menu (same behaviour as the homepage).
  function menu() {
    const nav = $('nav'), mb = $('menuBtn');
    if (!nav || !mb) return;
    const close = () => { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-label', 'Open menu'); };
    mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', String(o)); mb.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); });
    nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { close(); mb.focus(); } });
    document.addEventListener('click', e => { if (!e.target.closest('.top')) close(); });
  }

  /* ---------- recap helpers (media_posts, post_type = recap) ---------- */
  const recapSortKey = p => { const m = p.source_metrics || {}; return Date.parse(m.sort_at || m.ended_utc || (m.game_date ? m.game_date + 'T23:59:59Z' : '') || p.published_at) || 0; };
  // Calgary-first score. Prefers the stored scores, falls back to the stored final string.
  function recapScore(m) {
    m = m || {};
    let cs = Number(m.calgary_score), os = Number(m.opponent_score);
    const f = String(m.final || '');
    if (!Number.isFinite(cs) || !Number.isFinite(os) || m.calgary_score == null || m.opponent_score == null) {
      const x = f.match(/(\d+)\s*[-–]\s*(\d+)/); if (x) { cs = Number(x[1]); os = Number(x[2]); }
    }
    const ot = /\bOT\b/i.test(f), so = /\bSO\b/i.test(f);
    const win = m.result === 'W' || (Number.isFinite(cs) && Number.isFinite(os) && cs > os);
    const res = win ? 'W' : (ot || so || m.result === 'OTL') ? 'OTL' : 'L';
    return { cs, os, ot: ot || so, extra: so ? 'SO' : ot ? 'OT' : '', win, res, text: Number.isFinite(cs) && Number.isFinite(os) ? cs + '–' + os : '' };
  }
  function recapParagraphs(body) {
    const cut = String(body || '').search(/\n\s*Three stars\s*\n/i);
    let b = cut >= 0 ? body.slice(0, cut) : String(body || '');
    let source = '';
    b = b.replace(/\n\s*Source:\s*([^\n]+)\s*$/i, (_, s) => { source = s.trim(); return ''; });
    const paras = b.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
      .flatMap(s => { const nl = s.indexOf('\n'); return s.startsWith('## ') && nl > 0 ? [s.slice(0, nl).trim(), s.slice(nl + 1).trim()] : [s]; })
      .filter(Boolean);
    return { paras, source };
  }
  const recapLede = p => { const m = p.source_metrics || {}; if (m.dek) return m.dek; const x = recapParagraphs(p.body).paras.find(s => !s.startsWith('## ')); return x || ''; };
  const recapHref = p => 'hitmen-recap.html?id=' + encodeURIComponent(p.id);
  const lgGameUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' + Number(id);
  const recapDate = m => { const d = m?.game_date ? new Date(m.game_date + 'T16:00:00Z') : null; return d && !isNaN(d) ? F.date.format(d) : ''; };

  window.WMDesk = { API, KEY, $, esc, nb, F, etDate, ordinal, logo, read, teamColor, tint, menu, recapSortKey, recapScore, recapParagraphs, recapLede, recapHref, lgGameUrl, recapDate };
})();
