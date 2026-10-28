// Un seul bâtiment par ville, qui s'agrandit à chaque construction :
// 1 maisonnette, 2 maison à étage, 3 villa avec une aile, 4 manoir à colonnes, 5 hôtel (tour).
// En 3D (plateau) : groupe posé à y = 0, façade vers +z, emprise d'environ 0,7 × 0,32.
// En 2D : icône SVG du même bâtiment. Les civilisations (civBuildings.js) remplacent ce style classique.
import * as THREE from 'three';
import { CIV_BUILDERS, CIV_SVGS } from './civBuildings.js';
import { CIVS, cleanCiv } from '../../shared/civs.js';

// nom du bâtiment d'un niveau, selon la civilisation
export const buildingName = (level, civ) => CIVS[cleanCiv(civ)].levels[level - 1] || '';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const M = {
  wall: mat('#f4ead2'),
  wall2: mat('#e9dcc0'),
  roof: mat('#15803d', { roughness: 0.55 }),
  roofDark: mat('#166534'),
  trim: mat('#ffffff', { roughness: 0.4 }),
  door: mat('#7c4a21'),
  window: mat('#fde68a', { emissive: '#f59e0b', emissiveIntensity: 0.55, roughness: 0.3 }),
  chimney: mat('#9a3412'),
  hedge: mat('#4d7c0f', { roughness: 0.9 }),
  pool: mat('#38bdf8', { emissive: '#0ea5e9', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.1 }),
  hotel: mat('#dc2626', { roughness: 0.45 }),
  hotelDark: mat('#991b1b'),
  glass: mat('#fef3c7', { emissive: '#fbbf24', emissiveIntensity: 0.7, roughness: 0.2 }),
  gold: mat('#facc15', { metalness: 0.8, roughness: 0.25, emissive: '#a16207', emissiveIntensity: 0.25 }),
};

function box(g, w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = true;
  b.receiveShadow = true;
  g.add(b);
  return b;
}

// toit à deux pans, pignon sur la façade
function gable(g, w, h, d, m, x, y, z) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const r = new THREE.Mesh(geo, m);
  r.position.set(x, y, z);
  r.castShadow = true;
  g.add(r);
  return r;
}

// fenêtres sur la façade (z = front) : `cols` × `rows`
function windows(g, cx, y0, front, w, rows, cols, floorH, size = 0.045) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx - w / 2 + (w / (cols + 1)) * (c + 1);
      box(g, size, size * 1.2, 0.012, M.window, x, y0 + floorH * r + floorH * 0.38, front + 0.004);
    }
  }
}

function cottage(g) {
  box(g, 0.26, 0.15, 0.22, M.wall, 0, 0, 0);
  gable(g, 0.32, 0.12, 0.26, M.roof, 0, 0.15, 0);
  box(g, 0.05, 0.085, 0.012, M.door, 0, 0, 0.112);
  for (const x of [-0.08, 0.08]) box(g, 0.045, 0.045, 0.012, M.window, x, 0.06, 0.112);
}

function house(g) {
  box(g, 0.32, 0.25, 0.24, M.wall, 0, 0, 0);
  box(g, 0.33, 0.014, 0.25, M.trim, 0, 0.125, 0); // bandeau entre les étages
  gable(g, 0.39, 0.15, 0.28, M.roof, 0, 0.25, 0);
  box(g, 0.045, 0.12, 0.045, M.chimney, 0.09, 0.27, -0.04);
  box(g, 0.055, 0.09, 0.012, M.door, 0, 0, 0.122);
  for (const x of [-0.1, 0.1]) box(g, 0.05, 0.055, 0.012, M.window, x, 0.04, 0.122);
  windows(g, 0, 0.125, 0.122, 0.32, 1, 3, 0.125, 0.05);
}

