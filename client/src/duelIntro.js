// Avant le duel du goulag, façon soirée UFC : face-à-face des deux combattants front contre front,
// le patron de la ligue au milieu, crépitement des flashs ; puis chacun entre dans l'arène,
// filmé en contre-plongée dans un couloir enfumé.
import * as THREE from 'three';
import { buildCharacter, DEFAULT_CHARACTER } from './characters.js';
import { playerModel } from './skin3d.js';

export const INTRO_DURATION = 13;
export const T_WALK_A = 6.5;
export const T_WALK_B = 9.75;

const FIGHTER_H = 1.82; // tout le monde à taille humaine, pions classiques compris
const BOSS_H = 1.74;
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// le patron de la ligue : crâne rasé, trapu, costume noir, chemise blanche ouverte
const BOSS = {
  ...DEFAULT_CHARACTER, build: 'heavy', height: 1.02, skin: '#f0c4a3', hair: 'bald', beard: 'stubble', beardColor: '#9a8b7c',
  top: 'suit', topColor: '#0d0d10', topColor2: '#f5f5f5', topColor3: '#0d0d10', pants: '#0d0d10', shoes: '#050505',
};

// met le modèle à la hauteur voulue, pieds au sol
function fitHeight(m, h) {
  const box = new THREE.Box3().setFromObject(m);
  const size = box.max.y - box.min.y || 1;
  m.scale.multiplyScalar(h / size);
  m.position.y -= (box.min.y * h) / size;
}

function fighterModel(roomId, p) {
  const g = new THREE.Group();
  const m = playerModel(roomId, p);
  if (p?.skin?.type === 'character' && m.children[0]) m.children[0].visible = false;
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(m);
  fitHeight(m, FIGHTER_H);
  return g;
}

// distance entre le centre du modèle et l'avant de son visage, une fois tourné vers +x
function frontOf(g) {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  return box.max.x - g.position.x;
}

