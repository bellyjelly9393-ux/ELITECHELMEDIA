(async function () {
  'use strict';
  const program = document.getElementById('program');
  const status = document.getElementById('carbonAccessStatus');
  const explanation = document.getElementById('carbonAccessMessage');
  const token = location.hash.slice(1);

  function showUnavailable(message) {
    // Never disguise a failed Carbon session as the public tactical rink.
    // OBS operators need to know that the authenticated 3D source did not load.
    program.removeAttribute('src');
    program.hidden = true;
    explanation.textContent = message;
    status.hidden = false;
    console.warn('GBR Carbon Arena: private OBS source unavailable.');
  }

  if (!token) {
    showUnavailable('No private program link was supplied. Generate a Carbon Arena OBS URL from the GBR Desk, then paste that complete URL into your OBS Browser Source.');
    return;
  }

  try {
    const response = await fetch('/lg3s-gb/arena/open-program', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      showUnavailable(response.status === 401
        ? 'This private program link is invalid or expired. Generate a new 90-day Carbon Arena OBS URL from the GBR Desk.'
        : 'Carbon Arena could not authenticate or load. Check your GBR Desk access, then generate a new private program URL.');
      return;
    }
    program.src = '/lg3s-gb/arena/broadcast.html?follow=desk';
  } catch (_) {
    showUnavailable('Carbon Arena is currently unreachable. Keep your gameplay source running and retry after checking the GBR Desk connection.');
  }
})();