/* EliteChel Media · Elite Live Hub · Carbon Arena.
 *
 * Default view: the real Carbon pregame scene for a Czechia World Juniors matchup. It is served
 * by this site at /czechia/arena/<game>/broadcast.html; a public viewer pass from
 * /czechia/arena/<game>/viewer-session opens it for one matchup (api/lg3s-carbon.js).
 * Carbon only takes camera and spotlight orders from its own lineup-card page
 * (czechia-obs.html), so this page sends them there as `ecm:live-hub-arena:1` messages and
 * hears back when the rink is ready. If Carbon cannot start, the public 3D rink and hockey cards
 * for the same matchup are shown instead.
 *
 * Demo mode (a local three.js rink with sample players) runs only when the viewer picks it.
 * The schedule and lineups arrive from elite-live-hub.js through `elh:arena-data`.
 */
const $ = id => document.getElementById(id);
const section = $('arena');
const view = $('elhArenaView');
const msg = $('elhArenaMsg');
const roster = $('elhArenaRoster');
const card = $('elhArenaCard');
const label = $('elhArenaLabel');
const when = $('elhArenaWhen');
const pick = $('elhArenaGame');
const camSeg = $('elhCamSeg');
const hint = $('elhArenaHint');
const full = $('elhArenaFull');
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[c]);

const PROTOCOL = 'ecm:live-hub-arena:1';
const READY_TIMEOUT = 25000;
const ORDER = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];
const NATION_FLAGS = {canada: 'ca', czechia: 'cz', finland: 'fi', germany: 'de', slovakia: 'sk', sweden: 'se', switzerland: 'ch', usa: 'us'};
const flag = name => { const c = NATION_FLAGS[String(name).toLowerCase()]; return c ? `/assets/lg3s-world/flags/${c}.svg` : ''; };
const dayLabel = new Intl.DateTimeFormat('en-CA', {timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric'});

// mode: loading | carbon | public (fallback rink + cards) | demo | empty
const A = {data: null, key: null, picked: false, demo: false, mode: 'loading', camera: 'ice', demoCam: 'wide',
  spotlight: null, frame: null, timer: 0, probe: 0, token: 0, near: false};
let demoApi = null;

const game = () => A.data?.games.find(g => g.key === A.key) || null;
const byPosition = list => [...(list || [])].sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position));

function showMsg(text) { msg.textContent = text; msg.hidden = !text; }
function setMode(mode) {
  A.mode = mode;
  section.dataset.arenaMode = mode;
  updateCams();
  renderHint();
}

/* ---------- Sidebar ---------- */
function teamBlock(side, name, players, home) {
  const crest = flag(name);
  const head = `<h3>${crest ? `<img src="${esc(crest)}" alt="" width="22" height="15">` : ''}${esc(name)}</h3>`;
  if (!players.length) return `<section class="elh-arena-team ${home ? 'is-home' : 'is-away'}">${head}<p class="elh-arena-pending">Lineup pending</p></section>`;
  const canSpot = A.mode === 'carbon' || A.mode === 'loading' || A.mode === 'demo';
  return `<section class="elh-arena-team ${home ? 'is-home' : 'is-away'}">${head}<ol>${players.map(p => {
    const on = A.spotlight && A.spotlight.side === side && A.spotlight.position === p.position && A.spotlight.name === p.name;
    return `<li><button type="button" class="${home ? 'is-home' : 'is-away'}${on ? ' is-on' : ''}" data-side="${side}" data-position="${esc(p.position)}" data-name="${esc(p.name)}"${canSpot ? '' : ' disabled'}><span class="elh-pos">${esc(p.position)}</span><b>${esc(p.name)}</b>${p.jersey ? `<small>#${esc(p.jersey)}</small>` : ''}</button></li>`;
  }).join('')}</ol></section>`;
}

function renderSide() {
  card.hidden = true;
  if (A.demo) {
    const d = A.data?.demo;
    const players = d?.players || [];
    const teams = [...new Set(players.map(p => p.team))];
    label.textContent = 'Demo · ' + (d?.label || 'sample matchup');
    when.textContent = 'Sample lineup. Not a real game.';
    roster.innerHTML = teams.map(t => teamBlock(t, t, byPosition(players.filter(p => p.team === t)), t === d?.home)).join('');
    full.hidden = !fullOK();
    return;
  }
  const g = game();
  full.hidden = !fullOK();
  if (!g) {
    label.textContent = 'Starting lineups';
    when.textContent = '';
    roster.innerHTML = '';
    return;
  }
  label.textContent = 'Czechia vs ' + g.opponent;
  when.textContent = dayLabel.format(new Date(g.date + 'T12:00:00Z')) + ' · ' + g.time;
  roster.innerHTML = teamBlock('czech', 'Czechia', byPosition(g.czech), true) + teamBlock('away', g.opponent, byPosition(g.away), false);
  if (A.spotlight) showCard();
}

