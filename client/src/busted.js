// Cinématique d'arrestation : le pion s'enfuit vers la prison, un policier le course et le plaque au sol,
// puis « BUSTED » façon GTA (le texte et le noir et blanc sont gérés par la page, au signal onBusted).
import * as THREE from 'three';
import { cellCenter, TOTAL } from './layout.js';

const HALF = TOTAL / 2;
const GROUND = 0.14;
export const BUSTED_DURATION = 7.8; // secondes
const T_CHASE = 1.1;
const T_TACKLE = 4.3;
export const T_BUSTED = 4.9;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

function cellWorld(i) {
  const c = cellCenter(((i % 40) + 40) % 40);
  return new THREE.Vector3(c.x - HALF, GROUND, c.y - HALF);
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
}

// Pion fugitif, avec des yeux pour l'expression
function makeRunner(color) {
  const g = new THREE.Group();
  const mat = std(color, { metalness: 0.3, roughness: 0.35 });
  const add = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 24), mat, 0.035);
  add(new THREE.CylinderGeometry(0.07, 0.16, 0.34, 24), mat, 0.24);
  add(new THREE.SphereGeometry(0.12, 24, 16), mat, 0.47);
  const white = std('#ffffff');
  const black = std('#111111');
  for (const x of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), white);
    eye.position.set(x, 0.5, 0.1);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), black);
    pupil.position.set(x, 0.5, 0.13);
    g.add(eye, pupil);
  }
  g.scale.setScalar(1.35);
  return g;
}

// Policier : jambes et bras articulés pour la course
function makeCop() {
  const g = new THREE.Group();
  const navy = std('#1e3a8a');
  const dark = std('#0f172a');
  const skin = std('#f1c27d');
  const box = (w, h, d, m, x, y, z, parent = g) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  const limb = (x, y, m, len) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    box(0.075, len, 0.08, m, 0, -len / 2, 0, pivot);
    g.add(pivot);
    return pivot;
  };
  const legs = [limb(-0.06, 0.3, dark, 0.3), limb(0.06, 0.3, dark, 0.3)];
  box(0.27, 0.3, 0.16, navy, 0, 0.45, 0);
  box(0.28, 0.04, 0.17, dark, 0, 0.32, 0);
  box(0.05, 0.05, 0.02, std('#facc15', { metalness: 0.8, roughness: 0.2 }), -0.07, 0.52, 0.085);
  const arms = [limb(-0.17, 0.58, navy, 0.26), limb(0.17, 0.58, navy, 0.26)];
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), skin);
  head.position.y = 0.71;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.1, 0.07, 20), dark);
  cap.position.y = 0.79;
  g.add(cap);
  box(0.16, 0.015, 0.09, dark, 0, 0.76, 0.09);
  box(0.03, 0.03, 0.01, std('#facc15', { metalness: 0.8 }), 0, 0.8, 0.106);
  g.scale.setScalar(1.35);
  return { g, legs, arms };
}

function makePoliceCar() {
  const g = new THREE.Group();
  const white = std('#f8fafc');
  const blue = std('#1d4ed8');
  const glass = std('#0f172a', { metalness: 0.6, roughness: 0.2 });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  // l'avant de la voiture est vers +z
  box(0.5, 0.22, 1.0, white, 0, 0.2, 0);
  box(0.51, 0.06, 1.01, blue, 0, 0.2, 0);
  box(0.46, 0.18, 0.55, glass, 0, 0.4, -0.05);
  box(0.08, 0.05, 0.02, std('#fef08a', { emissive: '#fef08a', emissiveIntensity: 1 }), -0.15, 0.22, 0.505);
  box(0.08, 0.05, 0.02, std('#fef08a', { emissive: '#fef08a', emissiveIntensity: 1 }), 0.15, 0.22, 0.505);
  for (const [x, z] of [[-0.25, 0.32], [0.25, 0.32], [-0.25, -0.32], [0.25, -0.32]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), std('#111827'));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.1, z);
    g.add(w);
  }
  const red = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 2 });
  const blu = new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: '#3b82f6', emissiveIntensity: 2 });
  box(0.14, 0.06, 0.12, red, -0.08, 0.52, -0.05);
  box(0.14, 0.06, 0.12, blu, 0.08, 0.52, -0.05);
  const pr = new THREE.PointLight('#ff2d2d', 0, 5);
  pr.position.set(-0.1, 0.7, 0);
  const pb = new THREE.PointLight('#2d6bff', 0, 5);
  pb.position.set(0.1, 0.7, 0);
  g.add(pr, pb);
  g.scale.setScalar(1.3);
  return { g, lights: [[red, pr], [blu, pb]] };
}

