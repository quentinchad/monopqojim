// Duel à mort du goulag en 3D. La simulation du serveur reste un plan vu de dessus (960 × 540) ;
// on la transpose ici dans une cage de béton et de grillage, la nuit, sous les projecteurs.
// Les combattants jouent à la première personne, les spectateurs ont une caméra de retransmission.
import * as THREE from 'three';
import { playerModel } from './skin3d.js';

const K = 1 / 60; // 60 unités de la simulation = 1 mètre
const EYE = 1.55;
const MODEL_SCALE = 2.25;

const shadeHex = (hex, k) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

function concreteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#56524d';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const v = 60 + Math.random() * 45;
    x.fillStyle = `rgba(${v},${v - 3},${v - 7},${0.25 + Math.random() * 0.35})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  x.strokeStyle = 'rgba(0,0,0,.3)';
  x.lineWidth = 3;
  for (let g = 0; g <= 512; g += 128) {
    x.beginPath(); x.moveTo(g, 0); x.lineTo(g, 512); x.stroke();
    x.beginPath(); x.moveTo(0, g); x.lineTo(512, g); x.stroke();
  }
  x.strokeStyle = 'rgba(15,12,10,.6)';
  x.lineWidth = 1.5;
  for (let k = 0; k < 10; k++) {
    let px = Math.random() * 512;
    let py = Math.random() * 512;
    x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 6; s++) { px += (Math.random() - 0.5) * 70; py += (Math.random() - 0.5) * 70; x.lineTo(px, py); }
    x.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 60);
    g.addColorStop(0, k % 2 ? 'rgba(60,10,10,.35)' : 'rgba(35,25,15,.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(Math.random() * 512, Math.random() * 512); x.fillStyle = g; x.fillRect(-60, -60, 120, 120); x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#6b4f2a';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#5c4223' : '#755731'; x.fillRect(0, i * 16, 128, 14); }
  x.strokeStyle = '#3a2a14';
  x.lineWidth = 8;
  x.strokeRect(4, 4, 120, 120);
  x.beginPath(); x.moveTo(4, 4); x.lineTo(124, 124); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fenceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.strokeStyle = '#9ca3af';
  x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function nameTag(name, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.3, 0.33, 1);
  sprite.renderOrder = 10;
  let last = -1;
  sprite.userData.draw = (hp) => {
    if (hp === last) return;
    last = hp;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 64);
    x.font = '900 24px Nunito, Arial, sans-serif';
    x.textAlign = 'center';
    x.lineWidth = 5;
    x.strokeStyle = '#000';
    x.strokeText(name, 128, 24);
    x.fillStyle = color;
    x.fillText(name, 128, 24);
    x.fillStyle = 'rgba(0,0,0,.7)';
    x.fillRect(28, 36, 200, 16);
    x.fillStyle = hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444';
    x.fillRect(30, 38, 196 * (hp / 100), 12);
    tex.needsUpdate = true;
  };
  return sprite;
}

function weaponMeshes() {
  const black = new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.7, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: '#4a2f17', roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: '#d6d9de', metalness: 0.9, roughness: 0.2 });
  const pistol = new THREE.Group();
  pistol.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.22), black));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.05), black);
  grip.position.set(0, -0.07, -0.06);
  grip.rotation.x = -0.25;
  pistol.add(grip);
  const shotgun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 10), black);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.2;
  shotgun.add(barrel);
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), wood);
  pump.position.set(0, -0.035, 0.25);
  shotgun.add(pump);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.3), wood);
  stock.position.set(0, -0.03, -0.25);
  shotgun.add(stock);
  const machete = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.14), wood);
  machete.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.5), steel);
  blade.position.set(0, 0.012, 0.31);
  machete.add(blade);
  return { pistol, shotgun, machete };
}

export function createDuelArena({ container, meta, players, roomId, me }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const W = meta.W * K;
  const D = meta.H * K;
  const to3 = (x, y) => new THREE.Vector3((x - meta.W / 2) * K, 0, (y - meta.H / 2) * K);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#090a0e');
  scene.fog = new THREE.Fog('#090a0e', 12, 38);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.03, 120);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight('#7f8fb3', '#1a1612', 0.55));

  // sol, extérieur, caisses
  const floorTex = concreteTexture();
  floorTex.repeat.set(W / 4, D / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: '#1f2026', roughness: 1 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.01;
  scene.add(outside);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 });
  for (const o of meta.obstacles) {
    const h = 1.15;
    const box = new THREE.Mesh(new THREE.BoxGeometry(o.w * K, h, o.h * K), woodMat);
    const c = to3(o.x + o.w / 2, o.y + o.h / 2);
    box.position.set(c.x, h / 2, c.z);
    box.castShadow = box.receiveShadow = true;
    scene.add(box);
  }

  // cage : grillage, poteaux, barbelés
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
  const postMat = new THREE.MeshStandardMaterial({ color: '#2b2d33', metalness: 0.7, roughness: 0.4 });
  const wireMat = new THREE.MeshStandardMaterial({ color: '#9ca3af', metalness: 0.8, roughness: 0.35 });
  const sides = [
    { len: W, x: 0, z: -D / 2, ry: 0 }, { len: W, x: 0, z: D / 2, ry: 0 },
    { len: D, x: -W / 2, z: 0, ry: Math.PI / 2 }, { len: D, x: W / 2, z: 0, ry: Math.PI / 2 },
  ];
  for (const s of sides) {
    const tex = fenceMat.map.clone();
    tex.repeat.set(s.len * 4, 3 * 4);
    tex.needsUpdate = true;
    const m = fenceMat.clone();
    m.map = tex;
    const fence = new THREE.Mesh(new THREE.PlaneGeometry(s.len, 3), m);
    fence.position.set(s.x, 1.5, s.z);
    fence.rotation.y = s.ry;
    scene.add(fence);
    const coil = new THREE.Mesh(new THREE.TorusKnotGeometry(0.2, 0.012, 300, 6, 60, 3), wireMat);
    coil.scale.set(1, 1, s.len / 0.8);
    coil.rotation.y = s.ry + Math.PI / 2;
    coil.position.set(s.x, 3.1, s.z);
    scene.add(coil);
    const n = Math.round(s.len / 2);
    for (let k = 0; k <= n; k++) {
      const t = -s.len / 2 + (k * s.len) / n;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), postMat);
      post.position.set(s.x + (s.ry ? 0 : t), 1.6, s.z + (s.ry ? t : 0));
      post.castShadow = true;
      scene.add(post);
    }
  }

  // projecteurs aux coins, lumière rouge de secours
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 8), postMat);
    pole.position.set(sx * (W / 2 + 1.5), 3.5, sz * (D / 2 + 1.5));
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff7d6', emissiveIntensity: 3 }));
    lamp.position.set(sx * (W / 2 + 1.5), 7, sz * (D / 2 + 1.5));
    scene.add(lamp);
    const spot = new THREE.SpotLight('#fff1d6', 260, 40, 0.55, 0.5, 1.4);
    spot.position.copy(lamp.position);
    spot.target.position.set(sx * 2, 0, sz * 1.5);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    scene.add(spot, spot.target);
  }
  const alarm = new THREE.PointLight('#ff2020', 0, 18, 1.5);
  alarm.position.set(0, 4, -D / 2 - 1);
  scene.add(alarm);

  // gardes immobiles derrière le grillage
  const guardMat = new THREE.MeshStandardMaterial({ color: '#0d0d10', roughness: 0.8 });
  for (let k = 0; k < 10; k++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.3, 10), guardMat));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), guardMat);
    head.position.y = 0.85;
    g.add(head);
    const side = k % 4;
    const t = ((k * 0.37) % 1) - 0.5;
    if (side === 0) g.position.set(t * W, 0.65, -D / 2 - 1.2);
    else if (side === 1) g.position.set(t * W, 0.65, D / 2 + 1.2);
    else if (side === 2) g.position.set(-W / 2 - 1.2, 0.65, t * D);
    else g.position.set(W / 2 + 1.2, 0.65, t * D);
    scene.add(g);
  }

  // neige
  const N = 1200;
  const snowPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 30; snowPos[i * 3 + 1] = Math.random() * 10; snowPos[i * 3 + 2] = (Math.random() - 0.5) * 22; }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  scene.add(new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#e2e8f0', size: 0.04, transparent: true, opacity: 0.8, depthWrite: false })));

  // ---------- combattants ----------
  const fighters = new Map();
  for (const id of meta.ids) {
    const p = players.find((x) => x.id === id);
    const g = new THREE.Group();
    const model = playerModel(roomId, p);
    if (p?.skin?.type === 'character' && model.children[0]) model.children[0].visible = false; // pas de socle
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    model.scale.setScalar(MODEL_SCALE);
    g.add(model);
    const weapons = weaponMeshes();
    const hand = new THREE.Group();
    hand.position.set(-0.32, 1.0, 0.25); // main droite (le modèle regarde vers +z)
    for (const w of Object.values(weapons)) { w.traverse((o) => { if (o.isMesh) o.castShadow = true; }); hand.add(w); }
    g.add(hand);
    const tag = nameTag(p?.name || '?', p?.color || '#fff');
    tag.position.y = 2.15;
    g.add(tag);
    const hurt = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff0000', transparent: true, opacity: 0, depthWrite: false }));
    hurt.position.y = 1.0;
    hurt.scale.y = 1.8;
    g.add(hurt);
    scene.add(g);
    fighters.set(id, { g, model, hand, weapons, tag, hurt, pos: null, yaw: 0, flash: 0, swingT: 0, dead: false, deadT: 0 });
  }

  // arme vue à la première personne
  const view = weaponMeshes();
  const viewHand = new THREE.Group();
  viewHand.position.set(0.22, -0.2, -0.42);
  for (const w of Object.values(view)) { w.rotation.y = Math.PI; viewHand.add(w); }
  const skinMat = new THREE.MeshStandardMaterial({ color: '#d9a37c', roughness: 0.7 });
  const fist = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), skinMat);
  fist.position.set(0, -0.06, 0.05);
  viewHand.add(fist);
  camera.add(viewHand);
  const muzzleLight = new THREE.PointLight('#ffb347', 0, 8, 2);
  scene.add(muzzleLight);

  // caisses d'armes
  const crates = [];
  const crateMat = new THREE.MeshStandardMaterial({ color: '#6b4f2a', roughness: 0.8 });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const getCrate = (i) => {
    if (!crates[i]) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.4), crateMat);
      box.position.y = 0.3;
      box.castShadow = true;
      g.add(box);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 32), glowMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      g.add(ring);
      const gun = weaponMeshes().shotgun;
      gun.position.set(0, 0.56, 0);
      gun.rotation.y = Math.PI / 2;
      g.add(gun);
      scene.add(g);
      crates[i] = g;
    }
    return crates[i];
  };

  // balles
  const bulletGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const bulletMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
  const pelletMat = new THREE.MeshBasicMaterial({ color: '#fb923c' });
  const bullets = [];

  // ---------- sang ----------
  const dropGeo = new THREE.SphereGeometry(1, 6, 4);
  const dropMat = new THREE.MeshBasicMaterial({ color: '#9b0d0d' });
  const decalGeo = new THREE.CircleGeometry(1, 12);
  const decalMats = ['#7a0606', '#8f0b0b', '#5a0303'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const chunkMats = [new THREE.MeshStandardMaterial({ color: '#5e0808', roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.5 })];
  const chunkGeo = new THREE.BoxGeometry(1, 0.6, 0.8);
  const parts = [];
  const decals = [];
  let decalY = 0.004;
  const stain = (x, z, r, mat) => {
    const m = new THREE.Mesh(decalGeo, mat || decalMats[Math.floor(Math.random() * 3)]);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI;
    m.scale.set(r, r * (0.6 + Math.random() * 0.4), 1);
    decalY = decalY > 0.02 ? 0.004 : decalY + 0.00003;
    m.position.set(x, decalY, z);
    scene.add(m);
    decals.push(m);
    if (decals.length > 700) { const old = decals.shift(); scene.remove(old); }
  };
  const spray = (origin, dir, n, force = 1, spread = 0.6) => {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dir.z, dir.x) + (Math.random() - 0.5) * 2 * spread;
      const sp = (2 + Math.random() * 5) * force;
      const m = new THREE.Mesh(dropGeo, dropMat);
      const r = 0.012 + Math.random() * 0.025;
      m.scale.setScalar(r);
      m.position.copy(origin);
      scene.add(m);
      parts.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, 0.5 + Math.random() * 2.5, Math.sin(a) * sp), r, kind: 'drop' });
    }
  };
  const gore = (origin, dir) => {
    spray(origin, dir, 140, 1.4, Math.PI);
    for (let i = 0; i < 16; i++) {
      const bone = i % 5 === 0;
      const m = new THREE.Mesh(chunkGeo, chunkMats[bone ? 1 : 0]);
      const s = 0.04 + Math.random() * 0.07;
      m.scale.setScalar(s);
      m.position.copy(origin);
      m.castShadow = true;
      scene.add(m);
      const a = Math.atan2(dir.z, dir.x) + (Math.random() - 0.5) * 2.6;
      const sp = 2 + Math.random() * 5;
      parts.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp), spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), kind: 'chunk', r: s, bone });
    }
    pool = { x: origin.x, z: origin.z, r: 0.1 };
  };
  let pool = null;
  let poolMesh = null;

  // ---------- état local ----------
  let slow = 0;
  let shake = 0;
  let deathFocus = null;
  let specAngle = 0;
  const camPos = new THREE.Vector3(0, 7, 9);
  const camLook = new THREE.Vector3();
  let viewKick = 0;
  let viewSwing = 0;
  let bobT = 0;

  const dirOf = (a) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a));

  // évènements envoyés par le serveur
  function onEvent(e, s) {
    const f = s.fighters.find((x) => x.id === (e.victim || e.pid));
    if (e.type === 'hit' && f) {
      const p = to3(f.x, f.y);
      p.y = 1.05 + Math.random() * 0.45;
      const slash = e.kind === 'slash';
      spray(p, dirOf(e.a), slash ? 45 : e.kind === 'shotgun' ? 14 : 16, slash ? 1.2 : 1, slash ? 0.9 : 0.5);
      const fr = fighters.get(e.victim);
      if (fr) fr.flash = 0.15;
      if (slash && fr) fr.spray = 0.5;
      fr && (fr.sprayDir = e.a);
      shake = Math.max(shake, slash ? 0.12 : 0.05);
    } else if (e.type === 'shot' && f) {
      const p = to3(f.x, f.y).add(dirOf(e.a).multiplyScalar(0.6));
      muzzleLight.position.set(p.x, 1.3, p.z);
      muzzleLight.intensity = e.kind === 'shotgun' ? 40 : 18;
      if (e.pid === me) viewKick = e.kind === 'shotgun' ? 1 : 0.5;
    } else if (e.type === 'swing') {
      const fr = fighters.get(e.pid);
      if (fr) fr.swingT = 0.22;
      if (e.pid === me) viewSwing = 0.22;
    } else if (e.type === 'death') {
      const fr = fighters.get(e.victim);
      const p = to3(e.x, e.y);
      p.y = 1.0;
      gore(p, dirOf(e.a));
      if (fr) { fr.dead = true; fr.deadDir = e.a; }
      slow = 2.2;
      shake = 0.25;
      deathFocus = p;
    }
  }

  // s : dernier état du combat ; yaw/pitch : regard local (vue à la première personne) ; dt : temps écoulé
  function render(s, yaw, realDt, pitch = 0) {
    slow = Math.max(0, slow - realDt);
    const dt = realDt * (slow > 0 ? 0.3 : 1);
    const t = performance.now() / 1000;
    if (!s) { renderer.render(scene, camera); return; }

    // combattants : position lissée, orientation, arme en main, mort
    for (const f of s.fighters) {
      const fr = fighters.get(f.id);
      if (!fr) continue;
      const target = to3(f.x, f.y);
      if (!fr.pos) fr.pos = target.clone();
      fr.pos.lerp(target, Math.min(1, realDt * 18));
      const a = f.id === me && yaw != null ? yaw : f.angle;
      fr.yaw = a;
      fr.g.position.copy(fr.pos);
      if (!fr.dead) fr.g.rotation.set(0, Math.PI / 2 - a, 0);
      fr.tag.userData.draw(f.hp);
      fr.tag.visible = !fr.dead;
      // arme visible : machette pendant le coup, sinon arme à feu
      fr.swingT = Math.max(0, fr.swingT - dt);
      const swinging = fr.swingT > 0;
      fr.weapons.machete.visible = swinging;
      fr.weapons.pistol.visible = !swinging && f.weapon !== 'shotgun';
      fr.weapons.shotgun.visible = !swinging && f.weapon === 'shotgun';
      fr.hand.rotation.set(0, swinging ? -1.2 + (1 - fr.swingT / 0.22) * 2.4 : 0, 0);
      fr.hand.visible = !fr.dead;
      // touché : halo rouge ; giclée artérielle après la machette
      fr.flash = Math.max(0, fr.flash - realDt);
      fr.hurt.material.opacity = fr.flash > 0 ? 0.35 : 0;
      if (fr.spray > 0 && !fr.dead) {
        fr.spray -= dt;
        spray(new THREE.Vector3(fr.pos.x, 1.4, fr.pos.z), dirOf(fr.sprayDir || 0), 3, 1.1, 0.4);
      }
      // traînée de sang quand on saigne
      if ((f.bleeding || f.hp < 30) && !fr.dead && Math.random() < 0.15) stain(fr.pos.x + (Math.random() - 0.5) * 0.3, fr.pos.z + (Math.random() - 0.5) * 0.3, 0.03 + Math.random() * 0.05);
      // mort : le corps bascule en arrière et s'effondre
      if (fr.dead) {
        fr.deadT = Math.min(1, fr.deadT + dt * 2.2);
        const k = 1 - (1 - fr.deadT) ** 3;
        fr.g.rotation.set(0, Math.PI / 2 - (fr.deadDir ?? a), 0);
        fr.model.rotation.x = -k * Math.PI / 2;
        fr.model.position.y = k * 0.25;
      }
      // le combattant à la première personne ne voit pas son propre corps
      fr.model.visible = !(f.id === me && !fr.dead && yaw != null);
      if (f.id === me && yaw != null) fr.hand.visible = false;
    }

    // caisses
    (s.pickups || []).forEach(([px, py], i) => {
      const g = getCrate(i);
      const p = to3(px, py);
      g.visible = true;
      g.position.set(p.x, Math.sin(t * 3) * 0.04, p.z);
      g.rotation.y = t;
    });
    for (let i = (s.pickups || []).length; i < crates.length; i++) crates[i].visible = false;

    // balles
    s.bullets.forEach(([bx, by, sh], i) => {
      if (!bullets[i]) { bullets[i] = new THREE.Mesh(bulletGeo, bulletMat); scene.add(bullets[i]); }
      const b = bullets[i];
      const p = to3(bx, by);
      b.position.set(p.x, 1.25, p.z);
      b.material = sh ? pelletMat : bulletMat;
      b.visible = true;
    });
    for (let i = s.bullets.length; i < bullets.length; i++) bullets[i].visible = false;
    muzzleLight.intensity *= Math.pow(0.0005, realDt);

    // particules de sang et morceaux
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.v.y -= 9.8 * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.spin) { p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; }
      if (p.m.position.y <= p.r * 0.5) {
        if (p.kind === 'drop') {
          stain(p.m.position.x, p.m.position.z, p.r * (3 + Math.random() * 3));
          scene.remove(p.m);
          parts.splice(i, 1);
        } else {
          // les morceaux rebondissent puis restent au sol
          p.m.position.y = p.r * 0.5;
          p.v.multiplyScalar(0.35);
          p.v.y = Math.abs(p.v.y) * 0.3;
          if (p.v.length() < 0.3) { stain(p.m.position.x, p.m.position.z, p.r * 2.5); p.spin = null; parts.splice(i, 1); }
        }
      }
    }
    // flaque qui s'étend sous le corps
    if (pool && pool.r < 1.1) {
      pool.r += dt * 0.35;
      if (!poolMesh) {
        poolMesh = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: '#4d0202', transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
        poolMesh.rotation.x = -Math.PI / 2;
        poolMesh.position.set(pool.x, 0.025, pool.z);
        scene.add(poolMesh);
      }
      poolMesh.scale.set(pool.r, pool.r * 0.8, 1);
    }

    // neige
    const sp = snowGeo.attributes.position;
    for (let i = 0; i < N; i++) { let y = sp.getY(i) - 0.012; if (y < 0) y += 10; sp.setY(i, y); }
    sp.needsUpdate = true;
    alarm.intensity = s.phase === 'fight' && s.timeLeft < 10 ? 25 * (0.5 + 0.5 * Math.sin(t * 8)) : 0;

    // ---------- caméra ----------
    const mine = s.fighters.find((f) => f.id === me);
    const myFr = fighters.get(me);
    const firstPerson = mine && yaw != null && myFr && !myFr.dead;
    viewHand.visible = !!firstPerson;
    shake *= Math.pow(0.01, realDt);
    if (firstPerson) {
      const moving = myFr.lastPos ? myFr.lastPos.distanceTo(myFr.pos) > 0.002 : false;
      myFr.lastPos = myFr.pos.clone();
      if (moving) bobT += realDt * 9;
      const eye = myFr.pos.clone();
      eye.y = EYE + (moving ? Math.abs(Math.sin(bobT)) * 0.035 : 0) - (mine.hp < 25 ? 0.12 : 0);
      camera.position.copy(eye).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
      // regard : cap (yaw) et inclinaison verticale (pitch, purement visuel : le combat se joue au sol)
      const cp = Math.cos(pitch);
      camera.lookAt(eye.clone().add(new THREE.Vector3(Math.cos(yaw) * cp, Math.sin(pitch) - 0.02, Math.sin(yaw) * cp)));
      camera.fov = 72;
      // arme : recul, coup de machette, balancement
      viewKick = Math.max(0, viewKick - realDt * 6);
      viewSwing = Math.max(0, viewSwing - realDt);
      const swinging = viewSwing > 0;
      view.machete.visible = swinging;
      view.pistol.visible = !swinging && mine.weapon !== 'shotgun';
      view.shotgun.visible = !swinging && mine.weapon === 'shotgun';
      viewHand.position.set(0.22 + (swinging ? -0.25 + (1 - viewSwing / 0.22) * 0.5 : 0), -0.2 + Math.sin(bobT) * 0.01, -0.42 + viewKick * 0.08);
      viewHand.rotation.set(viewKick * 0.4, swinging ? 1.3 - (1 - viewSwing / 0.22) * 2.6 : 0, swinging ? -0.6 : 0);
    } else {
      // caméra de retransmission : vue plongeante qui tourne lentement autour de l'action
      const alive = s.fighters.map((f) => fighters.get(f.id)).filter(Boolean);
      const mid = alive.reduce((acc, fr) => acc.add(fr.pos || new THREE.Vector3()), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, alive.length));
      const spread = alive.length === 2 && alive[0].pos && alive[1].pos ? alive[0].pos.distanceTo(alive[1].pos) : 4;
      specAngle += realDt * 0.12;
      let want;
      let look;
      if (deathFocus) {
        // ralenti : la caméra descend sur le corps
        want = deathFocus.clone().add(new THREE.Vector3(Math.cos(specAngle) * 2.6, 1.6, Math.sin(specAngle) * 2.6));
        look = deathFocus.clone().setY(0.4);
      } else {
        const dist = 6 + spread * 0.55;
        want = mid.clone().add(new THREE.Vector3(Math.cos(specAngle) * dist, 4.2 + spread * 0.3, Math.sin(specAngle) * dist));
        look = mid.clone().setY(0.9);
      }
      const k = 1 - Math.pow(0.05, realDt);
      camPos.lerp(want, k);
      camLook.lerp(look, k);
      camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
      camera.lookAt(camLook);
      camera.fov = 50;
    }
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

  return { render, onEvent, resize, dispose, canvas: renderer.domElement };
}
