import * as THREE from 'three';
import { createGBR3DSkaterTexture, GBR_ROSTER, jerseyImage } from '../utils/gbrRoyalBlueJersey';
import { demoFormations, demoMatch, type CameraAngle, type Match } from '../utils/match';

type State = Match & { positions?: Record<number, [number, number]> };
declare global {
  interface Window {
    installLG3SRinkBridge: (arena: {
      setState: (state: State) => void;
      setCamera: (camera: CameraAngle) => void;
      highlightPlayer: (number: number) => void;
      setAlpha: (alpha: boolean) => void;
      onPlayerSelected: (callback: (num: number) => void) => () => void;
    }) => () => void;
  }
}
const viewport = document.querySelector<HTMLElement>('#viewport')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;

const views: Record<CameraAngle, [number, number, number]> = {
    ice: [37, 29, 39], overhead: [0, 78, .01], goalie: [-35, 7, 0],
    jumbotron: [0, 25, 34], orbit: [42, 30, 36],
  };

function mountRink() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  renderer.setClearColor(0, 0);
  viewport.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
  const key = new THREE.DirectionalLight(0xd0e7ff, 2.1);
  key.position.set(-12, 30, -9);
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x24395f, 1.7));
  const ice = document.createElement('canvas');
  ice.width = 1500;
  ice.height = 750;
  const ctx = ice.getContext('2d')!;
  const icePaint = ctx.createLinearGradient(0, 0, 0, 750);
  icePaint.addColorStop(0, '#d9edf9');
  icePaint.addColorStop(.5, '#f2faff');
  icePaint.addColorStop(1, '#c2d9eb');
  ctx.fillStyle = icePaint;
  ctx.fillRect(0, 0, 1500, 750);
  for (const [x, color, width] of [[750,'#c32346',9],[485,'#075e9e',12],[1015,'#075e9e',12],[103,'#c32346',4],[1397,'#c32346',4]] as const) {
    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, 0, width, 750);
  }
  for (const [x,y,r,color] of [[750,375,123,'#075e9e'],[313,178,120,'#c32346'],[313,570,120,'#c32346'],[1187,178,120,'#c32346'],[1187,570,120,'#c32346']] as const) {
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#93c5e8';
  for (const [x,start] of [[103,-Math.PI / 2],[1397,Math.PI / 2]]) {
    ctx.beginPath();
    ctx.arc(x, 375, 48, start, start + Math.PI);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(ice);
  texture.colorSpace = THREE.SRGBColorSpace;
  const outline = new THREE.Shape();
  outline.moveTo(-24, -14);
  outline.lineTo(24, -14);
  outline.quadraticCurveTo(30,-14,30,-8);
  outline.lineTo(30,8);
  outline.quadraticCurveTo(30,14,24,14);
  outline.lineTo(-24,14);
  outline.quadraticCurveTo(-30,14,-30,8);
  outline.lineTo(-30,-8);
  outline.quadraticCurveTo(-30,-14,-24,-14);

  const surface = new THREE.ShapeGeometry(outline, 12);
  const uv = surface.getAttribute('uv');
  const vertices = surface.getAttribute('position');
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, (vertices.getX(index) + 30) / 60, (vertices.getY(index) + 14) / 28);
  }
  const surfaceMesh = new THREE.Mesh(surface, new THREE.MeshBasicMaterial({ map: texture }));
  surfaceMesh.rotation.x = -Math.PI / 2;
  scene.add(surfaceMesh);
  const boards = outline.getSpacedPoints(132);
  for (const [height,tint] of [[.45,0x9bafc9],[.89,0x6b172b],[1.06,0x32476b]] as const) {
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      boards.map((p) => new THREE.Vector3(p.x, height, -p.y))),
      new THREE.LineBasicMaterial({ color: tint })));
  }
  const scoreCanvas = document.createElement('canvas');
  scoreCanvas.width = 512; scoreCanvas.height = 128;
  const scoreCtx = scoreCanvas.getContext('2d')!;
  const scoreTexture = new THREE.CanvasTexture(scoreCanvas);
  scoreTexture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Sprite(new THREE.SpriteMaterial({ map: scoreTexture }));
  screen.scale.set(14, 3.5, 1);
  screen.position.set(0, 9, -12);
  scene.add(screen);
  const baseGeometry = new THREE.CylinderGeometry(.75, .88, .25, 14);
  const helmetGeometry = new THREE.SphereGeometry(.35, 16, 10);
  let state: State = demoMatch;
  let chosen = state.highlighted_player;
  let cameraMode: CameraAngle = state.camera_angle;
  const jumpTarget = new THREE.Vector3();
  camera.position.set(...views.ice);
  const selectors = new Set<(num: number) => void>();
  const players = GBR_ROSTER.map((spec) => {
    const group = new THREE.Group();
    group.userData.num = spec.num;
    scene.add(group);
    const pad = new THREE.Mesh(baseGeometry, new THREE.MeshStandardMaterial({ color: 0x08132b, metalness: .25 }));
    group.add(pad);
    const helmet = new THREE.Mesh(helmetGeometry, new THREE.MeshStandardMaterial({ color: 0x0d3c78 }));
    helmet.position.y = 2.08;
    group.add(helmet);
    const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .15 });
    const back = material.clone();
    const torso = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.05), material);
    torso.position.set(0, 1.12, .26);
    const reverse = new THREE.Mesh(torso.geometry, back);
    reverse.position.set(0, 1.12, -.26);
    reverse.rotation.y = Math.PI;
    group.add(torso, reverse);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1.11, 28), new THREE.MeshBasicMaterial({ color: 0xffc766, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .035;
    group.add(ring);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(2.2,2.5,1.6), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.y = 1.15;
    group.add(hitbox);
    return { spec, group, material, back, ring, hitbox };
  });
  let kitVersion = 0;
  function dress() {
    const version = ++kitVersion;
    for (const p of players) {
      for (const [side, material] of [['front',p.material],['back',p.back]] as const) {
        void createGBR3DSkaterTexture(p.spec, state.kit_variant, side).then((map) => {
          if (version !== kitVersion) { map.dispose(); return; }
          material.map?.dispose();
          material.map = map;
          material.needsUpdate = true;
        }).catch(console.warn);
      }
    }
  }
  dress();
  function updateScore() {
    scoreCtx.fillStyle = '#081325';
    scoreCtx.fillRect(0, 0, 512, 128);
    scoreCtx.fillStyle = '#edf6ff';
    scoreCtx.textAlign = 'center';
    scoreCtx.font = 'bold 38px sans-serif';
    scoreCtx.fillText(`${state.home_team} ${state.home_score}  —  ${state.away_score} ${state.away_team}`, 256, 53);
    scoreCtx.fillStyle = '#80bbff';
    scoreCtx.font = '23px monospace';
    scoreCtx.fillText(`${state.period}  ·  ${state.clock}`, 256, 96);
    scoreTexture.needsUpdate = true;
    status.value = `${state.active_formation.toUpperCase()}   /   ${state.home_team} ${state.home_score}–${state.away_score} ${state.away_team}`;
  }
  updateScore();
  window.installLG3SRinkBridge({
    setState(next) {
      const previous = state;
      state = next;
      cameraMode = next.camera_angle;
      chosen = next.highlighted_player;
      if (previous.kit_variant !== next.kit_variant) dress();
      updateScore();
    },
    setCamera(next) { cameraMode = next; },
    highlightPlayer(num) { chosen = num; },
    setAlpha(alpha) { renderer.setClearColor(0, 0); screen.visible = !alpha; },
    onPlayerSelected(callback) { selectors.add(callback); return () => selectors.delete(callback); },
  });
  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener('click', (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(2 * (event.clientX - bounds.x) / bounds.width - 1,
      1 - 2 * (event.clientY - bounds.y) / bounds.height), camera);
    const hit = raycaster.intersectObjects(players.map((p) => p.hitbox))[0];
    if (hit?.object.parent) {
      chosen = hit.object.parent.userData.num;
      selectors.forEach((callback) => callback(chosen));
    }
  });
  new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = viewport;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }).observe(viewport);
  let last = 0;
  const endpoint = new THREE.Vector3();
  renderer.setAnimationLoop((now) => {
    const damping = 1 - Math.exp(-Math.min(100, now - last) / 130);
    last = now;
    const [x, y, z] = views[cameraMode] ?? views.ice;
    const yaw = now * .00016;
    endpoint.set(cameraMode === 'orbit' ? Math.cos(yaw) * 44 : x, y, cameraMode === 'orbit' ? Math.sin(yaw) * 44 : z);
    if (camera.aspect < 1.5) endpoint.multiplyScalar(Math.min(1.55, 1.5 / camera.aspect));
    camera.position.lerp(endpoint, damping);
    jumpTarget.set(0, cameraMode === 'jumbotron' ? 5 : 0, 0);
    camera.lookAt(jumpTarget);
    const positions = state.positions ?? demoFormations.find((f) => f.slug === state.active_formation)?.positions;
    for (const p of players) {
      const [px, pz] = positions?.[p.spec.num] ?? [0, 0];
      p.group.position.x = THREE.MathUtils.lerp(p.group.position.x, px, damping);
      p.group.position.z = THREE.MathUtils.lerp(p.group.position.z, pz, damping);
      p.group.rotation.y = Math.atan2(camera.position.x - p.group.position.x, camera.position.z - p.group.position.z)
        + (state.jersey_side === 'back' ? Math.PI : 0);
      p.ring.visible = p.spec.num === chosen;
      p.ring.scale.setScalar(1 + .14 * Math.sin(now * .007));
    }
    renderer.render(scene, camera);
  });
}
try { mountRink(); } catch (error) {
  console.info('Using the Canvas tactical view', error);
  mountCanvasRink();
}

