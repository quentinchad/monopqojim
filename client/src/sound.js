// Bruitages du jeu, synthétisés avec la Web Audio API (aucun fichier son à charger).
// Réglages par joueur (activé / volume) mémorisés dans le navigateur.
import { useEffect, useState } from 'react';

const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };

let enabled = read('mq_sound', '1') === '1';
let volume = Math.max(0, Math.min(1, +read('mq_volume', '0.7') || 0.7));
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn({ enabled, volume }));

let ctx = null;
let master = null;
let noiseBuf = null;

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// les navigateurs n'autorisent le son qu'après une interaction de l'utilisateur
if (typeof window !== 'undefined') {
  const unlock = () => { if (enabled) audio(); };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

export function setSoundEnabled(on) {
  enabled = !!on;
  write('mq_sound', enabled ? '1' : '0');
  if (ctx) {
    if (enabled) ctx.resume().catch(() => {});
    else ctx.suspend().catch(() => {});
  }
  if (enabled) audio();
  notify();
}

export function setSoundVolume(v) {
  volume = Math.max(0, Math.min(1, +v));
  write('mq_volume', String(volume));
  if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
  notify();
}

export function useSoundSettings() {
  const [s, setS] = useState({ enabled, volume });
  useEffect(() => { listeners.add(setS); return () => listeners.delete(setS); }, []);
  return s;
}

// ---------- primitives ----------
// Toutes acceptent `at` (décalage en secondes) et `out` (bus de sortie, sinon le volume général).

function env(g, t, vol, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, dur));
}

function tone({ f, f2, dur = 0.2, type = 'sine', vol = 0.2, at = 0, attack = 0.005, lp, out }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain();
  env(g, t, vol, attack, dur);
  let node = o;
  if (lp) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g).connect(out || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.2, at = 0, attack = 0.005, type = 'bandpass', f = 1000, f2, q = 1, out }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const s = a.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const fl = a.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  fl.Q.value = q;
  const g = a.createGain();
  env(g, t, vol, attack, dur);
  s.connect(fl).connect(g).connect(out || master);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

const notes = (list, { step = 0.09, type = 'triangle', vol = 0.16, dur = 0.25, at = 0, out } = {}) =>
  list.forEach((f, i) => f && tone({ f, type, vol, dur, at: at + i * step, out }));

// Bus pour un son long (cinématique) : peut être coupé net quand on passe la scène
function bus() {
  const a = audio();
  if (!a) return { out: null, stop() {} };
  const g = a.createGain();
  g.connect(master);
  return {
    out: g,
    stop() {
      g.gain.setTargetAtTime(0, a.currentTime, 0.08);
      setTimeout(() => g.disconnect(), 600);
    },
  };
}

// Son continu dont on automatise filtre et volume (vent, réacteur…)
function drone({ at = 0, dur, vol, points, type = 'bandpass', q = 1, out, osc }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const src = osc ? a.createOscillator() : a.createBufferSource();
  if (osc) { src.type = osc; } else { src.buffer = noiseBuf; src.loop = true; }
  const fl = a.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  const g = a.createGain();
  // points : [temps relatif, fréquence, volume relatif]
  points.forEach(([pt, f, v], i) => {
    const param = osc ? src.frequency : fl.frequency;
    const gv = Math.max(0.0001, vol * v);
    if (i === 0) { param.setValueAtTime(f, t + pt); g.gain.setValueAtTime(gv, t + pt); }
    else { param.linearRampToValueAtTime(f, t + pt); g.gain.linearRampToValueAtTime(gv, t + pt); }
  });
  if (osc) fl.frequency.value = 900;
  src.connect(fl).connect(g).connect(out || master);
  src.start(t);
  src.stop(t + dur + 0.1);
}

// ---------- bruitages ----------
let lastStep = 0;

