// Bâtiments des civilisations (pur décor) : 5 niveaux par civilisation, du plus modeste au monument.
// 3D : groupe posé à y = 0, façade vers +z, emprise d'au plus ~0,7 × 0,34. 2D : icônes SVG (viewBox 32 × 32, sol en y = 30).
import * as THREE from 'three';

// ---------- outils 3D ----------
const cache = new Map();
const mat = (color, extra = {}) => {
  const key = color + JSON.stringify(extra);
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra }));
  return cache.get(key);
};
const add = (g, geo, m, x, y, z) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
  return o;
};
// boîte posée sur y
const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
// cylindre posé sur y
const cyl = (g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z);
// cône (ou pyramide à 4 faces) posé sur y
const cone = (g, r, h, m, x = 0, y = 0, z = 0, seg = 16) => {
  const c = add(g, new THREE.ConeGeometry(r, h, seg), m, x, y + h / 2, z);
  if (seg === 4) c.rotation.y = Math.PI / 4;
  return c;
};
// toit à deux pans, pignon sur la façade
const gable = (g, w, h, d, m, x = 0, y = 0, z = 0) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return add(g, geo, m, x, y, z);
};
// rangée de colonnes le long de x
const columns = (g, n, x0, x1, z, h, r, m, y = 0) => {
  for (let k = 0; k < n; k++) cyl(g, r, r * 1.1, h, m, x0 + ((x1 - x0) * k) / Math.max(1, n - 1), y, z, 10);
};
// créneaux au sommet d'un mur rectangulaire
const merlons = (g, w, d, y, m, size = 0.03, cx = 0, cz = 0) => {
  for (let x = -w / 2 + size / 2; x <= w / 2 - size / 2 + 1e-6; x += size * 2) {
    box(g, size, size, size, m, cx + x, y, cz + d / 2 - size / 2);
    box(g, size, size, size, m, cx + x, y, cz - d / 2 + size / 2);
  }
  for (let z = -d / 2 + size * 2.5; z <= d / 2 - size * 2.5 + 1e-6; z += size * 2) {
    box(g, size, size, size, m, cx - w / 2 + size / 2, y, cz + z);
    box(g, size, size, size, m, cx + w / 2 - size / 2, y, cz + z);
  }
};
// escalier en façade : bloc incliné
const stairs = (g, w, h, depth, m, z0, y0 = 0) => {
  const len = Math.hypot(h, depth);
  const s = box(g, w, 0.02, len, m, 0, 0, 0);
  s.position.set(0, y0 + h / 2, z0 + depth / 2);
  s.rotation.x = Math.atan2(h, depth);
  return s;
};
// arcades peintes (texture répétée) pour le Colisée
let arcadeTex = null;
function arcadeTexture() {
  if (arcadeTex) return arcadeTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#e8dcc0';
  x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#3b2f22';
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 8; i++) {
      const ax = 6 + i * 32;
      const ay = 10 + row * 40;
      x.beginPath();
      x.moveTo(ax, ay + 30);
      x.lineTo(ax, ay + 10);
      x.arc(ax + 10, ay + 10, 10, Math.PI, 0);
      x.lineTo(ax + 20, ay + 30);
      x.closePath();
      x.fill();
    }
    x.fillStyle = '#c9b892';
    x.fillRect(0, 42 + row * 40, 256, 4);
    x.fillStyle = '#3b2f22';
  }
  arcadeTex = new THREE.CanvasTexture(c);
  arcadeTex.colorSpace = THREE.SRGBColorSpace;
  arcadeTex.wrapS = THREE.RepeatWrapping;
  arcadeTex.repeat.set(4, 1);
  return arcadeTex;
}

const C = {
  marble: '#f1ece0', ochre: '#e7c79a', terracotta: '#c2410c', bronze: '#b7791f', red: '#991b1b',
  sand: '#e3c58f', stone: '#d6b47a', mud: '#c9a06a', palm: '#15803d', trunk: '#7c5a2e', lapis: '#1d4ed8', gold: '#facc15',
  wood: '#7c2d12', darkwood: '#3f1d0b', paper: '#f8fafc', tile: '#1f2937', vermilion: '#dc2626', thatchJ: '#a16207', granite: '#78716c',
  grey: '#9ca3af', greyDark: '#6b7280', plaster: '#f5f0e6', beam: '#3f2a1a', thatch: '#b88a3b', slate: '#475569', banner: '#b91c1c',
  lime: '#d6d3d1', mayaStone: '#a8a29e', jungle: '#166534', jade: '#10b981', mayaRed: '#b91c1c',
};
const glow = () => mat('#fde68a', { emissive: '#f59e0b', emissiveIntensity: 0.5 });
const door = (g, x, z, w = 0.05, h = 0.08) => box(g, w, h, 0.012, mat('#2b1d12'), x, 0, z);

