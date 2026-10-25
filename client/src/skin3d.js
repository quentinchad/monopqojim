// Pions personnalisés : modèles 3D générés à partir de l'image choisie par le joueur.
// Quatre gabarits : personnage (l'image fait le visage), animal à quatre pattes (l'image fait la tête),
// véhicule (l'image sur le toit) et objet (figurine : l'image en médaillon sur un socle).
// Les couleurs du modèle viennent de l'image ; le socle reprend la couleur du joueur pour le reconnaître.
import * as THREE from 'three';
import { buildCharacter, characterPortrait } from './characters.js';

export const SKIN_LABELS = {
  person: { icon: '🧍', name: 'Personnage' },
  animal: { icon: '🐕', name: 'Animal' },
  vehicle: { icon: '🚗', name: 'Véhicule' },
  object: { icon: '🏆', name: 'Objet / figurine' },
};

export const skinUrl = (roomId, p) => {
  if (!p?.skin) return null;
  // personnage : portrait rendu à la volée (pas d'image sur le serveur)
  if (p.skin.type === 'character') return characterPortrait(p.skin.char);
  return `/skin/${roomId}/${p.id}?v=${p.skin.v}`;
};

// Style CSS d'une pastille ronde montrant l'image du pion (zoomée sur le visage s'il est connu)
export function skinBackground(roomId, p) {
  const url = skinUrl(roomId, p);
  if (!url) return {};
  const f = p.skin.focus;
  if (!f) return { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  const pos = (c) => (f.s >= 1 ? 50 : Math.max(0, Math.min(100, ((c - f.s / 2) / (1 - f.s)) * 100)));
  return { backgroundImage: `url(${url})`, backgroundSize: `${100 / f.s}%`, backgroundPosition: `${pos(f.x)}% ${pos(f.y)}%` };
}

const cache = new Map();

// Textures d'une image : telle quelle, et découpée en rond avec un liseré (médaillon)
export function skinTextures(src) {
  if (cache.has(src)) return cache.get(src);
  const plain = new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const round = new THREE.CanvasTexture(canvas);
  // visage : découpé en rond aux bords adoucis, sans liseré (le reste de la tête garde sa couleur)
  const fcanvas = document.createElement('canvas');
  fcanvas.width = fcanvas.height = 256;
  const face = new THREE.CanvasTexture(fcanvas);
  for (const t of [plain, round, face]) t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    plain.image = img;
    plain.needsUpdate = true;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, 256, 256);
    ctx.restore();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.stroke();
    round.needsUpdate = true;
    const f = fcanvas.getContext('2d');
    const grad = f.createRadialGradient(128, 128, 104, 128, 128, 128);
    grad.addColorStop(0, '#000');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    f.drawImage(img, 0, 0, 256, 256);
    f.globalCompositeOperation = 'destination-in';
    f.fillStyle = grad;
    f.fillRect(0, 0, 256, 256);
    face.needsUpdate = true;
  };
  img.src = src;
  const entry = { plain, round, face };
  cache.set(src, entry);
  // l'éditeur crée une texture par recadrage : on n'en garde qu'un nombre limité
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return entry;
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });

function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Calotte de sphère tournée vers l'avant (+z) sur laquelle l'image est plaquée (visage)
function faceCap(r, tex, spread = 0.95) {
  const geo = new THREE.SphereGeometry(r, 32, 24, Math.PI / 2 - spread, spread * 2, Math.PI / 2 - spread, spread * 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: true, alphaTest: 0.05 }));
  m.castShadow = true;
  return m;
}

function base(g, color) {
  add(g, new THREE.CylinderGeometry(0.21, 0.23, 0.05, 32), std(color, { metalness: 0.35, roughness: 0.35 }), 0, 0.025, 0);
}

// Couleurs d'un personnage : [vêtement, cheveux, pantalon, peau]
function person(g, { face: tex, plain, c, color, faceData, hair }) {
  base(g, color);
  const pants = std(c[2] || '#334155');
  const shirt = std(c[0] || color, { roughness: 0.6 });
  const skin = std(c[3] || '#e0ac87', { roughness: 0.7 });
  for (const x of [-0.05, 0.05]) add(g, new THREE.CylinderGeometry(0.04, 0.035, 0.15, 16), pants, x, 0.125, 0);
  add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.2, 24), shirt, 0, 0.29, 0);
  for (const s of [-1, 1]) {
    const arm = add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.17, 12), shirt, s * 0.14, 0.29, 0);
    arm.rotation.z = s * 0.35;
    add(g, new THREE.SphereGeometry(0.032, 12, 8), skin, s * 0.17, 0.2, 0);
  }
  add(g, new THREE.CylinderGeometry(0.035, 0.04, 0.06, 12), skin, 0, 0.41, 0);
  const head = new THREE.Group();
  head.position.y = 0.56;
  g.add(head);
  g.userData.head = head;
  if (faceData) {
    // vraie tête : visage reconstruit à partir des repères, coiffure selon la photo
    faceData.then((data) => { if (data) buildFaceHead(head, data, plain, skin, std(c[1] || '#3b2a20', { roughness: 0.85 }), hair); else simpleHead(); });
  } else simpleHead();
  function simpleHead() {
    add(head, new THREE.SphereGeometry(0.15, 32, 24), std(c[1] || '#5b4636'));
    head.add(faceCap(0.153, tex));
  }
}

