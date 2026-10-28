// Cinématique du « Régime de Vichy » : façon actualités d'époque, sur le quai d'une petite gare de campagne
// (l'entrevue de Montoire). Les deux collaborateurs s'avancent l'un vers l'autre devant une locomotive à vapeur,
// se serrent longuement la main sous les flashs des photographes, puis posent pour la photo officielle.
import * as THREE from 'three';
import { playerModel } from './skin3d.js';

export const VICHY_DURATION = 9.5;
export const T_SHAKE = 2.7; // la poignée de main
export const T_POSE = 6.4; // ils posent pour la photo
export const T_PHOTO = 7.4; // le flash de la photo officielle

const H = 1.75;
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

function visibleBox(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const walk = (o) => {
    if (!o.visible) return;
    if (o.isMesh) {
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    }
    o.children.forEach(walk);
  };
  walk(obj);
  return box;
}

function figure(roomId, p) {
  const g = new THREE.Group();
  const m = playerModel(roomId, p);
  if (p?.skin?.type === 'character' && m.children[0]) m.children[0].visible = false;
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(m);
  const box = visibleBox(m);
  const s = H / (box.max.y - box.min.y || 1);
  m.scale.multiplyScalar(s);
  m.position.y -= box.min.y * s;
  // bras droit articulé des personnages ; les pions classiques n'en ont pas (on leur en ajoute un)
  return { g, m, head: m.userData.head, arm: m.userData.arms?.right || null };
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#1e3a5f';
  x.fillRect(0, 0, 512, 96);
  x.strokeStyle = '#e5e7eb';
  x.lineWidth = 6;
  x.strokeRect(6, 6, 500, 84);
  x.fillStyle = '#f5f5f4';
  x.font = '900 54px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function brickTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#b7a58a';
  x.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 8; col++) {
      const off = row % 2 ? 16 : 0;
      const v = 150 + Math.random() * 40;
      x.fillStyle = `rgb(${v + 20},${v},${v - 25})`;
      x.fillRect(col * 32 + off + 1, row * 16 + 1, 30, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}

function buildStation(scene) {
  // quai et voies
  const platform = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 4), std('#a8a29e'));
  platform.position.set(0, -0.15, 0.6);
  platform.receiveShadow = true;
  scene.add(platform);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(14, 0.05, 0.25), std('#e7e5e4'));
  edge.position.set(0, 0.0, -1.3);
  scene.add(edge);
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 2.4), std('#57534e'));
  ballast.position.set(0, -0.45, -2.6);
  scene.add(ballast);
  for (const z of [-2.15, -3.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.06), std('#6b7280', { metalness: 0.7, roughness: 0.4 }));
    rail.position.set(0, -0.36, z);
    scene.add(rail);
  }
  for (let x = -7; x <= 7; x += 0.6) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 1.3), std('#44403c'));
    sleeper.position.set(x, -0.39, -2.6);
    scene.add(sleeper);
  }
  // bâtiment de la gare, de l'autre côté des voies (derrière le train)
  const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 4.4, 0.4), new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.9 }));
  wall.position.set(0, 1.9, -5.2);
  scene.add(wall);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture('MONTOIRE') }));
  sign.position.set(-2.6, 3.4, -4.98);
  scene.add(sign);
  // banderoles tricolores sur la façade
  for (const [x, c] of [[-0.6, '#1d4ed8'], [0, '#f5f5f4'], [0.6, '#b91c1c']]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.8), std(c));
    band.position.set(x + 3.2, 3.0, -4.98);
    scene.add(band);
  }
  // auvent du quai, porté par des poteaux au bord des voies
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 2.6), std('#3f3f46'));
  roof.position.set(0, 3.4, -0.3);
  roof.castShadow = true;
  scene.add(roof);
  for (const x of [-4.5, -2.2, 2.2, 4.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.4, 10), std('#1f2937', { metalness: 0.5 }));
    post.position.set(x, 1.7, -1.15);
    post.castShadow = true;
    scene.add(post);
  }
  // panneau suspendu sous l'auvent
  const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.35), new THREE.MeshBasicMaterial({ map: signTexture('MONTOIRE'), side: THREE.DoubleSide }));
  sign2.position.set(2.2, 3.05, -0.6);
  scene.add(sign2);
}

