// Décors 3D autour du plateau, selon le thème : ciel, sol et environnement (ville, parc, océan, néon, désert).
import * as THREE from 'three';

// Aléatoire déterministe : le décor est identique à chaque chargement
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUND_Y = -0.33;
// le coin du plateau est à ~9 unités du centre : aucun décor ne doit empiéter en deçà
const CLEAR = 10.8;
const BOARD_POINTS = [-6, 0, 6].flatMap((x) => [-6, 0, 6].map((z) => new THREE.Vector3(x, 0.1, z)));

function polar(rand, rMin, rMax) {
  const a = rand() * Math.PI * 2;
  const r = rMin + rand() * (rMax - rMin);
  return [Math.cos(a) * r, Math.sin(a) * r, a];
}

function skyDome(top, bottom) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vPos; void main(){ float h = clamp(normalize(vPos).y * 1.4 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(95, 32, 16), mat);
}

function stars(rand) {
  const pos = [];
  for (let i = 0; i < 700; i++) {
    const a = rand() * Math.PI * 2;
    const y = 0.15 + rand() * 0.85;
    const r = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * r * 88, y * 88, Math.sin(a) * r * 88);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
}

function ground(color) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(95, 64), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = GROUND_Y;
  m.receiveShadow = true;
  return m;
}

function windowTexture(rand, night) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = night ? '#120e22' : '#9fb3c8';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const lit = rand() < (night ? 0.45 : 0.9);
      ctx.fillStyle = night ? (lit ? (rand() < 0.8 ? '#ffd27a' : '#9ad8ff') : '#1d1834') : (lit ? '#d9ecfa' : '#6e8aa6');
      ctx.fillRect(4 + x * 15, 5 + y * 15, 10, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Un bâtiment qui peut masquer le plateau : il devient transparent quand il est entre la caméra et le plateau
function addOccluder(occluders, objects) {
  const box = new THREE.Box3();
  const mats = new Set();
  for (const o of objects) {
    o.updateMatrixWorld(true);
    box.expandByObject(o);
    o.traverse((c) => {
      const list = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
      list.forEach((m) => mats.add(m));
    });
  }
  box.expandByScalar(0.3);
  occluders.push({ box, mats: [...mats], objects, opacity: 1 });
}

// ---------- ville (nuit) ----------
function city(g, rand, sc, updaters, occluders) {
  const palette = ['#2a2346', '#1f1a38', '#352b5c', '#241e40', '#2e2750'];
  const roofMat = new THREE.MeshStandardMaterial({ color: '#15112a', roughness: 0.9 });
  const lights = [];
  for (let i = 0; i < 95; i++) {
    const [x, z] = polar(rand, 15, 38);
    const w = 1 + rand() * 1.8;
    const d = 1 + rand() * 1.8;
    const h = 2 + rand() ** 1.6 * 11;
    const tex = windowTexture(rand, sc.night).clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h / 2.2)));
    const side = new THREE.MeshStandardMaterial({
      color: palette[i % palette.length], map: tex, roughness: 0.7,
      emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: sc.night ? 0.85 : 0,
    });
    const roof = roofMat.clone();
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]);
    const parts = [b];
    b.position.set(x, GROUND_Y + h / 2, z);
    b.rotation.y = rand() * Math.PI;
    g.add(b);
    if (h > 8) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), roof);
      ant.position.set(x, GROUND_Y + h + 0.6, z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b3b' }));
      lamp.position.set(x, GROUND_Y + h + 1.25, z);
      g.add(ant, lamp);
      parts.push(ant, lamp);
      lights.push({ lamp, phase: rand() * 6 });
    }
    addOccluder(occluders, parts);
  }
  // routes éclairées autour du plateau
  const road = new THREE.Mesh(new THREE.RingGeometry(8, 9.6, 64), new THREE.MeshStandardMaterial({ color: '#1b1730', roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = GROUND_Y + 0.01;
  g.add(road);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4), roofMat);
    lampPost.position.set(Math.cos(a) * 10, GROUND_Y + 0.7, Math.sin(a) * 10);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe3a3' }));
    bulb.position.set(Math.cos(a) * 10, GROUND_Y + 1.45, Math.sin(a) * 10);
    g.add(lampPost, bulb);
  }
  updaters.push((t) => {
    for (const l of lights) l.lamp.visible = Math.sin(t * 3 + l.phase) > 0;
  });
}

