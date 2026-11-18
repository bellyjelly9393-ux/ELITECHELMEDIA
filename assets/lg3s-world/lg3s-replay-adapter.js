// Load after the existing replay.html initializes its arena.
(() => {
  if (new URLSearchParams(location.search).get('embed') !== 'true') return;
  document.querySelectorAll('.standalone-header, .sidebar-nav').forEach((el) => { el.hidden = true; });
  const background = window.scene?.background;
  const fog = window.scene?.fog;
  const clearAlpha = window.renderer?.getClearAlpha?.();
  window.installLG3SRinkBridge({
    setState(state) {
      window.setCameraAngle?.(state.camera_angle);
      window.highlightSkaterByNumber?.(state.highlighted_player);
      window.setTacticalFormation?.(state.active_formation, state.positions);
      window.updateJumbotronScore?.(state);
      window.setGBRKitVariant?.(state.kit_variant, state.jersey_side);
    },
    setCamera: (camera) => window.setCameraAngle?.(camera),
    highlightPlayer: (num) => window.highlightSkaterByNumber?.(num),
    setAlpha(alpha) {
      document.documentElement.style.background = alpha ? 'transparent' : '';
      window.renderer?.setClearAlpha(alpha ? 0 : clearAlpha ?? 1);
      if (window.scene) {
        window.scene.background = alpha ? null : background;
        window.scene.fog = alpha ? null : fog;
      }
    },
    onPlayerSelected(send) {
      const select = (event) => { if ([88,20,19,35].includes(event.detail)) send(event.detail); };
      window.addEventListener('lg3s:player-selected', select);
      return () => window.removeEventListener('lg3s:player-selected', select);
    },
  });
})();
