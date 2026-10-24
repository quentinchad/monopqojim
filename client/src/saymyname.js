// Cinématique « Say my name » : jouée quand un trafiquant livre sa marchandise.
// Reprise de la scène de Breaking Bad (saison 5) dans le désert : Heisenberg (pion avec chapeau, lunettes
// et bouc) face au pion du joueur, voitures et hommes de main autour, champ / contrechamp puis grue finale.
import * as THREE from 'three';
import { makeSkinModel } from './skin3d.js';

export const SAY_MY_NAME_DURATION = 18; // secondes

// Répliques (sous-titres, en anglais comme dans la série) : qui parle et quand
export const LINES = [
  { from: 3.6, to: 5.6, who: 'player', text: 'Who the hell are you?' },
  { from: 6.6, to: 8.8, who: 'walt', text: 'Say my name.' },
  { from: 10.3, to: 11.9, who: 'player', text: '… Heisenberg.' },
  { from: 12.5, to: 14.6, who: 'walt', text: 'You’re goddamn right.' },
];
export const T_TITLE = 15.2;

const W_POS = new THREE.Vector3(-0.85, 0, 0);
const P_POS = new THREE.Vector3(0.85, 0, 0);
const HEAD_Y = 0.47 * 1.4;

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => x * x * (3 - 2 * x);

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

// Pion de base (même silhouette que sur le plateau) : socle, corps, tête
function pawnBase(bodyMat, headMat = bodyMat) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 32), bodyMat, 0, 0.035, 0, g);
  mesh(new THREE.CylinderGeometry(0.07, 0.16, 0.34, 32), bodyMat, 0, 0.24, 0, g);
  const head = new THREE.Group();
  head.position.y = 0.47;
  mesh(new THREE.SphereGeometry(0.12, 32, 24), headMat, 0, 0, 0, head);
  g.add(head);
  g.userData.head = head;
  return g;
}

function addEyes(head, y = 0.02, z = 0.1) {
  const white = std('#ffffff', { roughness: 0.3 });
  const black = std('#111111', { roughness: 0.2 });
  for (const x of [-0.042, 0.042]) {
    mesh(new THREE.SphereGeometry(0.026, 16, 12), white, x, y, z, head);
    mesh(new THREE.SphereGeometry(0.013, 10, 8), black, x, y, z + 0.022, head);
  }
}

function addMouth(head, y = -0.05, z = 0.112) {
  const m = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), std('#3b0a0a'), 0, y, z, head);
  head.userData.mouth = m;
  return m;
}

// Heisenberg : veste sombre, col de chemise, crâne chauve, chapeau pork-pie noir, lunettes, bouc et moustache
function makeWalt() {
  const jacket = std('#26221d', { roughness: 0.8 });
  const skin = std('#f2c6a6', { roughness: 0.6 });
  const g = pawnBase(jacket, skin);
  const head = g.userData.head;
  // col de chemise et ouverture de la veste
  mesh(new THREE.TorusGeometry(0.068, 0.018, 10, 28), std('#e9e4d8'), 0, 0.385, 0, g).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.03, 0.18, 0.02), std('#d8d2c4'), 0, 0.3, 0.1, g).rotation.x = -0.42;
  // oreilles
  for (const x of [-0.118, 0.118]) mesh(new THREE.SphereGeometry(0.024, 12, 10), skin, x, 0, 0, head).scale.set(0.6, 1, 1);
  addEyes(head, 0.022, 0.098);
  // sourcils froncés
  const brow = std('#5c4a3d');
  for (const s of [-1, 1]) {
    const b = mesh(new THREE.BoxGeometry(0.045, 0.009, 0.01), brow, s * 0.042, 0.06, 0.108, head);
    b.rotation.z = s * -0.25;
  }
  // lunettes : montures rectangulaires arrondies, verres légèrement teintés
  const frame = std('#141414', { metalness: 0.5, roughness: 0.3 });
  const lens = new THREE.MeshStandardMaterial({ color: '#3c4a3a', transparent: true, opacity: 0.45, metalness: 0.9, roughness: 0.05 });
  for (const s of [-1, 1]) {
    const f = mesh(new THREE.TorusGeometry(0.03, 0.0055, 8, 24), frame, s * 0.044, 0.024, 0.117, head);
    f.scale.set(1.25, 0.85, 1);
    const l = mesh(new THREE.CircleGeometry(0.03, 24), lens, s * 0.044, 0.024, 0.116, head);
    l.scale.set(1.25, 0.85, 1);
    // branches vers les oreilles
    const arm = mesh(new THREE.BoxGeometry(0.006, 0.006, 0.11), frame, s * 0.093, 0.028, 0.065, head);
    arm.rotation.y = s * 0.28;
  }
  mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), frame, 0, 0.03, 0.12, head);
  // bouc et moustache (poivre et sel)
  const beard = std('#7a6a5c', { roughness: 1 });
  mesh(new THREE.BoxGeometry(0.068, 0.012, 0.02), beard, 0, -0.03, 0.113, head);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.012, 0.05, 0.02), beard, s * 0.034, -0.055, 0.105, head);
  mesh(new THREE.BoxGeometry(0.05, 0.035, 0.03), beard, 0, -0.085, 0.095, head);
  addMouth(head, -0.052, 0.118).scale.set(0.8, 1, 1);
  // chapeau pork-pie noir : bord court, calotte plate pincée, ruban
  const felt = std('#121212', { roughness: 0.9 });
  const hat = new THREE.Group();
  hat.position.y = 0.075;
  mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.012, 40), felt, 0, 0, 0, hat);
  mesh(new THREE.CylinderGeometry(0.112, 0.122, 0.07, 40), felt, 0, 0.037, 0, hat);
  mesh(new THREE.CylinderGeometry(0.1235, 0.1235, 0.022, 40), std('#2c2c2c', { roughness: 0.6 }), 0, 0.017, 0, hat);
  mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 32), felt, 0, 0.072, 0, hat).rotation.x = Math.PI / 2;
  hat.rotation.x = -0.06;
  head.add(hat);
  g.scale.setScalar(1.4);
  return g;
}

