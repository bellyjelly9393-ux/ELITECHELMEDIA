(async function () {
  'use strict';
  const program = document.getElementById('program');
  const status = document.getElementById('carbonAccessStatus');
  const explanation = document.getElementById('carbonAccessMessage');
  const token = location.hash.slice(1);
  const params = new URLSearchParams(location.search);
  const game = params.get('game');
  const isCzechia = params.has('game');

  function showUnavailable(message) {
    // Never disguise a failed Carbon session as the public tactical rink.
    // OBS operators need to know that the authenticated 3D source did not load.
    program.removeAttribute('src');
    program.hidden = true;
    explanation.textContent = message;
    status.hidden = false;
    console.warn('Carbon Arena: private OBS source unavailable.');
  }

  if (isCzechia) {
    document.title = 'Czechia Carbon Arena OBS Source';
    program.title = 'Czechia Carbon Arena broadcast graphics';
    document.getElementById('carbonAccessBrand').textContent = 'CZECHIA · PRIVATE BROADCAST SOURCE';
    document.getElementById('carbonAccessDesk').href = '/obs-control.html?channel=wjhc-czechia';
    if (!['germany', 'usa', 'sweden'].includes(game)) {
      showUnavailable('Choose a valid Czechia matchup in the OBS Desk and copy a new private OBS URL.');
      return;
    }
  }

  if (!token) {
    showUnavailable('Generate a Carbon Arena OBS URL from the OBS Desk, then paste the complete URL into your OBS Browser Source.');
    return;
  }

  const base = isCzechia ? `/czechia/arena/${game}/` : '/lg3s-gb/arena/';
  try {
    const response = await fetch(base + 'open-program', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      showUnavailable(response.status === 401
        ? 'This private program link is invalid or expired. Generate a new 90-day Carbon Arena OBS URL from the OBS Desk.'
        : 'Carbon Arena could not authenticate or load. Check your OBS Desk access, then generate a new private program URL.');
      return;
    }
    program.src = base + 'broadcast.html?follow=desk' + (isCzechia ? `&team=czechia&game=${game}` : '');
  } catch (_) {
    showUnavailable('Carbon Arena is currently unreachable. Keep your gameplay source running and retry after checking the OBS Desk connection.');
  }
})();