// ---------- Rome ----------
const ROME = [
  (g) => { // domus
    box(g, 0.28, 0.14, 0.22, mat(C.ochre));
    gable(g, 0.32, 0.07, 0.26, mat(C.terracotta), 0, 0.14);
    door(g, 0, 0.112);
  },
  (g) => { // villa à colonnes
    box(g, 0.36, 0.2, 0.22, mat(C.ochre), 0, 0, -0.03);
    gable(g, 0.4, 0.08, 0.26, mat(C.terracotta), 0, 0.2, -0.03);
    columns(g, 4, -0.13, 0.13, 0.11, 0.18, 0.013, mat(C.marble));
    box(g, 0.32, 0.02, 0.06, mat(C.marble), 0, 0.18, 0.1);
    door(g, 0, 0.082);
  },
  (g) => { // temple
    box(g, 0.48, 0.03, 0.32, mat(C.marble));
    box(g, 0.44, 0.03, 0.28, mat(C.marble), 0, 0.03);
    box(g, 0.28, 0.2, 0.16, mat(C.ochre), 0, 0.06, -0.04);
    columns(g, 6, -0.19, 0.19, 0.11, 0.22, 0.014, mat(C.marble), 0.06);
    columns(g, 6, -0.19, 0.19, -0.11, 0.22, 0.014, mat(C.marble), 0.06);
    box(g, 0.44, 0.03, 0.27, mat(C.marble), 0, 0.28);
    gable(g, 0.46, 0.09, 0.29, mat(C.terracotta), 0, 0.31);
  },
  (g) => { // arc de triomphe
    const m = mat(C.marble);
    for (const s of [-1, 1]) box(g, 0.15, 0.3, 0.16, m, s * 0.155, 0, 0);
    box(g, 0.46, 0.12, 0.16, m, 0, 0.3, 0); // attique
    box(g, 0.16, 0.05, 0.14, m, 0, 0.25, 0); // haut de l'arche
    const arch = add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.16, 16, 1, false, 0, Math.PI), m, 0, 0.25, 0);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.z = Math.PI;
    for (const x of [-0.21, -0.1, 0.1, 0.21]) cyl(g, 0.012, 0.013, 0.3, m, x, 0, 0.085, 10);
    box(g, 0.3, 0.02, 0.012, mat(C.bronze, { metalness: 0.6 }), 0, 0.35, 0.082); // inscription
    // quadrige de bronze
    box(g, 0.14, 0.05, 0.08, mat(C.bronze, { metalness: 0.7, roughness: 0.35 }), 0, 0.42, 0);
    cone(g, 0.03, 0.07, mat(C.bronze, { metalness: 0.7 }), 0, 0.47, 0, 8);
  },
  (g) => { // Colisée : arcades sur deux ellipses, une partie effondrée
    const tex = arcadeTexture();
    const outer = add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.4, 40, 1, true, 0, Math.PI * 1.7), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }), 0, 0.2, 0);
    outer.scale.z = 0.55;
    outer.rotation.y = Math.PI * 0.55;
    const inner = add(g, new THREE.CylinderGeometry(0.24, 0.24, 0.28, 40, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }), 0, 0.14, 0);
    inner.scale.z = 0.55;
    const arena = add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 32), mat('#d9b98a'), 0, 0.01, 0);
    arena.scale.z = 0.55;
    // gradins
    const seats = add(g, new THREE.CylinderGeometry(0.24, 0.17, 0.12, 32, 1, true), mat('#cdbb98', { side: THREE.DoubleSide }), 0, 0.08, 0);
    seats.scale.z = 0.55;
  },
];