function showCard() {
  const s = A.spotlight;
  if (!s) { card.hidden = true; return; }
  const team = s.side === 'czech' ? 'Czechia' : s.side === 'away' ? game()?.opponent : s.side;
  const note = A.demo ? 'Spotlight on' : A.mode !== 'carbon' ? 'Applies when the 3D rink is ready'
    : s.side === 'czech' ? 'Follow cam on' : 'Highlighted on the ice';
  card.hidden = false;
  card.innerHTML = `<span class="elh-pos">${esc(s.position)}</span><b>${esc(s.name)}</b><small>${esc(team || '')} · ${esc(note)}</small>`;
}

function renderHint() {
  hint.textContent = A.demo ? 'Demo rink. Drag to orbit, scroll or pinch to zoom, pick a player to spotlight them.'
    : A.mode === 'carbon' ? 'Pick a Czechia player for the follow cam, or an opponent to highlight them. Pick again to clear.'
    : A.mode === 'public' ? 'Showing the standard pregame rink. Camera and spotlight controls need the 3D Carbon view.'
    : A.mode === 'loading' ? 'Loading the 3D rink…' : '';
}

function renderPicker() {
  const games = A.data?.games || [];
  const opts = games.map(g => `<option value="${esc(g.key)}">${esc(dayLabel.format(new Date(g.date + 'T12:00:00Z')))} · ${esc(g.time)} · vs ${esc(g.opponent)}</option>`);
  if (!games.length) opts.push(`<option value="" disabled>${A.data?.feed === 'down' ? 'Schedule unavailable' : A.data?.feed === 'loading' ? 'Loading…' : 'No matchup posted yet'}</option>`);
  opts.push('<optgroup label="Demo"><option value="demo">Demo · sample matchup (not a real game)</option></optgroup>');
  pick.innerHTML = opts.join('');
  pick.value = A.demo ? 'demo' : A.key || '';
  pick.disabled = false;
}

/* ---------- Cameras ---------- */
function updateCams() {
  let shown = 0;
  camSeg.querySelectorAll('button').forEach(b => {
    const show = A.demo || (A.mode === 'carbon' && !!b.dataset.carbonCam);
    b.hidden = !show;
    if (show) shown++;
    b.setAttribute('aria-pressed', String(A.demo ? b.dataset.cam === A.demoCam : b.dataset.carbonCam === A.camera));
  });
  camSeg.hidden = !shown;
}

window.addEventListener('elh:camera', e => {
  const {demo, carbon} = e.detail || {};
  if (A.demo) { A.demoCam = demo; demoApi?.camera(demo); updateCams(); return; }
  if (A.mode !== 'carbon' || !carbon) return;
  A.camera = carbon;
  if (A.spotlight?.side === 'czech' && carbon !== 'orbit') { /* ring stays, follow cam off */ }
  updateCams(); sendView(); showCard();
});

/* ---------- Carbon ---------- */
function graphicsWindow() {
  try { return A.frame?.contentDocument?.getElementById('graphics')?.contentWindow || null; } catch { return null; }
}
function sendView() {
  if (A.mode !== 'carbon' || !A.key) return;
  const s = A.spotlight;
  graphicsWindow()?.postMessage({protocol: PROTOCOL, type: 'view', game: A.key, camera: A.camera,
    spotlight: s ? {side: s.side, position: s.position} : null}, location.origin);
}

window.addEventListener('message', e => {
  const d = e.data;
  if (e.origin !== location.origin || d?.protocol !== PROTOCOL || d.type !== 'ready' || d.game !== A.key) return;
  if (!A.frame || e.source !== graphicsWindow()) return;
  if (A.mode === 'carbon') return;
  clearTimeout(A.timer); clearInterval(A.probe);
  showMsg('');
  setMode('carbon');
  renderSide();
  sendView();
});

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

function teardown() {
  clearTimeout(A.timer); clearInterval(A.probe);
  A.frame?.remove(); A.frame = null;
  demoApi?.dispose(); demoApi = null;
}

function frameFor(src, title, cls) {
  const f = document.createElement('iframe');
  f.className = cls; f.title = title; f.src = src;
  f.allow = 'fullscreen'; f.allowFullscreen = true;
  view.append(f);
  return f;
}

function mountPublic(g, token) {
  if (token !== A.token) return;
  teardown();
  showMsg('');
  A.frame = frameFor('/czechia-obs.html?' + new URLSearchParams({game: g.key, view: 'live-hub'}),
    'Czechia vs ' + g.opponent + ' pregame · rink and hockey cards', 'elh-arena-frame is-public');
  A.spotlight = null;
  setMode('public');
  renderSide();
}