function villa(g) {
  // corps principal à étage et aile basse sur le côté, haie devant
  box(g, 0.32, 0.3, 0.26, M.wall, -0.08, 0, 0);
  gable(g, 0.38, 0.16, 0.3, M.roof, -0.08, 0.3, 0);
  box(g, 0.22, 0.17, 0.22, M.wall2, 0.19, 0, -0.01);
  gable(g, 0.26, 0.1, 0.25, M.roofDark, 0.19, 0.17, -0.01);
  box(g, 0.06, 0.1, 0.012, M.door, -0.08, 0, 0.132);
  windows(g, -0.08, 0, 0.132, 0.32, 2, 2, 0.15, 0.055);
  windows(g, 0.19, 0, 0.102, 0.22, 1, 2, 0.17, 0.05);
  box(g, 0.05, 0.13, 0.05, M.chimney, -0.18, 0.33, -0.06);
  box(g, 0.6, 0.04, 0.03, M.hedge, 0.02, 0, 0.17);
}

function manor(g) {
  // grande façade symétrique, fronton sur colonnes, deux ailes, piscine devant
  box(g, 0.36, 0.36, 0.26, M.wall, 0, 0, -0.02);
  box(g, 0.37, 0.02, 0.27, M.trim, 0, 0.36, -0.02);
  gable(g, 0.42, 0.14, 0.3, M.roof, 0, 0.38, -0.02);
  for (const s of [-1, 1]) {
    box(g, 0.16, 0.26, 0.22, M.wall2, s * 0.26, 0, -0.04);
    box(g, 0.17, 0.035, 0.23, M.roofDark, s * 0.26, 0.26, -0.04);
    windows(g, s * 0.26, 0, 0.07, 0.16, 2, 1, 0.13, 0.05);
  }
  // portique : quatre colonnes et un fronton
  for (const x of [-0.1, -0.035, 0.035, 0.1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.3, 10), M.trim);
    c.position.set(x, 0.15, 0.135);
    c.castShadow = true;
    g.add(c);
  }
  box(g, 0.26, 0.025, 0.06, M.trim, 0, 0.3, 0.125);
  gable(g, 0.27, 0.07, 0.06, M.trim, 0, 0.325, 0.125);
  box(g, 0.06, 0.12, 0.012, M.door, 0, 0, 0.112);
  windows(g, 0, 0.17, 0.112, 0.36, 1, 4, 0.18, 0.045);
  box(g, 0.22, 0.012, 0.07, M.pool, 0, 0, 0.215);
}

function hotel(g) {
  // podium, tour vitrée rouge, enseigne dorée au sommet
  box(g, 0.66, 0.1, 0.32, M.hotelDark, 0, 0, 0);
  box(g, 0.66, 0.012, 0.012, M.gold, 0, 0.1, 0.161);
  box(g, 0.1, 0.07, 0.012, M.glass, 0, 0, 0.162); // entrée
  const tower = box(g, 0.4, 0.62, 0.26, M.hotel, 0, 0.1, -0.01);
  tower.userData.tower = true;
  // fenêtres éclairées sur la façade et les côtés
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      box(g, 0.055, 0.045, 0.01, M.glass, -0.135 + c * 0.09, 0.14 + r * 0.08, 0.121);
      box(g, 0.055, 0.045, 0.01, M.glass, -0.135 + c * 0.09, 0.14 + r * 0.08, -0.141); // façade arrière
    }
    for (const s of [-1, 1]) for (let c = 0; c < 2; c++) box(g, 0.01, 0.045, 0.05, M.glass, s * 0.201, 0.14 + r * 0.08, -0.07 + c * 0.11);
  }
  box(g, 0.42, 0.03, 0.28, M.hotelDark, 0, 0.72, -0.01);
  // enseigne « H » dorée et petite antenne
  const sign = box(g, 0.16, 0.12, 0.02, M.gold, 0, 0.75, 0.06);
  sign.userData.sign = true;
  const bar = (w, h, x, y) => box(g, w, h, 0.01, M.hotelDark, x, y, 0.072);
  bar(0.02, 0.09, -0.04, 0.765);
  bar(0.02, 0.09, 0.04, 0.765);
  bar(0.07, 0.02, 0, 0.8);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), M.gold);
  ant.position.set(0.12, 0.82, -0.06);
  g.add(ant);
}

const BUILDERS = [null, cottage, house, villa, manor, hotel];

export function buildBuilding3D(level, civ) {
  const g = new THREE.Group();
  const n = Math.max(0, Math.min(5, level));
  const civBuild = CIV_BUILDERS[cleanCiv(civ)];
  if (n) (civBuild ? civBuild[n - 1] : BUILDERS[n])(g);
  return g;
}