// ---------- Égypte ----------
const palm = (g, x, z, h = 0.22) => {
  cyl(g, 0.01, 0.013, h, mat(C.trunk), x, 0, z, 6);
  for (let k = 0; k < 5; k++) {
    const l = box(g, 0.012, 0.004, 0.09, mat(C.palm), x, h, z);
    l.rotation.y = (k / 5) * Math.PI * 2;
    l.rotation.x = 0.4;
    l.position.y = h - 0.01;
  }
};
const pyramid = (g, base, h, m, x = 0, y = 0, z = 0, squash = 1) => {
  const p = cone(g, base / Math.SQRT2, h, m, x, y, z, 4);
  p.scale.z = squash;
  return p;
};
const EGYPT = [
  (g) => { // maison de terre
    box(g, 0.26, 0.14, 0.22, mat(C.mud));
    box(g, 0.27, 0.02, 0.23, mat(C.sand), 0, 0.14);
    door(g, 0, 0.112, 0.045, 0.07);
    box(g, 0.04, 0.03, 0.012, mat('#2b1d12'), 0.08, 0.08, 0.112);
  },
  (g) => { // maison à terrasse, auvent et palmier
    box(g, 0.3, 0.14, 0.24, mat(C.mud), -0.04);
    box(g, 0.18, 0.1, 0.16, mat(C.sand), -0.08, 0.14, -0.03);
    box(g, 0.14, 0.006, 0.08, mat('#e5e7eb'), 0.05, 0.22, 0.03); // auvent de toile
    for (const x of [-0.01, 0.11]) cyl(g, 0.004, 0.004, 0.08, mat(C.trunk), x, 0.14, 0.06, 6);
    door(g, -0.04, 0.122);
    palm(g, 0.22, 0.05);
  },
  (g) => { // obélisques et maison
    for (const x of [-0.14, 0.14]) {
      box(g, 0.08, 0.03, 0.08, mat(C.stone), x);
      box(g, 0.05, 0.36, 0.05, mat(C.stone), x, 0.03);
      pyramid(g, 0.05, 0.05, mat(C.gold, { metalness: 0.8, roughness: 0.25 }), x, 0.39);
    }
    box(g, 0.16, 0.12, 0.16, mat(C.mud), 0, 0, -0.06);
    box(g, 0.17, 0.015, 0.17, mat(C.sand), 0, 0.12, -0.06);
  },
  (g) => { // temple : pylônes et colonnade
    const m = mat(C.stone);
    for (const s of [-1, 1]) {
      const t = add(g, new THREE.CylinderGeometry(0.07, 0.11, 0.36, 4), m, s * 0.17, 0.18, 0.04);
      t.rotation.y = Math.PI / 4;
      t.scale.set(1, 1, 0.55);
      box(g, 0.012, 0.18, 0.004, mat(C.lapis), s * 0.17, 0.12, 0.085); // bannière
    }
    box(g, 0.12, 0.26, 0.08, m, 0, 0, 0.04);
    box(g, 0.06, 0.16, 0.012, mat('#2b1d12'), 0, 0, 0.081);
    box(g, 0.13, 0.025, 0.09, mat(C.lapis), 0, 0.24, 0.04);
    box(g, 0.44, 0.18, 0.18, mat(C.sand), 0, 0, -0.1);
    columns(g, 5, -0.18, 0.18, -0.005, 0.18, 0.016, m);
  },
  (g) => { // grande pyramide et sa petite sœur
    pyramid(g, 0.5, 0.52, mat(C.stone), -0.04, 0, 0, 0.62);
    pyramid(g, 0.07, 0.07, mat(C.gold, { metalness: 0.85, roughness: 0.2, emissive: '#a16207', emissiveIntensity: 0.3 }), -0.04, 0.47, 0, 0.62);
    pyramid(g, 0.2, 0.2, mat(C.sand), 0.25, 0, 0.06, 0.8);
  },
];