// Pion du joueur, à sa couleur, avec des yeux et une bouche pour parler
function makePlayerPawn(color) {
  const mat = std(color, { metalness: 0.35, roughness: 0.35 });
  const g = pawnBase(mat);
  addEyes(g.userData.head);
  addMouth(g.userData.head);
  g.scale.setScalar(1.4);
  return g;
}

function makeExtra({ body, head, hat, shades, beanie }) {
  const g = pawnBase(std(body, { metalness: 0.2, roughness: 0.6 }), std(head, { roughness: 0.6 }));
  const h = g.userData.head;
  if (shades) {
    mesh(new THREE.BoxGeometry(0.16, 0.035, 0.02), std('#050505', { metalness: 0.8, roughness: 0.1 }), 0, 0.02, 0.105, h);
  } else addEyes(h);
  if (beanie) {
    const b = mesh(new THREE.SphereGeometry(0.128, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(beanie, { roughness: 1 }), 0, 0.02, 0, h);
    b.scale.y = 0.9;
  }
  if (hat) mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 24), std(hat), 0, 0.08, 0, h);
  g.scale.setScalar(1.3);
  return g;
}

function makeCar({ color, suv = false }) {
  const g = new THREE.Group();
  const paint = std(color, { metalness: 0.7, roughness: 0.25 });
  const glass = std('#334155', { metalness: 0.9, roughness: 0.1 });
  const chrome = std('#d4d4d8', { metalness: 1, roughness: 0.2 });
  const tire = std('#111111', { roughness: 0.9 });
  const L = suv ? 2.3 : 2.25;
  const H = suv ? 0.48 : 0.3;
  const B = suv ? 0.2 : 0.16;
  // l'avant est vers +z
  mesh(new THREE.BoxGeometry(1.0, H, L), paint, 0, B + H / 2, 0, g);
  const cabin = suv ? [0.96, 0.38, 1.55, -0.2] : [0.86, 0.26, 1.1, -0.15];
  mesh(new THREE.BoxGeometry(cabin[0], cabin[1], cabin[2]), glass, 0, B + H + cabin[1] / 2, cabin[3], g);
  mesh(new THREE.BoxGeometry(cabin[0] + 0.01, 0.03, cabin[2] + 0.01), paint, 0, B + H + cabin[1], cabin[3], g);
  // calandre et phares
  mesh(new THREE.BoxGeometry(0.6, H * 0.45, 0.02), chrome, 0, B + H * 0.45, L / 2 + 0.005, g);
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), std('#fff7d6', { emissive: '#fff7d6', emissiveIntensity: 0.4 }), s * 0.38, B + H * 0.62, L / 2 + 0.006, g);
    mesh(new THREE.BoxGeometry(0.14, 0.06, 0.02), std('#7f1d1d', { emissive: '#7f1d1d', emissiveIntensity: 0.3 }), s * 0.38, B + H * 0.62, -L / 2 - 0.006, g);
  }
  for (const [x, z] of [[-0.5, L * 0.32], [0.5, L * 0.32], [-0.5, -L * 0.32], [0.5, -L * 0.32]]) {
    const w = mesh(new THREE.CylinderGeometry(B + 0.03, B + 0.03, 0.14, 20), tire, x, B + 0.03, z, g);
    w.rotation.z = Math.PI / 2;
    const hub = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.145, 16), chrome, x, B + 0.03, z, g);
    hub.rotation.z = Math.PI / 2;
  }
  return g;
}

