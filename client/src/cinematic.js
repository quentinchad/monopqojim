// Cinématique 3D du détournement d'avion : décollage depuis l'aéroport, vol, crash sur les bâtiments visés, explosion.
import * as THREE from 'three';
import { cellCenter, TOTAL } from './layout.js';

const HALF = TOTAL / 2;
export const HIJACK_DURATION = 9.2; // secondes

const T_TAKEOFF = 1.4; // début du roulage
const T_AIRBORNE = 3.0; // fin du décollage
const T_IMPACT = 6.6;

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const easeIn = (x) => x * x * x;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function cellWorld(i, y = 0) {
  const c = cellCenter(((i % 40) + 40) % 40);
  return new THREE.Vector3(c.x - HALF, y, c.y - HALF);
}

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return p0.clone().multiplyScalar(u * u * u)
    .add(p1.clone().multiplyScalar(3 * u * u * t))
    .add(p2.clone().multiplyScalar(3 * u * t * t))
    .add(p3.clone().multiplyScalar(t * t * t));
}

function makePlane(stripeColor) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.3, roughness: 0.35 });
  const stripe = new THREE.MeshStandardMaterial({ color: stripeColor, metalness: 0.2, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.2 });
  const add = (geo, mat, pos, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  // l'avant de l'avion pointe vers +z (convention de Object3D.lookAt)
  add(new THREE.CylinderGeometry(0.1, 0.08, 1.0, 20), white, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(new THREE.SphereGeometry(0.1, 20, 14), white, [0, 0, 0.5]).scale.set(1, 1, 1.6);
  add(new THREE.BoxGeometry(0.12, 0.05, 0.12), glass, [0, 0.06, 0.52]);
  add(new THREE.CylinderGeometry(0.101, 0.101, 0.5, 20), stripe, [0, 0, 0.05], [Math.PI / 2, 0, 0]).scale.set(1, 1, 0.25);
  add(new THREE.BoxGeometry(1.15, 0.025, 0.24), white, [0, -0.02, 0.05]);
  add(new THREE.BoxGeometry(0.42, 0.02, 0.12), white, [0, 0.02, -0.45]);
  add(new THREE.BoxGeometry(0.025, 0.24, 0.18), stripe, [0, 0.13, -0.44]);
  for (const x of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 12), stripe, [x, -0.07, 0.12], [Math.PI / 2, 0, 0]);
  return g;
}

