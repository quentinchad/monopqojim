// Personnages 3D : un constructeur de figurine paramétrable (morphologie, peau, coiffure, barbe, lunettes,
// chapeau, tenue, accessoires) et des personnages prêts à l'emploi construits avec lui.
import * as THREE from 'three';

import { OPTIONS, DEFAULT_CHARACTER, CHARACTERS, cleanCharacter } from '../../shared/characters.js';

export { OPTIONS, DEFAULT_CHARACTER, CHARACTERS, cleanCharacter };

// ---------- construction ----------
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
const shade = (hex, k) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

const BUILD = {
  slim: { w: 0.88, arm: 0.9, chest: 1 },
  normal: { w: 1, arm: 1, chest: 1 },
  athletic: { w: 1.1, arm: 1.2, chest: 1.08 },
  muscular: { w: 1.24, arm: 1.6, chest: 1.18 },
  heavy: { w: 1.18, arm: 1.15, chest: 1.05, belly: true },
};
const LONG_SLEEVES = ['shirt', 'suit', 'jacket', 'sweater', 'racing', 'military', 'pirate'];

// Haut du corps : texture « dépliée » autour du torse (le milieu de l'image = le devant)
function topTexture(c) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const x = cv.getContext('2d');
  const W = 512;
  const H = 256;
  const mid = W / 2;
  x.fillStyle = c.topColor;
  x.fillRect(0, 0, W, H);
  const poly = (pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
  const num = (size, y, col, outline) => {
    if (!c.number) return;
    x.font = `900 ${size}px Arial, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if (outline) { x.lineWidth = 6; x.strokeStyle = outline; x.strokeText(c.number, mid, y); }
    x.fillStyle = col;
    x.fillText(c.number, mid, y);
  };
  switch (c.top) {
    case 'suit':
      poly([[mid - 46, 0], [mid + 46, 0], [mid, 150]], c.topColor2); // chemise
      poly([[mid - 11, 6], [mid + 11, 6], [mid + 15, 175], [mid, 205], [mid - 15, 175]], c.topColor3); // cravate
      x.strokeStyle = shade(c.topColor, 0.6);
      x.lineWidth = 6;
      x.beginPath(); x.moveTo(mid - 60, 0); x.lineTo(mid - 4, 170); x.moveTo(mid + 60, 0); x.lineTo(mid + 4, 170); x.stroke();
      x.fillStyle = shade(c.topColor, 0.5);
      for (const y of [190, 225]) { x.beginPath(); x.arc(mid + 12, y, 6, 0, Math.PI * 2); x.fill(); }
      break;
    case 'jacket':
      x.fillStyle = c.topColor2;
      x.fillRect(mid - 26, 0, 52, H);
      x.strokeStyle = shade(c.topColor, 0.55);
      x.lineWidth = 5;
      x.beginPath(); x.moveTo(mid - 28, 0); x.lineTo(mid - 28, H); x.moveTo(mid + 28, 0); x.lineTo(mid + 28, H); x.stroke();
      poly([[mid - 70, 0], [mid - 28, 0], [mid - 28, 60]], shade(c.topColor, 0.8));
      poly([[mid + 70, 0], [mid + 28, 0], [mid + 28, 60]], shade(c.topColor, 0.8));
      break;
    case 'shirt':
      poly([[mid - 30, 0], [mid + 30, 0], [mid, 30]], shade(c.topColor, 0.85));
      x.fillStyle = shade(c.topColor, 0.7);
      for (let y = 50; y < H; y += 40) { x.beginPath(); x.arc(mid, y, 5, 0, Math.PI * 2); x.fill(); }
      break;
    case 'sweater':
      poly([[mid - 40, 0], [mid + 40, 0], [mid, 40]], c.topColor2);
      x.fillStyle = shade(c.topColor, 0.8);
      x.fillRect(0, H - 22, W, 22);
      break;
    case 'jersey':
      if (c.stripes) {
        x.fillStyle = c.topColor2;
        for (let s = 0; s < W; s += 64) x.fillRect(s + 16, 0, 32, H);
      }
      x.fillStyle = c.stripes ? c.topColor : c.topColor2;
      x.fillRect(0, 0, W, 14);
      poly([[mid - 34, 0], [mid + 34, 0], [mid, 34]], c.stripes ? c.topColor2 : c.topColor2);
      num(110, 140, c.stripes ? '#1f2937' : '#ffffff', c.stripes ? null : shade(c.topColor2, 0.8));
      break;
    case 'racing':
      x.fillStyle = c.topColor2;
      x.fillRect(0, 70, W, 34);
      x.fillStyle = c.topColor3;
      x.fillRect(0, 104, W, 12);
      x.fillRect(mid - 140, 0, 14, H);
      x.fillRect(mid + 126, 0, 14, H);
      num(80, 180, '#ffffff', c.topColor2);
      break;
    case 'military':
      x.fillStyle = c.topColor2;
      x.fillRect(0, 190, W, 26); // ceinture
      x.fillStyle = shade(c.topColor2, 1.6);
      x.fillRect(mid - 14, 192, 28, 22);
      x.fillStyle = shade(c.topColor, 0.7);
      for (const y of [40, 90, 140]) { x.beginPath(); x.arc(mid, y, 6, 0, Math.PI * 2); x.fill(); }
      x.fillRect(mid - 90, 60, 50, 36);
      x.fillRect(mid + 40, 60, 50, 36);
      x.strokeStyle = shade(c.topColor, 0.6);
      x.lineWidth = 4;
      x.beginPath(); x.moveTo(mid, 0); x.lineTo(mid, 190); x.stroke();
      break;
    case 'pirate':
      x.fillStyle = c.topColor2;
      x.fillRect(mid - 40, 0, 80, H);
      poly([[mid - 40, 0], [mid + 40, 0], [mid, 70]], shade(c.topColor2, 0.85));
      x.fillStyle = c.topColor3;
      x.fillRect(0, 175, W, 34); // ceinture
      break;
    case 'tank':
      poly([[mid - 40, 0], [mid + 40, 0], [mid, 50]], shade(c.topColor, 0.85));
      break;
    default: // t-shirt
      x.fillStyle = shade(c.topColor, 0.82);
      x.fillRect(0, 0, W, 10);
      poly([[mid - 30, 0], [mid + 30, 0], [mid, 22]], shade(c.topColor, 0.8));
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function capGeo(r, theta) {
  return new THREE.SphereGeometry(r, 48, 28, 0, Math.PI * 2, 0, theta);
}

function buildHair(head, c, R) {
  const mat = std(c.hairColor, { roughness: c.hair === 'slick' ? 0.3 : 0.85 });
  const cap = (r, theta, tilt, sx = 1, sy = 1, sz = 1) => {
    const m = add(head, capGeo(r, theta), mat);
    m.rotation.x = tilt;
    m.scale.set(sx, sy, sz);
    return m;
  };
  switch (c.hair) {
    case 'bald': return;
    case 'buzz': cap(R * 1.035, 1.35, -0.45, 1.01, 1.07, 1.01); return;
    case 'receding': cap(R * 1.05, 1.42, -0.62, 1.03, 1.05, 1.04); return;
    case 'slick': cap(R * 1.05, 1.45, -0.62, 1.02, 1.04, 1.06); return;
    case 'side': {
      cap(R * 1.05, 1.42, -0.45, 1.02, 1.04, 1.03);
      const fringe = add(head, new THREE.SphereGeometry(R * 0.5, 16, 10), mat, -R * 0.2, R * 0.66, R * 0.62);
      fringe.scale.set(1.3, 0.32, 0.6);
      fringe.rotation.set(-0.6, 0, 0.45);
      return;
    }
    case 'quiff': {
      cap(R * 1.04, 1.3, -0.5, 1, 1.02, 1.02);
      const tuft = add(head, new THREE.SphereGeometry(R * 0.42, 16, 12), mat, 0, R * 0.98, R * 0.5);
      tuft.scale.set(1.5, 0.75, 1.1);
      tuft.rotation.x = -0.4;
      return;
    }
    case 'swoop': {
      cap(R * 1.1, 1.5, -0.35, 1.08, 1.02, 1.12);
      const sw = add(head, new THREE.SphereGeometry(R * 0.55, 18, 12), mat, R * 0.05, R * 0.82, R * 0.62);
      sw.scale.set(1.9, 0.55, 1.05);
      sw.rotation.set(-0.35, 0, 0.12);
      return;
    }
    case 'messy': {
      cap(R * 1.05, 1.38, -0.45, 1.02, 1.05, 1.03);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const spike = add(head, new THREE.ConeGeometry(R * 0.16, R * 0.4, 8), mat, Math.cos(a) * R * 0.45, R * 0.98, Math.sin(a) * R * 0.45 - R * 0.05);
        spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      }
      return;
    }
    case 'curly': {
      cap(R * 1.05, 1.4, -0.45);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const rr = k % 2 ? 0.5 : 0.8;
        add(head, new THREE.SphereGeometry(R * 0.2, 10, 8), mat, Math.cos(a) * R * rr * 0.9, R * (1 - rr * 0.25), Math.sin(a) * R * rr * 0.9 - R * 0.1);
      }
      return;
    }
    case 'long': {
      cap(R * 1.06, 1.45, -0.4, 1.03, 1.04, 1.04);
      const back = add(head, new THREE.CylinderGeometry(R * 1.05, R * 1.22, R * 1.9, 24, 1, true, Math.PI / 2 + 0.25, Math.PI - 0.5), std(c.hairColor, { roughness: 0.85, side: THREE.DoubleSide }));
      back.position.set(0, -R * 0.75, -R * 0.08);
      return;
    }
    case 'dreads': {
      cap(R * 1.06, 1.42, -0.45, 1.03, 1.03, 1.04);
      for (let k = 0; k < 16; k++) {
        const a = Math.PI * 0.32 + (k / 15) * Math.PI * 1.36; // côtés et arrière (a = 0 : devant le visage)
        const dx = Math.sin(a) * R * 1.02;
        const dz = Math.cos(a) * R * 1.02;
        const len = R * (1.2 + (k % 3) * 0.25);
        const d = add(head, new THREE.CylinderGeometry(R * 0.08, R * 0.06, len, 6), mat, dx, -len / 2 + R * 0.25, dz);
        d.rotation.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
        if (c.extras.includes('beads') && k % 3 === 0) {
          add(head, new THREE.SphereGeometry(R * 0.08, 8, 6), std(['#f59e0b', '#ef4444', '#e5e7eb'][k % 3], { roughness: 0.3 }), dx * 1.05, -len + R * 0.3, dz * 1.05);
        }
      }
      return;
    }
    default: cap(R * 1.05, 1.38, -0.45, 1.02, 1.06, 1.03); // courts
  }
}

function buildBeard(head, c, R) {
  const mat = std(c.beardColor, { roughness: 0.9 });
  const lower = (r, opacity) => {
    const m = add(head, new THREE.SphereGeometry(r, 32, 12, Math.PI / 2 - 1.35, 2.7, 1.72, 0.95), opacity < 1 ? std(c.beardColor, { roughness: 1, transparent: true, opacity }) : mat);
    return m;
  };
  const box = (w, h, d, x, y, z, rz = 0) => { const m = add(head, new THREE.BoxGeometry(w, h, d), mat, x, y, z); m.rotation.z = rz; return m; };
  switch (c.beard) {
    case 'stubble': lower(R * 1.012, 0.45); break;
    case 'full':
      lower(R * 1.04, 1);
      box(R * 0.5, R * 0.1, R * 0.12, 0, -R * 0.27, R * 0.95);
      break;
    case 'goatee':
      box(R * 0.48, R * 0.1, R * 0.12, 0, -R * 0.27, R * 0.96);
      for (const s of [-1, 1]) box(R * 0.08, R * 0.33, R * 0.12, s * R * 0.23, -R * 0.45, R * 0.9);
      box(R * 0.36, R * 0.24, R * 0.18, 0, -R * 0.6, R * 0.86);
      break;
    case 'mustache': box(R * 0.55, R * 0.12, R * 0.12, 0, -R * 0.27, R * 0.97); break;
    case 'toothbrush': box(R * 0.22, R * 0.13, R * 0.1, 0, -R * 0.26, R * 0.98); break;
    case 'pirate':
      for (const s of [-1, 1]) box(R * 0.3, R * 0.06, R * 0.08, s * R * 0.15, -R * 0.28, R * 0.96, s * -0.25);
      for (const s of [-1, 1]) {
        const b = add(head, new THREE.CylinderGeometry(R * 0.05, R * 0.03, R * 0.5, 6), mat, s * R * 0.09, -R * 0.82, R * 0.82);
        b.rotation.x = 0.25;
      }
      break;
    default: break;
  }
}

function buildGlasses(head, c, R) {
  if (c.glasses === 'none') return;
  const frame = std(c.glasses === 'aviator' ? '#d4af37' : '#141414', { metalness: 0.6, roughness: 0.3 });
  const dark = c.glasses === 'sun' || c.glasses === 'aviator';
  const lens = new THREE.MeshStandardMaterial({ color: c.lensColor, transparent: true, opacity: dark ? 0.85 : 0.35, metalness: 0.8, roughness: 0.1 });
  const y = R * 0.13;
  const z = R * 0.98;
  const sx = c.glasses === 'round' ? 1 : c.glasses === 'rect' ? 1.3 : 1.25;
  const sy = c.glasses === 'round' ? 1 : c.glasses === 'rect' ? 0.85 : 1.05;
  for (const s of [-1, 1]) {
    const f = add(head, new THREE.TorusGeometry(R * 0.21, R * 0.035, 8, 24), frame, s * R * 0.34, y, z);
    f.scale.set(sx, sy, 1);
    const l = add(head, new THREE.CircleGeometry(R * 0.21, 24), lens, s * R * 0.34, y, z - 0.002);
    l.scale.set(sx, sy, 1);
    const arm = add(head, new THREE.BoxGeometry(R * 0.04, R * 0.04, R * 0.75), frame, s * R * 0.64, y + R * 0.02, R * 0.55);
    arm.rotation.y = s * 0.28;
  }
  add(head, new THREE.BoxGeometry(R * 0.2, R * 0.035, R * 0.04), frame, 0, y + R * 0.04, z + R * 0.01);
}

function buildHat(head, c, R) {
  const felt = std(c.hatColor, { roughness: 0.85 });
  switch (c.hat) {
    case 'porkpie': {
      const hat = new THREE.Group();
      hat.position.y = R * 0.5;
      hat.rotation.x = -0.06;
      add(hat, new THREE.CylinderGeometry(R * 1.12, R * 1.12, R * 0.08, 40), felt);
      add(hat, new THREE.CylinderGeometry(R * 0.75, R * 0.81, R * 0.47, 40), felt, 0, R * 0.25, 0);
      add(hat, new THREE.CylinderGeometry(R * 0.82, R * 0.82, R * 0.15, 40), std('#2c2c2c', { roughness: 0.6 }), 0, R * 0.11, 0);
      add(hat, new THREE.TorusGeometry(R * 0.57, R * 0.08, 8, 32), felt, 0, R * 0.48, 0).rotation.x = Math.PI / 2;
      head.add(hat);
      return;
    }
    case 'tricorn': {
      const hat = new THREE.Group();
      hat.position.y = R * 0.62;
      hat.rotation.x = -0.12;
      add(hat, new THREE.CylinderGeometry(R * 0.8, R * 0.88, R * 0.5, 32), felt, 0, R * 0.2, 0);
      // trois bords relevés, une pointe vers l'avant
      add(hat, new THREE.CylinderGeometry(R * 1.45, R * 1.25, R * 0.42, 3, 1, true), std(c.hatColor, { roughness: 0.85, side: THREE.DoubleSide }), 0, R * 0.12, 0).rotation.y = Math.PI / 6 + Math.PI;
      add(hat, new THREE.CylinderGeometry(R * 1.25, R * 1.25, R * 0.05, 3), felt, 0, -R * 0.08, 0).rotation.y = Math.PI / 6 + Math.PI;
      head.add(hat);
      return;
    }
    case 'cap': {
      const crown = add(head, capGeo(R * 1.08, 1.45), felt, 0, R * 0.05, 0);
      crown.rotation.x = -0.25;
      const visor = add(head, new THREE.BoxGeometry(R * 1.1, R * 0.06, R * 0.75), felt, 0, R * 0.42, R * 1.08);
      visor.rotation.x = 0.18;
      add(head, new THREE.SphereGeometry(R * 0.08, 8, 6), felt, 0, R * 1.12, -R * 0.2);
      return;
    }
    case 'beanie': {
      const b = add(head, capGeo(R * 1.1, 1.5), std(c.hatColor, { roughness: 1 }), 0, R * 0.04, 0);
      b.rotation.x = -0.3;
      add(head, new THREE.TorusGeometry(R * 1.02, R * 0.12, 8, 32), std(shade(c.hatColor, 0.8), { roughness: 1 }), 0, R * 0.35, -R * 0.12).rotation.x = Math.PI / 2 - 0.3;
      return;
    }
    default:
  }
}

function buildFace(head, c, R, skinMat) {
  const white = std('#ffffff', { roughness: 0.3 });
  const pupil = std(c.eyes, { roughness: 0.2 });
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(R * 0.17, 16, 12), white, s * R * 0.34, R * 0.13, R * 0.85);
    add(head, new THREE.SphereGeometry(R * 0.09, 12, 8), pupil, s * R * 0.34, R * 0.13, R * 1.0);
    if (c.extras.includes('kohl')) {
      const k = add(head, new THREE.TorusGeometry(R * 0.17, R * 0.035, 8, 20), std('#111111'), s * R * 0.34, R * 0.13, R * 0.9);
      k.scale.set(1.1, 0.75, 1);
    }
    const angry = c.extras.includes('angry') || c.extras.includes('evil');
    const brow = add(head, new THREE.BoxGeometry(R * 0.36, R * (angry ? 0.09 : 0.07), R * 0.08), std(c.hair === 'bald' ? shade(c.skin, 0.55) : c.hairColor), s * R * 0.33, R * (angry ? 0.33 : 0.4), R * 0.94);
    brow.rotation.z = s * (angry ? 0.5 : -0.12); // sourcils froncés : bout intérieur vers le bas
    add(head, new THREE.SphereGeometry(R * 0.2, 12, 8), skinMat, s * R * 0.99, 0, 0).scale.set(0.45, 1, 0.8); // oreilles
    if (s > 0 && c.extras.includes('earring')) add(head, new THREE.TorusGeometry(R * 0.07, R * 0.02, 6, 12), std('#d4af37', { metalness: 0.9, roughness: 0.2 }), R * 1.02, -R * 0.2, 0);
  }
  add(head, new THREE.SphereGeometry(R * 0.14, 12, 10), std(shade(c.skin, 0.93)), 0, -R * 0.06, R * 1.0); // nez
  if (c.extras.includes('evil')) {
    // grand sourire mauvais : arc relevé aux coins, dents serrées
    const grin = add(head, new THREE.TorusGeometry(R * 0.24, R * 0.045, 8, 20, Math.PI), std('#5b1414'), 0, -R * 0.3, R * 0.9);
    grin.rotation.set(-0.25, 0, Math.PI);
    const teeth = add(head, new THREE.BoxGeometry(R * 0.36, R * 0.08, R * 0.05), std('#f8fafc', { roughness: 0.3 }), 0, -R * 0.46, R * 0.93);
    teeth.rotation.x = -0.3;
  } else if (c.extras.includes('angry')) {
    // bouche pincée et crispée
    for (const s of [-1, 1]) add(head, new THREE.BoxGeometry(R * 0.2, R * 0.05, R * 0.08), std('#5b1414'), s * R * 0.09, -R * 0.44, R * 0.92).rotation.z = s * 0.25;
  } else {
    add(head, new THREE.BoxGeometry(R * 0.36, R * 0.07, R * 0.08), std('#7f1d1d'), 0, -R * 0.42, R * 0.92); // bouche
  }
  if (c.extras.includes('bandana') && c.hat !== 'cap') {
    const band = add(head, new THREE.CylinderGeometry(R * 1.03, R * 1.03, R * 0.25, 32, 1, true), std('#b91c1c', { side: THREE.DoubleSide }), 0, R * 0.55, 0);
    band.rotation.x = -0.2;
    for (const s of [-1, 1]) {
      const tail = add(head, new THREE.BoxGeometry(R * 0.12, R * 0.6, R * 0.04), std('#b91c1c'), s * R * 0.15, R * 0.15, -R * 1.02);
      tail.rotation.z = s * 0.3;
    }
  }
}

// Un personnage (sans socle), d'environ 0,6 de haut, l'avant vers +z
function buildFigure(c) {
  const g = new THREE.Group();
  const b = BUILD[c.build] || BUILD.normal;
  const w = b.w;
  const skinMat = std(c.skin, { roughness: 0.7 });
  const pantsMat = std(c.pants, { roughness: 0.75 });
  const topMat = std(c.topColor, { roughness: 0.65 });
  const shoeMat = std(c.shoes, { roughness: 0.5 });
  const longCoat = c.top === 'pirate';

  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.06 * w, 0.035, 0.1), shoeMat, s * 0.05 * w, 0.067, 0.015);
    add(g, new THREE.CylinderGeometry(0.038 * w, 0.034 * w, 0.14, 14), pantsMat, s * 0.05 * w, 0.155, 0);
  }
  add(g, new THREE.CylinderGeometry(0.1 * w, 0.1 * w, 0.05, 20), pantsMat, 0, 0.235, 0); // bassin
  // torse avec la tenue « peinte » dessus (le devant au milieu de la texture)
  const torsoGeo = new THREE.CylinderGeometry(0.1 * w * b.chest, 0.108 * w, 0.19, 32, 1, false, Math.PI);
  const torso = add(g, torsoGeo, new THREE.MeshStandardMaterial({ map: topTexture(c), roughness: 0.65 }), 0, 0.345, 0);
  torso.scale.z = 0.82;
  add(g, new THREE.CircleGeometry(0.1 * w * b.chest, 24), topMat, 0, 0.44, 0).rotation.x = -Math.PI / 2;
  if (b.belly) add(g, new THREE.SphereGeometry(0.095 * w, 20, 14), new THREE.MeshStandardMaterial({ map: topTexture(c), roughness: 0.65 }), 0, 0.3, 0.035).scale.set(1, 0.9, 0.85);
  if (longCoat) {
    const coat = add(g, new THREE.CylinderGeometry(0.11 * w, 0.14 * w, 0.17, 24, 1, true, 0.55, Math.PI * 2 - 1.1), std(c.topColor, { roughness: 0.7, side: THREE.DoubleSide }), 0, 0.2, 0);
    coat.scale.z = 0.9;
  }
  // épaules et bras (manches selon la tenue)
  const sleeve = c.top === 'tank' ? skinMat : topMat;
  const fore = LONG_SLEEVES.includes(c.top) ? topMat : skinMat;
  const aw = b.arm;
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.04 * w * Math.max(1, aw * 0.85), 14, 10), c.top === 'tank' ? skinMat : topMat, s * 0.105 * w * b.chest, 0.41, 0);
    const upper = add(g, new THREE.CylinderGeometry(0.03 * aw, 0.027 * aw, 0.1, 12), sleeve, s * (0.125 * w * b.chest + 0.01), 0.36, 0);
    upper.rotation.z = s * 0.18;
    if (c.extras.includes('crossed')) {
      // bras croisés sur la poitrine
      upper.rotation.x = -0.35;
      upper.position.z = 0.02;
      const front = 0.085 * w * b.chest + 0.025 * aw;
      const fa = add(g, new THREE.CylinderGeometry(0.027 * aw, 0.025 * aw, 0.15 * w * b.chest, 12), fore, s * 0.02, 0.32 + s * 0.012, front);
      fa.rotation.z = Math.PI / 2 + s * 0.12;
      add(g, new THREE.SphereGeometry(0.027 * Math.max(1, aw * 0.8), 12, 8), skinMat, -s * 0.075 * w * b.chest, 0.33 + s * 0.012, front + 0.005);
      continue;
    }
    // le bras pend depuis l'épaule, sur un pivot qu'on peut faire tourner (poignée de main…)
    const sx = s * 0.105 * w * b.chest;
    const arm = new THREE.Group();
    arm.position.set(sx, 0.41, 0);
    g.add(arm);
    g.remove(upper);
    arm.add(upper);
    upper.position.set(upper.position.x - sx, upper.position.y - 0.41, upper.position.z);
    const lowerArm = add(arm, new THREE.CylinderGeometry(0.026 * aw, 0.024 * aw, 0.09, 12), fore, s * (0.135 * w * b.chest + 0.02) - sx, 0.27 - 0.41, 0.01);
    lowerArm.rotation.z = s * 0.1;
    const hand = new THREE.Vector3(s * (0.14 * w * b.chest + 0.022) - sx, 0.215 - 0.41, 0.012);
    add(arm, new THREE.SphereGeometry(0.027 * Math.max(1, aw * 0.8), 12, 8), skinMat, hand.x, hand.y, hand.z);
    arm.userData.hand = hand; // position de la main dans le repère du pivot
    (g.userData.arms ||= {})[s < 0 ? 'right' : 'left'] = arm;
  }
  if (c.top === 'tank') {
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.03, 0.06, 0.02), topMat, s * 0.05 * w, 0.42, 0.06);
  }
  add(g, new THREE.CylinderGeometry(0.036, 0.042, 0.05, 14), skinMat, 0, 0.455, 0); // cou
  if (c.extras.includes('chain')) {
    const silver = std('#e5e7eb', { metalness: 0.95, roughness: 0.2 });
    const ch = add(g, new THREE.TorusGeometry(0.06 * w, 0.005, 6, 32), silver, 0, 0.415, 0.02);
    ch.rotation.x = Math.PI / 2 - 0.5;
    add(g, new THREE.BoxGeometry(0.008, 0.035, 0.005), silver, 0, 0.375, 0.085 * w);
    add(g, new THREE.BoxGeometry(0.024, 0.008, 0.005), silver, 0, 0.383, 0.085 * w);
  }
  // tête
  const R = 0.135;
  const head = new THREE.Group();
  head.position.y = 0.6;
  add(head, new THREE.SphereGeometry(R, 32, 24), skinMat).scale.set(1, 1.06, 1);
  buildFace(head, c, R, skinMat);
  buildBeard(head, c, R);
  buildHair(head, c, R);
  buildGlasses(head, c, R);
  buildHat(head, c, R);
  g.add(head);
  g.userData.head = head;
  return g;
}

// Pion complet : socle à la couleur du joueur et personnage (ou deux pour des jumeaux)
export function buildCharacter(g, cfg, color) {
  const c = cleanCharacter(cfg) || DEFAULT_CHARACTER;
  add(g, new THREE.CylinderGeometry(0.21, 0.23, 0.05, 32), std(color, { metalness: 0.35, roughness: 0.35 }), 0, 0.025, 0);
  const k = 0.95 * c.height;
  const place = (fig, x, s) => {
    fig.scale.setScalar(s);
    fig.position.set(x, 0.05 - 0.05 * s, 0);
    g.add(fig);
    return fig;
  };
  if (c.twins) {
    const a = place(buildFigure(c), -0.115, k * 0.72);
    place(buildFigure(c), 0.115, k * 0.72);
    g.userData.head = a.userData.head;
    g.userData.arms = a.userData.arms;
  } else {
    const fig = place(buildFigure(c), 0, k);
    g.userData.head = fig.userData.head;
    g.userData.arms = fig.userData.arms;
  }
  return g;
}

// ---------- portraits (pastilles, pions 2D, duel) ----------
let portraitRig = null;
const portraitCache = new Map();
export function characterPortrait(cfg) {
  const key = JSON.stringify(cfg);
  if (portraitCache.has(key)) return portraitCache.get(key);
  try {
    if (!portraitRig) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(160, 160);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', '#8a7fa8', 2.2));
      const sun = new THREE.DirectionalLight('#ffffff', 1.6);
      sun.position.set(0.5, 1, 1.5);
      scene.add(sun);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
      portraitRig = { renderer, scene, camera };
    }
    const { renderer, scene, camera } = portraitRig;
    const g = new THREE.Group();
    buildCharacter(g, cfg, '#000000');
    scene.add(g);
    const c = cleanCharacter(cfg);
    const top = 0.05 + 0.6 * 0.95 * c.height * (c.twins ? 0.72 : 1);
    camera.position.set(0, top + 0.03, c.twins ? 0.95 : 0.62);
    camera.lookAt(0, top - 0.02, 0);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(g);
    g.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); });
    portraitCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}
