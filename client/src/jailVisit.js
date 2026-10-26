// Cinématique de la « simple visite » : le prisonnier est allongé sur sa couchette et ne fait rien ;
// la porte de la prison s'ouvre à la volée sur le visiteur, filmé en contre-plongée ; il traverse le couloir,
// entre dans la cellule, toise le prisonnier de haut avec un sourire mauvais, lui fait les poches et repart en agitant les billets.
import * as THREE from 'three';
import { playerModel, makeSkinModel } from './skin3d.js';

export const VISIT_DURATION = 13.3;
export const T_ENTER = 1.9; // plan sur la porte de la prison, encore fermée
export const T_BURST = 2.6; // elle s'ouvre à la volée
export const T_CELL = 4.0; // la porte de la cellule coulisse d'un coup
export const T_LOOK = 5.4; // il toise le prisonnier
export const T_STEAL = 7.3; // il lui fait les poches
export const T_GLOAT = 9.1; // il agite les billets
export const T_LEAVE = 10.9; // il repart

const H = 1.75; // taille de tout le monde
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

const BUNK = { x: -1.12, top: 0.5, z0: -1.5, z1: 0.75 };
const FEET_Z = 0.55;
const STAND = { x: -0.2, z: -0.42 }; // le visiteur, à côté de la couchette
// trajet du visiteur : [temps, x, z]
const DOOR_X = 0.87; // milieu de la porte de la cellule
const GATE = { x: 4.4, z0: 1.95, z1: 2.95, h: 2.2 }; // porte d'entrée de la prison, au bout du couloir
const HALL_Z = 2.45;
const PATH = [
  [0, 5.0, HALL_Z], [T_BURST + 0.45, 5.0, HALL_Z], [4.45, DOOR_X, HALL_Z], [4.9, DOOR_X, 1.0], [T_LOOK, STAND.x, STAND.z],
  [T_LEAVE, STAND.x, STAND.z], [11.5, DOOR_X, 1.0], [12.0, DOOR_X, HALL_Z], [VISIT_DURATION, 3.4, HALL_Z],
];

// boîte englobante des seules parties visibles (le socle masqué des personnages ne compte pas)
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

// Dessous d'un corps allongé, exact (sommet par sommet) : point le plus bas de chaque tranche de 10 cm le long
// du corps. Seules les parties visibles comptent, sauf `skip` (la tête, qui s'enfonce dans l'oreiller).
function underside(obj, skip) {
  obj.updateMatrixWorld(true);
  const bins = new Map();
  const v = new THREE.Vector3();
  const walk = (o) => {
    if (!o.visible || o === skip) return;
    if (o.isMesh) {
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const k = Math.round(v.z * 10);
        bins.set(k, Math.min(bins.get(k) ?? Infinity, v.y));
      }
    }
    o.children.forEach(walk);
  };
  walk(obj);
  return [...bins.values()].sort((a, b) => a - b);
}

// met le modèle à la taille voulue, pieds au sol
function fitHeight(m, h) {
  const box = visibleBox(m);
  const size = box.max.y - box.min.y || 1;
  m.scale.multiplyScalar(h / size);
  m.position.y -= (box.min.y * h) / size;
}

// pion classique : on lui dessine quand même des sourcils froncés et un sourire mauvais
function evilPawnFace(m) {
  const dark = std('#1a1a1a');
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), dark);
    brow.position.set(s * 0.035, 0.51, 0.112);
    brow.rotation.z = s * 0.5;
    m.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dark);
    eye.position.set(s * 0.04, 0.485, 0.112);
    m.add(eye);
  }
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 16, Math.PI), dark);
  grin.position.set(0, 0.45, 0.112);
  grin.rotation.z = Math.PI;
  m.add(grin);
}

function visitorModel(roomId, p) {
  let m;
  if (p?.skin?.type === 'character') {
    const char = { ...p.skin.char, extras: [...(p.skin.char?.extras || []).filter((e) => e !== 'angry' && e !== 'crossed'), 'evil'] };
    m = makeSkinModel({ skin: { ...p.skin, char }, color: p.color });
    if (m.children[0]) m.children[0].visible = false;
  } else {
    m = playerModel(roomId, p);
    if (!p?.skin) evilPawnFace(m);
  }
  return m;
}