// Software-rendered tactical view for browser sources and browsers without WebGL2.
function mountCanvasRink() {
  viewport.replaceChildren();
  const canvas = document.createElement('canvas');
  viewport.append(canvas);
  const context = canvas.getContext('2d');
  if (!context) { status.value = 'Tactical view unavailable'; return; }
  const ctx = context;
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 180);
  let state: State = demoMatch;
  let alpha = false;
  const selects = new Set<(num: number) => void>();
  const images = new Map<number, HTMLImageElement>();
  let hits: { num: number; x: number; y: number }[] = [];
  function dress() {
    for (const spec of GBR_ROSTER) {
      const image = new Image();
      image.src = jerseyImage(spec, state.kit_variant, state.jersey_side);
      images.set(spec.num, image);
    }
  }
  dress();
  window.installLG3SRinkBridge({
    setState(next) {
      const updateKit = state.kit_variant !== next.kit_variant || state.jersey_side !== next.jersey_side;
      state = next;
      if (updateKit) dress();
    },
    setCamera(camera_angle) { state = { ...state, camera_angle }; },
    highlightPlayer(highlighted_player) { state = { ...state, highlighted_player }; },
    setAlpha(next) { alpha = next; },
    onPlayerSelected(callback) { selects.add(callback); return () => selects.delete(callback); },
  });
  canvas.addEventListener('click', (event) => {
    const { offsetX, offsetY } = event;
    const hit = hits.find((p) => Math.hypot(p.x - offsetX, p.y - offsetY) < 22);
    if (!hit) return;
    state = { ...state, highlighted_player: hit.num };
    selects.forEach((callback) => callback(hit.num));
  });
  const coord = new THREE.Vector3();
  function render(now: number) {
    requestAnimationFrame(render);
    const { clientWidth: width, clientHeight: height } = viewport;
    if (!width || !height) return;
    const ratio = Math.min(1.5, devicePixelRatio);
    const pxWidth = Math.round(width * ratio);
    const pxHeight = Math.round(height * ratio);
    if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
      canvas.width = pxWidth;
      canvas.height = pxHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const [x,y,z] = views[state.camera_angle] ?? views.ice;
    camera.position.set(x,y,z);
    if (state.camera_angle === 'orbit') camera.position.set(Math.cos(now * .00016) * 44, y, Math.sin(now * .00016) * 44);
    if (camera.aspect < 1.5) camera.position.multiplyScalar(Math.min(1.55, 1.5 / camera.aspect));
    camera.lookAt(0, state.camera_angle === 'jumbotron' ? 5 : 0, 0);
    camera.updateMatrixWorld();
    const point = (x: number, z: number, y = 0) => {
      coord.set(x,y,z).project(camera);
      return { x: (coord.x + 1) * width / 2, y: (1 - coord.y) * height / 2 };
    };
    const shape = (points: [number, number][]) => {
      ctx.beginPath();
      points.forEach(([x,z], i) => {
        const p = point(x,z);
        if (i === 0) ctx.moveTo(p.x,p.y);
        else ctx.lineTo(p.x,p.y);
      });
    };
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    const border: [number, number][] = [];
    for (const [x,z,start] of [[24,8,0],[-24,8,90],[-24,-8,180],[24,-8,270]]) {
      for (let deg = start; deg <= start + 90; deg += 15) {
        const rad = deg * Math.PI / 180;
        border.push([x + 6 * Math.cos(rad), z + 6 * Math.sin(rad)]);
      }
    }
    shape(border);
    ctx.closePath();
    ctx.fillStyle = '#e0f1fb';
    ctx.strokeStyle = '#8399b8';
    ctx.lineWidth = 5;
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.clip();
    for (const [x,color] of [[-26,'#ac3152'],[-11,'#1568aa'],[0,'#bb3054'],[11,'#1568aa'],[26,'#ac3152']] as const) {
      shape([[x,-14],[x,14]]);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    }
    for (const [x,z] of [[0,0],[-16,-7],[-16,7],[16,-7],[16,7]]) {
      const ellipse: [number, number][] = Array.from({ length: 33 }, (_, i) => {
        const t = i * Math.PI / 16;
        return [x + 4.6 * Math.cos(t), z + 4.6 * Math.sin(t)];
      });
      shape(ellipse);
      ctx.lineWidth = 1.2; ctx.strokeStyle = x ? '#be6780' : '#497aaf'; ctx.stroke();
    }
    ctx.restore();
    if (!alpha) {
      ctx.fillStyle = '#0c182c'; ctx.fillRect(width - 128,12,116,33);
      ctx.font = '600 12px sans-serif'; ctx.fillStyle = '#d8eaff';
      ctx.fillText(`${state.home_team} ${state.home_score}–${state.away_score} ${state.away_team}`, width - 120, 33);
    }
    const positions = state.positions ?? demoFormations.find((f) => f.slug === state.active_formation)?.positions;
    hits = GBR_ROSTER.map(({ num }) => {
      const [x,z] = positions?.[num] ?? [0,0];
      return { num, ...point(x,z) };
    }).sort((a,b) => a.y - b.y);
    for (const p of hits) {
      if (state.highlighted_player === p.num) {
        ctx.strokeStyle = '#e5a722';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 11, 5, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const image = images.get(p.num);
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, p.x - 13, p.y - 23, 26, 24);
      ctx.fillStyle = '#163865'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(String(p.num), p.x + 9, p.y + 1);
    }
    const label = `${state.active_formation.toUpperCase()}   /   ${state.home_team} ${state.home_score}–${state.away_score} ${state.away_team}`;
    if (status.value !== label) status.value = label;
  }
  requestAnimationFrame(render);
}
