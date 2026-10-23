import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BOARD, COUNTRIES } from '../../../shared/board.js';
import { cellRect, cellCenter, tokenOffset, TOTAL } from '../layout.js';
import { flagDataUrl } from '../flags.js';
import { currentRent, money, playerById } from '../gameInfo.js';
import { createHijackCinematic } from '../cinematic.js';
import { createBustedCinematic } from '../busted.js';
import { THEMES, useThemeId } from '../themes.js';
import { buildScenery } from '../scenery.js';

const HALF = TOTAL / 2;
const CELL_H = 0.14;
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const ROT = { bottom: 0, left: -Math.PI / 2, top: Math.PI, right: Math.PI / 2 };
const CORNER_ROT = { 0: 0, 10: -Math.PI / 2, 20: Math.PI, 30: Math.PI / 2 };

// Drapeaux chargés une fois pour les textures
const flagImages = {};
function loadFlags(onDone) {
  const codes = Object.values(COUNTRIES).map((c) => c.code);
  let left = codes.length;
  for (const code of codes) {
    if (flagImages[code]) { if (--left === 0) onDone(); continue; }
    const img = new Image();
    img.onload = img.onerror = () => { flagImages[code] = img; if (--left === 0) onDone(); };
    img.src = flagDataUrl(code);
  }
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  lines.forEach((l, k) => ctx.fillText(l, x, y + k * lineH));
  return lines.length;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCell(ctx, W, H, cell, state, pal) {
  const prop = state.props[cell.index];
  const owner = prop?.owner && playerById(state, prop.owner);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = pal.cellBg;
  ctx.fillRect(0, 0, W, H);
  if (owner) {
    ctx.fillStyle = owner.color;
    ctx.globalAlpha = 0.32;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = owner.color;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);
  } else {
    ctx.strokeStyle = pal.cellLine;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pal.cellText;

  const bottomTag = () => {
    if (owner) {
      const label = currentRent(state, cell.index);
      ctx.fillStyle = owner.color;
      roundRect(ctx, 14, H - 58, W - 28, 42, 12);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Nunito, sans-serif';
      ctx.fillText(label, W / 2, H - 37);
    } else if (cell.price) {
      ctx.fillStyle = pal.price;
      ctx.font = 'bold 28px Nunito, sans-serif';
      ctx.fillText(money(cell.price), W / 2, H - 36);
    }
  };

  if (cell.type === 'city') {
    const c = COUNTRIES[cell.country];
    ctx.fillStyle = c.color;
    ctx.fillRect(0, 0, W, H * 0.24);
    const img = flagImages[c.code];
    if (img?.complete && img.naturalWidth) {
      ctx.drawImage(img, W / 2 - 30, H * 0.12 - 20, 60, 40);
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 30, H * 0.12 - 20, 60, 40);
    }
    ctx.fillStyle = pal.cellText;
    ctx.font = 'bold 26px Nunito, sans-serif';
    wrapText(ctx, cell.name.toUpperCase(), W / 2, H * 0.38, W - 16, 30);
    bottomTag();
  } else if (['airport', 'utility', 'chance', 'chest', 'tax', 'casino'].includes(cell.type)) {
    const icon = { airport: '✈️', chance: '❓', chest: '📦', tax: '💸', casino: '🎰' }[cell.type] || cell.icon;
    ctx.font = `64px ${EMOJI_FONT}`;
    ctx.fillText(icon, W / 2, H * 0.3);
    ctx.fillStyle = pal.cellText;
    ctx.font = 'bold 22px Nunito, sans-serif';
    const name = cell.type === 'chest' ? 'CAISSE DE COMMUNAUTÉ' : cell.name.toUpperCase();
    wrapText(ctx, name, W / 2, H * 0.52, W - 16, 26);
    if (cell.type === 'tax') {
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 28px Nunito, sans-serif';
      ctx.fillText(money(cell.amount), W / 2, H - 36);
    } else bottomTag();
  } else {
    const conf = {
      go: ['🏁', 'DÉPART', '+200 $'],
      jail: ['🚔', 'PRISON', 'simple visite'],
      parking: ['🏖️', 'PARC GRATUIT', state.settings.freeParkingPot ? money(state.pot) : ''],
      gotojail: ['👮', 'ALLEZ EN', 'PRISON'],
    }[cell.type];
    ctx.font = `96px ${EMOJI_FONT}`;
    ctx.fillText(conf[0], W / 2, H * 0.38);
    ctx.fillStyle = pal.cellText;
    ctx.font = 'bold 34px Nunito, sans-serif';
    ctx.fillText(conf[1], W / 2, H * 0.68);
    ctx.fillStyle = pal.price;
    ctx.font = 'bold 28px Nunito, sans-serif';
    ctx.fillText(conf[2], W / 2, H * 0.82);
  }
}

