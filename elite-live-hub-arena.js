/* EliteChel Media · Elite Live Hub · Carbon 3D arena.
 * three.js from the jsDelivr CDN (import map in elite-live-hub.html). Loads only when the
 * arena scrolls into view; falls back to a static message if WebGL is not available.
 * Lineups arrive from elite-live-hub.js through the `elh:lineup` event.
 */
const view = document.getElementById('elhArenaView');
const msg = document.getElementById('elhArenaMsg');
const roster = document.getElementById('elhArenaRoster');
const card = document.getElementById('elhArenaCard');
const label = document.getElementById('elhArenaLabel');
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[c]);

let lineup = null;
let api = null;

// Rink positions (x along the length, z across). Home defends the right end.
const SPOTS = {C: [-4.5, 0], LW: [-5.5, -5], RW: [-5.5, 5], LD: [-12, -3.2], RD: [-12, 3.2], G: [-21.2, 0]};

function renderRoster() {
  if (!lineup) return;
  label.textContent = lineup.label;
  roster.innerHTML = (lineup.players || []).map((p, i) => `<li><button type="button" data-arena-player="${i}" class="${p.team === lineup.home ? 'is-home' : 'is-away'}"><span class="elh-pos">${esc(p.position)}</span><b>${esc(p.name)}</b><small>${esc(p.team)}</small></button></li>`).join('') || '<li class="elh-note">No lineup posted.</li>';
}

window.addEventListener('elh:lineup', e => {
  lineup = e.detail;
  renderRoster();
  api?.setPlayers(lineup);
});
window.addEventListener('elh:camera', e => api?.camera(e.detail));
roster.addEventListener('click', e => {
  const b = e.target.closest('[data-arena-player]');
  if (!b) return;
  const i = +b.dataset.arenaPlayer;
  roster.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
  const p = lineup.players[i];
  card.hidden = false;
  card.innerHTML = `<span class="elh-pos">${esc(p.position)}</span><b>${esc(p.name)}</b><small>${esc(p.team)}${p.jersey ? ' · #' + esc(p.jersey) : ''}</small>`;
  api?.spotlight(i);
});

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function boot() {
  if (!webglOK()) { msg.textContent = 'Your device cannot show the 3D arena. The Czechia Carbon pregame link still works.'; return; }
  msg.textContent = 'Loading Carbon Arena…';
  let THREE, OrbitControls;
  try {
    THREE = await import('three');
    ({OrbitControls} = await import('three/addons/controls/OrbitControls.js'));
  } catch {
    msg.textContent = 'The 3D engine could not load. Check your connection and refresh.';
    return;
  }
  api = build(THREE, OrbitControls);
  msg.remove();
  if (!lineup) window.ELHLastLineup?.();
  else api.setPlayers(lineup);
}

function iceTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(1024, 512, 80, 1024, 512, 1150);
  grd.addColorStop(0, '#f4f7fa'); grd.addColorStop(1, '#c9d2da');
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 1024);
  // fine skate scratches
  g.globalAlpha = .06; g.strokeStyle = '#7a8794';
  for (let i = 0; i < 500; i++) { g.beginPath(); const x = Math.random() * 2048, y = Math.random() * 1024; g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 160, y + (Math.random() - .5) * 40); g.stroke(); }
  g.globalAlpha = 1;
  const X = v => 1024 + v * (2048 / 48), Y = v => 512 + v * (1024 / 24);
  g.lineWidth = 10; g.strokeStyle = '#b3171d';
  g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), 1024); g.stroke();
  g.strokeStyle = '#1d3f8a'; g.lineWidth = 14;
  [-7.6, 7.6].forEach(v => { g.beginPath(); g.moveTo(X(v), 0); g.lineTo(X(v), 1024); g.stroke(); });
  g.strokeStyle = '#b3171d'; g.lineWidth = 4;
  [-21, 21].forEach(v => { g.beginPath(); g.moveTo(X(v), Y(-11.2)); g.lineTo(X(v), Y(11.2)); g.stroke(); });
  g.lineWidth = 5;
  const circle = (x, y, r, fill) => { g.beginPath(); g.arc(X(x), Y(y), r * (2048 / 48), 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } else g.stroke(); };
  circle(0, 0, 3.6); circle(0, 0, .25, '#1d3f8a');
  [[-15, -5.5], [-15, 5.5], [15, -5.5], [15, 5.5]].forEach(([x, y]) => { g.strokeStyle = '#b3171d'; circle(x, y, 3.6); circle(x, y, .3, '#b3171d'); });
  [[-4.5, -5.5], [-4.5, 5.5], [4.5, -5.5], [4.5, 5.5]].forEach(([x, y]) => circle(x, y, .25, '#b3171d'));
  g.fillStyle = 'rgba(80,140,220,.35)';
  [-1, 1].forEach(s => { g.beginPath(); g.arc(X(21 * s), Y(0), 1.5 * (2048 / 48), s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2); g.fill(); });
  // centre-ice mark in brand colours
  g.save(); g.translate(X(0), Y(0));
  g.globalAlpha = .9; g.font = 'italic 900 64px Kanit, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#2b2b2e'; g.fillText('ELITECHEL', 2, -8);
  g.font = '700 34px Anton, Impact, sans-serif'; g.fillStyle = '#bfa14a'; g.fillText('M E D I A', 0, 40);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function nameSprite(THREE, text, sub, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 160);
  grd.addColorStop(0, 'rgba(28,24,22,.92)'); grd.addColorStop(1, 'rgba(8,6,6,.92)');
  g.fillStyle = grd; g.beginPath(); g.roundRect(6, 20, 500, 120, 14); g.fill();
  g.strokeStyle = color; g.lineWidth = 5; g.stroke();
  g.fillStyle = color; g.fillRect(6, 20, 14, 120);
  g.font = '700 40px Anton, Impact, sans-serif'; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(sub, 36, 80);
  g.font = '600 46px "Barlow Semi Condensed", Arial, sans-serif'; g.fillStyle = '#f2f0ea';
  let t = text; while (g.measureText(t).width > 380 && t.length > 4) t = t.slice(0, -2);
  g.fillText(t === text ? t : t + '…', 116, 82);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, depthTest: false, transparent: true}));
  s.scale.set(3.2, 1, 1);
  s.renderOrder = 10;
  return s;
}

