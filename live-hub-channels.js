// Live Hub channels: World Juniors, Hitmen, LG Threes, All Games and Multiview.
// One channel shows at a time, and only its players are loaded, so a hidden
// channel never plays audio or uses data in the background.
(() => {
  'use strict';
  const CHANNELS = ['wjr', 'hitmen', 'lg3s', 'games', 'multiview'];
  // Links from before the channels existed still land in the right place.
  const OLD_LINKS = {czechia: 'wjr', hitman: 'hitmen', lgchl: 'games', all: 'games', 'games-list': 'games', 'games-add': 'games', add: 'multiview'};
  const tabs = [...document.querySelectorAll('[data-channel-tab]')];
  // Panels are ch-<channel> so the #channel link never makes the browser jump past the channel bar.
  const panels = new Map(CHANNELS.map(id => [id, document.getElementById('ch-' + id)]));
  let current = '';

  function fromHash() {
    const key = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    return CHANNELS.includes(key) ? key : OLD_LINKS[key] || '';
  }

  function embed(raw) {
    try {
      const url = new URL(raw, location.href);
      if (url.origin === location.origin) return url.href;
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'twitch.tv') {
        const channel = url.pathname.split('/')[1];
        if (!/^[a-z0-9_]{3,25}$/i.test(channel)) return '';
        return 'https://player.twitch.tv/?' + new URLSearchParams({channel, parent: location.hostname, autoplay: 'false'});
      }
      if (host === 'youtube.com' && /^[\w-]{11}$/.test(url.searchParams.get('v') || '')) {
        return 'https://www.youtube-nocookie.com/embed/' + url.searchParams.get('v');
      }
    } catch { /* not a supported stream link */ }
    return '';
  }

  // A player either has a fixed page (data-channel-src) or follows a stream link
  // (data-stream-link) that live-hub.js keeps up to date. data-live="0" means off air.
  // data-live-src plays a broadcast page instead of the bare stream while the link is live.
  // data-pick is a game the viewer chose to watch here; it plays instead of the hosted game.
  function sourceFor(frame) {
    if (frame.dataset.channelSrc) return frame.dataset.channelSrc;
    if (frame.dataset.pick) return embed(frame.dataset.pick);
    const link = document.getElementById(frame.dataset.streamLink);
    if (!link || link.dataset.live === '0') return '';
    return frame.dataset.liveSrc ? new URL(frame.dataset.liveSrc, location.href).href : embed(link.href);
  }

  function syncPlayers() {
    document.querySelectorAll('iframe[data-channel-src], iframe[data-stream-link]').forEach(frame => {
      const watching = frame.closest('[data-channel]')?.dataset.channel === current;
      const src = watching ? sourceFor(frame) : '';
      const poster = frame.parentElement.querySelector('.lh-poster-copy');
      if (poster) { poster.hidden = !!src; frame.hidden = !src; }
      if (src && frame.dataset.loaded !== src) { frame.src = src; frame.dataset.loaded = src; }
      if (!src && frame.hasAttribute('src')) { frame.removeAttribute('src'); delete frame.dataset.loaded; }
    });
  }

  function select(id, focus) {
    if (!panels.get(id)) id = CHANNELS[0];
    if (id === current) return;
    const previous = current;
    current = id;
    for (const [key, panel] of panels) panel.hidden = key !== id;
    for (const tab of tabs) {
      const on = tab.dataset.channelTab === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus({preventScroll: true});
      if (on) {
        // On phones the channel bar scrolls sideways: keep the open channel in view.
        const bar = tab.parentElement.getBoundingClientRect();
        const box = tab.getBoundingClientRect();
        tab.parentElement.scrollLeft += box.left - bar.left - (bar.width - box.width) / 2;
      }
    }
    syncPlayers();
    document.dispatchEvent(new CustomEvent('livehub:channel', {detail: {channel: id, previous}}));
  }

  function open(id, focus) {
    history.replaceState(null, '', '#' + id);
    select(id, focus);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', event => { event.preventDefault(); open(tab.dataset.channelTab); });
    tab.addEventListener('keydown', event => {
      const step = {ArrowRight: 1, ArrowLeft: -1}[event.key];
      if (event.key === 'Home' || event.key === 'End' || step) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + step + tabs.length) % tabs.length;
        open(tabs[next].dataset.channelTab, true);
      }
    });
  });
  addEventListener('hashchange', () => {
    const id = fromHash();
    if (!id) return;
    const anchor = ['#games-list', '#games-add'].includes(location.hash) && document.getElementById(location.hash.slice(1));
    select(id);
    if (anchor) anchor.scrollIntoView({behavior: 'smooth', block: 'start'});
  });
  document.addEventListener('livehub:streams', syncPlayers);

  window.ECMLiveHub = {current: () => current};
  // Coming back from Discord sign-in: leave the sign-in details in the address for the
  // sign-in script to read, and open All Games where the person was adding a game.
  const signInReturn = /(^|&)(access_token|error_description)=/.test(location.hash.slice(1));
  const start = signInReturn ? 'games' : fromHash() || CHANNELS[0];
  if (!signInReturn && location.hash && location.hash.slice(1) !== start && !['#games-list', '#games-add'].includes(location.hash)) history.replaceState(null, '', '#' + start);
  select(start);
})();