function drawCenter(ctx, S, pal) {
  const g = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, pal.centerA);
  g.addColorStop(1, pal.centerB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `150px ${EMOJI_FONT}`;
  ctx.globalAlpha = 0.25;
  ctx.fillText('🌍', S / 2, S / 2 - 40);
  ctx.globalAlpha = 1;
  ctx.font = '900 110px Nunito, sans-serif';
  ctx.fillStyle = pal.logoA;
  ctx.fillText('MONOP', S / 2 - 140, S / 2 + 140);
  ctx.fillStyle = pal.logoB;
  ctx.fillText('QOJIM', S / 2 + 175, S / 2 + 140);
}

function makePawn(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 24), mat);
  base.position.y = 0.035;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 0.34, 24), mat);
  body.position.y = 0.24;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), mat);
  head.position.y = 0.47;
  for (const m of [base, body, head]) { m.castShadow = true; g.add(m); }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.33, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  ring.visible = false;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

const houseGeo = new THREE.BoxGeometry(0.15, 0.13, 0.15);
const roofGeo = new THREE.ConeGeometry(0.13, 0.1, 4);
const hotelGeo = new THREE.BoxGeometry(0.5, 0.2, 0.22);
const hotelRoofGeo = new THREE.ConeGeometry(0.3, 0.12, 4);
const houseMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });
const hotelMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
const hotelRoofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });

function buildHouses(group, n, depth) {
  while (group.children.length) group.remove(group.children[0]);
  const z = -depth / 2 + 0.2;
  if (n === 5) {
    const b = new THREE.Mesh(hotelGeo, hotelMat);
    b.position.set(0, CELL_H / 2 + 0.1, z);
    const r = new THREE.Mesh(hotelRoofGeo, hotelRoofMat);
    r.position.set(0, CELL_H / 2 + 0.26, z);
    r.rotation.y = Math.PI / 4;
    r.scale.set(1, 1, 0.45);
    for (const m of [b, r]) { m.castShadow = true; group.add(m); }
    return;
  }
  for (let k = 0; k < n; k++) {
    const x = -0.33 + k * 0.22;
    const b = new THREE.Mesh(houseGeo, houseMat);
    b.position.set(x, CELL_H / 2 + 0.065, z);
    const r = new THREE.Mesh(roofGeo, roofMat);
    r.position.set(x, CELL_H / 2 + 0.18, z);
    r.rotation.y = Math.PI / 4;
    for (const m of [b, r]) { m.castShadow = true; group.add(m); }
  }
}

const ORBIT_CAMERA = new THREE.Vector3(0, 15.5, 12.5);

// Point au centre d'une case, en coordonnées 3D
function cellWorld(i, y = 0) {
  const c = cellCenter(((i % 40) + 40) % 40);
  return new THREE.Vector3(c.x - HALF, y, c.y - HALF);
}

