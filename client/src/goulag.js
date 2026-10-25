// Cinématique du départ au goulag : de nuit, sous la neige, le joueur est conduit vers un bâtiment
// de béton barbelé par trois costauds en costard noir, furieux ; devant la porte, deux autres costauds
// en costard et lunettes noires l'attendent bras croisés. La porte se referme derrière lui.
import * as THREE from 'three';
import { buildCharacter, DEFAULT_CHARACTER } from './characters.js';
import { playerModel } from './skin3d.js';

export const GOULAG_DURATION = 12.2;
export const T_GUARDS = 5.2; // plan sur les gardes de la porte
export const T_DOOR = 10.2; // la porte se referme

const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

const DOOR_Z = -4;
const START_Z = 7;
const STOP_Z = -3.25; // le joueur s'arrête devant la porte
const T_WALK = [1.4, 9.0];

// costards : carrure de bodybuilder, crâne rasé, mine furieuse
const SUIT = {
  ...DEFAULT_CHARACTER, build: 'muscular', height: 1.06, top: 'suit', topColor: '#0f0f12', topColor2: '#f2f2f2', topColor3: '#0a0a0a',
  pants: '#0f0f12', shoes: '#050505', beard: 'none',
};
const escortLook = (k) => ({ ...SUIT, skin: ['#e9c3a3', '#c99a76', '#a8714f'][k], hair: ['buzz', 'bald', 'buzz'][k], hairColor: '#1c1410', beard: k === 1 ? 'stubble' : 'none', beardColor: '#1c1410', extras: ['angry'] });
const guardLook = (k) => ({ ...SUIT, skin: ['#f1c7a5', '#7a4e33'][k], hair: k ? 'bald' : 'slick', hairColor: '#111111', glasses: 'sun', lensColor: '#050505', extras: ['angry', 'crossed'] });

function figure(cfg) {
  const g = new THREE.Group();
  buildCharacter(g, cfg, '#111111');
  g.children[0].visible = false; // pas de socle de pion : ils marchent sur la neige
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.7);
  return g;
}

function plaque() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#2a0d0d';
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = '#7f1d1d';
  x.lineWidth = 10;
  x.strokeRect(5, 5, 502, 118);
  x.fillStyle = '#e5e7eb';
  x.font = '900 82px Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('ГУЛАГ', 256, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildCamp(scene) {
  // sol enneigé
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), std('#a9adb5', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // chemin piétiné jusqu'à la porte
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 14), std('#6b6f78', { roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.005, 2.5);
  path.receiveShadow = true;
  scene.add(path);

  // bâtiment de béton
  const concrete = std('#5b5e66', { roughness: 0.95 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 5), concrete);
  block.position.set(0, 2, DOOR_Z - 2.5);
  block.castShadow = block.receiveShadow = true;
  scene.add(block);
  // bandes plus sombres et fenêtres grillagées
  for (const y of [1.2, 2.9]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(10.02, 0.08, 5.02), std('#3f4148'));
    band.position.set(0, y, DOOR_Z - 2.5);
    scene.add(band);
  }
  for (const x of [-3.6, -2.2, 2.2, 3.6]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.05), std('#111214', { emissive: '#3b2a0a', emissiveIntensity: 0.25 }));
    win.position.set(x, 2.5, DOOR_Z + 0.01);
    scene.add(win);
    for (let b = -1; b <= 1; b++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.04), std('#2b2d33', { metalness: 0.6 }));
      bar.position.set(x + b * 0.18, 2.5, DOOR_Z + 0.04);
      scene.add(bar);
    }
  }
  // embrasure sombre et porte d'acier
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.1), new THREE.MeshBasicMaterial({ color: '#030304' }));
  hole.position.set(0, 1.15, DOOR_Z + 0.02);
  scene.add(hole);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.35, 0.12), std('#3a3d44', { metalness: 0.7, roughness: 0.45 }));
  door.position.set(-1.6, 1.17, DOOR_Z + 0.1);
  door.castShadow = true;
  scene.add(door);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshStandardMaterial({ map: plaque(), roughness: 0.7 }));
  sign.position.set(0, 2.75, DOOR_Z + 0.03);
  scene.add(sign);
  // lampe rouge au-dessus de la porte
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.15), std('#ef4444', { emissive: '#ef4444', emissiveIntensity: 2 }));
  lamp.position.set(0, 2.42, DOOR_Z + 0.12);
  scene.add(lamp);
  const red = new THREE.PointLight('#ff2a2a', 18, 7, 1.6);
  red.position.set(0, 2.3, DOOR_Z + 0.6);
  scene.add(red);

  // clôtures barbelées le long du chemin
  const post = std('#2d2a26', { roughness: 0.9 });
  const wire = std('#8a8f99', { metalness: 0.8, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const x = side * 3.4;
    for (let z = DOOR_Z + 0.3; z <= 9; z += 1.6) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), post);
      p.position.set(x, 0.95, z);
      p.castShadow = true;
      scene.add(p);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), post);
      top.position.set(x - side * 0.12, 2.0, z);
      top.rotation.z = side * 0.6;
      scene.add(top);
    }
    for (const y of [0.5, 1.0, 1.5, 1.95]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 13.5, 4), wire);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, y, 2.6);
      scene.add(w);
    }
    // spirale de barbelés au sommet
    const coil = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.01, 260, 6, 40, 3), wire);
    coil.scale.set(1, 1, 18);
    coil.position.set(x - side * 0.2, 2.15, 2.6);
    scene.add(coil);
  }

  // mirador et son projecteur
  const tower = new THREE.Group();
  tower.position.set(-5.6, 0, -1.6);
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.2, 0.12), post);
    leg.position.set(dx, 2.1, dz);
    tower.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.8), std('#3a3530'));
  cabin.position.y = 4.6;
  tower.add(cabin);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 4), std('#24211d'));
  roof.position.y = 5.45;
  roof.rotation.y = Math.PI / 4;
  tower.add(roof);
  scene.add(tower);
  const search = new THREE.SpotLight('#e8f0ff', 90, 30, 0.22, 0.35, 1);
  search.position.set(-5.6, 4.6, -1.6);
  search.castShadow = true;
  scene.add(search, search.target);

  return { door, red, lamp, search };
}