// ---------- parc (jour) ----------
function tree(rand) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#6b4423' }));
  trunk.position.y = 0.45;
  t.add(trunk);
  const greens = ['#2f7d32', '#3e8e41', '#4caf50', '#2e6b30'];
  const mat = new THREE.MeshStandardMaterial({ color: greens[Math.floor(rand() * greens.length)], roughness: 0.9, flatShading: true });
  if (rand() < 0.5) {
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.8 - k * 0.2, 1, 8), mat);
      c.position.y = 1.1 + k * 0.55;
      t.add(c);
    }
  } else {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), mat);
    s.position.y = 1.4;
    t.add(s);
  }
  const k = 0.8 + rand() * 0.9;
  t.scale.set(k, k, k);
  return t;
}

function park(g, rand, updaters) {
  for (let i = 0; i < 130; i++) {
    const [x, z] = polar(rand, CLEAR + 0.6, 40);
    const t = tree(rand);
    t.position.set(x, GROUND_Y, z);
    g.add(t);
  }
  const houseColors = ['#f4e1c1', '#f8c8a0', '#e8eef5', '#f3d9e3', '#fff2b3'];
  for (let i = 0; i < 16; i++) {
    const [x, z, a] = polar(rand, 14, 30);
    const h = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.1), new THREE.MeshStandardMaterial({ color: houseColors[i % houseColors.length] }));
    body.position.y = 0.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.8, 4), new THREE.MeshStandardMaterial({ color: '#b5442c', flatShading: true }));
    roof.position.y = 1.4;
    roof.rotation.y = Math.PI / 4;
    h.add(body, roof);
    h.position.set(x, GROUND_Y, z);
    h.rotation.y = -a;
    g.add(h);
  }
  // allée autour du plateau
  const path = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.8, 64), new THREE.MeshStandardMaterial({ color: '#d8c7a0', roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.position.y = GROUND_Y + 0.01;
  g.add(path);
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 14; i++) {
    const [x, z] = polar(rand, 18, 50);
    const c = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1 + rand() * 1.2, 12, 8), cloudMat);
      s.position.set((rand() - 0.5) * 4, rand() * 0.8, (rand() - 0.5) * 2);
      c.add(s);
    }
    c.position.set(x, 14 + rand() * 8, z);
    clouds.add(c);
  }
  g.add(clouds);
  updaters.push((t) => { clouds.rotation.y = t * 0.01; });
}

// ---------- océan ----------
function palm(rand) {
  const p = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', flatShading: true });
  const lean = (rand() - 0.5) * 0.5;
  for (let k = 0; k < 5; k++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 6), trunkMat);
    seg.position.set(lean * k * 0.25, 0.22 + k * 0.42, 0);
    seg.rotation.z = -lean * 0.4;
    p.add(seg);
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2f9e44', side: THREE.DoubleSide, flatShading: true });
  for (let k = 0; k < 6; k++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 4), leafMat);
    leaf.scale.set(1, 1, 0.25);
    leaf.position.set(lean * 1.2, 2.15, 0);
    leaf.rotation.set(Math.PI / 2.6, (k / 6) * Math.PI * 2, 0, 'YXZ');
    leaf.translateY(0.5);
    p.add(leaf);
  }
  const k = 0.8 + rand() * 0.5;
  p.scale.set(k, k, k);
  return p;
}