// locomotive à vapeur et un wagon, à l'arrêt derrière les deux hommes
function buildTrain(scene) {
  const g = new THREE.Group();
  const black = std('#18181b', { metalness: 0.4, roughness: 0.5 });
  const red = std('#7f1d1d', { metalness: 0.3 });
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.4, 24), black);
  boiler.rotation.z = Math.PI / 2;
  boiler.position.set(0.6, 1.0, 0);
  g.add(boiler);
  const front = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.1, 24), std('#3f3f46', { metalness: 0.6 }));
  front.rotation.z = Math.PI / 2;
  front.position.set(2.35, 1.0, 0);
  g.add(front);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), std('#fde68a', { emissive: '#fbbf24', emissiveIntensity: 1 }));
  lamp.position.set(2.42, 1.75, 0);
  g.add(lamp);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.7, 16), black);
  chimney.position.set(1.8, 1.9, 0);
  g.add(chimney);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#a16207', { metalness: 0.8, roughness: 0.3 }));
  dome.position.set(0.7, 1.58, 0);
  g.add(dome);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 1.5), black);
  cab.position.set(-1.6, 1.25, 0);
  g.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.7), black);
  cabRoof.position.set(-1.6, 2.25, 0);
  g.add(cabRoof);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.02), std('#fde68a', { emissive: '#f59e0b', emissiveIntensity: 0.5 }));
  win.position.set(-1.6, 1.65, 0.76);
  g.add(win);
  for (const x of [-1.6, -0.6, 0.4, 1.4]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20), red);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.42, 0.68);
    g.add(w);
  }
  const rod = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 0.04), std('#9ca3af', { metalness: 0.8 }));
  rod.position.set(-0.1, 0.42, 0.77);
  g.add(rod);
  // wagon de voyageurs
  const coach = new THREE.Mesh(new THREE.BoxGeometry(5, 2.1, 1.8), std('#14532d'));
  coach.position.set(-5.4, 1.35, 0);
  g.add(coach);
  for (let k = 0; k < 6; k++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.02), std('#fde68a', { emissive: '#f59e0b', emissiveIntensity: 0.4 }));
    w.position.set(-7.4 + k * 0.8, 1.6, 0.91);
    g.add(w);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(-0.2, -0.3, -2.6);
  scene.add(g);
  return { chimneyTop: new THREE.Vector3(1.6, 2.0, -2.6) };
}

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// bras tendu entre l'épaule et la main
function makeArm(color) {
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 1, 10), std(color));
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std('#e0ac87'));
  sleeve.castShadow = hand.castShadow = true;
  return { sleeve, hand };
}
const UP = new THREE.Vector3(0, 1, 0);
// fait pivoter le bras d'un personnage à l'épaule pour que sa main aille vers `target` (k : 0 au repos, 1 tendu)
const tmpQ = new THREE.Quaternion();
function aimArm(pivot, target, k) {
  pivot.quaternion.identity();
  pivot.parent.updateWorldMatrix(true, false);
  const from = pivot.getWorldPosition(new THREE.Vector3());
  const dir = target.clone().sub(from).normalize().applyQuaternion(pivot.parent.getWorldQuaternion(tmpQ).invert());
  const q = new THREE.Quaternion().setFromUnitVectors(pivot.userData.hand.clone().normalize(), dir);
  pivot.quaternion.slerp(q, k);
}
// épaule et longueur du bras d'un personnage, dans le repère de la scène
function armInfo(pivot) {
  pivot.parent.updateWorldMatrix(true, false);
  const shoulder = pivot.getWorldPosition(new THREE.Vector3());
  const scale = pivot.getWorldScale(new THREE.Vector3()).x;
  return { shoulder, len: pivot.userData.hand.length() * scale };
}