// ---------- icônes 2D (viewBox 0 0 32 32, sol en y = 30) ----------
const W = '#fbf3df';
const WS = '#7c5a2e';
const R = '#16a34a';
const RS = '#14532d';
const Y = '#fbbf24';
const win = (x, y, w = 3.2, h = 3.6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".5" fill="${Y}" stroke="${WS}" stroke-width=".6"/>`;
const door = (x, y, w = 3.6, h = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#8b5a2b" stroke="${WS}" stroke-width=".6"/>`;
const roof = (x1, x2, yb, yt, fill = R) => `<path d="M${x1} ${yb} L${(x1 + x2) / 2} ${yt} L${x2} ${yb} Z" fill="${fill}" stroke="${RS}" stroke-width=".9" stroke-linejoin="round"/>`;
const body = (x, y, w, h, fill = W) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${WS}" stroke-width=".9"/>`;

const SVGS = [
  '',
  // maisonnette
  body(9, 18, 14, 12) + roof(7, 25, 18.5, 9) + door(14.2, 24) + win(10.5, 21) + win(18.3, 21),
  // maison à étage, cheminée
  `<rect x="19" y="6" width="3.4" height="7" fill="#b45309" stroke="${WS}" stroke-width=".7"/>`
    + body(8, 14, 16, 16) + roof(6, 26, 14.5, 4) + door(14.2, 24) + win(9.6, 17) + win(14.4, 17) + win(19.2, 17) + win(9.6, 24) + win(19.2, 24),
  // villa : corps à étage + aile, haie
  body(19, 19, 11, 11, '#efe2c3') + roof(18, 31, 19.5, 13, '#15803d') + win(21, 22) + win(25.8, 22)
    + body(3, 13, 16, 17) + roof(1, 21, 13.5, 4) + door(9.2, 24) + win(4.6, 16.5) + win(12.6, 16.5) + win(4.6, 23) + win(13.4, 23)
    + `<rect x="1" y="28.2" width="30" height="2.2" rx="1.1" fill="#4d7c0f"/>`,
  // manoir : ailes, colonnes, fronton
  body(1, 16, 8, 14, '#efe2c3') + body(23, 16, 8, 14, '#efe2c3')
    + `<rect x="0.5" y="14.5" width="9" height="2" fill="${RS}"/><rect x="22.5" y="14.5" width="9" height="2" fill="${RS}"/>`
    + win(3.4, 19) + win(3.4, 24.5) + win(25.4, 19) + win(25.4, 24.5)
    + body(8, 11, 16, 19) + roof(7, 25, 11.5, 3)
    + `<path d="M10 17 L16 13.2 L22 17 Z" fill="#fff" stroke="${WS}" stroke-width=".7"/>`
    + [11, 14, 18, 21].map((x) => `<rect x="${x - 0.7}" y="17" width="1.4" height="13" fill="#fff" stroke="${WS}" stroke-width=".4"/>`).join('')
    + door(14.2, 24, 3.6, 6),
  // hôtel : tour rouge, fenêtres allumées, enseigne H
  `<rect x="2" y="25" width="28" height="5" rx=".6" fill="#991b1b" stroke="#450a0a" stroke-width=".8"/>`
    + `<rect x="8" y="5" width="16" height="21" rx=".8" fill="#dc2626" stroke="#450a0a" stroke-width=".9"/>`
    + [0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => `<rect x="${10 + c * 4.6}" y="${10 + r * 3.8}" width="2.8" height="2.4" fill="${Y}"/>`).join('')).join('')
    + `<rect x="11" y="0.8" width="10" height="5" rx="1" fill="#facc15" stroke="#854d0e" stroke-width=".7"/>`
    + `<text x="16" y="4.9" text-anchor="middle" font-size="4.6" font-weight="900" fill="#7f1d1d" font-family="Arial">H</text>`
    + `<rect x="14" y="26.4" width="4" height="3.6" fill="${Y}"/>`,
];

export function buildingSvg(level, civ) {
  const n = Math.max(0, Math.min(5, level | 0));
  if (!n) return '';
  const art = CIV_SVGS[cleanCiv(civ)]?.[n - 1] ?? SVGS[n];
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${art}</svg>`;
}