function build(THREE, OrbitControls) {
  const W = () => view.clientWidth, H = () => view.clientHeight;
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  view.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D hockey rink');
  renderer.domElement.setAttribute('role', 'img');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070505);
  scene.fog = new THREE.FogExp2(0x070505, .012);
  const camera = new THREE.PerspectiveCamera(40, W() / H(), .1, 300);
  camera.position.set(0, 23, 35);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.maxPolarAngle = Math.PI * .49; controls.minDistance = 8; controls.maxDistance = 70;
  controls.target.set(0, 0, 0);

  // Lighting: warm key, ember + flame rims from the ECM palette, cool fill off the ice.
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x140806, .7));
  const key = new THREE.DirectionalLight(0xfff3e2, 2.1);
  key.position.set(8, 30, 14); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -30, right: 30, top: 18, bottom: -18, near: 1, far: 80});
  scene.add(key);
  const flame = new THREE.SpotLight(0xf98a01, 260, 90, Math.PI / 5, .6, 1.6); flame.position.set(-30, 18, -16); scene.add(flame);
  const ember = new THREE.SpotLight(0xfe3402, 220, 90, Math.PI / 5, .6, 1.6); ember.position.set(30, 18, 16); scene.add(ember);

  // Floor + ice
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), new THREE.MeshStandardMaterial({color: 0x0b0807, roughness: .35, metalness: .6}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.4; floor.receiveShadow = true; scene.add(floor);
  const iceShape = new THREE.Shape();
  const L = 24, Wd = 12, R = 4.2;
  iceShape.moveTo(-L + R, -Wd); iceShape.lineTo(L - R, -Wd); iceShape.quadraticCurveTo(L, -Wd, L, -Wd + R);
  iceShape.lineTo(L, Wd - R); iceShape.quadraticCurveTo(L, Wd, L - R, Wd); iceShape.lineTo(-L + R, Wd);
  iceShape.quadraticCurveTo(-L, Wd, -L, Wd - R); iceShape.lineTo(-L, -Wd + R); iceShape.quadraticCurveTo(-L, -Wd, -L + R, -Wd);
  const iceGeo = new THREE.ShapeGeometry(iceShape, 24);
  const pos = iceGeo.attributes.position, uv = iceGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + L) / (2 * L), (pos.getY(i) + Wd) / (2 * Wd));
  const ice = new THREE.Mesh(iceGeo, new THREE.MeshPhysicalMaterial({map: iceTexture(THREE), roughness: .12, metalness: 0, clearcoat: 1, clearcoatRoughness: .08}));
  ice.rotation.x = -Math.PI / 2; ice.receiveShadow = true; scene.add(ice);

  // Boards: extruded ring with a gold kick plate and chrome cap.
  const ring = (inset, height, y, color, metal, rough) => {
    const outer = new THREE.Shape(iceShape.getPoints(48).map(p => new THREE.Vector2(p.x * (1 + inset / L), p.y * (1 + inset / Wd))));
    outer.holes.push(new THREE.Path(iceShape.getPoints(48).reverse()));
    const geo = new THREE.ExtrudeGeometry(outer, {depth: height, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2, curveSegments: 24});
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color, metalness: metal, roughness: rough}));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = true; m.receiveShadow = true; scene.add(m);
    return m;
  };
  ring(.45, 1.2, 0, 0xe9e8e4, .05, .5);
  ring(.47, .22, 0, 0xbfa14a, .9, .3);
  ring(.5, .12, 1.2, 0xcfd2d6, 1, .18);
  // Glass
  const glassMat = new THREE.MeshPhysicalMaterial({color: 0xffffff, transmission: .92, roughness: .04, thickness: .1, transparent: true, opacity: .25, side: THREE.DoubleSide});
  const glassShape = iceShape.getPoints(64).map(p => new THREE.Vector3(p.x * (1 + .45 / L), 0, p.y * (1 + .45 / Wd)));
  const glassGeo = new THREE.BufferGeometry();
  const gv = [];
  for (let i = 0; i < glassShape.length - 1; i++) {
    const a = glassShape[i], b = glassShape[i + 1];
    gv.push(a.x, 1.35, a.z, b.x, 1.35, b.z, b.x, 3.1, b.z, a.x, 1.35, a.z, b.x, 3.1, b.z, a.x, 3.1, a.z);
  }
  glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(gv, 3)); glassGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(glassGeo, glassMat));

  // Goals
  const postMat = new THREE.MeshStandardMaterial({color: 0xd11f1f, metalness: .4, roughness: .35});
  const netMat = new THREE.MeshStandardMaterial({color: 0xffffff, wireframe: true, transparent: true, opacity: .45});
  [-21, 21].forEach(x => {
    const g = new THREE.Group(); g.position.set(x, 0, 0);
    const s = Math.sign(x);
    [[-.9], [.9]].forEach(([z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.2, 12), postMat); p.position.set(0, .6, z); p.castShadow = true; g.add(p); });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.8, 12), postMat); bar.rotation.x = Math.PI / 2; bar.position.y = 1.2; g.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(1, 1.15, 1.8, 5, 5, 8), netMat); net.position.set(s * .5, .58, 0); g.add(net);
    scene.add(g);
  });

  // Centre-hung scoreboard with the ECM crest
  const board = new THREE.Group(); board.position.y = 15;
  const core = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 5), new THREE.MeshStandardMaterial({color: 0x0c0908, metalness: .85, roughness: .25}));
  board.add(core);
  const crestTex = new THREE.TextureLoader().load('/assets/brand/ecm-logo.webp'); crestTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshBasicMaterial({map: crestTex, transparent: true});
  [[0, 0, 2.51, 0], [0, 0, -2.51, Math.PI]].forEach(([x, y, z, r]) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), face); f.position.set(x, y, z); f.rotation.y = r; board.add(f); });
  [[1.8, 0xf98a01], [-1.8, 0xfe3402]].forEach(([y, c]) => { const r = new THREE.Mesh(new THREE.TorusGeometry(4.6, .08, 8, 64), new THREE.MeshBasicMaterial({color: c})); r.rotation.x = Math.PI / 2; r.position.y = y; board.add(r); });
  scene.add(board);

  // Ember particles
  const N = 500, ep = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { ep[i * 3] = (Math.random() - .5) * 90; ep[i * 3 + 1] = Math.random() * 30 + 2; ep[i * 3 + 2] = (Math.random() - .5) * 70; }
  const embers = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ep, 3)), new THREE.PointsMaterial({color: 0xf98a01, size: .18, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false}));
  scene.add(embers);

  // Players
  const players = new THREE.Group(); scene.add(players);
  const ringGlow = new THREE.Mesh(new THREE.RingGeometry(.9, 1.25, 40), new THREE.MeshBasicMaterial({color: 0xf98a01, transparent: true, opacity: .9, side: THREE.DoubleSide}));
  ringGlow.rotation.x = -Math.PI / 2; ringGlow.visible = false; scene.add(ringGlow);
  let tokens = [];
  function setPlayers(lu) {
    players.clear(); tokens = []; ringGlow.visible = false;
    const list = lu?.players || [];
    const teams = [...new Set(list.map(p => p.team))];
    const home = lu?.home || teams[0];
    list.forEach(p => {
      const isHome = p.team === home;
      const spot = SPOTS[p.position] || [0, 0];
      const x = (isHome ? 1 : -1) * -spot[0], z = spot[1] * (isHome ? 1 : -1);
      const color = isHome ? 0xf98a01 : 0xdcdcde;
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.7, .8, .25, 32), new THREE.MeshStandardMaterial({color: 0x111012, metalness: .8, roughness: .3}));
      base.position.y = .13; base.castShadow = true; g.add(base);
      const puck = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .9, 32), new THREE.MeshStandardMaterial({color, metalness: .55, roughness: .28, emissive: color, emissiveIntensity: .12}));
      puck.position.y = .7; puck.castShadow = true; g.add(puck);
      const sprite = nameSprite(THREE, p.name, p.position, isHome ? '#f98a01' : '#dcdcde');
      sprite.position.y = 2.4; g.add(sprite);
      players.add(g); tokens.push(g);
    });
  }
  function spotlight(i) {
    const t = tokens[i]; if (!t) return;
    ringGlow.visible = true; ringGlow.position.set(t.position.x, .03, t.position.z);
    goTo([t.position.x * .6, 11, t.position.z + 17], [t.position.x, 1, t.position.z]);
  }

  // Cameras
  const PRESETS = {wide: [[0, 23, 35], [0, 0, 0]], top: [[0, 46, .1], [0, 0, 0]], ice: [[-6, 1.6, 15], [4, 1, 0]], bench: [[0, 5, -17], [0, 1, 2]]};
  let flight = null;
  function goTo(pos, look) {
    flight = {from: camera.position.clone(), to: new THREE.Vector3(...pos), lf: controls.target.clone(), lt: new THREE.Vector3(...look), t: 0};
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(view);
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), .05);
    if (flight) {
      flight.t = Math.min(1, flight.t + dt * (reduce ? 10 : 1.4));
      const k = flight.t < .5 ? 2 * flight.t * flight.t : 1 - Math.pow(-2 * flight.t + 2, 2) / 2;
      camera.position.lerpVectors(flight.from, flight.to, k);
      controls.target.lerpVectors(flight.lf, flight.lt, k);
      if (flight.t >= 1) flight = null;
    }
    if (!reduce) {
      board.rotation.y += dt * .15;
      const a = embers.geometry.attributes.position;
      for (let i = 0; i < N; i++) { let y = a.getY(i) + dt * (.6 + (i % 7) * .08); if (y > 32) y = 2; a.setY(i, y); }
      a.needsUpdate = true;
      tokens.forEach((t, i) => { t.children[1].position.y = .7 + Math.sin(clock.elapsedTime * 2 + i) * .05; });
      ringGlow.material.opacity = .6 + Math.sin(clock.elapsedTime * 4) * .3;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  frame();
  new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); }).observe(view);
  return {setPlayers, spotlight, camera: name => PRESETS[name] && goTo(...PRESETS[name])};
}

window.ELHLastLineup?.();
const io = new IntersectionObserver(entries => {
  if (entries.some(e => e.isIntersecting)) { io.disconnect(); boot(); }
}, {rootMargin: '300px'});
io.observe(view);