function ocean(g, rand, sc, updaters) {
  const geo = new THREE.PlaneGeometry(200, 200, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: sc.ground, roughness: 0.18, metalness: 0.25, flatShading: true }));
  water.position.y = GROUND_Y - 0.05;
  g.add(water);
  const base = geo.attributes.position.array.slice();
  let frame = 0;
  updaters.push((t) => {
    if (frame++ % 2) return;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] = Math.sin(x * 0.35 + t * 1.2) * 0.12 + Math.cos(z * 0.28 + t * 0.9) * 0.1;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  });
  // île sous le plateau
  const sand = new THREE.MeshStandardMaterial({ color: '#e8d3a2', roughness: 1 });
  const island = new THREE.Mesh(new THREE.CylinderGeometry(12, 13.8, 0.7, 48), sand);
  island.position.y = GROUND_Y - 0.2;
  g.add(island);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.3;
    const p = palm(rand);
    const pr = CLEAR + rand() * 0.8;
    p.position.set(Math.cos(a) * pr, GROUND_Y + 0.15, Math.sin(a) * pr);
    g.add(p);
  }
  // îles lointaines
  for (let i = 0; i < 7; i++) {
    const [x, z] = polar(rand, 22, 45);
    const s = 2 + rand() * 3;
    const isl = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), sand);
    isl.scale.y = 0.3;
    isl.position.set(x, GROUND_Y - 0.1, z);
    g.add(isl);
    for (let k = 0; k < 3; k++) {
      const p = palm(rand);
      p.position.set(x + (rand() - 0.5) * s, GROUND_Y + s * 0.2, z + (rand() - 0.5) * s);
      g.add(p);
    }
  }
  // bateaux
  const boats = [];
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: i % 2 ? '#7c2d12' : '#f8fafc' }));
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 3), new THREE.MeshStandardMaterial({ color: '#fefce8', flatShading: true }));
    sail.position.set(0.1, 0.85, 0);
    sail.scale.z = 0.2;
    b.add(hull, sail);
    const r = 13 + rand() * 22;
    const a = rand() * Math.PI * 2;
    const speed = (0.02 + rand() * 0.03) * (rand() < 0.5 ? 1 : -1);
    g.add(b);
    boats.push({ b, r, a, speed, phase: rand() * 6 });
  }
  updaters.push((t) => {
    for (const o of boats) {
      const a = o.a + t * o.speed;
      o.b.position.set(Math.cos(a) * o.r, GROUND_Y + 0.05 + Math.sin(t * 1.5 + o.phase) * 0.08, Math.sin(a) * o.r);
      o.b.rotation.y = -a + (o.speed > 0 ? Math.PI : 0);
      o.b.rotation.z = Math.sin(t * 1.3 + o.phase) * 0.06;
    }
  });
}

// ---------- néon ----------
function neon(g, rand, updaters, occluders) {
  const grid = new THREE.GridHelper(190, 95, '#ec4899', '#22d3ee');
  grid.position.y = GROUND_Y + 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  g.add(grid);
  const colors = ['#ec4899', '#22d3ee', '#a855f7', '#f472b6', '#34d399'];
  const dark = new THREE.MeshStandardMaterial({ color: '#0b0816', roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 85; i++) {
    const [x, z] = polar(rand, 15, 40);
    const w = 1 + rand() * 1.8;
    const d = 1 + rand() * 1.8;
    const h = 2 + rand() ** 1.5 * 13;
    const geo = new THREE.BoxGeometry(w, h, d);
    const b = new THREE.Mesh(geo, dark.clone());
    b.position.set(x, GROUND_Y + h / 2, z);
    b.rotation.y = rand() * Math.PI;
    const col = colors[i % colors.length];
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col }));
    b.add(edges);
    // bandes lumineuses sur la façade
    const stripeMat = new THREE.MeshBasicMaterial({ color: col });
    for (let k = 1; k < h / 2.5; k++) {
      if (rand() < 0.5) continue;
      const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.06, d + 0.02), stripeMat);
      s.position.y = -h / 2 + k * 2.5;
      b.add(s);
    }
    g.add(b);
    addOccluder(occluders, [b]);
  }
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const [x, z] = polar(rand, 18, 32);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5 + rand() * 2, 0.07, 8, 64), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    ring.position.set(x, 10 + rand() * 8, z);
    g.add(ring);
    rings.push({ ring, speed: 0.3 + rand() * 0.5 });
  }
  updaters.push((t) => {
    for (const r of rings) { r.ring.rotation.x = t * r.speed; r.ring.rotation.y = t * r.speed * 0.7; }
    grid.material.opacity = 0.22 + Math.sin(t * 1.5) * 0.06;
  });
}

