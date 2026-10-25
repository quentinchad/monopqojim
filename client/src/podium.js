// Cinématique de fin de partie : le podium en 3D. Les perdants arrivent d'abord à côté du podium,
// puis le 3e, le 2e et enfin le vainqueur, qui a droit aux projecteurs dorés et aux confettis.
import * as THREE from 'three';
import { makeSkinModel, skinSources } from './skin3d.js';

const SLOTS = [
  { x: 0, h: 0.95, color: '#e9b949', label: '1' },
  { x: -1.3, h: 0.62, color: '#c7ccd6', label: '2' },
  { x: 1.3, h: 0.42, color: '#c4773a', label: '3' },
];

const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function bounce(x) {
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}

// Pion classique pour un joueur sans pion personnalisé
function classicPawn(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.35 });
  const add = (geo, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); };
  add(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 32), 0.035);
  add(new THREE.CylinderGeometry(0.07, 0.16, 0.34, 32), 0.24);
  add(new THREE.SphereGeometry(0.12, 32, 20), 0.47);
  return g;
}

function blockFace(slot) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, slot.color);
  grad.addColorStop(1, new THREE.Color(slot.color).multiplyScalar(0.6).getStyle());
  x.fillStyle = grad;
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(255,255,255,.92)';
  x.font = '900 170px Nunito, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.35)';
  x.shadowBlur = 12;
  x.fillText(slot.label, 128, 140);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ranking : joueurs du 1er au dernier. Renvoie { steps, duration, update, resize, dispose }