// allongé, il n'a pas de socle (personnages comme pions classiques)
function prisonerModel(roomId, p) {
  const m = playerModel(roomId, p);
  if ((!p?.skin || p.skin.type === 'character') && m.children[0]) m.children[0].visible = false;
  return m;
}

function wallTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#6d6a63';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 80 + Math.random() * 50;
    x.fillStyle = `rgba(${v},${v - 4},${v - 10},.35)`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // traces d'humidité
  for (let k = 0; k < 8; k++) {
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(40,35,25,.35)');
    g.addColorStop(1, 'rgba(40,35,25,0)');
    x.fillStyle = g;
    x.fillRect(Math.random() * 512, 0, 10 + Math.random() * 30, 200 + Math.random() * 300);
  }
  // les jours comptés à la craie
  x.strokeStyle = 'rgba(235,235,225,.75)';
  x.lineWidth = 4;
  for (let n = 0; n < 4; n++) {
    const ox = 60 + n * 70;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(ox + i * 12, 250); x.lineTo(ox + i * 12 + 3, 300); x.stroke(); }
    x.beginPath(); x.moveTo(ox - 6, 290); x.lineTo(ox + 46, 260); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function textSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const x = c.getContext('2d');
  x.font = '900 64px Arial Black, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineWidth = 10;
  x.strokeStyle = '#000';
  x.strokeText(text, 128, 50);
  x.fillStyle = color;
  x.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(0.55, 0.2, 1);
  s.renderOrder = 10;
  return s;
}

function billTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 56;
  const x = c.getContext('2d');
  x.fillStyle = '#86b46d';
  x.fillRect(0, 0, 128, 56);
  x.strokeStyle = '#2f5d24';
  x.lineWidth = 4;
  x.strokeRect(4, 4, 120, 48);
  x.fillStyle = '#2f5d24';
  x.beginPath(); x.arc(64, 28, 15, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#d9ead0';
  x.font = '900 18px Arial';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('$', 64, 29);
  x.fillStyle = '#1f3d18';
  x.fillText('25', 22, 18);
  x.fillText('25', 106, 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildCell(scene) {
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), std('#3f3d3a', { roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1;
  floor.receiveShadow = true;
  scene.add(floor);
  const wall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  wall(3.4, 2.8, 0, 1.4, -1.65, 0); // fond
  wall(3.3, 2.8, -1.65, 1.4, 0, Math.PI / 2); // gauche
  wall(3.3, 2.8, 1.65, 1.4, 0, -Math.PI / 2); // droite
  wall(9, 2.8, 0, 1.4, 3.7, Math.PI); // mur du couloir
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), std('#2a2927'));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 2.8, 1);
  scene.add(ceil);

  // couchette : cadre d'acier, matelas, oreiller, couverture grise
  const steel = std('#4b5058', { metalness: 0.6, roughness: 0.5 });
  const len = BUNK.z1 - BUNK.z0;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, len), steel);
  frame.position.set(BUNK.x, BUNK.top - 0.16, (BUNK.z0 + BUNK.z1) / 2);
  frame.castShadow = frame.receiveShadow = true;
  scene.add(frame);
  for (const dx of [-0.38, 0.38]) {
    for (const z of [BUNK.z0 + 0.05, BUNK.z1 - 0.05]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, BUNK.top - 0.16, 0.05), steel);
      leg.position.set(BUNK.x + dx, (BUNK.top - 0.16) / 2, z);
      scene.add(leg);
    }
  }
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, len - 0.05), std('#8b8571'));
  mattress.position.set(BUNK.x, BUNK.top - 0.06, (BUNK.z0 + BUNK.z1) / 2);
  mattress.receiveShadow = true;
  scene.add(mattress);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.3), std('#c9c4b5'));
  pillow.position.set(BUNK.x, BUNK.top + 0.02, BUNK.z0 + 0.22);
  scene.add(pillow);

  // toilettes et lavabo dans le coin
  const porcelain = std('#d6d3cc', { roughness: 0.35 });
  const wc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 20), porcelain);
  wc.position.set(1.25, 0.2, -1.3);
  scene.add(wc);
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), porcelain);
  sink.position.set(1.45, 0.85, -0.5);
  scene.add(sink);

  // fenêtre à barreaux tout en haut : un rayon de lune bleuté
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshBasicMaterial({ color: '#9fb8d8' }));
  win.position.set(0.3, 2.3, -1.64);
  scene.add(win);
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.37, 0.03), steel);
    bar.position.set(0.3 + i * 0.12, 2.3, -1.62);
    scene.add(bar);
  }
  const moon = new THREE.SpotLight('#9fb8ff', 40, 8, 0.35, 0.6, 1.2);
  moon.position.set(0.3, 2.3, -1.5);
  moon.target.position.set(-0.6, 0, 0.3);
  moon.castShadow = true;
  scene.add(moon, moon.target);

  // barreaux : façade fixe et porte coulissante
  const barMat = std('#2f3238', { metalness: 0.75, roughness: 0.35 });
  const bars = (x0, x1, z, parent) => {
    for (let x = x0; x <= x1 + 1e-6; x += 0.15) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.8, 8), barMat);
      b.position.set(x, 1.4, z);
      b.castShadow = true;
      parent.add(b);
    }
    for (const y of [0.12, 1.15, 2.3]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.06, 0.05, 0.05), barMat);
      h.position.set((x0 + x1) / 2, y, z);
      parent.add(h);
    }
  };
  bars(-1.65, 0.3, 1.65, scene);
  bars(1.45, 1.65, 1.65, scene);
  const door = new THREE.Group();
  bars(-0.49, 0.49, 0, door);
  door.position.set(DOOR_X, 0, 1.72);
  scene.add(door);

  // le couloir jusqu'à la porte d'entrée de la prison
  wall(GATE.x - 1.65, 2.8, (1.65 + GATE.x) / 2, 1.4, 1.65, 0); // mur d'en face, après la cellule
  const gw = (w, h, z, y) => wall(w, h, GATE.x, y, z, -Math.PI / 2);
  gw(GATE.z0 - 1.65, 2.8, (1.65 + GATE.z0) / 2, 1.4);
  gw(3.7 - GATE.z1, 2.8, (GATE.z1 + 3.7) / 2, 1.4);
  gw(GATE.z1 - GATE.z0, 2.8 - GATE.h, (GATE.z0 + GATE.z1) / 2, (GATE.h + 2.8) / 2);
  // la porte d'acier, sur ses gonds côté z0
  const gate = new THREE.Group();
  gate.position.set(GATE.x - 0.04, 0, GATE.z0);
  const gateMat = std('#3d4148', { metalness: 0.7, roughness: 0.45 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.07, GATE.h, GATE.z1 - GATE.z0), gateMat);
  slab.position.set(0, GATE.h / 2, (GATE.z1 - GATE.z0) / 2);
  slab.castShadow = true;
  gate.add(slab);
  for (const y of [0.35, 1.1, 1.85]) { // renforts
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, GATE.z1 - GATE.z0), std('#2a2d33', { metalness: 0.8, roughness: 0.4 }));
    band.position.set(0, y, (GATE.z1 - GATE.z0) / 2);
    gate.add(band);
  }
  const peep = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: '#cfdcff' }));
  peep.position.set(0, 1.6, (GATE.z1 - GATE.z0) / 2);
  gate.add(peep);
  scene.add(gate);
  // dehors : une lumière blanche aveuglante, le visiteur s'y découpe en ombre chinoise
  const outFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), std('#3f3d3a'));
  outFloor.rotation.x = -Math.PI / 2;
  outFloor.position.set(GATE.x + 1.5, 0, HALL_Z);
  scene.add(outFloor);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: '#e8efff', fog: false }));
  glow.position.set(GATE.x + 2.2, 1.5, HALL_Z);
  glow.rotation.y = -Math.PI / 2;
  scene.add(glow);
  // le jour qui entre : un faisceau étroit sur le sol du couloir, sans éblouir les murs
  const daylight = new THREE.SpotLight('#dfe8ff', 0, 8, 0.32, 0.6, 1.5);
  daylight.position.set(GATE.x + 1.6, 1.7, HALL_Z);
  daylight.target.position.set(GATE.x - 2.5, 0, HALL_Z);
  scene.add(daylight, daylight.target);

  // ampoule du couloir, jaunâtre et faiblarde
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe2a3' }));
  bulb.position.set(1.2, 2.6, 2.6);
  scene.add(bulb);
  const lamp = new THREE.PointLight('#ffcf80', 14, 9, 1.4);
  lamp.position.copy(bulb.position).add(new THREE.Vector3(0, -0.15, 0));
  lamp.castShadow = true;
  scene.add(lamp);
  const hall = new THREE.SpotLight('#ffd49a', 30, 7, 0.7, 0.5, 1.3);
  hall.position.set(0.9, 2.7, 3.2);
  hall.target.position.set(0.9, 0.8, 2.3);
  scene.add(hall, hall.target);
  const inside = new THREE.PointLight('#ffd9a0', 4, 5, 1.6);
  inside.position.set(0, 2.4, 0);
  scene.add(inside);
  return { door, lamp, gate, daylight };
}