function makeSky() {
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const colors = [];
  const top = new THREE.Color('#5b8fc7');
  const horizon = new THREE.Color('#f1e3c4');
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = clamp01(pos.getY(i) / 180);
    const c = horizon.clone().lerp(top, Math.pow(k, 0.55));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
}

function makeGround() {
  const geo = new THREE.PlaneGeometry(400, 400, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const a = new THREE.Color('#d9b98a');
  const b = new THREE.Color('#c49a68');
  const c = new THREE.Color('#e6cfa3');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    // terrain plat autour de la scène, légères ondulations au loin
    const h = r < 14 ? 0 : (Math.sin(x * 0.07) * Math.cos(z * 0.05) * 1.6 + Math.sin(x * 0.21 + z * 0.13) * 0.4) * clamp01((r - 14) / 30);
    pos.setY(i, h);
    const n = (Math.sin(x * 1.7 + z * 0.9) + Math.sin(x * 0.37 - z * 1.3)) * 0.25 + Math.random() * 0.5;
    const col = a.clone().lerp(n > 0.45 ? c : b, Math.abs(n - 0.3));
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}

function buildDesert(group) {
  group.add(makeSky(), makeGround());
  // mesas et buttes à l'horizon
  const rock = [std('#b4683f', { roughness: 1 }), std('#a35a36', { roughness: 1 }), std('#c27c4e', { roughness: 1 })];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.random() * 0.25;
    const r = 75 + Math.random() * 45;
    const h = 5 + Math.random() * 12;
    const w = 6 + Math.random() * 16;
    const m = mesh(new THREE.CylinderGeometry(w * 0.75, w, h, 7), rock[i % 3], Math.cos(a) * r, h / 2 - 0.5, Math.sin(a) * r, group);
    m.scale.z = 0.5 + Math.random() * 0.6;
    m.rotation.y = Math.random() * Math.PI;
    m.castShadow = false;
  }
  // broussailles et cailloux
  const bush = [std('#7a7d45', { roughness: 1 }), std('#8b8a55', { roughness: 1 }), std('#6a6b3c', { roughness: 1 })];
  const stone = std('#a8957a', { roughness: 1 });
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 60;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 7 && Math.abs(z) < 3.5) continue;
    const isBush = Math.random() < 0.7;
    const s = isBush ? 0.12 + Math.random() * 0.3 : 0.05 + Math.random() * 0.12;
    const m = mesh(new THREE.IcosahedronGeometry(s, 0), isBush ? bush[i % 3] : stone, x, s * 0.5, z, group);
    m.scale.y = isBush ? 0.7 : 0.5;
    m.rotation.y = Math.random() * 3;
  }
  // piste de terre
  const road = new THREE.Mesh(new THREE.PlaneGeometry(3, 120), std('#c9a777', { roughness: 1 }));
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = 0.35;
  road.position.set(0, 0.01, -6);
  road.receiveShadow = true;
  group.add(road);
}

