import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../net.js';
import { playerById } from '../gameInfo.js';
import { sfx, duelIntroSound } from '../sound.js';
import { createDuelArena } from '../duelArena.js';
import { createDuelIntro, INTRO_DURATION, T_WALK_A, T_WALK_B } from '../duelIntro.js';

// Source par défaut : le combat simulé par le serveur. La page de démo fournit une simulation locale.
const socketSource = {
  subscribe: (fn) => { socket.on('fight', fn); return () => socket.off('fight', fn); },
  send: (inp) => socket.volatile.emit('fightInput', inp),
};

const FORWARD = ['KeyW', 'KeyZ', 'ArrowUp'];
const BACK = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'KeyQ'];
const RIGHT = ['KeyD'];
const SENS = 0.0024;

const hpColor = (hp) => (hp > 50 ? '#16a34a' : hp > 25 ? '#d97706' : '#dc2626');

// Le serveur ferme le duel quelques secondes après la mort ; si son message se perd, on se retire quand même.
const OVER_FALLBACK = 8;

export default function FightOverlay(props) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return <FightView {...props} onDone={() => { setGone(true); props.onClose?.(); }} />;
}

function FightView({ state, me, source = socketSource, onClose, onDone }) {
  const meta = state.fight;
  const stageRef = useRef(null);
  const introRef = useRef(null);
  const fs = useRef(null); // dernier état reçu
  const yaw = useRef(null); // regard du combattant local (vue à la première personne)
  const pitch = useRef(0); // inclinaison verticale du regard
  const keys = useRef({ fwd: 0, back: 0, left: 0, right: 0, turnL: 0, turnR: 0 });
  const input = useRef({ shoot: false, melee: false, dash: false });
  const arenaRef = useRef(null);
  const fighting = meta.ids.includes(me);
  const players = meta.ids.map((id) => playerById(state, id));
  const [p1, p2] = players;
  const [hud, setHud] = useState(null);
  const [locked, setLocked] = useState(false);
  const [skipIntro, setSkipIntro] = useState(false);
  const [hitMark, setHitMark] = useState(0);
  const [hurt, setHurt] = useState(0);
  const intro = useRef({ t: null, at: 0 }); // synchro de l'intro sur le serveur

  // ---------- évènements du combat : sons, effets 3D, interface ----------
  useEffect(() => {
    let lastHud = 0;
    let lastRic = 0;
    return source.subscribe((s) => {
      const p = fs.current;
      fs.current = s;
      if (s.phase === 'intro') intro.current = { t: INTRO_DURATION - s.timeLeft, at: performance.now() };
      // le combattant regarde son adversaire au départ
      if (fighting && yaw.current == null) {
        const mine = s.fighters.find((f) => f.id === me);
        const foe = s.fighters.find((f) => f.id !== me);
        if (mine && foe) yaw.current = Math.atan2(foe.y - mine.y, foe.x - mine.x);
      }
      for (const e of s.events || []) {
        arenaRef.current?.onEvent(e, s);
        if (e.type === 'shot') {
          if (e.kind === 'shotgun') sfx.shotgun(); else sfx.shot();
        } else if (e.type === 'hit') {
          if (e.kind === 'slash') sfx.slash(); else sfx.hit();
          if (e.victim === me) setHurt(performance.now() + (e.kind === 'slash' ? 600 : 350));
          else if (fighting) setHitMark(performance.now() + 180);
        } else if (e.type === 'swing') sfx.swish();
        else if (e.type === 'ricochet') {
          if (performance.now() - lastRic > 120) { lastRic = performance.now(); sfx.ricochet(); }
        } else if (e.type === 'pickup') sfx.cock();
        else if (e.type === 'death') { sfx.gore(); sfx.scream(); }
      }
      if (p) {
        if (s.phase === 'countdown' && p.phase === 'countdown' && Math.ceil(s.timeLeft - 0.5) !== Math.ceil(p.timeLeft - 0.5)) sfx.beep();
        if (s.phase === 'countdown' && p.phase === 'intro') sfx.beep();
        if (s.phase === 'fight' && p.phase === 'countdown') sfx.beep(true);
        for (const f of s.fighters) {
          const o = p.fighters.find((x) => x.id === f.id);
          if (o && f.dash && !o.dash) sfx.dash();
        }
      }
      // l'interface HTML est rafraîchie ~10 fois par seconde (et à chaque changement de phase)
      const now = performance.now();
      if (now - lastHud > 100 || !p || p.phase !== s.phase) {
        lastHud = now;
        setHud({ phase: s.phase, timeLeft: s.timeLeft, winner: s.winner, fighters: s.fighters.map((f) => ({ id: f.id, hp: f.hp, weapon: f.weapon, ammo: f.ammo, bleeding: f.bleeding, dashCd: f.dashCd })) });
      }
    });
  }, [source]);

  // ---------- retour automatique à la partie une fois le duel fini ----------
  const over = hud?.phase === 'over';
  useEffect(() => {
    if (!over) return undefined;
    if (document.pointerLockElement) document.exitPointerLock();
    const t = setTimeout(onDone, OVER_FALLBACK * 1000);
    return () => clearTimeout(t);
  }, [over]);

  // partie mise en pause : on rend la souris
  useEffect(() => {
    if (state.pause?.on && document.pointerLockElement) document.exitPointerLock();
  }, [state.pause?.on]);

  // ---------- arène 3D ----------
  useEffect(() => {
    const stage = stageRef.current;
    const arena = createDuelArena({ container: stage, meta, players, roomId: state.id, me });
    arenaRef.current = arena;
    let raf;
    let last = performance.now();
    let w = 0;
    let h = 0;
    let beat = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (stage.clientWidth !== w || stage.clientHeight !== h) { w = stage.clientWidth; h = stage.clientHeight; arena.resize(w, h); }
      const k = keys.current;
      if (yaw.current != null) yaw.current += (k.turnR - k.turnL) * dt * 2.4;
      arena.render(fs.current, fighting ? yaw.current : null, dt, pitch.current);
      // à l'agonie : battements de cœur
      const mine = fs.current?.fighters.find((f) => f.id === me);
      if (mine && mine.hp > 0 && mine.hp < 30 && fs.current.phase === 'fight') {
        beat += dt;
        if (beat > 0.75) { beat = 0; sfx.heartbeat(); }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); arena.dispose(); arenaRef.current = null; };
  }, []);

  // ---------- intro : face-à-face puis entrée dans l'arène ----------
  const showIntro = hud?.phase === 'intro' && !skipIntro;
  useEffect(() => {
    if (!showIntro) return undefined;
    const box = introRef.current;
    const film = createDuelIntro({ container: box, a: p1, b: p2, roomId: state.id });
    const elapsed = () => {
      const s = intro.current;
      return s.t == null ? 0 : s.t + (performance.now() - s.at) / 1000;
    };
    const snd = duelIntroSound({ from: elapsed(), walkA: T_WALK_A, walkB: T_WALK_B, duration: INTRO_DURATION });
    let raf;
    let w = 0;
    let h = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (box.clientWidth !== w || box.clientHeight !== h) { w = box.clientWidth; h = box.clientHeight; film.resize(w, h); }
      film.update(Math.min(INTRO_DURATION - 0.01, elapsed()));
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); snd.stop(); film.dispose(); };
  }, [showIntro]);

  // ---------- commandes : souris verrouillée pour viser, ZQSD relatifs au regard ----------
  useEffect(() => {
    if (!fighting) return undefined;
    const k = keys.current;
    const inp = input.current;
    const canvas = () => arenaRef.current?.canvas;
    const key = (down) => (e) => {
      const v = down ? 1 : 0;
      let used = true;
      if (FORWARD.includes(e.code)) k.fwd = v;
      else if (BACK.includes(e.code)) k.back = v;
      else if (LEFT.includes(e.code)) k.left = v;
      else if (RIGHT.includes(e.code)) k.right = v;
      else if (e.code === 'ArrowLeft') k.turnL = v;
      else if (e.code === 'ArrowRight') k.turnR = v;
      else if (e.code === 'Space') inp.dash = down;
      else if (e.code === 'KeyF' || e.code === 'KeyE') inp.melee = down;
      else if (e.code === 'ControlLeft' || e.code === 'Enter') inp.shoot = down;
      else used = false;
      if (used) e.preventDefault();
    };
    const kd = key(true);
    const ku = key(false);
    const isLocked = () => document.pointerLockElement && document.pointerLockElement === canvas();
    const mm = (e) => {
      if (!isLocked() || yaw.current == null) return;
      yaw.current += e.movementX * SENS;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - e.movementY * SENS));
    };
    const md = (e) => {
      if (!isLocked()) return;
      if (e.button === 0) inp.shoot = true;
      if (e.button === 2) inp.melee = true;
    };
    const mu = (e) => { if (e.button === 0) inp.shoot = false; if (e.button === 2) inp.melee = false; };
    const lockChange = () => { const l = isLocked(); setLocked(!!l); if (!l) { inp.shoot = false; inp.melee = false; } };
    const noMenu = (e) => e.preventDefault();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    document.addEventListener('mousemove', mm);
    document.addEventListener('mousedown', md);
    document.addEventListener('mouseup', mu);
    document.addEventListener('pointerlockchange', lockChange);
    document.addEventListener('contextmenu', noMenu);
    const iv = setInterval(() => {
      const a = yaw.current ?? 0;
      const fwd = k.fwd - k.back;
      const side = k.right - k.left;
      // déplacement relatif au regard : avant = (cos, sin), droite = (-sin, cos)
      const mx = fwd * Math.cos(a) - side * Math.sin(a);
      const my = fwd * Math.sin(a) + side * Math.cos(a);
      source.send({ up: 0, down: 0, left: 0, right: 0, mx, my, angle: a, shoot: inp.shoot, melee: inp.melee, dash: inp.dash });
    }, 33);
    return () => {
      clearInterval(iv);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mousedown', md);
      document.removeEventListener('mouseup', mu);
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('contextmenu', noMenu);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [fighting]);

  const lock = () => {
    const c = arenaRef.current?.canvas;
    if (!fighting || !c || document.pointerLockElement) return;
    try { const r = c.requestPointerLock(); r?.catch?.(() => {}); } catch { /* verrouillage refusé */ }
  };

  const close = () => { if (document.pointerLockElement) document.exitPointerLock(); onClose?.(); };

  const now = performance.now();
  const mine = hud?.fighters.find((f) => f.id === me);
  const winner = hud && players.find((p) => p?.id === hud.winner);
  const walkTime = intro.current.t ?? 0;
  const walker = walkTime >= T_WALK_B ? p2 : p1;

  return (
    <div className="fight-overlay fight3d">
      <div ref={stageRef} className="fight-stage" onClick={lock} />

      {/* barres de vie */}
      {hud && hud.phase !== 'intro' && (
        <div className="fight-bars">
          {hud.fighters.map((f, i) => {
            const p = players.find((x) => x?.id === f.id);
            return (
              <div key={f.id} className={`fight-bar ${i ? 'right' : ''}`}>
                <div className="fb-name" style={{ color: p?.color }}>{p?.name}{f.bleeding ? ' 🩸' : ''}</div>
                <div className="fb-track"><div className="fb-fill" style={{ width: `${f.hp}%`, background: hpColor(f.hp) }} /></div>
                <div className="fb-weapon">{f.weapon === 'shotgun' ? `Fusil à pompe ×${f.ammo}` : 'Pistolet · Machette'}</div>
              </div>
            );
          })}
          {hud.phase === 'fight' && <div className={`fight-timer ${hud.timeLeft < 10 ? 'low' : ''}`}>{Math.ceil(hud.timeLeft)}</div>}
        </div>
      )}

      {/* vue à la première personne : réticule, marqueur de touche, écran rouge */}
      {fighting && mine && mine.hp > 0 && hud.phase !== 'intro' && hud.phase !== 'over' && (
        <>
          <div className={`fight-crosshair ${hitMark > now ? 'hit' : ''}`} />
          <div className="fight-ammo">
            {mine.weapon === 'shotgun' ? <><b>{mine.ammo}</b> cartouches</> : <><b>∞</b> pistolet</>}
            <span className={mine.dashCd > 0 ? 'cd' : ''}>Roulade {mine.dashCd > 0 ? '…' : 'prête'}</span>
          </div>
        </>
      )}
      {fighting && <div className={`fight-hurt ${hurt > now ? 'on' : ''} ${mine && mine.hp > 0 && mine.hp < 30 ? 'dying' : ''}`} />}

      {hud?.phase === 'countdown' && (
        <div className="fight-count">
          <div className="fc-num" key={Math.ceil(hud.timeLeft - 0.5)}>{Math.max(1, Math.ceil(hud.timeLeft - 0.5))}</div>
          <div className="fc-sub">UN SEUL SORTIRA VIVANT</div>
        </div>
      )}
      {hud?.phase === 'over' && (
        <div className="fight-over">
          <div className="fo-title">EXÉCUTÉ</div>
          <div className="fo-sub" style={{ color: winner?.color }}>{winner?.name} sort vivant du goulag</div>
          <div className="fo-back">Retour à la partie dans {Math.max(1, Math.ceil(hud.timeLeft || 0))} s…</div>
        </div>
      )}

      {fighting && !locked && hud && (hud.phase === 'countdown' || hud.phase === 'fight') && (
        <button className="fight-lock" onClick={lock}>🖱️ Cliquez pour verrouiller la visée</button>
      )}

      {/* intro, au-dessus de tout */}
      {showIntro && (
        <div className="fight-intro">
          <div ref={introRef} className="cinematic-stage" />
          <div className="cinematic-bars top" />
          <div className="cinematic-bars bottom" />
          {walkTime < T_WALK_A ? (
            <div className="fi-vs" key="vs">
              <span style={{ color: p1?.color }}>{p1?.name}</span>
              <b>VS</b>
              <span style={{ color: p2?.color }}>{p2?.name}</span>
              <small>Duel à mort du goulag</small>
            </div>
          ) : (
            <div className="fi-walk" key={walker?.id} style={{ borderColor: walker?.color }}>
              <small>Entrée dans l'arène</small>
              <span style={{ color: walker?.color }}>{walker?.name}</span>
            </div>
          )}
          <button className="btn tiny ghost cinematic-skip" onClick={() => setSkipIntro(true)}>Passer ⏭</button>
        </div>
      )}

      {state.pause?.on && <div className="fight-paused">⏸️ Partie en pause — le duel reprendra au vote</div>}
      {onClose && <button className="btn tiny ghost fight-close" onClick={close}>✕ Fermer</button>}
      {hud?.phase !== 'intro' && (
        <div className="fight-help">
          {fighting
            ? 'Souris : viser · ZQSD / WASD : bouger · Clic gauche : tirer · Clic droit ou F : machette · Espace : roulade · Échap : libérer la souris'
            : `Vous regardez le duel. Le survivant revient en jeu avec ${state.settings.goulagMoney} $.`}
        </div>
      )}
    </div>
  );
}
