// Cellule du goulag, en hauteur dans le coin du Parc gratuit : les joueurs au goulag y attendent leur duel
// en vue à la première personne, avec vue sur tout le plateau à travers les barreaux et une vieille télé
// qui retransmet le plateau 2D en direct.
import * as THREE from 'three';
import { BOARD } from './activeBoard.js';
import { COUNTRIES } from '../../shared/board.js';
import { cellRect, cellCenter, tokenOffset, TOTAL } from './layout.js';

// dimensions intérieures (unités du plateau : une case fait 1 de large, un pion 0,6 de haut)
const W = 2.6; // largeur (le long des barreaux)
const D = 2.4; // profondeur
const H = 2.0; // hauteur sous plafond
const EYE = 1.2; // hauteur des yeux
const FLOOR_Y = 5.2; // hauteur du plancher au-dessus du plateau
const MARGIN = 0.22; // distance minimale aux murs
const BED = { x0: -W / 2, x1: -W / 2 + 0.75, z0: -D / 2, z1: -D / 2 + 1.7 }; // couchette contre le mur gauche, au fond

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// béton sale : bruit, taches d'humidité, traces de coulures
function concrete(x, w, h, base, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = base;
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${rand() * 0.07})`;
    x.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
  }
  for (let i = 0; i < 7; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const g = x.createRadialGradient(cx, cy, 2, cx, cy, 30 + rand() * 70);
    g.addColorStop(0, 'rgba(40,30,15,.22)');
    g.addColorStop(1, 'rgba(40,30,15,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 10; i++) {
    x.fillStyle = 'rgba(30,25,15,.12)';
    x.fillRect(rand() * w, 0, 2 + rand() * 4, h * (0.2 + rand() * 0.5));
  }
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

// ---------- télé : le plateau 2D en direct ----------
function drawTV(x, S, state, positions) {
  x.fillStyle = '#0b0a14';
  x.fillRect(0, 0, S, S);
  const pad = 14;
  const k = (S - pad * 2) / TOTAL;
  const R = (u) => pad + u * k;
  for (const cell of BOARD) {
    const r = cellRect(cell.index);
    const prop = state.props?.[cell.index];
    const owner = prop?.owner && state.players.find((p) => p.id === prop.owner);
    x.fillStyle = '#e8e3d3';
    x.fillRect(R(r.x) + 0.5, R(r.y) + 0.5, r.w * k - 1, r.h * k - 1);
    if (cell.country) {
      x.fillStyle = COUNTRIES[cell.country].color;
      const band = 0.28 * k;
      if (r.side === 'bottom') x.fillRect(R(r.x), R(r.y), r.w * k, band);
      if (r.side === 'top') x.fillRect(R(r.x), R(r.y + r.h) - band, r.w * k, band);
      if (r.side === 'left') x.fillRect(R(r.x + r.w) - band, R(r.y), band, r.h * k);
      if (r.side === 'right') x.fillRect(R(r.x), R(r.y), band, r.h * k);
    }
    if (owner) {
      x.strokeStyle = owner.color;
      x.lineWidth = 3;
      x.strokeRect(R(r.x) + 2, R(r.y) + 2, r.w * k - 4, r.h * k - 4);
    }
    if (prop?.houses) {
      const c = cellCenter(cell.index);
      x.fillStyle = prop.houses === 5 ? '#dc2626' : '#16a34a';
      x.font = `900 ${Math.round(k * 0.45)}px sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(prop.houses === 5 ? 'H' : String(prop.houses), R(c.x), R(c.y));
    }
    const icon = { go: '➜', jail: '⛓', parking: 'P', gotojail: '🚔', chance: '?', chest: '▣', casino: '🎰', airport: '✈', utility: '⚡', tax: '$' }[cell.type];
    if (icon) {
      const c = cellCenter(cell.index);
      x.fillStyle = '#444';
      x.font = `${Math.round(k * 0.4)}px sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(icon, R(c.x), R(c.y));
    }
  }
  // centre : titre et joueur dont c'est le tour
  x.fillStyle = '#16112b';
  x.fillRect(R(1.6), R(1.6), (TOTAL - 3.2) * k, (TOTAL - 3.2) * k);
  x.fillStyle = '#facc15';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `900 ${Math.round(S * 0.07)}px sans-serif`;
  x.fillText('MONOPQOJIM', S / 2, S / 2 - S * 0.06);
  const cur = state.players.find((p) => p.id === state.turn?.pid);
  if (cur) {
    x.fillStyle = cur.color;
    x.font = `800 ${Math.round(S * 0.045)}px sans-serif`;
    x.fillText(`▶ ${cur.name}`, S / 2, S / 2 + S * 0.04);
  }
  x.fillStyle = '#ef4444';
  x.font = `900 ${Math.round(S * 0.035)}px sans-serif`;
  x.fillText('● EN DIRECT', S / 2, S / 2 + S * 0.12);
  // pions
  const alive = state.players.filter((p) => p.status === 'alive');
  const byCell = {};
  for (const p of alive) (byCell[positions?.[p.id] ?? p.pos] ||= []).push(p);
  for (const [pos, list] of Object.entries(byCell)) {
    const c = cellCenter(+pos);
    list.forEach((p, i) => {
      const o = tokenOffset(i, list.length);
      x.beginPath();
      x.arc(R(c.x + o.dx), R(c.y + o.dy), k * 0.2 * o.s, 0, Math.PI * 2);
      x.fillStyle = p.color;
      x.fill();
      x.lineWidth = 2;
      x.strokeStyle = '#fff';
      x.stroke();
    });
  }
  // lignes de balayage d'un vieux tube cathodique
  x.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = 0; y < S; y += 3) x.fillRect(0, y, S, 1);
}

export function createGoulagCell({ scene }) {
  const half = TOTAL / 2;
  const root = new THREE.Group();
  // en hauteur, au-delà du coin du Parc gratuit, face au centre du plateau
  root.position.set(-half - 3.4, FLOOR_Y, -half - 3.4);
  root.rotation.y = Math.PI / 4;
  scene.add(root);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const add = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const wallTex = track(canvasTex(512, 512, (x, w, h) => concrete(x, w, h, '#8a8578', 7)));
  const floorTex = track(canvasTex(512, 512, (x, w, h) => {
    concrete(x, w, h, '#58544c', 3);
    x.strokeStyle = 'rgba(0,0,0,.25)';
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, (i * h) / 4); x.lineTo(w, (i * h) / 4); x.stroke(); }
  }));
  // mur du fond : bâtons comptant les jours
  const backTex = track(canvasTex(512, 400, (x, w, h) => {
    concrete(x, w, h, '#8a8578', 11);
    x.strokeStyle = 'rgba(30,25,20,.75)';
    x.lineWidth = 3;
    for (let g = 0; g < 7; g++) {
      const bx = 40 + g * 34;
      for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(bx + i * 6, 250); x.lineTo(bx + i * 6, 290); x.stroke(); }
      x.beginPath(); x.moveTo(bx - 4, 285); x.lineTo(bx + 24, 255); x.stroke();
    }
  }));
  const wallMat = std('#ffffff', { map: wallTex });
  const backMat = std('#ffffff', { map: backTex });
  const floorMat = std('#ffffff', { map: floorTex });
  track(wallMat); track(backMat); track(floorMat);

  // plancher, plafond, murs (le devant est fait de barreaux)
  const T = 0.12;
  add(new THREE.BoxGeometry(W + T * 2, T, D + T * 2), floorMat, 0, -T / 2, 0);
  add(new THREE.BoxGeometry(W + T * 2, T, D + T * 2), wallMat, 0, H + T / 2, 0);
  add(new THREE.BoxGeometry(W + T * 2, H, T), backMat, 0, H / 2, -D / 2 - T / 2);
  add(new THREE.BoxGeometry(T, H, D), wallMat, -W / 2 - T / 2, H / 2, 0);
  add(new THREE.BoxGeometry(T, H, D), wallMat, W / 2 + T / 2, H / 2, 0);

  // barreaux
  const iron = track(std('#2b2b2e', { metalness: 0.7, roughness: 0.45 }));
  const barGeo = track(new THREE.CylinderGeometry(0.022, 0.022, H, 8));
  for (let bx = -W / 2 + 0.06; bx <= W / 2 - 0.05; bx += 0.17) {
    const b = new THREE.Mesh(barGeo, iron);
    b.position.set(bx, H / 2, D / 2);
    root.add(b);
  }
  for (const y of [0.05, 0.5, H - 0.05]) add(new THREE.BoxGeometry(W, 0.05, 0.06), iron, 0, y, D / 2);

  // couchette métallique avec matelas et couverture
  const bedW = BED.x1 - BED.x0;
  const bedD = BED.z1 - BED.z0;
  const bx = (BED.x0 + BED.x1) / 2;
  const bz = (BED.z0 + BED.z1) / 2;
  add(new THREE.BoxGeometry(bedW, 0.06, bedD), iron, bx, 0.42, bz);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.05, 0.42, 0.05), iron, bx + dx * (bedW / 2 - 0.03), 0.21, bz + dz * (bedD / 2 - 0.03));
  add(new THREE.BoxGeometry(bedW - 0.06, 0.1, bedD - 0.06), track(std('#9c9783')), bx, 0.5, bz);
  add(new THREE.BoxGeometry(bedW - 0.04, 0.03, bedD * 0.6), track(std('#4b5320')), bx, 0.565, bz + bedD * 0.18);
  add(new THREE.BoxGeometry(bedW * 0.6, 0.08, 0.25), track(std('#d6d0bd')), bx, 0.59, BED.z0 + 0.2);

  // seau, tabouret, gamelle
  const bucket = add(new THREE.CylinderGeometry(0.14, 0.11, 0.3, 16, 1, true), track(std('#6b7280', { metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide })), W / 2 - 0.25, 0.15, -D / 2 + 0.25);
  bucket.rotation.y = 0.4;
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), track(std('#5b3a1e')), 0.15, 0.42, 0.1);
  for (let i = 0; i < 3; i++) {
    const leg = add(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), track(std('#4a2f17')), 0.15 + Math.cos(i * 2.1) * 0.12, 0.21, 0.1 + Math.sin(i * 2.1) * 0.12);
    leg.rotation.z = Math.cos(i * 2.1) * 0.12;
  }
  add(new THREE.CylinderGeometry(0.09, 0.07, 0.05, 16), track(std('#9ca3af', { metalness: 0.7, roughness: 0.3 })), -W / 2 + 0.95, 0.025, -D / 2 + 0.2);

  // télé cathodique sur une étagère, contre le mur droit, tournée vers l'intérieur
  const tv = new THREE.Group();
  tv.position.set(W / 2 - 0.3, 1.15, -0.35);
  tv.rotation.y = -Math.PI / 2;
  root.add(tv);
  add(new THREE.BoxGeometry(0.75, 0.04, 0.5), track(std('#5b3a1e')), 0, -0.29, 0.02, tv);
  add(new THREE.BoxGeometry(0.66, 0.54, 0.5), track(std('#3f3a33', { roughness: 0.6 })), 0, 0, 0, tv);
  const tvCanvas = document.createElement('canvas');
  tvCanvas.width = tvCanvas.height = 512;
  const tvTex = track(new THREE.CanvasTexture(tvCanvas));
  tvTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = track(new THREE.MeshBasicMaterial({ map: tvTex }));
  add(new THREE.PlaneGeometry(0.46, 0.44), screenMat, -0.06, 0.01, 0.252, tv);
  // boutons et antenne
  for (const y of [0.12, 0]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), iron, 0.25, y, 0.255, tv).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const a = add(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 6), iron, s * 0.08, 0.44, -0.05, tv);
    a.rotation.z = s * 0.45;
  }
  const tvGlow = new THREE.PointLight('#9ec5ff', 0.6, 1.6, 2);
  tvGlow.position.set(0, 0, 0.5);
  tv.add(tvGlow);

  // ampoule nue au plafond
  add(new THREE.CylinderGeometry(0.005, 0.005, 0.25, 4), iron, 0, H - 0.125, -0.2);
  const bulb = add(new THREE.SphereGeometry(0.05, 12, 8), track(new THREE.MeshBasicMaterial({ color: '#ffe2a8' })), 0, H - 0.28, -0.2);
  const lamp = new THREE.PointLight('#ffd49a', 2.2, 4.5, 1.6);
  lamp.position.copy(bulb.position);
  root.add(lamp);

  // pilotis jusqu'au sol, et passerelle
  const stilt = track(std('#3f3f46', { metalness: 0.4 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.18, FLOOR_Y + 0.6, 0.18), stilt, sx * (W / 2 + 0.05), -(FLOOR_Y + 0.6) / 2, sz * (D / 2 + 0.05));
  for (const y of [-1.4, -2.8, -4.2]) {
    add(new THREE.BoxGeometry(W + 0.3, 0.06, 0.06), stilt, 0, y, D / 2 + 0.05);
    add(new THREE.BoxGeometry(W + 0.3, 0.06, 0.06), stilt, 0, y, -D / 2 - 0.05);
  }
  // projecteur de garde sur le toit
  const spot = add(new THREE.CylinderGeometry(0.1, 0.14, 0.2, 12), iron, W / 2 - 0.1, H + 0.22, D / 2 - 0.1);
  spot.rotation.x = 0.9;

  // ---------- déplacements à la première personne ----------
  const me = { x: 0, z: 0.75, yaw: Math.PI, pitch: -0.42 }; // regard vers les barreaux et le plateau
  const keys = new Set();
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);
  const onKey = (e) => {
    if (typing(e)) return;
    const k = e.key.toLowerCase();
    if (!['z', 'q', 's', 'd', 'w', 'a', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) return;
    if (e.type === 'keydown') { keys.add(k); if (k.startsWith('arrow')) e.preventDefault(); } else keys.delete(k);
  };
  const blur = () => keys.clear();
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', blur);

  const collide = () => {
    me.x = Math.max(-W / 2 + MARGIN, Math.min(W / 2 - MARGIN, me.x));
    me.z = Math.max(-D / 2 + MARGIN, Math.min(D / 2 - MARGIN, me.z));
    // la couchette : on en est repoussé par le côté le plus proche
    const x0 = BED.x0 - MARGIN, x1 = BED.x1 + MARGIN * 0.6, z0 = BED.z0 - MARGIN, z1 = BED.z1 + MARGIN * 0.6;
    if (me.x > x0 && me.x < x1 && me.z > z0 && me.z < z1) {
      if (x1 - me.x < z1 - me.z) me.x = x1; else me.z = z1;
    }
  };

  let bob = 0;
  let flick = 0;
  const forward = new THREE.Vector3();
  const look = new THREE.Vector3();

  return {
    root,
    look(dx, dy) {
      me.yaw -= dx;
      me.pitch = Math.max(-1.2, Math.min(1.1, me.pitch - dy));
    },
    reset() { Object.assign(me, { x: 0, z: 0.75, yaw: Math.PI, pitch: -0.42 }); },
    update(dt, t, camera, active) {
      // la télé grésille un peu
      flick += dt;
      if (flick > 0.08) {
        flick = 0;
        const v = 0.85 + Math.random() * 0.15;
        screenMat.color.setRGB(v, v, v * 1.04);
        tvGlow.intensity = 0.45 + Math.random() * 0.3;
      }
      lamp.intensity = 2.2 + Math.sin(t * 13) * 0.05 + (Math.random() < 0.004 ? -1.5 : 0);
      if (!active) return;
      let f = 0, s = 0;
      if (keys.has('z') || keys.has('w') || keys.has('arrowup')) f += 1;
      if (keys.has('s') || keys.has('arrowdown')) f -= 1;
      if (keys.has('q') || keys.has('a') || keys.has('arrowleft')) s -= 1;
      if (keys.has('d') || keys.has('arrowright')) s += 1;
      const moving = f || s;
      if (moving) {
        const speed = (keys.has('shift') ? 1.9 : 1.1) * dt / Math.hypot(f, s);
        // repère local de la cellule : yaw = 0 regarde vers le fond (-z)
        me.x += (-Math.sin(me.yaw) * f + Math.cos(me.yaw) * s) * speed;
        me.z += (-Math.cos(me.yaw) * f - Math.sin(me.yaw) * s) * speed;
        collide();
        bob += dt * 9;
      }
      const eye = new THREE.Vector3(me.x, EYE + (moving ? Math.sin(bob) * 0.025 : 0), me.z);
      forward.set(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
      look.copy(eye).add(forward);
      root.localToWorld(eye);
      root.localToWorld(look);
      camera.position.copy(eye);
      camera.lookAt(look);
    },
    drawTV(state, positions) {
      drawTV(tvCanvas.getContext('2d'), 512, state, positions);
      tvTex.needsUpdate = true;
    },
    dispose() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', blur);
      scene.remove(root);
      for (const d of disposables) d.dispose?.();
    },
  };
}
