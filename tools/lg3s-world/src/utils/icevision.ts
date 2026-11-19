export function localIceVisionParent(parameter: 'arenaParent' | 'programParent') {
  if (window.parent === window) return '';
  try {
    const requested = new URL(new URLSearchParams(location.search).get(parameter) ?? '');
    if (requested.origin === location.origin && window.parent.location.pathname === '/lg3s-gb/arena/broadcast.html') {
      return requested.origin;
    }
    const referrer = new URL(document.referrer);
    return requested.origin === referrer.origin && requested.protocol === 'http:'
      && ['localhost','127.0.0.1'].includes(requested.hostname) ? requested.origin : '';
  } catch {
    return '';
  }
}