// ---------- Japon ----------
// toit débordant (plat) à étages
const eave = (g, w, d, y, m) => {
  const r = box(g, w, 0.025, d, m, 0, y, 0);
  return r;
};
const JAPAN = [
  (g) => { // minka au toit de chaume
    box(g, 0.28, 0.12, 0.2, mat(C.wood));
    box(g, 0.24, 0.07, 0.012, mat(C.paper), 0, 0.03, 0.101);
    gable(g, 0.36, 0.16, 0.26, mat(C.thatchJ), 0, 0.12);
  },
  (g) => { // machiya à étage
    box(g, 0.3, 0.22, 0.22, mat(C.darkwood));
    eave(g, 0.36, 0.28, 0.12, mat(C.tile));
    for (const y of [0.02, 0.14]) box(g, 0.24, 0.07, 0.012, mat(C.paper, { emissive: '#fde68a', emissiveIntensity: 0.25 }), 0, y, 0.111);
    gable(g, 0.38, 0.09, 0.28, mat(C.tile), 0, 0.22);
  },
  (g) => { // sanctuaire et torii
    box(g, 0.24, 0.03, 0.18, mat(C.granite), 0, 0, -0.06);
    for (const x of [-0.09, 0.09]) for (const z of [-0.12, 0]) cyl(g, 0.01, 0.01, 0.13, mat(C.vermilion), x, 0.03, z, 8);
    box(g, 0.16, 0.1, 0.1, mat(C.paper), 0, 0.03, -0.06);
    gable(g, 0.32, 0.08, 0.24, mat(C.tile), 0, 0.16, -0.06);
    // torii devant
    const v = mat(C.vermilion);
    for (const x of [-0.12, 0.12]) cyl(g, 0.012, 0.014, 0.22, v, x, 0, 0.13, 8);
    box(g, 0.34, 0.02, 0.03, v, 0, 0.21, 0.13);
    box(g, 0.28, 0.015, 0.02, v, 0, 0.17, 0.13);
    box(g, 0.36, 0.012, 0.035, mat(C.tile), 0, 0.23, 0.13);
  },
  (g) => { // pagode à cinq étages
    const w = mat(C.vermilion);
    const r = mat(C.tile);
    for (let k = 0; k < 5; k++) {
      const s = 1 - k * 0.14;
      box(g, 0.16 * s, 0.07, 0.16 * s, w, 0, k * 0.09);
      eave(g, 0.3 * s, 0.3 * s, k * 0.09 + 0.07, r);
    }
    cyl(g, 0.006, 0.006, 0.12, mat(C.gold, { metalness: 0.8 }), 0, 0.47, 0, 6);
  },
  (g) => { // château : socle de pierre et donjon blanc aux toits superposés
    const base = add(g, new THREE.CylinderGeometry(0.2, 0.26, 0.14, 4), mat(C.granite), 0, 0.07, 0);
    base.rotation.y = Math.PI / 4;
    base.scale.z = 0.6;
    const white = mat(C.paper);
    const r = mat(C.tile);
    const tiers = [[0.3, 0.2], [0.24, 0.16], [0.18, 0.12], [0.12, 0.09]];
    let y = 0.14;
    tiers.forEach(([w, d]) => {
      box(g, w, 0.08, d, white, 0, y);
      box(g, w + 0.08, 0.02, d + 0.08, r, 0, y + 0.08);
      gable(g, w * 0.5, 0.05, d + 0.04, r, 0, y + 0.1);
      y += 0.11;
    });
    for (const s of [-1, 1]) box(g, 0.02, 0.03, 0.01, mat(C.gold, { metalness: 0.8 }), s * 0.04, y, 0); // shachihoko
  },
];

