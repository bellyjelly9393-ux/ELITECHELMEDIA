// Mount after the arena initializes. Standalone URLs never install the listener.
window.installLG3SRinkBridge = (arena) => {
  const params = new URLSearchParams(window.location.search);
  if (window.parent === window || params.get('embed') !== 'true') return () => {};
  const origin = window.location.origin;
  const send = (type, payload) => window.parent.postMessage({ protocol: 'lg3s:1', type, payload }, origin);
  const alpha = (enabled) => {
    document.documentElement.classList.toggle('alpha', enabled);
    document.body.style.background = enabled ? 'transparent' : '';
    arena.setAlpha(enabled);
  };
  const receive = (event) => {
    if (event.origin !== origin || event.source !== window.parent || event.data?.protocol !== 'lg3s:1') return;
    const { type, payload } = event.data;
    if (type === 'hello') send('ready');
    if (type === 'state' && payload && Number.isInteger(payload.home_score) && Number.isInteger(payload.away_score)) arena.setState(payload);
    if (type === 'camera' && ['ice','overhead','jumbotron','goalie','orbit'].includes(payload)) arena.setCamera(payload);
    if (type === 'highlight' && [1,2,3,4].includes(payload)) arena.highlightPlayer(payload);
    if (type === 'alpha' && typeof payload === 'boolean') alpha(payload);
  };
  window.addEventListener('message', receive);
  alpha(params.get('mode') === 'obs');
  const unsubscribe = arena.onPlayerSelected?.((num) => send('player-selected', num));
  send('ready');
  return () => {
    window.removeEventListener('message', receive);
    unsubscribe?.();
  };
};