export const sfx = {
  dice() {
    for (let i = 0; i < 9; i++) {
      const at = i * 0.065 + Math.random() * 0.03;
      noise({ at, dur: 0.035, vol: 0.35, f: 2500 + Math.random() * 2500, q: 4 });
      tone({ at, f: 1600 + Math.random() * 1200, dur: 0.03, type: 'triangle', vol: 0.05 });
    }
    for (const at of [0.66, 0.72]) {
      noise({ at, dur: 0.05, vol: 0.5, f: 1800, q: 3 });
      tone({ at, f: 900, f2: 600, dur: 0.06, type: 'triangle', vol: 0.12 });
    }
  },
  step() {
    const now = performance.now();
    if (now - lastStep < 60) return;
    lastStep = now;
    tone({ f: 480 + Math.random() * 120, f2: 300, dur: 0.06, vol: 0.09, type: 'triangle' });
    noise({ dur: 0.03, vol: 0.06, type: 'highpass', f: 3000 });
  },
  coin() { tone({ f: 988, dur: 0.08, type: 'square', vol: 0.06, lp: 4000 }); tone({ f: 1319, dur: 0.35, type: 'square', vol: 0.06, at: 0.07, lp: 4000 }); },
  pay() { tone({ f: 523, f2: 392, dur: 0.12, type: 'triangle', vol: 0.14 }); tone({ f: 392, f2: 262, dur: 0.18, type: 'triangle', vol: 0.12, at: 0.1 }); },
  buy() {
    noise({ dur: 0.05, vol: 0.25, f: 3500, q: 2 });
    tone({ f: 1568, dur: 0.5, vol: 0.1, at: 0.05 });
    tone({ f: 2093, dur: 0.6, vol: 0.08, at: 0.12 });
  },
  card() {
    noise({ dur: 0.28, vol: 0.22, type: 'bandpass', f: 900, f2: 6000, q: 0.8, attack: 0.04 });
    tone({ f: 660, dur: 0.2, vol: 0.06, at: 0.15 });
    tone({ f: 990, dur: 0.35, vol: 0.06, at: 0.24 });
  },
  yourTurn() { tone({ f: 784, dur: 0.5, vol: 0.14 }); tone({ f: 1175, dur: 0.8, vol: 0.12, at: 0.13 }); },
  build() {
    for (const at of [0, 0.17]) {
      noise({ at, dur: 0.06, vol: 0.45, type: 'lowpass', f: 700 });
      tone({ at, f: 190, f2: 90, dur: 0.09, vol: 0.3 });
    }
    tone({ f: 1046, dur: 0.3, vol: 0.06, at: 0.32 });
  },
  sell() { tone({ f: 330, f2: 220, dur: 0.15, type: 'triangle', vol: 0.12 }); sfx.coin(); },
  bid() { tone({ f: 1400, dur: 0.06, type: 'square', vol: 0.05, lp: 3000 }); },
  gavel() {
    for (const at of [0, 0.2, 0.4]) {
      noise({ at, dur: 0.05, vol: 0.45, f: 900, q: 2 });
      tone({ at, f: 320, f2: 200, dur: 0.08, type: 'triangle', vol: 0.22 });
    }
  },
  chime() { tone({ f: 660, dur: 0.35, vol: 0.14 }); tone({ f: 880, dur: 0.5, vol: 0.14, at: 0.14 }); },
  tradeDone() { notes([523, 659, 784, 1047], { step: 0.08, vol: 0.13 }); },
  refuse() { tone({ f: 196, f2: 140, dur: 0.35, type: 'sawtooth', vol: 0.1, lp: 700 }); },
  swap() {
    noise({ dur: 0.35, vol: 0.25, f: 400, f2: 3000, q: 1.5, attack: 0.1 });
    noise({ at: 0.35, dur: 0.35, vol: 0.25, f: 3000, f2: 400, q: 1.5, attack: 0.1 });
  },
  traffic() {
    tone({ f: 73, dur: 1.4, type: 'sawtooth', vol: 0.12, lp: 300, attack: 0.2 });
    tone({ f: 77.8, dur: 1.4, type: 'sawtooth', vol: 0.12, lp: 300, attack: 0.2 });
    for (const at of [0.1, 0.5, 0.9]) tone({ at, f: 110, f2: 55, dur: 0.18, vol: 0.25 });
  },
  pot() { for (let i = 0; i < 10; i++) tone({ at: i * 0.06 + Math.random() * 0.03, f: 1300 + Math.random() * 1300, dur: 0.18, type: 'square', vol: 0.035, lp: 5000 }); },
  goulag() {
    for (const at of [0, 0.14, 0.3]) {
      for (const m of [1, 2.76, 5.4]) tone({ at, f: 420 * m, dur: 0.25, vol: 0.05 });
      noise({ at, dur: 0.08, vol: 0.18, type: 'highpass', f: 4000 });
    }
    tone({ at: 0.45, f: 98, dur: 1, type: 'sawtooth', vol: 0.12, lp: 400 });
  },
  fightStart() { for (const at of [0, 0.35, 0.7]) tone({ at, f: 90, f2: 45, dur: 0.3, vol: 0.4 }); },
  goulagWin() { notes([392, 523, 659, 784, null, 659, 784], { step: 0.11, vol: 0.14, dur: 0.3 }); },
  bankrupt() {
    [392, 370, 349, 294].forEach((f, i) => tone({ at: i * 0.38, f, f2: i === 3 ? 262 : f * 0.97, dur: i === 3 ? 0.9 : 0.34, type: 'sawtooth', vol: 0.12, lp: 900 }));
  },
  win() {
    notes([523, 659, 784, 1047], { step: 0.12, vol: 0.14, dur: 0.3 });
    for (const f of [523, 659, 784, 1047]) tone({ at: 0.55, f, dur: 1.4, type: 'triangle', vol: 0.08 });
    sfx.pot();
  },
  disconnect() { tone({ f: 600, f2: 300, dur: 0.25, vol: 0.1 }); },
  reconnect() { tone({ f: 300, f2: 600, dur: 0.25, vol: 0.1 }); },
  error() { tone({ f: 220, dur: 0.12, type: 'square', vol: 0.05, lp: 1200 }); },

  // ---------- casino ----------
  lever() {
    for (let i = 0; i < 6; i++) noise({ at: i * 0.045, dur: 0.02, vol: 0.25, f: 2200, q: 5 });
    tone({ at: 0.28, f: 220, f2: 110, dur: 0.25, type: 'triangle', vol: 0.15 });
  },
  reels(stops) {
    let t = 0.15;
    while (t < stops[stops.length - 1]) {
      const left = stops.filter((s) => s > t).length;
      tone({ at: t, f: 1800 + left * 200, dur: 0.02, type: 'square', vol: 0.025 + left * 0.008, lp: 5000 });
      t += 0.055 + (t > stops[0] ? 0.01 : 0);
    }
    stops.forEach((at) => {
      tone({ at, f: 160, f2: 70, dur: 0.12, vol: 0.35 });
      noise({ at, dur: 0.05, vol: 0.3, type: 'lowpass', f: 900 });
    });
  },
  slotWin() { notes([784, 988, 1175, 1568], { step: 0.07, type: 'square', vol: 0.06, dur: 0.18 }); sfx.pot(); },
  jackpot() {
    notes([523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093], { step: 0.08, type: 'square', vol: 0.06, dur: 0.2 });
    for (let k = 0; k < 4; k++) tone({ at: 0.8 + k * 0.25, f: 2093, dur: 0.4, vol: 0.06 });
    for (let i = 0; i < 25; i++) tone({ at: 0.6 + i * 0.07, f: 1200 + Math.random() * 1600, dur: 0.15, type: 'square', vol: 0.03, lp: 5000 });
  },
  slotLose() { [392, 370, 349, 330].forEach((f, i) => tone({ at: i * 0.26, f, f2: f * 0.96, dur: i === 3 ? 0.7 : 0.24, type: 'sawtooth', vol: 0.09, lp: 800 })); },

  // ---------- duel du goulag ----------
  shot() { tone({ f: 1100, f2: 160, dur: 0.09, type: 'square', vol: 0.05, lp: 3500 }); noise({ dur: 0.04, vol: 0.12, type: 'highpass', f: 2500 }); },
  hit() { noise({ dur: 0.09, vol: 0.4, type: 'lowpass', f: 900 }); tone({ f: 220, f2: 80, dur: 0.12, vol: 0.25 }); },
  dash() { noise({ dur: 0.18, vol: 0.2, f: 600, f2: 3000, q: 1.2, attack: 0.03 }); },
  beep(go = false) { tone({ f: go ? 1320 : 880, dur: go ? 0.4 : 0.12, type: 'square', vol: 0.06, lp: 3000 }); },
  gong() { for (const m of [1, 2.4, 3.9, 5.2]) tone({ f: 130 * m, dur: 2.2 / m + 0.4, vol: 0.12 / m, attack: 0.01 }); },
};