export function createSayMyName({ container, color = '#ef4444', skin, src, faceSrc }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#ead9b6', 30, 160);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 400);

  scene.add(new THREE.HemisphereLight('#cfe3ff', '#b08a5a', 0.9));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.position.set(-6, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);
  buildDesert(world);

  // les deux protagonistes, face à face
  const walt = makeWalt();
  walt.position.copy(W_POS);
  walt.lookAt(P_POS);
  // face à Heisenberg : le pion personnalisé du joueur s'il en a un
  let player;
  if (skin && (src || skin.type === 'character')) {
    player = new THREE.Group();
    player.add(makeSkinModel({ skin, src, faceSrc, color }));
    player.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    player.userData.head = player.children[0].userData.head;
    player.scale.setScalar(1.4);
  } else player = makePlayerPawn(color);
  player.position.copy(P_POS);
  player.lookAt(W_POS);
  world.add(walt, player);

  // le camp de Heisenberg : sa voiture, Mike et Jesse
  const sedan = makeCar({ color: '#3a1418' });
  sedan.position.set(-4.3, 0, -1.4);
  sedan.rotation.y = 2.2;
  const mike = makeExtra({ body: '#b9a27a', head: '#e2b08f' });
  mike.position.set(-2.9, 0, -0.9);
  const jesse = makeExtra({ body: '#3e4a3a', head: '#f0c3a0', beanie: '#6b7280' });
  jesse.position.set(-3.2, 0, 0.7);
  // le camp d'en face : 4×4 noirs et hommes de main en lunettes noires
  const suvs = [[4.6, -1.7, -2.4], [5.1, 1.5, -1.0]].map(([x, z, r]) => {
    const s = makeCar({ color: '#0a0a0c', suv: true });
    s.position.set(x, 0, z);
    s.rotation.y = r;
    return s;
  });
  const goons = [[3.3, -0.8], [3.5, 0.9], [4.2, 0.1]].map(([x, z]) => {
    const g = makeExtra({ body: '#111114', head: '#d9a27e', shades: true });
    g.position.set(x, 0, z);
    return g;
  });
  world.add(sedan, mike, jesse, ...suvs, ...goons);
  for (const o of [mike, jesse, ...goons]) o.lookAt(0, 0, 0);

  // poussière qui flotte dans la lumière
  const dustGeo = new THREE.BufferGeometry();
  const N = 400;
  const dp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { dp[i * 3] = (Math.random() - 0.5) * 30; dp[i * 3 + 1] = Math.random() * 3; dp[i * 3 + 2] = (Math.random() - 0.5) * 30; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#fff3d6', size: 0.03, transparent: true, opacity: 0.6, depthWrite: false }));
  world.add(dust);

  // virevoltant qui traverse le champ
  const tumble = mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshStandardMaterial({ color: '#9a7b4f', wireframe: true }), 0, 0.22, 0, world);

  const wHead = new THREE.Vector3(W_POS.x, HEAD_Y, 0);
  const pHead = new THREE.Vector3(P_POS.x, HEAD_Y, 0);
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  // plans successifs (coupes franches, comme dans la série) : position et cible de la caméra
  const SHOTS = [
    { until: 3.4, from: [v(-3, 3.2, 10), v(0, 0.5, 0)], to: [v(-1.2, 1.7, 6.8), v(0, 0.55, 0)] },
    { until: 5.9, from: [v(-2.2, 0.98, 0.75), pHead], to: [v(-2.0, 0.95, 0.65), pHead] },
    { until: 9.2, from: [v(0.75, 0.55, 0.42), wHead], to: [v(0.2, 0.6, 0.24), wHead] },
    { until: 12.1, from: [v(-0.25, 0.66, -0.4), pHead], to: [v(-0.05, 0.64, -0.3), pHead] },
    { until: 14.9, from: [v(0.25, 0.5, 0.3), wHead], to: [v(0.05, 0.55, 0.2), wHead.clone().setY(HEAD_Y + 0.02)] },
    { until: SAY_MY_NAME_DURATION + 1, from: [v(0, 1.1, 4.2), v(0, 0.5, 0)], to: [v(3, 8, 11), v(0, 0.2, 0)] },
  ];
  let start = 0;
  const shotAt = (t) => {
    start = 0;
    for (const s of SHOTS) { if (t < s.until) return s; start = s.until; }
    return SHOTS[SHOTS.length - 1];
  };

  const talking = (who, t) => LINES.some((l) => l.who === who && t >= l.from && t <= l.to - 0.2);

  function update(t) {
    const s = shotAt(t);
    const k = ease(clamp01((t - start) / (s.until - start)));
    const pos = s.from[0].clone().lerp(s.to[0], k);
    const look = s.from[1].clone().lerp(s.to[1], k);
    // léger mouvement de caméra à l'épaule
    pos.x += Math.sin(t * 1.3) * 0.006;
    pos.y += Math.sin(t * 1.7 + 1) * 0.005;
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.fov = s === SHOTS[2] || s === SHOTS[4] ? 30 : 35;
    camera.updateProjectionMatrix();

    // bouches qui bougent pendant les répliques
    for (const [who, pawn] of [['walt', walt], ['player', player]]) {
      const mouth = pawn.userData.head?.userData.mouth;
      if (!mouth) continue;
      mouth.scale.y = talking(who, t) ? 1 + Math.abs(Math.sin(t * 17)) * 2.6 : 1;
    }
    // Heisenberg incline la tête sur « T'as foutrement raison », le joueur déglutit avant de répondre
    const nod = t > 13.3 && t < 14.2 ? Math.sin(((t - 13.3) / 0.9) * Math.PI) * 0.18 : 0;
    walt.userData.head.rotation.x = nod;
    const nervous = t > 9.2 && t < 10.3 ? Math.sin(t * 22) * 0.012 : 0;
    const ph = player.userData.head || player.children[0]?.userData.head; // tête parfois construite après coup
    if (ph) {
      ph.userData.x0 ??= ph.position.x;
      ph.position.x = ph.userData.x0 + nervous;
      ph.rotation.x = t > 9.2 && t < 12 ? 0.1 : 0;
    } else {
      player.rotation.z = nervous * 2;
    }

    tumble.position.set(-12 + ((t * 1.6) % 30), 0.22 + Math.abs(Math.sin(t * 4)) * 0.12, 5.5);
    tumble.rotation.z = -t * 6;
    dust.rotation.y = t * 0.02;
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { update, resize, dispose };
}