// Tête générée : crâne ellipsoïdal couleur peau, maillage du visage (852 triangles) plaqué avec la photo
// et posé sur l'avant du crâne avec son relief (nez, arcades, lèvres), oreilles, cheveux.
function buildFaceHead(head, { pts, tri }, tex, skinMat, hairMat, hair) {
  const r = 0.15;
  const P = (i) => [pts[i * 3] / 1000, pts[i * 3 + 1] / 1000, pts[i * 3 + 2] / 1000];
  const [lx] = P(234);
  const [rx] = P(454);
  const [, ty] = P(10);
  const [, by] = P(152);
  const cx = (lx + rx) / 2;
  const cy = (ty + by) / 2;
  const s = (2 * r * 0.95) / Math.abs(rx - lx);
  const sy = Math.max(1, Math.min(1.5, (Math.abs(by - ty) * s) / 2 / r * 1.04));
  const zOut = (P(234)[2] + P(454)[2]) / 2;
  const skull = add(head, new THREE.SphereGeometry(r, 40, 30), skinMat);
  skull.scale.set(1, sy, 1);

  const pos = [];
  const uv = [];
  for (let i = 0; i < pts.length / 3; i++) {
    const [x, y, z] = P(i);
    const X = (x - cx) * s;
    const Y = -(y - cy) * s;
    const d2 = (X / r) ** 2 + (Y / (r * sy)) ** 2;
    const zs = r * Math.sqrt(Math.max(0, 1 - d2));
    const relief = Math.max(0, -(z - zOut) * s * 0.25);
    // le visage dépasse du crâne au centre et s'y enfonce sur les bords (raccord invisible)
    const w = Math.max(0, 1 - d2);
    pos.push(X, Y, zs * (0.9 + 0.16 * w) + relief + 0.004 * w);
    uv.push(x, 1 - y);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // le maillage MediaPipe laisse les yeux et la bouche ouverts : on les referme (éventail depuis l'iris)
  const fan = (center, ring) => ring.flatMap((v, k) => [center, v, ring[(k + 1) % ring.length]]);
  const holes = [
    ...fan(468, [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]),
    ...fan(473, [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]),
    ...fan(13, [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]),
  ];
  geo.setIndex([...tri, ...(pts.length >= 478 * 3 ? holes : [])]);
  geo.computeVertexNormals();
  const faceMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, side: THREE.DoubleSide }));
  faceMesh.castShadow = true;
  head.add(faceMesh);

  for (const sgn of [-1, 1]) add(head, new THREE.SphereGeometry(0.03, 12, 10), skinMat, sgn * r * 0.98, -0.005, -0.01).scale.set(0.55, 1, 0.9);

  const style = hair?.style || 'short';
  if (style === 'bald') return;
  const vol = 1 + (hair?.vol || 0.15) * 0.7;
  const cap = add(head, new THREE.SphereGeometry(r * 1.07, 36, 18, 0, Math.PI * 2, 0, 1.3), hairMat);
  cap.scale.set(1.02, sy * vol, 1.04);
  cap.rotation.x = -0.5;
  cap.position.set(0, 0.012, -0.012);
  if (style === 'long') {
    const back = add(head, new THREE.CylinderGeometry(r * 1.08, r * 1.22, r * sy * 1.9, 28, 1, true, Math.PI / 2 + 0.25, Math.PI - 0.5), hairMat);
    back.material = hairMat.clone();
    back.material.side = THREE.DoubleSide;
    back.position.set(0, -r * sy * 0.55, -0.015);
  }
}

function animal(g, { face: tex, c, color }) {
  base(g, color);
  const fur = std(c[0] || '#a0764a', { roughness: 0.9 });
  const fur2 = std(c[1] || c[0] || '#6b4a2b', { roughness: 0.9 });
  const body = add(g, new THREE.SphereGeometry(0.13, 24, 16), fur, 0, 0.25, -0.04);
  body.scale.set(0.9, 0.78, 1.65);
  for (const [x, z] of [[-0.065, 0.1], [0.065, 0.1], [-0.065, -0.17], [0.065, -0.17]]) {
    add(g, new THREE.CylinderGeometry(0.026, 0.022, 0.2, 12), fur2, x, 0.13, z);
    add(g, new THREE.SphereGeometry(0.03, 10, 8), fur2, x, 0.035, z + 0.012).scale.set(1, 0.6, 1.3);
  }
  const tail = add(g, new THREE.CylinderGeometry(0.018, 0.01, 0.17, 8), fur2, 0, 0.33, -0.28);
  tail.rotation.x = -0.7;
  // collier à la couleur du joueur
  const collar = add(g, new THREE.TorusGeometry(0.075, 0.016, 8, 24), std(color), 0, 0.36, 0.15);
  collar.rotation.x = Math.PI / 2 - 0.5;
  const neck = add(g, new THREE.CylinderGeometry(0.05, 0.065, 0.12, 12), fur, 0, 0.35, 0.14);
  neck.rotation.x = 0.5;
  const head = new THREE.Group();
  head.position.set(0, 0.45, 0.2);
  add(head, new THREE.SphereGeometry(0.12, 28, 20), fur);
  head.add(faceCap(0.123, tex, 0.9));
  for (const s of [-1, 1]) {
    const ear = add(head, new THREE.ConeGeometry(0.045, 0.1, 12), fur2, s * 0.085, 0.12, -0.02);
    ear.rotation.z = s * -0.35;
  }
  g.add(head);
  g.userData.head = head;
}