// ---------- cinématiques (renvoient un bus à couper si on passe la scène) ----------
export function hijackSound() {
  const b = bus();
  const out = b.out;
  if (!out) return b;
  tone({ out, f: 110, dur: 1.2, type: 'sawtooth', vol: 0.1, lp: 500, attack: 0.1 });
  // réacteurs : roulage, décollage puis vol
  drone({ out, dur: 6.8, vol: 0.5, type: 'bandpass', q: 0.8, points: [[0, 300, 0.05], [1.4, 400, 0.3], [3.0, 1400, 0.9], [5.5, 1000, 1], [6.6, 1600, 1.2], [6.7, 1600, 0]] });
  drone({ out, osc: 'sawtooth', dur: 6.7, vol: 0.05, points: [[0, 70, 0.2], [1.4, 90, 0.6], [3, 160, 1], [6.6, 210, 1.2], [6.65, 210, 0]] });
  // explosion
  noise({ out, at: 6.6, dur: 2.4, vol: 1, type: 'lowpass', f: 4000, f2: 120, attack: 0.01 });
  tone({ out, at: 6.6, f: 70, f2: 28, dur: 1.6, vol: 0.7 });
  for (let i = 0; i < 14; i++) noise({ out, at: 6.9 + Math.random() * 1.5, dur: 0.04, vol: 0.15, f: 2000 + Math.random() * 3000, q: 3 });
  return b;
}