function placeArm(arm, from, to) {
  const d = to.clone().sub(from);
  arm.sleeve.position.copy(from).add(to).multiplyScalar(0.5);
  arm.sleeve.scale.set(1, d.length(), 1);
  arm.sleeve.quaternion.setFromUnitVectors(UP, d.normalize());
  arm.hand.position.copy(to);
}

export function createVichy({ container, a, b, roomId }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cbd5e1');
  scene.fog = new THREE.Fog('#cbd5e1', 9, 22);
  scene.add(new THREE.HemisphereLight('#f1f5f9', '#57534e', 1.0));
  const sun = new THREE.DirectionalLight('#fff7ed', 1.6);
  sun.position.set(4, 8, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(sun);
  const flash = new THREE.PointLight('#ffffff', 0, 12, 1.2);
  flash.position.set(0.5, 2, 3.2);
  scene.add(flash);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 80);

  buildStation(scene);
  const { chimneyTop } = buildTrain(scene);

  // les deux collaborateurs, face à face
  const A = figure(roomId, a);
  const B = figure(roomId, b);
  A.g.rotation.y = Math.PI / 2;
  B.g.rotation.y = -Math.PI / 2;
  scene.add(A.g, B.g);
  const front = (f) => {
    const box = visibleBox(f.g);
    return (box.max.x - box.min.x) / 2;
  };
  // assez près pour que leurs bras se rejoignent
  const stopA = -Math.max(A.arm ? 0.3 : 0.42, front(A) + (A.arm ? 0.05 : 0.12));
  const stopB = Math.max(B.arm ? 0.3 : 0.42, front(B) + (B.arm ? 0.05 : 0.12));
  const armA = A.arm ? null : makeArm(a?.color || '#1f2937');
  const armB = B.arm ? null : makeArm(b?.color || '#1f2937');
  for (const arm of [armA, armB]) if (arm) scene.add(arm.sleeve, arm.hand);

  // fumée de la locomotive
  const tex = smokeTexture();
  const puffs = Array.from({ length: 26 }, (_, k) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#e7e5e4', transparent: true, depthWrite: false }));
    scene.add(s);
    return { s, off: k / 26 };
  });

  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let flashT = -1;
  const flashes = [3.1, 3.8, 4.5, 5.1, T_PHOTO];

  function update(t) {
    // ils s'avancent l'un vers l'autre
    const k = ease(clamp01(t / (T_SHAKE - 0.2)));
    const walking = t < T_SHAKE - 0.2;
    const bob = walking ? Math.abs(Math.sin(t * 9)) * 0.04 : 0;
    A.g.position.set(-2.6 + (2.6 + stopA) * k, bob, 0);
    B.g.position.set(2.6 - (2.6 - stopB) * k, bob, 0);
    A.g.rotation.z = walking ? Math.sin(t * 9) * 0.03 : 0;
    B.g.rotation.z = walking ? -Math.sin(t * 9) * 0.03 : 0;

    // les bras : le long du corps, puis tendus vers le milieu, et la poignée de main qui n'en finit pas
    // épaules : celles des personnages (bras articulés), ou une estimation pour les pions
    if (A.arm) A.arm.quaternion.identity();
    if (B.arm) B.arm.quaternion.identity();
    const infoA = A.arm ? armInfo(A.arm) : { shoulder: v3(A.g.position.x + 0.05, H * 0.72 + bob, 0.17), len: 0.7 };
    const infoB = B.arm ? armInfo(B.arm) : { shoulder: v3(B.g.position.x - 0.05, H * 0.72 + bob, -0.17), len: 0.7 };
    // ils ne se lâchent plus la main, même pour la photo
    const reach = ease(clamp01((t - (T_SHAKE - 0.5)) / 0.5));
    const pump = t > T_SHAKE ? Math.sin((t - T_SHAKE) * 9) * 0.05 * (t < T_POSE ? 1 : 0.35) : 0;
    // point de rencontre des mains : à mi-chemin, à la hauteur que les bras peuvent atteindre
    const mid = infoA.shoulder.clone().add(infoB.shoulder).multiplyScalar(0.5);
    const drop = (info) => {
      const d = Math.hypot(info.shoulder.x - mid.x, info.shoulder.z - mid.z);
      return Math.sqrt(Math.max(0.01, (0.97 * info.len) ** 2 - d * d));
    };
    const meet = v3(mid.x, Math.max(H * 0.4, Math.min(infoA.shoulder.y - drop(infoA), infoB.shoulder.y - drop(infoB))) + pump, mid.z);
    if (A.arm) aimArm(A.arm, meet.clone().add(v3(-0.02, 0, 0)), reach);
    else placeArm(armA, infoA.shoulder, infoA.shoulder.clone().add(v3(0.05, -0.55, 0.06)).lerp(meet.clone().add(v3(-0.04, 0, 0.02)), reach));
    if (B.arm) aimArm(B.arm, meet.clone().add(v3(0.02, 0, 0)), reach);
    else placeArm(armB, infoB.shoulder, infoB.shoulder.clone().add(v3(-0.05, -0.55, -0.06)).lerp(meet.clone().add(v3(0.04, 0, -0.02)), reach));

    // ils tournent la tête vers les photographes pour la photo officielle
    const pose = ease(clamp01((t - T_POSE) / 0.6));
    if (A.head) A.head.rotation.y = -1.0 * pose;
    if (B.head) B.head.rotation.y = 1.0 * pose;

    // fumée qui monte en continu de la cheminée
    for (const p of puffs) {
      const life = (t * 0.35 + p.off) % 1;
      p.s.position.set(chimneyTop.x - life * 2.5, chimneyTop.y + life * 2.6, chimneyTop.z + Math.sin(life * 6 + p.off * 9) * 0.2);
      p.s.scale.setScalar(0.5 + life * 2.4);
      p.s.material.opacity = 0.75 * (1 - life);
    }

    // flashs des photographes
    for (const f of flashes) if (t >= f && t < f + 0.05 && flashT < f) flashT = f;
    flash.intensity = flashT >= 0 ? Math.max(0, 60 * (1 - (t - flashT) / 0.25)) : 0;

    // ---------- caméra ----------
    let cp;
    let cl;
    let fov = 40;
    if (t < T_SHAKE) { // plan large sur le quai, travelling avant
      const kk = ease(t / T_SHAKE);
      cp = v3(0, 1.5, 6.4 - kk * 1.4);
      cl = v3(0, 1.2, -0.5);
    } else if (t < 4.6) { // de trois quarts, la poignée de main
      const kk = (t - T_SHAKE) / (4.6 - T_SHAKE);
      cp = v3(1.9 - kk * 0.3, 1.45, 2.6);
      cl = v3(0, 1.05, 0);
      fov = 42;
    } else if (t < T_POSE) { // gros plan sur les mains
      const kk = (t - 4.6) / (T_POSE - 4.6);
      cp = v3(0.35 - kk * 0.1, 1.05, 1.15 - kk * 0.1);
      cl = meet.clone();
      fov = 38;
    } else { // la photo officielle, de face
      const kk = ease(clamp01((t - T_POSE) / 1.2));
      cp = v3(0, 1.5, 5.4 - kk * 0.5);
      cl = v3(0, 0.75, 0); // les personnages dans le haut du cadre, le titre en dessous
      fov = 40;
    }
    camera.position.copy(cp);
    camera.lookAt(cl);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((o) => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m?.map?.dispose(); m?.dispose?.(); }); });
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { update, resize, dispose };
}