async function mountCarbon(g) {
  const token = ++A.token;
  teardown();
  setMode('loading');
  renderSide();
  showMsg('Loading Carbon Arena…');
  if (!webglOK()) return mountPublic(g, token);
  const base = '/czechia/arena/' + encodeURIComponent(g.key) + '/';
  try {
    const pass = await fetch(base + 'viewer-session', {method: 'POST', cache: 'no-store', credentials: 'same-origin'});
    if (!pass.ok) throw new Error('viewer pass ' + pass.status);
  } catch {
    return mountPublic(g, token);
  }
  if (token !== A.token) return;
  A.frame = frameFor(base + 'broadcast.html?' + new URLSearchParams({team: 'czechia', game: g.key}),
    'Carbon Arena pregame · Czechia vs ' + g.opponent, 'elh-arena-frame');
  // Carbon shows its own error line if WebGL fails to start; switch to the standard rink then.
  A.probe = setInterval(() => {
    try {
      const err = A.frame?.contentDocument?.getElementById('arenaError');
      if (err && !err.hidden) mountPublic(g, token);
    } catch { /* not loaded yet */ }
  }, 1000);
  A.timer = setTimeout(() => { if (A.mode !== 'carbon') mountPublic(g, token); }, READY_TIMEOUT);
}

/* ---------- Demo ---------- */
async function mountDemo() {
  const token = ++A.token;
  teardown();
  setMode('demo');
  renderSide();
  if (!webglOK()) { showMsg('Your device cannot show the 3D demo rink.'); return; }
  showMsg('Loading the demo rink…');
  let THREE, OrbitControls;
  try {
    THREE = await import('three');
    ({OrbitControls} = await import('three/addons/controls/OrbitControls.js'));
  } catch {
    if (token === A.token) showMsg('The 3D engine could not load. Check your connection and refresh.');
    return;
  }
  if (token !== A.token) return;
  showMsg('');
  demoApi = build(THREE, OrbitControls);
  demoApi.setPlayers(A.data?.demo);
  demoApi.camera(A.demoCam);
}

/* ---------- Selection ---------- */
function mount() {
  if (!A.near) return;
  if (A.demo) return mountDemo();
  const g = game();
  if (g) return mountCarbon(g);
  teardown();
  setMode('empty');
  showMsg(A.data?.feed === 'down' ? 'The World Juniors schedule is unavailable right now. Refresh to try again.'
    : A.data?.feed === 'loading' || !A.data ? 'Loading the World Juniors matchup…'
    : 'The next Czechia matchup appears here when the schedule is posted.');
}

function select(key, byViewer) {
  if (byViewer) A.picked = true;
  if (key === 'demo') { A.demo = true; A.key = null; }
  else { A.demo = false; A.key = key || null; }
  A.spotlight = null; A.camera = 'ice';
  pick.value = A.demo ? 'demo' : A.key || '';
  renderSide(); updateCams(); renderHint();
  mount();
}

window.addEventListener('elh:arena-data', e => {
  const first = !A.data;
  A.data = e.detail;
  renderPicker();
  if (A.demo) { renderSide(); return; }
  const keep = A.picked && A.data.games.some(g => g.key === A.key);
  const key = keep ? A.key : A.data.nextKey;
  if (key !== A.key || first || (!key && A.mode !== 'empty')) select(key, false);
  else renderSide();
});

window.addEventListener('elh:arena-select', e => {
  const d = e.detail || {};
  if (d.demo) select('demo', true);
  else if (d.key) select(d.key, true);
});

pick.addEventListener('change', () => select(pick.value, true));
full.hidden = !view.requestFullscreen;
full.addEventListener('click', () => view.requestFullscreen?.().catch(() => {}));
const fullOK = () => !!view.requestFullscreen;

roster.addEventListener('click', e => {
  const b = e.target.closest('button[data-side]');
  if (!b || b.disabled) return;
  const s = {side: b.dataset.side, position: b.dataset.position, name: b.dataset.name};
  const same = A.spotlight && A.spotlight.side === s.side && A.spotlight.position === s.position && A.spotlight.name === s.name;
  A.spotlight = same ? null : s;
  if (A.demo) {
    const players = A.data?.demo?.players || [];
    const i = players.findIndex(p => p.team === s.side && p.position === s.position && p.name === s.name);
    if (!same && i >= 0) demoApi?.spotlight(i);
  } else if (s.side === 'czech' && !same) {
    A.camera = 'orbit'; // Carbon's follow cam tracks Czechia skaters in orbit view.
  } else if (A.camera === 'orbit') {
    A.camera = 'ice';
  }
  renderSide(); updateCams(); sendView();
});

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
  let alive = true;
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
  const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  seen.observe(view);
  function frame() {
    if (!alive) return;
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
  const sized = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
  sized.observe(view);
  function dispose() {
    alive = false; seen.disconnect(); sized.disconnect(); controls.dispose();
    renderer.dispose(); renderer.domElement.remove();
  }
  return {setPlayers, spotlight, dispose, camera: name => PRESETS[name] && goTo(...PRESETS[name])};
}


// Load the 3D scene when the arena comes near the viewport, or straight away if linked to.
const io = new IntersectionObserver(entries => {
  if (!entries.some(e => e.isIntersecting)) return;
  io.disconnect();
  A.near = true;
  mount();
}, {rootMargin: '600px'});
io.observe(view);
const initial = window.ELHArenaData?.();
if (initial) window.dispatchEvent(new CustomEvent('elh:arena-data', {detail: initial}));
