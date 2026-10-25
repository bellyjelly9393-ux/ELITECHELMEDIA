/* LG3s Media · nation scores live ticker
 * Mounts a scrolling ticker bar immediately after .th-sub (the section sub-nav).
 * Pulls from the same Supabase verified-only view as lg3s-recent-scores.js.
 * Self-contained: no dependencies, no React, no framework.
 */
(() => {
  'use strict';
  if (window.__lg3sTicker) return;
  window.__lg3sTicker = true;

  const BASE = 'https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
  const KEY  = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  const esc  = v => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Nation abbreviations for the ticker (3-char MAX) */
  const ABBR = {
    Canada: 'CAN', USA: 'USA', Sweden: 'SWE', Germany: 'GER',
    Japan: 'JPN', 'Great Britain': 'GBR', Switzerland: 'SUI',
    Slovakia: 'SVK', Latvia: 'LAT', Poland: 'POL',
    Kazakhstan: 'KAZ', Italy: 'ITA',
  };
  const ab = n => ABBR[n] || n.slice(0, 3).toUpperCase();

  function buildItems(games) {
    return games.map(g => {
      const aw = esc(ab(g.away_nation)), hw = esc(ab(g.home_nation));
      const as = Number(g.away_score), hs = Number(g.home_score);
      const awWin = as > hs, hwWin = hs > as;
      return `<span class="lg3t-item">` +
        `<span class="lg3t-team${awWin ? ' lg3t-win' : ''}">${aw}</span>` +
        `<span class="lg3t-score">${as}</span>` +
        `<span class="lg3t-dash">–</span>` +
        `<span class="lg3t-score">${hs}</span>` +
        `<span class="lg3t-team${hwWin ? ' lg3t-win' : ''}">${hw}</span>` +
        `<span class="lg3t-sep" aria-hidden="true">·</span>` +
        `</span>`;
    }).join('');
  }

  function mount(games, date) {
    if (document.getElementById('lg3sTicker')) return;

    const bar = document.createElement('div');
    bar.id = 'lg3sTicker';
    bar.className = 'lg3t band';
    bar.setAttribute('role', 'marquee');
    bar.setAttribute('aria-label', `LG3s verified results ${date}`);

    const items = buildItems(games);
    const doubled = items + items; // seamless loop clone

    bar.innerHTML =
      `<div class="lg3t-label">` +
        `<span class="lg3t-live-dot" aria-hidden="true"></span>` +
        `<span class="lg3t-live-word">FINAL</span>` +
        `<span class="lg3t-date">${esc(date)}</span>` +
      `</div>` +
      `<div class="lg3t-rail" aria-hidden="true">` +
        `<div class="lg3t-track">${doubled}</div>` +
      `</div>`;

    /* Insert after .th-sub (section sub-nav) */
    const anchor = document.querySelector('.th-sub') || document.querySelector('main');
    if (anchor) anchor.after(bar);
    else document.body.prepend(bar);

    sizeTicker(bar);
    window.addEventListener('resize', () => sizeTicker(bar), { passive: true });
  }

  function sizeTicker(bar) {
    const track = bar.querySelector('.lg3t-track');
    if (!track) return;
    /* Half the track width = one full set of items */
    const half = track.scrollWidth / 2;
    const speed = window.innerWidth < 700 ? 28 : 38; /* px/s */
    const dur = Math.max(20, Math.round(half / speed));
    track.style.setProperty('--lg3t-dur', `${dur}s`);
  }

  async function load() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    const url = BASE +
      'lg3s_public_games?select=lg_game_id,game_night_date,away_nation,home_nation,' +
      'away_score,home_score&is_verified=eq.true&order=game_night_date.desc&limit=100';
    const r = await fetch(url, { headers: { apikey: KEY }, cache: 'no-store' });
    if (!r.ok) return;
    const games = await r.json();
    const dates = [...new Set(
      games
        .filter(g => g.game_night_date <= today &&
          Number.isFinite(Number(g.away_score)) &&
          Number.isFinite(Number(g.home_score)))
        .map(g => g.game_night_date)
    )].sort().reverse();
    if (!dates.length) return;
    const night = games.filter(g =>
      g.game_night_date === dates[0] &&
      g.away_score != null && g.home_score != null
    );
    if (!night.length) return;
    mount(night, dates[0]);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', load, { once: true });
  else
    load();
})();