// player : joueur envoyé au goulag ; roomId : pour charger son pion personnalisé
export function createGoulag({ container, player, roomId }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#141821');
  scene.fog = new THREE.Fog('#141821', 7, 26);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
  scene.add(new THREE.HemisphereLight('#8796b8', '#22252e', 1.1));
  const moon = new THREE.DirectionalLight('#a9bde6', 1.4);
  moon.position.set(6, 10, 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(moon);

  const camp = buildCamp(scene);

  // le prisonnier et son escorte
  const prisoner = new THREE.Group();
  const pm = playerModel(roomId, player);
  pm.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  prisoner.add(pm);
  prisoner.scale.setScalar(1.7);
  scene.add(prisoner);
  const escorts = [0, 1, 2].map((k) => {
    const e = figure(escortLook(k));
    scene.add(e);
    return { e, dx: [-0.85, 0.85, 0][k], dz: [0.25, 0.25, 1.05][k], phase: k * 1.3 };
  });
  const guards = [0, 1].map((k) => {
    const gd = figure(guardLook(k));
    gd.position.set(k ? 1.08 : -1.08, 0, DOOR_Z + 0.6);
    scene.add(gd);
    return gd;
  });

  // neige
  const N = 1800;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 24; pos[i * 3 + 1] = Math.random() * 8; pos[i * 3 + 2] = (Math.random() - 0.5) * 24; }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#f1f5f9', size: 0.045, transparent: true, opacity: 0.85, depthWrite: false }));
  scene.add(snow);

  const zAt = (t) => {
    if (t < T_WALK[0]) return START_Z;
    if (t < T_WALK[1]) return START_Z + (STOP_Z - START_Z) * ((t - T_WALK[0]) / (T_WALK[1] - T_WALK[0]));
    // pause devant les gardes, puis il est poussé à l'intérieur
    return STOP_Z + (DOOR_Z - 1.2 - STOP_Z) * ease(clamp01((t - 9.4) / 0.9));
  };
  const walking = (t) => t > T_WALK[0] && t < T_WALK[1];

  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const SHOTS = [
    { until: 2.3, from: [v(-2.6, 3.6, 12.5), v(0, 1.0, 4)], to: [v(-1.8, 2.6, 10.8), v(0, 0.9, 5.5)] },
    { until: T_GUARDS, track: true },
    // contre-plongée sur les deux gardes de la porte, grand angle
    { until: 7.7, fov: 62, from: [v(0.1, 0.42, DOOR_Z + 2.5), v(0, 1.1, DOOR_Z + 0.5)], to: [v(-0.05, 0.38, DOOR_Z + 2.1), v(0, 1.15, DOOR_Z + 0.5)] },
    { until: 9.4, behind: true },
    { until: GOULAG_DURATION + 1, from: [v(0.6, 1.5, 1.2), v(0, 1.2, DOOR_Z)], to: [v(0.3, 1.4, 0.2), v(0, 1.2, DOOR_Z)] },
  ];
  let shotStart = 0;
  const shotAt = (t) => {
    shotStart = 0;
    for (const s of SHOTS) { if (t < s.until) return s; shotStart = s.until; }
    return SHOTS[SHOTS.length - 1];
  };

  function update(t) {
    const z = zAt(t);
    const bob = (ph) => (walking(t) ? Math.abs(Math.sin(t * 7 + ph)) * 0.05 : 0);
    const sway = (ph) => (walking(t) ? Math.sin(t * 7 + ph) * 0.05 : 0);
    // le prisonnier avance vers la porte (les modèles regardent vers +z : on les retourne)
    prisoner.position.set(Math.sin(t * 1.3) * 0.04, bob(0.5), z);
    prisoner.rotation.set(0, Math.PI, sway(0.5));
    prisoner.visible = t < 10.3;
    for (const { e, dx, dz, phase } of escorts) {
      const ez = Math.max(z + dz, STOP_Z + dz);
      e.position.set(dx, bob(phase), t > 9.4 ? STOP_Z + dz + 0.3 : ez);
      e.rotation.set(0, Math.PI, sway(phase));
    }
    // les gardes suivent le prisonnier du regard
    guards.forEach((gd, k) => {
      const head = gd.userData.head;
      if (!head) return;
      const look = Math.atan2(-(gd.position.x - prisoner.position.x), Math.max(0.6, z - gd.position.z));
      head.rotation.y += (Math.max(-0.9, Math.min(0.9, look)) - head.rotation.y) * 0.08;
    });

    // porte qui se referme, lampe qui grésille, projecteur qui balaie
    const close = ease(clamp01((t - T_DOOR) / 0.55));
    camp.door.position.x = -1.6 + 1.6 * close;
    const flicker = Math.random() < 0.06 ? 0.2 : 1;
    camp.red.intensity = 18 * flicker * (0.85 + Math.sin(t * 3) * 0.15);
    camp.lamp.material.emissiveIntensity = 2 * flicker;
    const sweep = t < 6 ? Math.sin(t * 0.9) * 4 : prisoner.position.x;
    camp.search.target.position.set(sweep, 0, t < 6 ? 3 + Math.cos(t * 0.7) * 3 : z);

    // neige qui tombe
    const p = snowGeo.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.getY(i) - 0.012 - (i % 5) * 0.002;
      if (y < 0) y += 8;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t + i) * 0.002);
    }
    p.needsUpdate = true;

    // caméra
    const s = shotAt(t);
    const k = ease(clamp01((t - shotStart) / (s.until - shotStart)));
    let cp;
    let cl;
    if (s.track) {
      // devant le groupe, de trois quarts : on voit les mines furieuses de l'escorte
      cp = v(2.0, 1.25, z - 2.6);
      cl = v(0, 1.0, z + 0.3);
    } else if (s.behind) {
      cp = v(0.55, 1.75, z + 3.6);
      cl = v(0, 1.3, DOOR_Z);
    } else {
      cp = s.from[0].clone().lerp(s.to[0], k);
      cl = s.from[1].clone().lerp(s.to[1], k);
    }
    // caméra à l'épaule, légèrement tremblante
    cp.x += Math.sin(t * 1.7) * 0.03;
    cp.y += Math.sin(t * 2.3) * 0.02;
    camera.position.copy(cp);
    camera.lookAt(cl);
    const fov = s.fov || 38;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
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