function bannerTexture(text, sub) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 384;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1024, 384);
  g.addColorStop(0, '#120406');
  g.addColorStop(1, '#2a0508');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 384);
  x.strokeStyle = '#b91c1c';
  x.lineWidth = 10;
  x.strokeRect(14, 14, 996, 356);
  x.fillStyle = '#f5f5f5';
  x.font = '900 120px Arial Black, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 512, 170);
  x.fillStyle = '#ef4444';
  x.font = '900 52px Arial, sans-serif';
  x.fillText(sub, 512, 290);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createDuelIntro({ container, a, b, roomId }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.03, 100);

  // ---------- plateau du face-à-face ----------
  const stage = new THREE.Scene();
  stage.background = new THREE.Color('#050507');
  stage.fog = new THREE.Fog('#050507', 6, 18);
  stage.add(new THREE.HemisphereLight('#c7d2fe', '#120a0a', 0.5));
  const key = new THREE.SpotLight('#fff6e8', 160, 20, 0.5, 0.45, 1.2);
  key.position.set(0, 6, 4);
  key.target.position.set(0, 1.3, 0);
  key.castShadow = true;
  stage.add(key, key.target);
  const rim = new THREE.SpotLight('#ff3b3b', 90, 18, 0.6, 0.5, 1.2);
  rim.position.set(0, 4, -4);
  rim.target.position.set(0, 1.4, 0);
  stage.add(rim, rim.target);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: '#121216', roughness: 0.3, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  stage.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshBasicMaterial({ map: bannerTexture('GOULAG', 'COMBAT À MORT') }));
  wall.position.set(0, 2.2, -3.2);
  stage.add(wall);
  // flashs des photographes
  const flashes = [];
  for (let k = 0; k < 6; k++) {
    const l = new THREE.PointLight('#ffffff', 0, 9, 1.5);
    l.position.set(-3 + k * 1.2, 1.2 + (k % 2) * 0.6, 3.2);
    stage.add(l);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }));
    bulb.position.copy(l.position);
    stage.add(bulb);
    flashes.push({ l, bulb, next: Math.random() * 0.6 });
  }

  const fa = fighterModel(roomId, a);
  const fb = fighterModel(roomId, b);
  // face à face, presque nez contre nez
  fa.rotation.y = Math.PI / 2;
  fb.rotation.y = Math.PI / 2;
  const xa = -frontOf(fa) - 0.05;
  const xb = frontOf(fb) + 0.05;
  fb.rotation.y = -Math.PI / 2;
  fa.position.x = xa;
  fb.position.x = xb;
  const HEAD = FIGHTER_H * 0.88;
  const boss = new THREE.Group();
  const bossModel = new THREE.Group();
  buildCharacter(bossModel, BOSS, '#000000');
  bossModel.children[0].visible = false;
  bossModel.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  boss.add(bossModel);
  fitHeight(bossModel, BOSS_H);
  boss.position.set(0, 0, -0.7);
  stage.add(fa, fb, boss);

  // fumée commune aux deux décors
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const makeSmoke = (scene, n, area, color) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.18, depthWrite: false }));
      s.position.set((Math.random() - 0.5) * area.x, Math.random() * area.y, (Math.random() - 0.5) * area.z);
      s.scale.setScalar(1.5 + Math.random() * 2);
      scene.add(s);
      list.push({ s, v: (Math.random() - 0.5) * 0.15 });
    }
    return list;
  };
  const stageSmoke = makeSmoke(stage, 18, { x: 8, y: 1.2, z: 6 }, '#9aa3b5');

  // ---------- couloir d'entrée (un par combattant) ----------
  const makeTunnel = (p, tint) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030304');
    scene.fog = new THREE.Fog('#030304', 4, 16);
    scene.add(new THREE.HemisphereLight('#94a3b8', '#0a0a0a', 0.35));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 30), new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.4, metalness: 0.3 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#202026', roughness: 0.9 });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 30), wallMat);
      w.position.set(s * 1.9, 2, 0);
      scene.add(w);
    }
    // rampes lumineuses au sol, de la couleur du combattant
    for (let z = -14; z < 14; z += 1.6) {
      for (const s of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.8), new THREE.MeshBasicMaterial({ color: tint }));
        strip.position.set(s * 1.6, 0.02, z);
        scene.add(strip);
      }
    }
    const spot = new THREE.SpotLight('#ffffff', 140, 14, 0.38, 0.4, 1.2);
    spot.castShadow = true;
    scene.add(spot, spot.target);
    const back = new THREE.SpotLight(tint, 120, 16, 0.6, 0.5, 1.2);
    back.position.set(0, 3.5, -10);
    scene.add(back, back.target);
    const fighter = fighterModel(roomId, p);
    scene.add(fighter);
    const smoke = makeSmoke(scene, 22, { x: 3.2, y: 1.0, z: 26 }, tint);
    return { scene, fighter, spot, back, smoke };
  };
  const ta = makeTunnel(a, a?.color || '#ef4444');
  const tb = makeTunnel(b, b?.color || '#3b82f6');

  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  function updateSmoke(list, t) {
    for (const s of list) { s.s.position.x += s.v * 0.02; s.s.material.opacity = 0.14 + Math.sin(t + s.v * 20) * 0.04; }
  }

  function update(t) {
    let scene = stage;
    // flashs qui crépitent pendant le face-à-face
    for (const f of flashes) {
      f.next -= 1 / 60;
      if (f.next <= 0 && t < T_WALK_A) { f.l.intensity = 30; f.bulb.material.opacity = 1; f.next = 0.15 + Math.random() * 0.7; }
      f.l.intensity *= 0.82;
      f.bulb.material.opacity *= 0.8;
    }
    if (t < T_WALK_A) {
      updateSmoke(stageSmoke, t);
      // ils se rapprochent, front contre front
      const lean = ease(clamp01((t - 4.8) / 0.5)) * 0.04;
      fa.position.x = xa + lean;
      fb.position.x = xb - lean;
      let cp;
      let cl;
      if (t < 2) { // plan d'ensemble, léger travelling avant
        const k = ease(t / 2);
        cp = v(0, 1.55, 4.6 - k * 0.9);
        cl = v(0, 1.25, 0);
      } else if (t < 3.5) { // par-dessus l'épaule du second : le visage du premier
        const k = (t - 2) / 1.5;
        cp = v(xb + 0.75, HEAD + 0.08, 1.15 - k * 0.12);
        cl = v(xa, HEAD - 0.08, 0);
      } else if (t < 4.8) { // contrechamp
        const k = (t - 3.5) / 1.3;
        cp = v(xa - 0.75, HEAD + 0.08, 1.15 - k * 0.12);
        cl = v(xb, HEAD - 0.08, 0);
      } else { // les deux de profil, front contre front, le patron au milieu, en contre-plongée
        const k = ease((t - 4.8) / 1.7);
        cp = v(0, HEAD - 0.5 + k * 0.08, 2.3 - k * 0.4);
        cl = v(0, HEAD - 0.1, 0);
      }
      camera.position.copy(cp);
      camera.lookAt(cl);
      camera.fov = t < 2 ? 38 : t < 4.8 ? 30 : 38;
    } else {
      // entrée dans l'arène : contre-plongée sur le combattant qui avance vers la caméra
      const second = t >= T_WALK_B;
      const tun = second ? tb : ta;
      scene = tun.scene;
      const local = t - (second ? T_WALK_B : T_WALK_A);
      const z = -6 + local * 1.15;
      tun.fighter.position.set(Math.sin(local * 4.5) * 0.03, Math.abs(Math.sin(local * 4.5)) * 0.04, z);
      tun.fighter.rotation.set(0, 0, Math.sin(local * 4.5) * 0.03);
      tun.spot.position.set(0, 4, z + 1.2);
      tun.spot.target.position.set(0, 1, z);
      tun.back.target.position.set(0, 1, z);
      updateSmoke(tun.smoke, t);
      camera.position.set(0.35, 0.3, z + 2.4 - local * 0.08);
      camera.lookAt(0, FIGHTER_H * 0.82, z);
      camera.fov = 42;
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
    for (const s of [stage, ta.scene, tb.scene]) {
      s.traverse((o) => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m?.map?.dispose(); m?.dispose?.(); }); });
    }
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { update, resize, dispose };
}