function vehicle(g, { tex, c, color }) {
  base(g, color);
  const paint = std(c[0] || '#dc2626', { metalness: 0.6, roughness: 0.3 });
  const glass = std('#1f2937', { metalness: 0.8, roughness: 0.15 });
  // carrosserie basse et allongée, habitacle vitré, l'image en décor sur le toit
  add(g, new THREE.BoxGeometry(0.3, 0.08, 0.54), paint, 0, 0.11, 0);
  const nose = add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.3, 16), paint, 0, 0.11, 0.27);
  nose.rotation.z = Math.PI / 2;
  add(g, new THREE.BoxGeometry(0.25, 0.075, 0.24), glass, 0, 0.185, -0.04);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.012, 0.2), [paint, paint, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), paint, paint, paint]);
  roof.position.set(0, 0.228, -0.04);
  roof.castShadow = true;
  g.add(roof);
  add(g, new THREE.BoxGeometry(0.28, 0.02, 0.05), paint, 0, 0.17, -0.25); // aileron
  const tire = std('#111111', { roughness: 0.9 });
  for (const [x, z] of [[-0.15, 0.16], [0.15, 0.16], [-0.15, -0.16], [0.15, -0.16]]) {
    const w = add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), tire, x, 0.08, z);
    w.rotation.z = Math.PI / 2;
  }
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.06, 0.03, 0.01), std('#fff7d6', { emissive: '#fff7d6', emissiveIntensity: 0.6 }), s * 0.09, 0.115, 0.305);
  }
  add(g, new THREE.BoxGeometry(0.31, 0.02, 0.51), std(c[1] || '#e5e7eb', { metalness: 0.5 }), 0, 0.08, 0);
  g.scale.setScalar(1.1);
}

function object(g, { round, color }) {
  base(g, color);
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), std('#d4d4d8', { metalness: 0.8, roughness: 0.3 }), 0, 0.15, 0);
  // médaillon toujours tourné vers la caméra
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: round, depthWrite: true }));
  sprite.scale.set(0.46, 0.46, 1);
  sprite.position.y = 0.46;
  g.add(sprite);
}

const BUILDERS = { person, animal, vehicle, object, character: (g, { char, color }) => buildCharacter(g, char, color) };

const faceCache = new Map();
function loadFace(url) {
  if (!faceCache.has(url)) faceCache.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return faceCache.get(url);
}

// Modèle complet (environ 0,6 de haut, l'avant vers +z).
// `src` : adresse ou data URL de l'image ; visage analysé fourni directement (`face`) ou chargé depuis `faceSrc`.
export function makeSkinModel({ skin, src, faceSrc, face, color = '#ef4444' }) {
  const g = new THREE.Group();
  const t = src ? skinTextures(src) : {};
  const faceData = face ? Promise.resolve(face) : skin.face && faceSrc ? loadFace(faceSrc) : null;
  (BUILDERS[skin.type] || object)(g, { tex: t.plain, plain: t.plain, round: t.round, face: t.face, c: skin.colors || [], color, faceData, hair: skin.hair, char: skin.char });
  return g;
}

// Adresses de l'image et du visage du pion d'un joueur
export function skinSources(roomId, p) {
  if (!p?.skin || p.skin.type === 'character') return {};
  const q = `?v=${p.skin.v}`;
  return {
    src: `/skin/${roomId}/${p.id}${q}`,
    faceSrc: p.skin.face ? `/skin/${roomId}/${p.id}/face${q}` : null,
  };
}

// Modèle 3D d'un joueur : son pion personnalisé, ou le pion classique à sa couleur
export function playerModel(roomId, p) {
  if (p?.skin) return makeSkinModel({ skin: p.skin, ...skinSources(roomId, p), color: p.color });
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: p?.color || '#ef4444', metalness: 0.35, roughness: 0.35 });
  const add = (geo, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); };
  add(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 32), 0.035);
  add(new THREE.CylinderGeometry(0.07, 0.16, 0.34, 32), 0.24);
  add(new THREE.SphereGeometry(0.12, 32, 20), 0.47);
  return g;
}