export function createJailVisit({ container, visitor, victim, roomId, amount = 75 }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0a09');
  scene.fog = new THREE.Fog('#0b0a09', 6, 14);
  scene.add(new THREE.HemisphereLight('#8794b0', '#2a2018', 0.45));
  const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 60);
  const { door, lamp, gate, daylight } = buildCell(scene);

  // le prisonnier, allongé sur le dos, les yeux au plafond
  const pris = new THREE.Group();
  const pm = prisonerModel(roomId, victim);
  pm.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  pris.add(pm);
  fitHeight(pm, H);
  const pawn = !victim?.skin;
  const prisHead = pm.userData.head || (pawn ? pm.children[2] : null);
  // la tête vers le mur du fond, le visage vers le haut ; le pion classique, conique, est incliné
  // pour que le flanc de son cône repose à plat
  pris.rotation.x = -Math.PI / 2 - (pawn ? 0.18 : 0);
  pris.position.set(BUNK.x, 0, FEET_Z);
  scene.add(pris);
  // le corps s'enfonce un peu dans le matelas, de sorte que torse et jambes reposent dessus
  // (la tête, plus large, s'enfonce dans l'oreiller)
  const under = underside(pris, prisHead);
  pris.position.y += BUNK.top - under[Math.floor(under.length * 0.4)];
  const prisY = pris.position.y;
  // ses yeux : au-dessus du visage, près de l'oreiller
  const prisEye = new THREE.Vector3(BUNK.x - 0.2, BUNK.top + 0.5, FEET_Z - H * 0.9);

  // le visiteur
  const vis = new THREE.Group();
  const lean = new THREE.Group(); // pivot pour se pencher au-dessus de la couchette
  const vm = visitorModel(roomId, visitor);
  vm.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  lean.add(vm);
  vis.add(lean);
  fitHeight(vm, H);
  scene.add(vis);
  const visHead = vm.userData.head;

  // la liasse : trois billets
  const billMat = new THREE.MeshStandardMaterial({ map: billTexture(), roughness: 0.7, side: THREE.DoubleSide });
  const wad = new THREE.Group();
  const bills = [0, 1, 2].map((i) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.13), billMat);
    b.position.z = i * 0.004;
    b.castShadow = true;
    const pivot = new THREE.Group();
    pivot.add(b);
    b.position.x = 0.13; // on tient les billets par un coin pour les éventailler
    wad.add(pivot);
    return pivot;
  });
  scene.add(wad);
  const minus = textSprite(`-${amount} $`, '#ef4444');
  const plus = textSprite(`+${amount} $`, '#4ade80');
  scene.add(minus, plus);

  const pocket = new THREE.Vector3(BUNK.x + 0.12, BUNK.top + 0.2, FEET_Z - H * 0.45);
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let yaw = -Math.PI / 2;

  function visitorAt(t) {
    let x = PATH[0][1];
    let z = PATH[0][2];
    let moving = false;
    let dir = null;
    for (let i = 0; i < PATH.length - 1; i++) {
      const [ta, xa, za] = PATH[i];
      const [tb, xb, zb] = PATH[i + 1];
      if (t >= ta && t <= tb) {
        const k = (t - ta) / (tb - ta);
        x = xa + (xb - xa) * k;
        z = za + (zb - za) * k;
        if (xa !== xb || za !== zb) { moving = true; dir = Math.atan2(xb - xa, zb - za); }
        break;
      }
      if (t > tb) { x = xb; z = zb; }
    }
    return { x, z, moving, dir };
  }

  function update(t) {
    // ---------- le visiteur ----------
    const w = visitorAt(t);
    // immobile : face au prisonnier, puis il se tourne vers nous pour exhiber son butin
    const want = w.moving ? w.dir : t > T_GLOAT - 0.3 && t < T_LEAVE ? 0.35 : -Math.PI / 2;
    let d = want - yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw += d * 0.18;
    const step = w.moving ? Math.sin(t * 11) : 0;
    vis.position.set(w.x, Math.abs(step) * 0.03, w.z);
    vis.rotation.set(0, yaw, step * 0.04);
    // il se penche pour faire les poches, puis se redresse
    lean.rotation.x = 0.42 * (ease(clamp01((t - (T_STEAL - 0.2)) / 0.5)) - ease(clamp01((t - (T_GLOAT - 0.4)) / 0.5)));
    if (visHead) {
      // il toise le prisonnier de haut, puis admire son butin
      const down = ease(clamp01((t - (T_LOOK - 0.3)) / 0.6)) * (1 - ease(clamp01((t - T_GLOAT) / 0.4)));
      visHead.rotation.x = 0.42 * down + (t > T_GLOAT && t < T_LEAVE ? 0.12 : 0);
      visHead.rotation.z = t > T_LOOK && t < T_STEAL ? Math.sin((t - T_LOOK) * 2) * 0.12 : 0; // tête penchée, moqueuse
    }

    // ---------- le prisonnier ne fait rien… ----------
    pris.position.y = prisY + Math.sin(t * 1.6) * 0.006; // respiration
    if (prisHead) {
      // il finit par tourner la tête vers le voleur, trop tard
      const turn = ease(clamp01((t - (T_GLOAT + 0.3)) / 0.8));
      prisHead.rotation.y = 0.9 * turn;
    }

    // ---------- la porte de la prison, ouverte à la volée ----------
    const kick = t > T_BURST - 0.75 && t < T_BURST - 0.6 ? -0.03 : 0; // un premier coup sourd la fait trembler
    if (t < T_BURST) gate.rotation.y = kick;
    else {
      const k = clamp01((t - T_BURST) / 0.13);
      const after = t - T_BURST - 0.13;
      const bounce = after > 0 ? Math.sin(after * 14) * 0.22 * Math.exp(-after * 5) : 0; // elle tape le mur et rebondit
      gate.rotation.y = -1.62 * k * k + bounce;
    }
    daylight.intensity = t < T_BURST ? 0 : 9 * clamp01((t - T_BURST) / 0.15);
    let shake = Math.max(0, 1 - Math.abs(t - T_BURST) * 5) * 0.07 + Math.max(0, 1 - Math.abs(t - T_BURST + 0.68) * 8) * 0.02;
    // la porte de la cellule coulisse d'un coup sec, puis se referme derrière lui
    const open = clamp01((t - T_CELL) / 0.22) - ease(clamp01((t - 12.1) / 0.5));
    door.position.x = DOOR_X + open * 0.95 + (t > T_CELL + 0.22 && t < T_CELL + 0.5 ? Math.sin((t - T_CELL) * 40) * 0.02 : 0);
    shake += Math.max(0, 1 - Math.abs(t - T_CELL - 0.22) * 8) * 0.03;
    lamp.intensity = 14 + (Math.random() < 0.03 ? -8 : 0); // l'ampoule grésille

    // ---------- les billets ----------
    vis.updateMatrixWorld(true);
    const hand = vis.localToWorld(v3(-0.18, 1.0 - lean.rotation.x * 0.35, 0.28 + lean.rotation.x * 0.5));
    const show = vis.localToWorld(v3(-0.32, 1.42, 0.42)); // à hauteur du visage
    const hip = vis.localToWorld(v3(-0.22, 0.95, 0.12));
    let wp;
    let spread = 0;
    wad.visible = t > T_STEAL - 0.2;
    if (t < T_STEAL + 0.4) {
      wp = pocket.clone();
    } else if (t < T_STEAL + 1.0) { // la liasse sort de la poche
      wp = pocket.clone().add(v3(0, ease((t - T_STEAL - 0.4) / 0.6) * 0.15, 0));
    } else if (t < T_GLOAT - 0.3) { // puis passe dans sa main
      const k = ease((t - T_STEAL - 1.0) / (T_GLOAT - 0.3 - T_STEAL - 1.0));
      wp = pocket.clone().add(v3(0, 0.15, 0)).lerp(hand, k);
      wp.y += Math.sin(k * Math.PI) * 0.25;
    } else if (t < T_LEAVE) { // il l'éventaille sous son nez
      const k = ease(clamp01((t - T_GLOAT + 0.3) / 0.5));
      wp = hand.clone().lerp(show, k);
      wp.y += Math.sin(t * 9) * 0.02 * k;
      spread = k;
    } else { // et repart avec
      const k = ease(clamp01((t - T_LEAVE) / 0.5));
      wp = show.clone().lerp(hip, k);
      spread = 1 - k;
    }
    wad.position.copy(wp);
    // à plat au sortir de la poche, puis dressés face à lui et à la caméra, en éventail
    wad.rotation.set((1 - spread) * -Math.PI / 2, yaw, 0, 'YXZ');
    bills.forEach((b, i) => { b.rotation.z = (i - 1) * 0.5 * spread + 0.6 * spread; });

    // gains et pertes qui s'envolent
    const mk = clamp01((t - (T_STEAL + 0.5)) / 1.8);
    minus.visible = mk > 0 && mk < 1;
    minus.position.copy(pocket).add(v3(0, 0.35 + mk * 0.4, 0));
    minus.material.opacity = 1 - mk * mk;
    const pk = clamp01((t - T_GLOAT) / 1.8);
    plus.visible = pk > 0 && pk < 1;
    plus.position.copy(show).add(v3(0, 0.3 + pk * 0.35, 0));
    plus.material.opacity = 1 - pk * pk;

    // ---------- caméra ----------
    const vhead = v3(w.x, H * 0.9 - lean.rotation.x * 0.25, w.z);
    let cp;
    let cl;
    let fov = 40;
    if (t < T_ENTER) { // plan large depuis le couloir, à travers les barreaux
      const k = ease(t / T_ENTER);
      cp = v3(2.1 - k * 0.4, 1.75, 3.25);
      cl = v3(-0.8, 0.65, -0.4);
    } else if (t < 3.55) { // contre-plongée sur la porte de la prison : elle s'ouvre à la volée, il est derrière
      const k = ease(clamp01((t - T_BURST - 0.45) / 0.9));
      cp = v3(2.45, 0.22, 2.95);
      cl = v3(GATE.x, 1.35, HALL_Z).lerp(vhead.clone().add(v3(0, -0.1, 0)), k);
      fov = 50;
    } else if (t < T_LOOK) { // du point de vue du prisonnier : le visiteur entre
      cp = v3(BUNK.x + 0.15, BUNK.top + 0.85, -1.4);
      cl = v3(w.x, 1.15, w.z);
      fov = 50;
    } else if (t < T_STEAL) { // contre-plongée : il le toise de haut, sourire mauvais
      const k = (t - T_LOOK) / (T_STEAL - T_LOOK);
      // vue subjective : les yeux du prisonnier (son corps est masqué le temps du plan)
      cp = prisEye.clone().add(v3(0.05 * k, 0, 0));
      cl = vhead.clone().add(v3(0, -0.22, 0)); // le visage dans le haut du cadre, au-dessus du sous-titre
      fov = 55 - k * 12;
    } else if (t < T_GLOAT) { // plan de côté : il lui fait les poches
      cp = v3(0.15, 2.2, 1.5);
      cl = v3(-0.75, 0.8, -0.45);
      fov = 44;
    } else if (t < T_LEAVE) { // gros plan : il agite les billets, le prisonnier tourne enfin la tête
      cp = vis.localToWorld(v3(-0.2, 1.4, 1.7));
      cl = show.clone().lerp(vhead, 0.4);
      fov = 38;
    } else { // il repart, la porte se referme
      cp = v3(-1.3, 1.4, -0.2);
      cl = v3(w.x, 1.1, w.z);
      fov = 48;
    }
    pris.visible = !(t >= T_LOOK && t < T_STEAL);
    camera.position.copy(cp).add(v3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
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