export default function Board3D({ state, positions, onCellClick, highlights, mode = 'orbit', followId, cinematic, onCinematicEnd, onCinematicCue }) {
  const mount = useRef(null);
  const themeId = useThemeId();
  const world = useRef(null);
  const clickRef = useRef(onCellClick);
  clickRef.current = onCellClick;
  const cineEndRef = useRef(onCinematicEnd);
  cineEndRef.current = onCinematicEnd;
  const cineCueRef = useRef(onCinematicCue);
  cineCueRef.current = onCinematicCue;

  // Initialisation de la scène
  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#0d0a1a', 30, 90);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
    camera.position.copy(ORBIT_CAMERA);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = 1.3;
    controls.minDistance = 5;
    controls.maxDistance = 30;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a1f4d, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    scene.add(sun);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(TOTAL + 0.5, 0.3, TOTAL + 0.5),
      new THREE.MeshStandardMaterial({ color: '#16112b', roughness: 0.8 }),
    );
    base.position.y = -0.16;
    base.receiveShadow = true;
    scene.add(base);

    // centre du plateau
    const cc = document.createElement('canvas');
    cc.width = cc.height = 1024;
    const centerTex = new THREE.CanvasTexture(cc);
    centerTex.colorSpace = THREE.SRGBColorSpace;
    const center = new THREE.Mesh(new THREE.PlaneGeometry(TOTAL - 3.2, TOTAL - 3.2), new THREE.MeshStandardMaterial({ map: centerTex }));
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.0;
    center.receiveShadow = true;
    scene.add(center);

    const cells = BOARD.map((cell) => {
      const r = cellRect(cell.index);
      const corner = r.side === 'corner';
      const cw = corner ? r.w : 1;
      const cd = corner ? r.h : 1.6;
      const canvas = document.createElement('canvas');
      canvas.width = corner ? 256 : 160;
      canvas.height = 256;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
      const side = new THREE.MeshStandardMaterial({ color: THEMES.nuit.scene.cellSide, roughness: 0.6 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.03, CELL_H, cd - 0.03), [side, side, top, side, side, side]);
      mesh.receiveShadow = true;
      mesh.userData.index = cell.index;
      const group = new THREE.Group();
      group.add(mesh);
      const houses = new THREE.Group();
      group.add(houses);
      group.position.set(r.x + r.w / 2 - HALF, CELL_H / 2, r.y + r.h / 2 - HALF);
      group.rotation.y = corner ? CORNER_ROT[cell.index] : ROT[r.side];
      scene.add(group);
      return { cell, group, mesh, canvas, tex, side, houses, depth: cd, sig: '', houseCount: -1 };
    });

    const w = {
      renderer, scene, camera, controls, cells, tokens: new Map(), flagsReady: false, raf: 0,
      hemi, sun, base, cc, centerTex, scenery: null, pal: THEMES.nuit.scene, themeId: null,
      state: null, highlights: {}, t: 0, mode: 'orbit', followId: null,
      // vue FPS : regard libre (yaw/pitch) qui revient doucement vers l'avant
      fps: { yaw: 0, pitch: 0, look: null, eye: null, dragging: false },
    };
    world.current = w;

    loadFlags(() => { w.flagsReady = true; w.refresh?.(); });

    // clics sur les cases (en ignorant les glisser-déposer de caméra)
    const ray = new THREE.Raycaster();
    let down = null;
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; w.fps.last = { x: e.clientX, y: e.clientY }; w.fps.dragging = true; };
    const onMove = (e) => {
      if (w.mode !== 'fps' || !w.fps.dragging || !e.buttons) return;
      w.fps.yaw -= (e.clientX - w.fps.last.x) * 0.006;
      w.fps.pitch = Math.max(-1, Math.min(0.7, w.fps.pitch - (e.clientY - w.fps.last.y) * 0.004));
      w.fps.last = { x: e.clientX, y: e.clientY };
    };
    const onRelease = () => { w.fps.dragging = false; };
    renderer.domElement.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onRelease);
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(cells.map((c) => c.mesh))[0];
      if (hit) clickRef.current(hit.object.userData.index);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      if (!cw || !ch) return;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const clock = new THREE.Clock();
    let lastSize = '';
    const tick = () => {
      w.raf = requestAnimationFrame(tick);
      // taille vérifiée à chaque image : fiable même si la page était en arrière-plan à l'ouverture
      const sz = `${el.clientWidth}x${el.clientHeight}`;
      if (sz !== lastSize) { lastSize = sz; resize(); }
      const rawDt = clock.getDelta();
      const dt = Math.min(0.05, rawDt);
      w.t += dt;
      const tokF = w.mode === 'fps' && w.tokens.get(w.followId);
      if (w.cine) {
        // la cinématique pilote la caméra
        // la cinématique suit le temps réel, même si l'ordinateur affiche peu d'images par seconde
        w.cineT += Math.min(rawDt, 0.5);
        if (w.cine.update(w.cineT, Math.min(rawDt, 0.1))) {
          w.cine.dispose();
          w.cine = null;
          controls.enabled = w.mode !== 'fps';
          cineEndRef.current?.();
        }
      } else if (tokF) {
        // caméra à hauteur des yeux du pion, regard vers les cases à venir
        const f = w.fps;
        const eye = tokF.obj.position.clone().add(new THREE.Vector3(0, 0.62, 0));
        const ahead = cellWorld((tokF.cell ?? 0) + 3, 0.35);
        if (!f.look) { f.look = ahead.clone(); f.eye = eye.clone(); }
        f.look.lerp(ahead, 0.05);
        f.eye.lerp(eye, 0.25);
        if (!f.dragging) { f.yaw *= 0.97; f.pitch *= 0.97; }
        const dir = f.look.clone().sub(f.eye).normalize();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw);
        const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        dir.applyAxisAngle(side, f.pitch);
        camera.position.copy(f.eye);
        camera.lookAt(f.eye.clone().add(dir));
      } else {
        controls.update();
      }
      for (const tok of w.tokens.values()) {
        const p = tok.obj.position;
        const dx = tok.target.x - p.x;
        const dz = tok.target.z - p.z;
        const d = Math.hypot(dx, dz);
        p.x += dx * 0.18;
        p.z += dz * 0.18;
        p.y = CELL_H + Math.min(d, 1) * 0.45;
        if (tok.obj.userData.ring.visible) tok.obj.userData.ring.material.opacity = 0.5 + Math.sin(w.t * 5) * 0.35;
      }
      for (const c of cells) {
        const hl = w.highlights[c.cell.index];
        const targetY = CELL_H / 2 + (hl ? 0.12 + Math.sin(w.t * 6) * 0.04 : 0);
        c.group.position.y += (targetY - c.group.position.y) * 0.2;
      }
      w.scenery?.update(w.t);
      // en vue FPS la caméra est sur le plateau : rien à estomper
      if (w.mode !== 'fps' || w.cine) w.scenery?.fadeOccluders(camera, w.cine ? new THREE.Vector3() : controls.target, dt);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(w.raf);
      w.scenery?.dispose();
      window.removeEventListener('pointerup', onRelease);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      for (const c of cells) { c.tex.dispose(); c.mesh.geometry.dispose(); }
      el.removeChild(renderer.domElement);
      world.current = null;
    };
  }, []);

  // Thème : ciel, brouillard, lumières, décor autour du plateau et couleurs des cases
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const sc = (THEMES[themeId] || THEMES.nuit).scene;
    w.pal = sc;
    w.themeId = themeId;
    w.scene.fog.color.set(sc.fog);
    w.scene.fog.near = sc.fogNear;
    w.scene.fog.far = sc.fogFar;
    w.hemi.color.set(sc.hemi[0]);
    w.hemi.groundColor.set(sc.hemi[1]);
    w.hemi.intensity = sc.hemi[2];
    w.sun.color.set(sc.sun[0]);
    w.sun.intensity = sc.sun[1];
    w.base.material.color.set(sc.base);
    drawCenter(w.cc.getContext('2d'), 1024, sc);
    w.centerTex.needsUpdate = true;
    if (w.scenery) { w.scene.remove(w.scenery.group); w.scenery.dispose(); }
    w.scenery = buildScenery(sc);
    w.scene.add(w.scenery.group);
    w.refresh?.();
  }, [themeId]);

  // Mise à jour des cases (propriétaire, bâtiments, loyers)
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    w.highlights = highlights || {};
    const refresh = () => {
      for (const c of w.cells) {
        const prop = state.props[c.cell.index];
        const owner = prop?.owner && playerById(state, prop.owner);
        const hl = w.highlights[c.cell.index];
        const sig = [w.themeId, owner?.color, prop?.houses, currentRent(state, c.cell.index), w.flagsReady,
          c.cell.type === 'parking' ? state.pot : 0].join('|');
        if (sig !== c.sig) {
          c.sig = sig;
          drawCell(c.canvas.getContext('2d'), c.canvas.width, c.canvas.height, c.cell, state, w.pal);
          c.tex.needsUpdate = true;
        }
        c.side.color.set(hl === 'target' || hl === 'boom' ? '#ef4444' : owner ? owner.color : w.pal.cellSide);
        c.side.emissive.set(owner ? owner.color : '#000000');
        c.side.emissiveIntensity = owner ? 0.35 : 0;
        // pendant la cinématique, les bâtiments visés restent debout jusqu'à l'impact
        const n = w.cineHotel === c.cell.index ? w.cineHouses : prop?.houses || 0;
        if (n !== c.houseCount) { c.houseCount = n; buildHouses(c.houses, n, c.depth); }
      }
    };
    w.refresh = refresh;
    refresh();
  }, [state, highlights]);

  // Pions
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const alive = state.players.filter((p) => p.status === 'alive');
    const byCell = {};
    for (const p of alive) (byCell[positions[p.id] ?? p.pos] ||= []).push(p);
    const seen = new Set();
    for (const [pos, list] of Object.entries(byCell)) {
      list.forEach((p, k) => {
        seen.add(p.id);
        let tok = w.tokens.get(p.id);
        if (!tok || tok.color !== p.color) {
          if (tok) w.scene.remove(tok.obj);
          const obj = makePawn(p.color);
          const c0 = cellCenter(+pos);
          obj.position.set(c0.x - HALF, CELL_H, c0.y - HALF);
          w.scene.add(obj);
          tok = { obj, color: p.color, target: { x: 0, z: 0 } };
          w.tokens.set(p.id, tok);
        }
        const c = cellCenter(+pos);
        let { dx, dy } = tokenOffset(k, list.length);
        if (+pos === 10) {
          if (p.jail.in) { dx = dx * 0.6 + 0.25; dy = dy * 0.6 - 0.25; } else { dx = dx * 0.6 - 0.45; dy = dy * 0.6 + 0.45; }
        }
        tok.target = { x: c.x + dx - HALF, z: c.y + dy - HALF };
        tok.obj.userData.ring.visible = state.turn?.pid === p.id && state.phase === 'playing';
        tok.cell = +pos;
      });
    }
    for (const [id, tok] of w.tokens) {
      if (!seen.has(id)) { w.scene.remove(tok.obj); w.tokens.delete(id); }
    }
  }, [positions, state]);

  // Cinématiques : détournement d'avion ou arrestation
  useEffect(() => {
    const w = world.current;
    if (!w || !cinematic) return;
    w.cine?.dispose();
    w.controls.enabled = false;
    w.cineT = 0;
    if (cinematic.kind === 'busted') {
      w.cine = createBustedCinematic({
        scene: w.scene, camera: w.camera, from: cinematic.from, color: cinematic.color,
        onBusted: () => cineCueRef.current?.('busted'),
      });
      return;
    }
    w.cineHotel = cinematic.cell;
    w.cineHouses = cinematic.houses ?? 5;
    w.refresh?.();
    w.cine = createHijackCinematic({
      scene: w.scene, camera: w.camera, cells: w.cells,
      from: cinematic.from, cell: cinematic.cell, color: cinematic.color,
      onImpact: () => { w.cineHotel = null; w.refresh?.(); cineCueRef.current?.('impact'); },
    });
  }, [cinematic?.key]);

  // Bascule vue orbitale / vue FPS
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    w.followId = followId;
    if (w.mode === mode) return;
    w.mode = mode;
    const fps = mode === 'fps';
    w.controls.enabled = !fps;
    w.camera.fov = fps ? 75 : 42;
    w.camera.near = fps ? 0.03 : 0.1;
    w.camera.updateProjectionMatrix();
    Object.assign(w.fps, { yaw: 0, pitch: 0, look: null, eye: null });
    if (!fps) {
      w.camera.position.copy(ORBIT_CAMERA);
      w.controls.target.set(0, 0, 0);
      w.controls.update();
    }
  }, [mode, followId]);

  // le pion suivi est masqué en vue FPS (la caméra est dans sa tête)
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    // pendant l'arrestation, le pion arrêté est joué par la cinématique
    const hidden = cinematic?.kind === 'busted' ? cinematic.pid : null;
    for (const [id, tok] of w.tokens) tok.obj.visible = !(mode === 'fps' && id === followId) && id !== hidden;
  });

  return <div ref={mount} className="board3d" />;
}
