import React, { useEffect, useRef, useState } from 'react';
import { playerById } from '../gameInfo.js';
import { createJailVisit, VISIT_DURATION, T_ENTER, T_BURST, T_CELL, T_LOOK, T_STEAL, T_GLOAT, T_LEAVE } from '../jailVisit.js';
import { jailVisitSound } from '../sound.js';

// Simple visite à la prison, montrée à tous : le visiteur détrousse le prisonnier allongé dans sa cellule
export default function JailVisitCinematic({ event, state, onEnd }) {
  const visitor = playerById(state, event.pid);
  const victim = playerById(state, event.victim);
  const mount = useRef(null);
  const [t, setT] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const el = mount.current;
    const film = createJailVisit({ container: el, visitor, victim, roomId: state.id, amount: event.amount });
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
      if (time >= VISIT_DURATION) { endRef.current?.(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const snd = jailVisitSound({ burst: T_BURST, cell: T_CELL, look: T_LOOK, steal: T_STEAL, gloat: T_GLOAT, leave: T_LEAVE, duration: VISIT_DURATION });
    // filet de sécurité si l'onglet est en arrière-plan
    const safety = setTimeout(() => endRef.current?.(), (VISIT_DURATION + 3) * 1000);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); snd.stop(); film.dispose(); };
  }, [event.id]);

  const name = (p) => <b style={{ color: p?.color }}>{p?.name}</b>;
  return (
    <div className="cinematic-overlay visit-overlay">
      <div className="cinematic-stage">
        <div ref={mount} className="board3d" />
        <div className="cinematic-bars top" />
        <div className="cinematic-bars bottom" />
        {t < T_ENTER && <div className="cinematic-caption visit">🔒 Prison · {name(victim)} purge sa peine…</div>}
        {t >= T_BURST + 0.4 && t < T_LOOK - 0.5 && <div className="cinematic-caption visit" key="burst">🚪💥 {name(visitor)} passe en « simple visite »</div>}
        {t >= T_LOOK - 0.5 && t < T_STEAL && <div className="cinematic-caption visit">{name(victim)} ne bouge pas…</div>}
        {t >= T_GLOAT && (
          <div className="cinematic-caption visit reveal" key="steal">
            🫳 {name(visitor)} vole <span className="visit-amount">{event.amount} $</span> à {name(victim)}
          </div>
        )}
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