export function bustedSound() {
  const b = bus();
  const out = b.out;
  if (!out) return b;
  // sirène deux tons
  const a = audio();
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = 'sawtooth';
  for (let k = 0; k * 0.38 < 4.7; k++) o.frequency.setValueAtTime(k % 2 ? 960 : 720, t + k * 0.38);
  const fl = a.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.value = 1800;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.3);
  g.gain.setValueAtTime(0.06, t + 4.4);
  g.gain.linearRampToValueAtTime(0.0001, t + 4.9);
  o.connect(fl).connect(g).connect(out);
  o.start(t);
  o.stop(t + 5);
  // course : pas précipités
  for (let s = 1.1; s < 4.25; s += 0.15) noise({ out, at: s, dur: 0.04, vol: 0.18, type: 'lowpass', f: 500 });
  // voiture qui freine
  noise({ out, at: 3.7, dur: 0.5, vol: 0.25, f: 2500, f2: 1800, q: 6, attack: 0.05 });
  // plaquage
  noise({ out, at: 4.3, dur: 0.25, vol: 0.9, type: 'lowpass', f: 600 });
  tone({ out, at: 4.3, f: 120, f2: 40, dur: 0.3, vol: 0.6 });
  // « BUSTED »
  noise({ out, at: 4.5, dur: 0.4, vol: 0.3, f: 300, f2: 4000, q: 0.7, attack: 0.35 });
  for (const f of [110, 131, 165, 220]) tone({ out, at: 4.9, f, dur: 2.2, type: 'sawtooth', vol: 0.09, lp: 900, attack: 0.01 });
  tone({ out, at: 4.9, f: 55, dur: 1.5, vol: 0.4 });
  return b;
}

// « Say my name » : vent du désert, tension qui monte, coup sourd sur le titre
export function sayMyNameSound({ title = 15.2, duration = 18 } = {}) {
  const b = bus();
  const out = b.out;
  if (!out) return b;
  drone({ out, dur: duration, vol: 0.22, type: 'bandpass', q: 0.6, points: [[0, 500, 0], [1.5, 700, 1], [4, 450, 0.7], [7, 800, 1], [10, 500, 0.6], [13, 700, 0.8], [duration - 0.5, 600, 0.6], [duration, 600, 0]] });
  // nappe grave qui enfle jusqu'au titre
  for (const f of [55, 82.4]) {
    drone({ out, osc: 'sine', dur: title + 0.2, vol: 0.12, type: 'lowpass', points: [[0, f, 0], [3.4, f, 0.3], [9, f, 0.6], [title - 0.1, f, 1], [title + 0.1, f, 0]] });
  }
  // battements de cœur avant « Heisenberg »
  for (const at of [9.3, 9.55, 10.0, 10.25]) tone({ out, at, f: 60, f2: 40, dur: 0.15, vol: 0.5 });
  tone({ out, at: 10.3, f: 98, dur: 1.6, type: 'sawtooth', vol: 0.06, lp: 400, attack: 0.05 });
  // montée puis impact du titre, accord de guitare sèche
  noise({ out, at: title - 0.9, dur: 0.9, vol: 0.25, type: 'highpass', f: 2000, f2: 8000, attack: 0.85 });
  tone({ out, at: title, f: 65, f2: 30, dur: 2.2, vol: 0.8 });
  noise({ out, at: title, dur: 1.4, vol: 0.5, type: 'lowpass', f: 2000, f2: 100 });
  [82.4, 123.5, 164.8, 196, 246.9].forEach((f, i) => tone({ out, at: title + 0.25 + i * 0.03, f, dur: 2.6, type: 'sawtooth', vol: 0.05, lp: 1400 }));
  return b;
}

// Son associé à une annonce (bannière d'évènement)
export function eventSound(type) {
  const fn = {
    card: sfx.card, traffic: sfx.traffic, pot: sfx.pot, swap: sfx.swap, goulag: sfx.goulag,
    fight: sfx.fightStart, goulagWin: sfx.goulagWin, bankrupt: sfx.bankrupt, win: sfx.win,
    trade: sfx.tradeDone, disconnect: sfx.disconnect, reconnect: sfx.reconnect, jail: sfx.refuse,
  }[type];
  fn?.();
}