export function createBustedCinematic({ scene, camera, from, color = '#ef4444', onBusted }) {
  const J = cellWorld(10);
  let S = cellWorld(from);
  // déjà sur la case Prison (trafiquant contrôlé) : la fuite part de l'intérieur du plateau
  if (S.distanceTo(J) < 3) S = J.clone().add(new THREE.Vector3(-J.x, 0, -J.z).normalize().multiplyScalar(6.5)).setY(GROUND);
  const dir = J.clone().sub(S).setY(0).normalize();
  const P = S.clone().lerp(J, 0.72);
  let side = new THREE.Vector3(dir.z, 0, -dir.x);
  // caméra du côté du centre du plateau
  if (P.clone().add(side).length() > P.clone().sub(side).length()) side.negate();

  const group = new THREE.Group();
  scene.add(group);
  const runner = makeRunner(color);
  const cop = makeCop();
  const car = makePoliceCar();
  // la voiture arrive depuis la prison et se gare juste après le lieu du plaquage, côté opposé à la caméra
  const carStop = P.clone().add(dir.clone().multiplyScalar(1.7)).sub(side.clone().multiplyScalar(0.6)).setY(GROUND);
  const carFrom = J.clone().add(dir.clone().multiplyScalar(1.2)).sub(side.clone().multiplyScalar(0.6)).setY(GROUND);
  car.g.position.copy(carFrom);
  car.g.lookAt(carFrom.clone().sub(dir));
  group.add(runner, cop.g, car.g);
  const T_CAR = [1.4, T_TACKLE - 0.2];

  const copStart = S.clone().sub(dir.clone().multiplyScalar(2.4));
  const particles = [];
  const stars = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: '#fde047' }));
    st.userData.k = k;
    stars.add(st);
  }
  stars.visible = false;
  group.add(stars);

  const camPos = S.clone().add(new THREE.Vector3(0, 6, 0)).add(side.clone().multiplyScalar(5));
  const camLook = S.clone();
  let cued = false;
  let impacted = false;
  let shake = 0;

  function puff(at) {
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 8, 6),
        new THREE.MeshStandardMaterial({ color: '#d6d3d1', transparent: true, opacity: 0.8, roughness: 1 }));
      m.position.copy(at).add(new THREE.Vector3(0, 0.08, 0));
      group.add(m);
      const a = Math.random() * Math.PI * 2;
      particles.push({ m, vel: new THREE.Vector3(Math.cos(a) * 1.2, 0.4 + Math.random() * 0.6, Math.sin(a) * 1.2), life: 0.9, max: 0.9 });
    }
  }

  const zig = (k) => side.clone().multiplyScalar(Math.sin(k * Math.PI * 5) * 0.35 * (1 - k * 0.6));
  const LEAP = 0.82; // moment du plongeon (fraction de la course)
  const pathPos = (k) => S.clone().lerp(P, k);

  function update(t, dt) {
    const sm = (a) => 1 - (1 - a) ** (dt * 60);
    // --- fugitif ---
    if (t < T_CHASE) {
      runner.position.copy(S);
      runner.position.y = GROUND + Math.abs(Math.sin(t * 9)) * 0.12; // sursauts de panique
      runner.lookAt(runner.position.clone().sub(dir)); // regarde le policier
      runner.rotation.z = Math.sin(t * 30) * 0.05;
    } else if (t < T_TACKLE) {
      const k = (t - T_CHASE) / (T_TACKLE - T_CHASE);
      const pos = S.clone().lerp(P, k).add(zig(k));
      pos.y = GROUND + Math.abs(Math.sin(t * 14)) * 0.14;
      runner.position.copy(pos);
      runner.lookAt(pos.clone().add(dir).setY(pos.y));
      runner.rotateX(0.25);
    } else {
      // plaqué au sol
      const k = clamp01((t - T_TACKLE) / 0.25);
      const pos = P.clone().add(dir.clone().multiplyScalar(0.35 * k));
      runner.position.copy(pos).setY(GROUND + 0.18 * k);
      runner.lookAt(pos.clone().add(dir).setY(runner.position.y));
      runner.rotateX((Math.PI / 2) * k);
    }

    // --- policier ---
    const swing = (amp) => { cop.legs[0].rotation.x = Math.sin(t * 18) * amp; cop.legs[1].rotation.x = -Math.sin(t * 18) * amp; cop.arms[0].rotation.x = -Math.sin(t * 18) * amp; cop.arms[1].rotation.x = Math.sin(t * 18) * amp; };
    if (t < T_CHASE) {
      const k = clamp01(t / T_CHASE);
      cop.g.position.copy(copStart.clone().sub(dir.clone().multiplyScalar(1.5 * (1 - k))));
      cop.g.lookAt(cop.g.position.clone().add(dir));
      swing(0.9);
    } else if (t < T_TACKLE) {
      const k = (t - T_CHASE) / (T_TACKLE - T_CHASE);
      if (k < LEAP) {
        // l'écart avec le pion se réduit de 2,4 à 0,9 sans jamais s'annuler : le policier reste derrière
        const gap = 2.4 - 1.5 * (1 - (1 - k / LEAP) ** 2);
        cop.g.position.copy(pathPos(k).sub(dir.clone().multiplyScalar(gap)).add(zig(Math.max(0, k - 0.1)).multiplyScalar(0.6)));
        cop.g.position.y = GROUND + Math.abs(Math.sin(t * 18)) * 0.05;
        cop.g.lookAt(cop.g.position.clone().add(dir).setY(cop.g.position.y));
        swing(0.9);
      } else {
        // plongeon : part de derrière le pion et atterrit juste derrière lui
        const j = (k - LEAP) / (1 - LEAP);
        const a = pathPos(LEAP).sub(dir.clone().multiplyScalar(0.9));
        const target = P.clone().sub(dir.clone().multiplyScalar(0.25));
        cop.g.position.copy(a.lerp(target, j));
        cop.g.position.y = GROUND + Math.sin(j * Math.PI) * 0.45 + j * 0.15;
        cop.g.lookAt(cop.g.position.clone().add(dir).setY(cop.g.position.y));
        cop.g.rotateX(j * 1.2);
        cop.arms[0].rotation.x = cop.arms[1].rotation.x = -2.6 * j;
        cop.legs[0].rotation.x = cop.legs[1].rotation.x = 0.4 * j;
      }
    } else {
      const k = clamp01((t - T_TACKLE) / 0.25);
      const pos = P.clone().add(dir.clone().multiplyScalar(0.1 * k));
      cop.g.position.copy(pos).setY(GROUND + 0.3);
      cop.g.lookAt(pos.clone().add(dir).setY(GROUND + 0.3));
      cop.g.rotateX(1.2 + 0.37 * k);
      cop.arms[0].rotation.x = cop.arms[1].rotation.x = -2.6 + Math.sin(t * 6) * 0.15;
      cop.legs[0].rotation.x = Math.sin(t * 5) * 0.2;
      cop.legs[1].rotation.x = -Math.sin(t * 5) * 0.2;
      if (!impacted) { impacted = true; shake = 0.12; puff(P); }
    }

    // voiture : arrive de la prison en freinant et se gare près du plaquage
    const ck = clamp01((t - T_CAR[0]) / (T_CAR[1] - T_CAR[0]));
    car.g.position.copy(carFrom.clone().lerp(carStop, 1 - (1 - ck) ** 3));
    car.g.position.y = GROUND + (ck > 0 && ck < 1 ? Math.abs(Math.sin(t * 25)) * 0.01 : 0);
    car.g.lookAt(car.g.position.clone().sub(dir));
    if (ck >= 1) car.g.rotateY(Math.min(0.5, (t - T_CAR[1]) * 1.5)); // léger braquage en se garant

    // gyrophares
    const blink = Math.floor(t * 6) % 2;
    car.lights.forEach(([mat, light], i) => {
      const on = (i === blink) && t > 0.3;
      mat.emissiveIntensity = on ? 3 : 0.2;
      light.intensity = on ? 6 : 0;
    });

    // étoiles du K.O. au-dessus du pion
    if (t > T_TACKLE + 0.3) {
      stars.visible = true;
      stars.position.copy(P).add(dir.clone().multiplyScalar(0.75)).setY(GROUND + 0.45);
      stars.children.forEach((s) => {
        const a = t * 4 + (s.userData.k * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.22, Math.sin(t * 6 + s.userData.k) * 0.03, Math.sin(a) * 0.22);
        s.rotation.y = t * 5;
      });
    }

    // poussière
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { group.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); particles.splice(i, 1); continue; }
      p.m.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(0.9 ** (dt * 60));
      p.m.scale.multiplyScalar(1 + dt * 2);
      p.m.material.opacity = 0.8 * (p.life / p.max);
    }

    if (t >= T_BUSTED && !cued) { cued = true; onBusted?.(); }

    // --- caméra ---
    const mid = runner.position.clone().lerp(cop.g.position, 0.5).setY(GROUND + 0.3);
    if (t < T_CHASE) {
      camPos.lerp(S.clone().add(side.clone().multiplyScalar(3.2)).add(new THREE.Vector3(0, 1.6, 0)).sub(dir.clone().multiplyScalar(1.2)), sm(0.05));
      camLook.lerp(S.clone().sub(dir.clone().multiplyScalar(0.8)), sm(0.1));
    } else if (t < T_TACKLE + 0.4) {
      camPos.lerp(mid.clone().add(side.clone().multiplyScalar(3.6)).add(new THREE.Vector3(0, 1.9, 0)), sm(0.07));
      camLook.lerp(mid, sm(0.15));
    } else {
      camPos.lerp(P.clone().add(side.clone().multiplyScalar(2.3)).add(dir.clone().multiplyScalar(0.4)).add(new THREE.Vector3(0, 1.25, 0)), sm(0.025));
      camLook.lerp(P.clone().add(dir.clone().multiplyScalar(0.7)).setY(GROUND + 0.3), sm(0.08));
    }
    shake *= 0.9 ** (dt * 60);
    camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
    camera.lookAt(camLook);
    return t >= BUSTED_DURATION;
  }

  function dispose() {
    scene.remove(group);
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }

  return { update, dispose };
}