export function createPodium({ container, ranking, roomId, onStep }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0820');
  scene.fog = new THREE.Fog('#0b0820', 9, 22);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight('#8b7cf6', '#1a1033', 0.55));

  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: '#1d1538', roughness: 0.35, metalness: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // anneaux lumineux au sol
  for (const r of [3.2, 4.6]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.04, 96), new THREE.MeshBasicMaterial({ color: '#7c3aed', transparent: true, opacity: 0.5 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);
  }

  // marches du podium
  SLOTS.forEach((s) => {
    const side = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.35, metalness: 0.45 });
    const front = new THREE.MeshStandardMaterial({ map: blockFace(s), roughness: 0.4, metalness: 0.3 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.2, s.h, 1.05), [side, side, side, side, front, side]);
    block.position.set(s.x, s.h / 2, 0);
    block.castShadow = block.receiveShadow = true;
    scene.add(block);
  });

  // un projecteur par place (et par perdant), allumé à son arrivée
  const spot = (x, z, color, angle) => {
    const l = new THREE.SpotLight(color, 0, 14, angle, 0.45, 1.2);
    l.position.set(x, 6.5, z + 2.5);
    l.target.position.set(x, 0, z);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    scene.add(l, l.target);
    return l;
  };

  // perdants : au sol, de part et d'autre du podium (le 4e le plus près), sans le masquer
  const losers = ranking.slice(3);
  const loserPos = (k) => {
    const side = k % 2 === 0 ? 1 : -1;
    const row = Math.floor(k / 2);
    return new THREE.Vector3(side * (2.45 + row * 0.95), 0, 0.55 + row * 0.55);
  };

  const actors = [];
  const steps = [];
  let t = 0.9;
  const place = (p, pos, rank, scale, isLoser) => {
    const holder = new THREE.Group();
    const model = p.skin ? makeSkinModel({ skin: p.skin, ...skinSources(roomId, p), color: p.color }) : classicPawn(p.color);
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    holder.add(model);
    holder.scale.setScalar(scale);
    holder.visible = false;
    scene.add(holder);
    const isWinner = rank === 1;
    const light = spot(pos.x, pos.z, isWinner ? '#ffd27a' : isLoser ? '#9aa4ff' : '#ffffff', isWinner ? 0.32 : 0.24);
    const drumroll = !isLoser;
    const dur = isLoser ? 1.35 : isWinner ? 5.2 : 2.5;
    const drop = t + (drumroll ? 1.1 : 0.15);
    const a = { p, holder, pos, rank, light, t0: t, drop, isWinner, isLoser, fired: false, landed: false };
    actors.push(a);
    steps.push({ t0: t, rank, player: p, isLoser, isWinner, drumroll });
    t += dur;
  };
  // ordre d'apparition : derniers d'abord, puis 3e, 2e, 1er
  for (let k = losers.length - 1; k >= 0; k--) place(losers[k], loserPos(k), k + 4, 1.5, true);
  [2, 1, 0].forEach((i) => {
    if (!ranking[i]) return;
    const s = SLOTS[i];
    place(ranking[i], new THREE.Vector3(s.x, s.h, 0), i + 1, i === 0 ? 2.1 : 1.9, false);
  });
  const duration = t + 1.5;

  // confettis du vainqueur
  const confetti = [];
  const confGroup = new THREE.Group();
  scene.add(confGroup);
  const confColors = ['#facc15', '#f43f5e', '#22d3ee', '#a3e635', '#c084fc', '#fb923c', '#ffffff'];
  function burst() {
    for (let i = 0; i < 260; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ color: confColors[i % confColors.length], side: THREE.DoubleSide }));
      m.position.set((Math.random() - 0.5) * 6, 4 + Math.random() * 3, (Math.random() - 0.5) * 3);
      confGroup.add(m);
      confetti.push({ m, v: 0.6 + Math.random() * 0.9, spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), sway: Math.random() * 6 });
    }
  }

  const camPos = new THREE.Vector3(0, 2.6, 8.5);
  const camLook = new THREE.Vector3(0, 0.8, 0);
  let current = null;

  function update(time, dt) {
    for (const a of actors) {
      if (!a.fired && time >= a.t0) {
        a.fired = true;
        current = a;
        onStep?.(steps.find((s) => s.player === a.p), 'start');
      }
      if (time >= a.drop) {
        a.holder.visible = true;
        const k = clamp01((time - a.drop) / 0.6);
        a.holder.position.set(a.pos.x, a.pos.y + (1 - bounce(k)) * 3, a.pos.z);
        if (k >= 1 && !a.landed) {
          a.landed = true;
          onStep?.(steps.find((s) => s.player === a.p), 'land');
          if (a.isWinner) burst();
        }
        // le vainqueur sautille et se tourne vers la foule
        if (a.isWinner && a.landed) {
          a.holder.position.y = a.pos.y + Math.abs(Math.sin((time - a.drop) * 4)) * 0.12;
          a.holder.rotation.y = Math.sin((time - a.drop) * 1.5) * 0.35;
        }
        // projecteur qui s'allume
        const target = a.isWinner ? 300 : a.isLoser ? 90 : 170;
        a.light.intensity += (target - a.light.intensity) * Math.min(1, dt * 4);
      } else if (time >= a.t0 && !a.isLoser) {
        // roulement de tambour : le projecteur balaie la marche avant l'arrivée
        a.light.intensity = 40 + Math.abs(Math.sin(time * 9)) * 60;
      }
    }

    // confettis
    for (const c of confetti) {
      c.m.position.y -= c.v * dt;
      c.m.position.x += Math.sin(time * 2 + c.sway) * dt * 0.3;
      c.m.rotation.x += c.spin.x * dt;
      c.m.rotation.y += c.spin.y * dt;
      if (c.m.position.y < 0.02) c.m.position.y = 0.02;
    }

    // caméra : suit la personne présentée, plan large à la fin
    let wantPos;
    let wantLook;
    if (!current || time > duration - 1.6) {
      wantPos = new THREE.Vector3(0, 2.6, 8.4);
      wantLook = new THREE.Vector3(0, 1.0, 0.4);
    } else {
      const p = current.pos;
      const h = current.isLoser ? 0.6 : 1.1;
      const dist = current.isWinner ? 3.6 : current.isLoser ? 4.2 : 4.4;
      wantPos = new THREE.Vector3(p.x * 0.75, p.y + h + 0.9, p.z + dist);
      wantLook = new THREE.Vector3(p.x, p.y + h * 0.75, p.z);
    }
    const k = 1 - Math.pow(0.08, dt);
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, k);
    camera.position.copy(camPos).add(new THREE.Vector3(Math.sin(time * 0.4) * 0.15, 0, 0));
    camera.lookAt(camLook);
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

  return { steps, duration, update, resize, dispose };
}