// ---------- Moyen Âge ----------
const MEDIEVAL = [
  (g) => { // chaumière
    box(g, 0.26, 0.13, 0.2, mat(C.grey));
    gable(g, 0.32, 0.15, 0.26, mat(C.thatch), 0, 0.13);
    door(g, -0.04, 0.102, 0.045, 0.08);
    box(g, 0.04, 0.04, 0.012, glow(), 0.07, 0.06, 0.102);
  },
  (g) => { // maison à colombages
    box(g, 0.26, 0.12, 0.2, mat(C.grey));
    box(g, 0.3, 0.13, 0.22, mat(C.plaster), 0, 0.12); // étage en encorbellement
    const b = mat(C.beam);
    for (const x of [-0.14, -0.05, 0.05, 0.14]) box(g, 0.012, 0.13, 0.012, b, x, 0.12, 0.111);
    box(g, 0.3, 0.012, 0.012, b, 0, 0.18, 0.111);
    const d1 = box(g, 0.012, 0.12, 0.012, b, -0.095, 0.125, 0.111);
    d1.rotation.z = 0.6;
    gable(g, 0.36, 0.16, 0.28, mat(C.slate), 0, 0.25);
    door(g, 0, 0.102);
    box(g, 0.04, 0.04, 0.012, glow(), 0.1, 0.17, 0.112);
  },
  (g) => { // tour ronde et logis
    cyl(g, 0.08, 0.09, 0.34, mat(C.grey), -0.12, 0, 0, 20);
    cone(g, 0.1, 0.14, mat(C.slate), -0.12, 0.34, 0, 20);
    box(g, 0.012, 0.05, 0.012, glow(), -0.12, 0.22, 0.087);
    box(g, 0.2, 0.15, 0.18, mat(C.plaster), 0.1, 0, 0);
    gable(g, 0.24, 0.1, 0.22, mat(C.slate), 0.1, 0.15);
    door(g, 0.1, 0.092);
  },
  (g) => { // donjon crénelé
    const m = mat(C.grey);
    box(g, 0.28, 0.4, 0.26, m);
    merlons(g, 0.28, 0.26, 0.4, mat(C.greyDark), 0.032);
    for (const y of [0.15, 0.28]) for (const x of [-0.07, 0.07]) box(g, 0.02, 0.05, 0.012, glow(), x, y, 0.131);
    box(g, 0.07, 0.1, 0.012, mat('#2b1d12'), 0, 0, 0.131);
    cyl(g, 0.004, 0.004, 0.14, mat('#1f2937'), 0.1, 0.43, 0.1, 6);
    box(g, 0.06, 0.035, 0.004, mat(C.banner), 0.13, 0.52, 0.1);
  },
  (g) => { // château fort : remparts, tours d'angle, donjon et porte
    const m = mat(C.grey);
    const dark = mat(C.greyDark);
    box(g, 0.56, 0.16, 0.03, m, 0, 0, 0.14); // rempart avant
    box(g, 0.56, 0.16, 0.03, m, 0, 0, -0.14);
    box(g, 0.03, 0.16, 0.28, m, -0.27, 0, 0);
    box(g, 0.03, 0.16, 0.28, m, 0.27, 0, 0);
    for (const x of [-0.24, -0.12, 0, 0.12, 0.24]) box(g, 0.03, 0.03, 0.035, dark, x, 0.16, 0.14);
    for (const x of [-0.27, 0.27]) for (const z of [-0.14, 0.14]) {
      cyl(g, 0.05, 0.055, 0.26, m, x, 0, z, 14);
      cone(g, 0.065, 0.12, mat(C.slate), x, 0.26, z, 14);
    }
    box(g, 0.2, 0.34, 0.16, m, 0, 0, -0.03);
    merlons(g, 0.2, 0.16, 0.34, dark, 0.03, 0, -0.03);
    box(g, 0.08, 0.1, 0.012, mat('#2b1d12'), 0, 0, 0.157); // porte
    cyl(g, 0.004, 0.004, 0.12, mat('#1f2937'), 0, 0.37, -0.03, 6);
    box(g, 0.06, 0.035, 0.004, mat(C.banner), 0.03, 0.45, -0.03);
  },
];

// ---------- Mayas ----------
// pyramide à degrés : `n` gradins de largeur décroissante
const steps = (g, n, w0, d0, h, shrink, m, y0 = 0) => {
  for (let k = 0; k < n; k++) box(g, w0 - k * shrink, h, d0 - k * shrink * 0.55, m, 0, y0 + k * h);
  return y0 + n * h;
};
const MAYA = [
  (g) => { // hutte ronde
    cyl(g, 0.1, 0.1, 0.1, mat(C.lime), 0, 0, 0, 18);
    cone(g, 0.15, 0.16, mat(C.thatch), 0, 0.1, 0, 18);
    door(g, 0, 0.098, 0.04, 0.07);
  },
  (g) => { // maison de pierre
    box(g, 0.3, 0.16, 0.22, mat(C.lime));
    box(g, 0.31, 0.025, 0.23, mat(C.mayaRed), 0, 0.12);
    box(g, 0.32, 0.02, 0.24, mat(C.mayaStone), 0, 0.16);
    door(g, 0, 0.112, 0.06, 0.09);
    box(g, 0.012, 0.012, 0.01, mat(C.jade), -0.1, 0.06, 0.112);
  },
  (g) => { // autel, stèle et brasero
    const y = steps(g, 2, 0.36, 0.3, 0.05, 0.08, mat(C.mayaStone));
    box(g, 0.08, 0.2, 0.03, mat(C.lime), -0.06, y, -0.04); // stèle
    box(g, 0.06, 0.03, 0.005, mat(C.jade), -0.06, y + 0.12, -0.023);
    cyl(g, 0.03, 0.02, 0.04, mat(C.greyDark), 0.07, y, 0.02, 10);
    cone(g, 0.02, 0.05, mat('#fb923c', { emissive: '#f97316', emissiveIntensity: 0.9 }), 0.07, y + 0.04, 0.02, 8);
  },
  (g) => { // temple sur gradins
    const m = mat(C.mayaStone);
    const y = steps(g, 3, 0.44, 0.32, 0.07, 0.1, m);
    stairs(g, 0.07, y, 0.1, mat(C.lime), 0.06);
    box(g, 0.14, 0.1, 0.1, mat(C.lime), 0, y, -0.02);
    box(g, 0.15, 0.03, 0.11, mat(C.mayaRed), 0, y + 0.1, -0.02);
    box(g, 0.04, 0.06, 0.012, mat('#1c1917'), 0, y, 0.031);
  },
  (g) => { // pyramide à degrés (Chichén Itzá) et crête faîtière
    const m = mat(C.mayaStone);
    const y = steps(g, 5, 0.6, 0.34, 0.07, 0.09, m);
    stairs(g, 0.08, y, 0.15, mat(C.lime), 0.02);
    box(g, 0.16, 0.1, 0.1, mat(C.lime), 0, y, -0.01);
    box(g, 0.17, 0.02, 0.11, mat(C.mayaRed), 0, y + 0.1, -0.01);
    box(g, 0.1, 0.07, 0.015, mat(C.mayaRed), 0, y + 0.12, -0.01); // crête
    box(g, 0.04, 0.06, 0.012, mat('#1c1917'), 0, y, 0.041);
    box(g, 0.012, 0.012, 0.01, mat(C.jade, { emissive: '#047857', emissiveIntensity: 0.4 }), 0, y + 0.14, 0.0);
  },
];

