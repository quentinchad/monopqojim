import React, { useEffect, useRef } from 'react';
import { socket } from '../net.js';
import { playerById } from '../gameInfo.js';
import { sfx } from '../sound.js';

const KEYS = {
  up: ['KeyW', 'KeyZ', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'KeyQ', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

// Source par défaut : le combat simulé par le serveur. La page de démo fournit une simulation locale.
const socketSource = {
  subscribe: (fn) => { socket.on('fight', fn); return () => socket.off('fight', fn); },
  send: (inp) => socket.volatile.emit('fightInput', inp),
};

export default function FightOverlay({ state, me, source = socketSource, onClose }) {
  const meta = state.fight;
  const canvasRef = useRef(null);
  const fs = useRef(null); // dernier état reçu
  const input = useRef({ up: 0, down: 0, left: 0, right: 0, angle: 0, shoot: false, dash: false });
  const fighting = meta.ids.includes(me);
  const [p1, p2] = meta.ids.map((id) => playerById(state, id));

  useEffect(() => {
    return source.subscribe((s) => {
      const p = fs.current;
      fs.current = s;
      // bruitages : compte à rebours, tirs, touches, esquives, fin du duel
      if (!p) return;
      if (s.phase === 'countdown' && Math.ceil(s.timeLeft - 0.5) !== Math.ceil(p.timeLeft - 0.5)) sfx.beep();
      if (s.phase === 'fight' && p.phase === 'countdown') sfx.beep(true);
      if (s.phase === 'over' && p.phase !== 'over') sfx.gong();
      if (s.bullets.length > p.bullets.length) sfx.shot();
      for (const f of s.fighters) {
        const o = p.fighters.find((x) => x.id === f.id);
        if (!o) continue;
        if (f.hp < o.hp) sfx.hit();
        if (f.dash && !o.dash) sfx.dash();
      }
    });
  }, [source]);

  // commandes clavier/souris si on combat
  useEffect(() => {
    if (!fighting) return;
    const inp = input.current;
    const key = (down) => (e) => {
      for (const [k, codes] of Object.entries(KEYS)) if (codes.includes(e.code)) { inp[k] = down ? 1 : 0; e.preventDefault(); }
      if (e.code === 'Space') { inp.dash = down; e.preventDefault(); }
    };
    const kd = key(true);
    const ku = key(false);
    const toArena = (e) => {
      const c = canvasRef.current;
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * meta.W, y: ((e.clientY - r.top) / r.height) * meta.H };
    };
    const mm = (e) => {
      const f = fs.current?.fighters.find((x) => x.id === me);
      if (!f) return;
      const p = toArena(e);
      inp.angle = Math.atan2(p.y - f.y, p.x - f.x);
    };
    const md = (e) => { if (e.button === 0) { inp.shoot = true; mm(e); } };
    const mu = () => { inp.shoot = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    const iv = setInterval(() => source.send({ ...inp }), 33);
    return () => {
      clearInterval(iv);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mousedown', md);
      window.removeEventListener('mouseup', mu);
    };
  }, [fighting]);

  // rendu
  useEffect(() => {
    let raf;
    const colors = Object.fromEntries(meta.ids.map((id) => [id, playerById(state, id)?.color || '#fff']));
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      const s = fs.current;
      ctx.fillStyle = '#1a1426';
      ctx.fillRect(0, 0, meta.W, meta.H);
      // sol en grille
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < meta.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, meta.H); ctx.stroke(); }
      for (let y = 0; y < meta.H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(meta.W, y); ctx.stroke(); }
      // obstacles (caisses / barbelés du goulag)
      for (const o of meta.obstacles) {
        ctx.fillStyle = '#4b3b2a';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = '#8a6d4a';
        ctx.lineWidth = 3;
        ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
      }
      if (!s) return;
      ctx.fillStyle = '#fde047';
      for (const [x, y] of s.bullets) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
      for (const f of s.fighters) {
        if (f.hp <= 0) ctx.globalAlpha = 0.3;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.fillStyle = '#ddd';
        ctx.fillRect(10, -5, 22, 10); // canon
        ctx.restore();
        ctx.beginPath();
        ctx.arc(f.x, f.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = f.hit ? '#fff' : colors[f.id];
        ctx.fill();
        ctx.lineWidth = f.dash ? 6 : 3;
        ctx.strokeStyle = f.id === me ? '#fff' : 'rgba(0,0,0,.6)';
        ctx.stroke();
        ctx.globalAlpha = 1;
        // barre de vie
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(f.x - 25, f.y - 34, 50, 6);
        ctx.fillStyle = f.hp > 40 ? '#22c55e' : '#ef4444';
        ctx.fillRect(f.x - 25, f.y - 34, (50 * f.hp) / 100, 6);
      }
      ctx.textAlign = 'center';
      if (s.phase === 'countdown') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 110px Nunito, sans-serif';
        ctx.fillText(Math.max(1, Math.ceil(s.timeLeft - 0.5)).toString(), meta.W / 2, meta.H / 2 + 40);
      } else if (s.phase === 'fight') {
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.font = 'bold 26px Nunito, sans-serif';
        ctx.fillText(`${Math.ceil(s.timeLeft)} s`, meta.W / 2, 34);
      } else if (s.phase === 'over') {
        const w = playerById(state, s.winner);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, meta.H / 2 - 70, meta.W, 120);
        ctx.fillStyle = w?.color || '#fff';
        ctx.font = 'bold 48px Nunito, sans-serif';
        ctx.fillText(`${w?.name} retourne en jeu !`, meta.W / 2, meta.H / 2 + 10);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fight-overlay">
      <div className="fight-head">
        <span style={{ color: p1?.color }}>{p1?.name}</span>
        <span className="vs">⚔️ COMBAT DU GOULAG ⚔️</span>
        <span style={{ color: p2?.color }}>{p2?.name}</span>
      </div>
      <canvas ref={canvasRef} width={meta.W} height={meta.H} className="fight-canvas" />
      {onClose && <button className="btn tiny ghost fight-close" onClick={onClose}>✕ Fermer</button>}
      <div className="fight-help">
        {fighting
          ? 'Déplacement : ZQSD / WASD / flèches · Viser : souris · Tirer : clic gauche · Esquive : Espace — le perdant est éliminé définitivement !'
          : `Vous regardez le duel. Le vainqueur revient en jeu avec ${state.settings.goulagMoney} $.`}
      </div>
    </div>
  );
}
