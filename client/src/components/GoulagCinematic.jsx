import React, { useEffect, useRef, useState } from 'react';
import { playerById } from '../gameInfo.js';
import { createGoulag, GOULAG_DURATION, T_GUARDS, T_DOOR } from '../goulag.js';
import { goulagSound } from '../sound.js';

// Départ au goulag, montré à tous : escorte musclée, gardes à lunettes noires, porte qui claque
export default function GoulagCinematic({ event, state, onEnd }) {
  const p = playerById(state, event.pid);
  const mount = useRef(null);
  const [t, setT] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const el = mount.current;
    const film = createGoulag({ container: el, player: p, roomId: state.id });
    let size = '';
    let raf;
    let last = performance.now();
    let time = 0;
    let shown = -1;
    const tick = (now) => {
      // suit le temps réel, même si l'ordinateur affiche peu d'images par seconde
      time += Math.min(0.5, (now - last) / 1000);
      last = now;
      const sig = `${el.clientWidth}x${el.clientHeight}`;
      if (sig !== size) { size = sig; film.resize(el.clientWidth, el.clientHeight); }
      film.update(time);
      const tenth = Math.floor(time * 10);
      if (tenth !== shown) { shown = tenth; setT(time); }
      if (time >= GOULAG_DURATION) { endRef.current?.(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const snd = goulagSound({ guards: T_GUARDS, door: T_DOOR, duration: GOULAG_DURATION });
    // filet de sécurité si l'onglet est en arrière-plan
    const safety = setTimeout(() => endRef.current?.(), (GOULAG_DURATION + 3) * 1000);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); snd.stop(); film.dispose(); };
  }, [event.id]);

  return (
    <div className={`cinematic-overlay goulag-overlay ${t > T_DOOR + 0.6 ? 'is-closed' : ''}`}>
      <div className="cinematic-stage">
        <div ref={mount} className="board3d" />
        <div className="goulag-grade" />
        <div className="cinematic-bars top" />
        <div className="cinematic-bars bottom" />
        {t < T_GUARDS && (
          <div className="goulag-caption">
            <small>Faillite</small>
            <b style={{ color: p?.color }}>{p?.name}</b> part au goulag sous escorte…
          </div>
        )}
        {t >= T_GUARDS && t < T_DOOR && <div className="goulag-caption quiet">On l’attendait.</div>}
        {t > T_DOOR + 0.6 && (
          <div className="goulag-end">
            <div className="ge-title">⛓️ GOULAG</div>
            <div className="ge-sub">Seule issue : gagner un duel.</div>
          </div>
        )}
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