export const CIV_BUILDERS = { rome: ROME, egypte: EGYPT, japon: JAPAN, medieval: MEDIEVAL, maya: MAYA };

// ---------- icônes 2D ----------
const R = (x, y, w, h, f, s = '#3b2a1a', sw = 0.7, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
const P = (pts, f, s = '#3b2a1a', sw = 0.7) => `<path d="M${pts} Z" fill="${f}" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const E = (cx, cy, rx, ry, f, s = '#3b2a1a', sw = 0.7) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
const cols = (xs, y, h, f = '#fffaf0') => xs.map((x) => R(x - 0.7, y, 1.4, h, f, '#7c6a4f', 0.4)).join('');
const Y = '#fbbf24';

export const CIV_SVGS = {
  rome: [
    R(8, 19, 16, 11, C.ochre) + P('6 19.5 L16 13 L26 19.5', C.terracotta) + R(14.3, 24, 3.4, 6, '#2b1d12'),
    R(6, 15, 20, 15, C.ochre) + P('4 15.5 L16 8 L28 15.5', C.terracotta) + cols([8, 12.5, 19.5, 24], 18, 12) + R(14.3, 24, 3.4, 6, '#2b1d12'),
    R(3, 27, 26, 3, C.marble) + R(4, 25, 24, 2, C.marble) + cols([6, 10, 14, 18, 22, 26], 13, 12) + R(4, 11, 24, 2, C.marble) + P('3 11.5 L16 4 L29 11.5', C.terracotta),
    R(3, 9, 26, 21, C.marble) + `<path d="M11 30 V19 A5 5 0 0 1 21 19 V30 Z" fill="#3b2f22"/>` + cols([5, 9, 23, 27], 12, 18) + R(8, 10, 16, 3, C.bronze, '#7c5a1f') + R(12, 4, 8, 5, C.bronze, '#7c5a1f'),
    E(16, 21, 15, 9, '#e8dcc0', '#7c6a4f', 0.9) + E(16, 21, 9, 4.5, '#d9b98a', '#7c6a4f', 0.6)
      + [0, 1, 2, 3, 4, 5, 6].map((k) => `<path d="M${4 + k * 3.6} 27 V23.5 A1.2 1.2 0 0 1 ${6.4 + k * 3.6} 23.5 V27 Z" fill="#3b2f22"/>`).join('')
      + P('20 12.6 L31 17 L31 21 L26 18 Z', '#e8dcc0', '#7c6a4f', 0.6),
  ],
  egypte: [
    R(8, 19, 16, 11, C.mud) + R(7.5, 18, 17, 2, C.sand) + R(14.3, 24, 3.4, 6, '#2b1d12'),
    R(4, 19, 18, 11, C.mud) + R(6, 13, 11, 6, C.sand) + P('17 15 L27 15 L27 16.5 L17 16.5', '#e5e7eb') + R(11.3, 24, 3.4, 6, '#2b1d12')
      + `<rect x="25.5" y="17" width="1.4" height="13" fill="${C.trunk}"/>` + P('26.2 17 L21 19 L26.2 15.5 L31 18.5 L26.2 15.5 L24 13', C.palm, '#14532d', 0.5),
    P('6 30 L6 8 L8 5 L10 8 L10 30', C.stone) + P('22 30 L22 8 L24 5 L26 8 L26 30', C.stone) + P('7 8 L8 5 L9 8', C.gold, '#854d0e', 0.4) + P('23 8 L24 5 L25 8', C.gold, '#854d0e', 0.4) + R(12, 21, 8, 9, C.mud),
    P('2 30 L4 10 L12 10 L13 30', C.stone) + P('19 30 L20 10 L28 10 L30 30', C.stone) + R(12, 14, 8, 16, C.sand) + R(14, 21, 4, 9, '#2b1d12')
      + R(12, 12.5, 8, 2, C.lapis, '#1e3a8a') + R(7.4, 13, 1.2, 12, C.lapis, '#1e3a8a', 0.3) + R(23.4, 13, 1.2, 12, C.lapis, '#1e3a8a', 0.3),
    P('1 30 L14 6 L27 30', C.stone, '#7c5a2e', 0.9) + P('12.4 9 L14 6 L15.6 9', C.gold, '#854d0e', 0.5) + P('20 30 L26 20 L32 30', C.sand, '#7c5a2e', 0.7)
      + '<path d="M5 24 L23 24 M8 18 L20 18 M11 12 L17 12" stroke="#b08a52" stroke-width=".5"/>',
  ],
  japon: [
    R(8, 21, 16, 9, C.wood) + R(10, 23, 12, 5, C.paper, '#7c2d12', 0.4) + P('4 21.5 L16 10 L28 21.5', C.thatchJ, '#713f12'),
    R(8, 12, 16, 18, C.darkwood) + R(5, 20, 22, 2, C.tile, '#111') + R(10, 14, 12, 5, C.paper, '#3f1d0b', 0.4) + R(10, 23, 12, 5, C.paper, '#3f1d0b', 0.4) + P('5 12.5 L16 6 L27 12.5', C.tile, '#111'),
    R(4, 9, 2, 21, C.vermilion, '#7f1d1d') + R(26, 9, 2, 21, C.vermilion, '#7f1d1d') + R(2, 7, 28, 2.4, C.tile, '#111') + R(4, 11.5, 24, 1.6, C.vermilion, '#7f1d1d')
      + R(11, 20, 10, 10, C.paper, '#7c2d12', 0.5) + P('8 20.5 L16 15 L24 20.5', C.tile, '#111'),
    [0, 1, 2, 3, 4].map((k) => {
      const w = 18 - k * 2.6;
      const y = 26 - k * 5;
      return R(16 - w / 4, y, w / 2, 4, C.vermilion, '#7f1d1d', 0.4) + R(16 - w / 2 - 2, y - 1, w + 4, 1.6, C.tile, '#111', 0.4);
    }).join('') + R(15.5, 1, 1, 4, C.gold, '#854d0e', 0.3),
    P('3 30 L6 23 L26 23 L29 30', C.granite, '#44403c') + R(8, 18, 16, 5, C.paper) + R(5, 16.5, 22, 2, C.tile, '#111') + R(10, 12, 12, 4.5, C.paper)
      + R(7.5, 10.6, 17, 1.8, C.tile, '#111') + R(12, 6.5, 8, 4, C.paper) + P('10 6.8 L16 2.5 L22 6.8', C.tile, '#111') + R(13, 19, 2, 2, '#1f2937', '#111', 0.2) + R(17, 19, 2, 2, '#1f2937', '#111', 0.2),
  ],
  medieval: [
    R(8, 20, 16, 10, C.grey, '#4b5563') + P('5 20.5 L16 9 L27 20.5', C.thatch, '#78350f') + R(11, 24, 3.4, 6, '#2b1d12') + R(18, 23, 3, 3, Y, '#78350f', 0.4),
    R(9, 22, 14, 8, C.grey, '#4b5563') + R(7, 13, 18, 9, C.plaster, '#3f2a1a') + '<path d="M7 13 L25 22 M12 13 V22 M20 13 V22 M7 17.5 H25" stroke="#3f2a1a" stroke-width=".9"/>'
      + P('5 13.5 L16 3 L27 13.5', C.slate, '#1e293b') + R(14.3, 24, 3.4, 6, '#2b1d12'),
    R(3, 10, 9, 20, C.grey, '#4b5563') + P('2 10.5 L7.5 2 L13 10.5', C.slate, '#1e293b') + R(6.5, 15, 2, 3, Y, '#78350f', 0.3)
      + R(14, 18, 15, 12, C.plaster, '#3f2a1a') + P('12.5 18.5 L21.5 11 L30.5 18.5', C.slate, '#1e293b') + R(19.8, 24, 3.4, 6, '#2b1d12'),
    R(8, 8, 16, 22, C.grey, '#4b5563') + [8, 12, 16, 20].map((x) => R(x, 5, 3, 3, C.greyDark, '#374151', 0.4)).join('') + R(13.5, 23, 5, 7, '#2b1d12')
      + R(10.5, 12, 2, 3, Y, '#78350f', 0.3) + R(19.5, 12, 2, 3, Y, '#78350f', 0.3) + '<path d="M22 5 V0.5" stroke="#1f2937" stroke-width=".7"/>' + P('22 0.5 L27 2 L22 3.5', C.banner, '#7f1d1d', 0.4),
    R(5, 18, 22, 12, C.grey, '#4b5563') + [7, 11, 15, 19, 23].map((x) => R(x, 16, 2.4, 2.4, C.greyDark, '#374151', 0.3)).join('')
      + R(1, 13, 6, 17, C.grey, '#4b5563') + R(25, 13, 6, 17, C.grey, '#4b5563') + P('0 13.5 L4 6 L8 13.5', C.slate, '#1e293b') + P('24 13.5 L28 6 L32 13.5', C.slate, '#1e293b')
      + R(12, 7, 8, 11, C.grey, '#4b5563') + P('11.5 7.5 L16 1.5 L20.5 7.5', C.slate, '#1e293b') + `<path d="M13 30 V24 A3 3 0 0 1 19 24 V30 Z" fill="#2b1d12"/>`,
  ],
  maya: [
    E(16, 25, 8, 5, C.lime, '#78716c') + P('5 22 L16 9 L27 22', C.thatch, '#78350f') + R(14.3, 25, 3.4, 5, '#2b1d12'),
    R(6, 16, 20, 14, C.lime, '#78716c') + R(5.5, 18, 21, 2.5, C.mayaRed, '#7f1d1d', 0.4) + R(5, 14.5, 22, 2, C.mayaStone, '#57534e') + R(13.5, 23, 5, 7, '#2b1d12'),
    R(3, 26, 26, 4, C.mayaStone, '#57534e') + R(6, 22, 20, 4, C.mayaStone, '#57534e') + R(10, 9, 5, 13, C.lime, '#78716c') + R(11, 13, 3, 2, C.jade, '#047857', 0.3)
      + R(18, 18, 5, 4, C.greyDark, '#374151', 0.4) + P('18.5 18 L20.5 13 L22.5 18', '#fb923c', '#c2410c', 0.4),
    R(2, 25, 28, 5, C.mayaStone, '#57534e') + R(5, 20, 22, 5, C.mayaStone, '#57534e') + R(8, 15, 16, 5, C.mayaStone, '#57534e') + R(14, 15, 4, 15, C.lime, '#78716c', 0.4)
      + R(11, 9, 10, 6, C.lime, '#78716c') + R(10.5, 7.5, 11, 2, C.mayaRed, '#7f1d1d', 0.4) + R(14.5, 11, 3, 4, '#1c1917'),
    [0, 1, 2, 3, 4].map((k) => R(1 + k * 2.6, 26 - k * 3.6, 30 - k * 5.2, 3.8, C.mayaStone, '#57534e', 0.5)).join('') + R(14, 11.6, 4, 18.4, C.lime, '#78716c', 0.4)
      + R(12, 6, 8, 6, C.lime, '#78716c') + R(11.5, 4.5, 9, 2, C.mayaRed, '#7f1d1d', 0.4) + R(13.5, 1, 5, 3.5, C.mayaRed, '#7f1d1d', 0.4) + R(14.6, 8, 2.8, 4, '#1c1917'),
  ],
};