// ---------- désert ----------
function desert(g, rand) {
  const sandColors = ['#d9a865', '#e0b373', '#cf9a55', '#e6bd80'];
  for (let i = 0; i < 34; i++) {
    const s = 3 + rand() * 6;
    // la dune (étirée ×1.4) reste entièrement hors du plateau
    const [x, z] = polar(rand, CLEAR + s * 1.4, 55);
    const dune = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: sandColors[i % sandColors.length], roughness: 1 }));
    dune.scale.set(1.4, 0.2 + rand() * 0.15, 1);
    dune.rotation.y = rand() * Math.PI;
    dune.position.set(x, GROUND_Y - 0.05, z);
    g.add(dune);
  }
  const stone = new THREE.MeshStandardMaterial({ color: '#c9955a', roughness: 0.95, flatShading: true });
  [[-26, -30, 8], [-14, -38, 6], [-36, -18, 5]].forEach(([x, z, s]) => {
    const p = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.95, 4), stone);
    p.position.set(x, GROUND_Y + (s * 0.95) / 2, z);
    p.rotation.y = Math.PI / 4;
    g.add(p);
  });
  const cactusMat = new THREE.MeshStandardMaterial({ color: '#4d7c3a', roughness: 0.8 });
  for (let i = 0; i < 32; i++) {
    const [x, z] = polar(rand, CLEAR, 35);
    const c = new THREE.Group();
    const h = 1 + rand() * 1.4;
    const main = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, h, 4, 8), cactusMat);
    main.position.y = h / 2 + 0.14;
    c.add(main);
    for (const side of [-1, 1]) {
      if (rand() < 0.35) continue;
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), cactusMat);
      arm.position.set(side * 0.28, h * (0.45 + rand() * 0.3), 0);
      c.add(arm);
      const join = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25), cactusMat);
      join.rotation.z = Math.PI / 2;
      join.position.set(side * 0.15, arm.position.y - 0.2, 0);
      c.add(join);
    }
    c.position.set(x, GROUND_Y, z);
    c.rotation.y = rand() * Math.PI;
    g.add(c);
  }
  const rockMat = new THREE.MeshStandardMaterial({ color: '#9a6a3a', flatShading: true });
  for (let i = 0; i < 22; i++) {
    const [x, z] = polar(rand, CLEAR, 40);
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.7, 0), rockMat);
    r.position.set(x, GROUND_Y + 0.1, z);
    r.scale.y = 0.6;
    g.add(r);
  }
  const sun = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffe0a3', fog: false }));
  sun.position.set(45, 9, -65);
  g.add(sun);
}

export function buildScenery(sc) {
  const rand = seeded(42);
  const group = new THREE.Group();
  const updaters = [];
  const occluders = [];
  group.add(skyDome(sc.skyTop, sc.skyBottom));
  if (sc.stars) group.add(stars(rand));
  if (sc.decor !== 'ocean') group.add(ground(sc.ground));
  if (sc.decor === 'city') city(group, rand, sc, updaters, occluders);
  if (sc.decor === 'park') park(group, rand, updaters);
  if (sc.decor === 'ocean') ocean(group, rand, sc, updaters);
  if (sc.decor === 'neon') neon(group, rand, updaters, occluders);
  if (sc.decor === 'desert') desert(group, rand);
  return {
    group,
    update: (t) => { for (const u of updaters) u(t); },
    // estompe les bâtiments qui cachent le plateau : lignes de vue de la caméra vers 9 points du plateau
    fadeOccluders(camera, target, dt) {
      if (!occluders.length) return;
      const cam = camera.position;
      const rays = BOARD_POINTS.map((p) => {
        const q = p.clone().add(new THREE.Vector3(target.x, 0, target.z));
        return { ray: new THREE.Ray(cam.clone(), q.clone().sub(cam).normalize()), dist: cam.distanceTo(q) };
      });
      const hit = new THREE.Vector3();
      const k = Math.min(1, dt * 8);
      for (const o of occluders) {
        const blocking = o.box.distanceToPoint(cam) < 2
          || rays.some(({ ray, dist }) => ray.intersectBox(o.box, hit) && cam.distanceTo(hit) < dist);
        // un bâtiment qui gêne s'efface complètement (fondu), puis réapparaît quand la vue est dégagée
        const goal = blocking ? 0 : 1;
        if (Math.abs(o.opacity - goal) < 0.005) continue;
        o.opacity += (goal - o.opacity) * k;
        if (Math.abs(o.opacity - goal) < 0.01) o.opacity = goal;
        for (const obj of o.objects) obj.visible = o.opacity > 0.02;
        for (const m of o.mats) {
          if (m.transparent !== o.opacity < 1) m.needsUpdate = true;
          m.transparent = o.opacity < 1;
          m.depthWrite = o.opacity >= 1;
          m.opacity = o.opacity;
        }
      }
    },
    dispose: () => {
      group.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { m.map?.dispose(); m.dispose(); }
      });
    },
  };
}