export function createHijackCinematic({ scene, camera, cells, from, cell, color = '#ef4444', onImpact }) {
  const particles = [];
  const plane = makePlane(color);
  scene.add(plane);

  const flash = new THREE.PointLight('#ff9a3c', 0, 12);
  scene.add(flash);

  // trajectoire : piste le long du plateau, puis courbe vers l'hôtel
  const A = cellWorld(from, 0.24);
  const runway = cellWorld(from + 1, 0.24).sub(A).setY(0).normalize();
  const target = cells.find((c) => c.cell.index === cell);
  target.group.updateMatrixWorld(true);
  // point visé : centre des bâtiments (maisons ou hôtel)
  const kids = target.houses.children;
  const H = kids.length
    ? kids.reduce((acc, k) => acc.add(k.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).divideScalar(kids.length)
    : cellWorld(cell, 0.3);
  const P1 = A.clone().add(runway.clone().multiplyScalar(2.6)).setY(1.4);
  const C1 = P1.clone().add(runway.clone().multiplyScalar(3)).setY(4.5);
  const C2 = H.clone().add(new THREE.Vector3(0, 6, 0)).add(P1.clone().sub(H).setY(0).normalize().multiplyScalar(2));

  // caméra de fin : sur le côté de l'hôtel, vers l'extérieur du plateau
  const outward = H.clone().setY(0).normalize();
  const crashCam = H.clone().add(outward.clone().multiplyScalar(3.4)).add(new THREE.Vector3(0, 2.3, 0))
    .add(new THREE.Vector3(-outward.z, 0, outward.x).multiplyScalar(1.6));

  plane.position.copy(A);
  plane.lookAt(A.clone().add(runway));
  const camPos = A.clone().add(new THREE.Vector3(0, 5, 0)).add(runway.clone().multiplyScalar(-4));
  const camLook = A.clone();
  let impacted = false;
  let shake = 0;
  let trailT = 0;

  function spawn(geo, mat, pos, vel, life, grow = 0, gravity = 0, spin = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    scene.add(m);
    particles.push({ m, vel, life, max: life, grow, gravity, spin, base: mat.opacity ?? 1 });
  }

  function explode() {
    impacted = true;
    shake = 0.35;
    flash.position.copy(H).add(new THREE.Vector3(0, 0.6, 0));
    flash.intensity = 40;
    scene.remove(plane);
    onImpact?.();
    const fireColors = ['#fff3b0', '#ffb703', '#fb8500', '#e63946'];
    for (let i = 0; i < 46; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      const mat = new THREE.MeshBasicMaterial({ color: fireColors[i % 4], transparent: true, opacity: 1 });
      spawn(new THREE.SphereGeometry(0.09 + Math.random() * 0.12, 10, 8), mat, H,
        dir.multiplyScalar(1.2 + Math.random() * 2.4), 0.9 + Math.random() * 0.8, 2.2, -1.5);
    }
    // débris de l'hôtel (rouge) et de l'avion (blanc)
    for (let i = 0; i < 26; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 1.2 + 0.4, Math.random() - 0.5);
      const mat = new THREE.MeshStandardMaterial({ color: i % 3 ? '#b91c1c' : '#e2e8f0' });
      const s = 0.04 + Math.random() * 0.08;
      spawn(new THREE.BoxGeometry(s, s, s), mat, H, dir.multiplyScalar(2.5 + Math.random() * 2.5), 2.6, 0, -6, 8);
    }
    // onde de choc
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 48),
      new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(H).setY(0.18);
    scene.add(ring);
    particles.push({ m: ring, vel: new THREE.Vector3(), life: 1.1, max: 1.1, grow: 9, gravity: 0, spin: 0, base: 0.9 });
  }

  function smoke(pos, size, life, rise = 0.6, color = '#6b7280') {
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, roughness: 1 });
    spawn(new THREE.SphereGeometry(size, 10, 8), mat, pos,
      new THREE.Vector3((Math.random() - 0.5) * 0.3, rise, (Math.random() - 0.5) * 0.3), life, 1.4);
  }

  function update(t, dt) {
    // lissage indépendant du nombre d'images par seconde
    const sm = (a) => 1 - (1 - a) ** (dt * 60);
    if (!impacted) {
      if (t < T_TAKEOFF) {
        // plan d'ensemble sur l'aéroport
        const k = ease(t / T_TAKEOFF);
        camPos.lerpVectors(
          A.clone().add(new THREE.Vector3(0, 6, 0)).add(runway.clone().multiplyScalar(-5)),
          A.clone().add(new THREE.Vector3(0, 0.9, 0)).add(runway.clone().multiplyScalar(-1.8)).add(new THREE.Vector3(runway.z, 0, -runway.x).multiplyScalar(0.9)),
          k,
        );
        camLook.copy(A);
      } else if (t < T_AIRBORNE) {
        // roulage puis décollage
        const k = (t - T_TAKEOFF) / (T_AIRBORNE - T_TAKEOFF);
        const pos = A.clone().add(runway.clone().multiplyScalar(2.6 * easeIn(k)));
        pos.y = 0.24 + Math.max(0, k - 0.45) ** 2 * 3.8;
        const ahead = A.clone().add(runway.clone().multiplyScalar(2.6 * easeIn(Math.min(1, k + 0.05)) + 0.3));
        ahead.y = pos.y + (k > 0.45 ? 0.35 : 0);
        plane.position.copy(pos);
        plane.lookAt(ahead);
        camPos.lerp(pos.clone().add(runway.clone().multiplyScalar(-1.7)).add(new THREE.Vector3(runway.z * 0.8, 0.6, -runway.x * 0.8)), sm(0.08));
        camLook.lerp(pos, sm(0.3));
      } else {
        // vol vers l'hôtel puis piqué
        const k = clamp01((t - T_AIRBORNE) / (T_IMPACT - T_AIRBORNE));
        const u = k < 0.7 ? ease(k / 0.7) * 0.75 : 0.75 + easeIn((k - 0.7) / 0.3) * 0.25;
        const pos = bezier(P1, C1, C2, H, u);
        plane.position.copy(pos);
        plane.lookAt(bezier(P1, C1, C2, H, Math.min(1, u + 0.01)));
        plane.rotateZ(Math.sin(t * 2.2) * 0.25);
        if (k < 0.72) {
          // caméra de poursuite, assez loin pour voir l'avion ET l'hôtel visé
          const fwd = bezier(P1, C1, C2, H, Math.min(1, u + 0.01)).sub(pos).setY(0).normalize();
          camPos.lerp(pos.clone().addScaledVector(fwd, -3).add(new THREE.Vector3(0, 1.8, 0)), sm(0.06));
          camLook.lerp(pos.clone().lerp(H, 0.35), sm(0.15));
        } else {
          camPos.lerp(crashCam, sm(0.08));
          camLook.lerp(H, sm(0.12));
        }
        trailT += dt;
        if (trailT > 0.04) {
          trailT = 0;
          smoke(plane.position.clone(), 0.05, 1.2, 0.05, '#cbd5e1');
        }
        if (k >= 1) explode();
      }
    } else {
      camPos.lerp(crashCam, sm(0.05));
      camLook.lerp(H, sm(0.1));
      flash.intensity *= 0.9 ** (dt * 60);
      if (Math.random() < 0.5) smoke(H.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4)), 0.12, 2.4, 0.7, '#3f3f46');
      if (Math.random() < 0.25) {
        const mat = new THREE.MeshBasicMaterial({ color: '#fb8500', transparent: true, opacity: 0.9 });
        spawn(new THREE.SphereGeometry(0.07, 8, 6), mat, H.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.12, (Math.random() - 0.5) * 0.3)),
          new THREE.Vector3(0, 0.6, 0), 0.5, 1.5);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.m);
        p.m.geometry.dispose();
        p.m.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.m.position.addScaledVector(p.vel, dt);
      if (p.gravity < -3 && p.m.position.y < 0.16) { p.m.position.y = 0.16; p.vel.multiplyScalar(0.4); p.vel.y = Math.abs(p.vel.y) * 0.3; }
      p.vel.multiplyScalar(p.gravity < -3 ? 1 : 0.96);
      if (p.grow) p.m.scale.multiplyScalar(1 + p.grow * dt);
      if (p.spin) { p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt; }
      if (p.m.material.transparent) p.m.material.opacity = Math.max(0, (p.life / p.max) * p.base);
    }

    shake *= 0.92 ** (dt * 60);
    camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
    camera.lookAt(camLook);
    return t >= HIJACK_DURATION;
  }

  function dispose() {
    scene.remove(plane);
    scene.remove(flash);
    for (const p of particles) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); }
    particles.length = 0;
  }

  return { update, dispose, get impacted() { return impacted; } };
}
