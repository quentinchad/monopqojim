import React, { useEffect, useRef, useState } from 'react';
import { playerById } from '../gameInfo.js';
import { RULES } from '../../../shared/board.js';
import { createVichy, VICHY_DURATION, T_SHAKE, T_POSE, T_PHOTO } from '../vichy.js';
import { vichySound } from '../sound.js';

// Carte « Régime de Vichy » : poignée de main historique sur le quai de la gare, façon actualités d'époque
export default function VichyCinematic({ event, state, onEnd }) {
  const a = playerById(state, event.pid);
  const b = playerById(state, event.partner);
  const mount = useRef(null);
  const [t, setT] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const el = mount.current;
    const film = createVichy({ container: el, a, b, roomId: state.id });
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
      if (time >= VICHY_DURATION) { endRef.current?.(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const snd = vichySound({ shake: T_SHAKE, pose: T_POSE, photo: T_PHOTO, duration: VICHY_DURATION });
    // filet de sécurité si l'onglet est en arrière-plan
    const safety = setTimeout(() => endRef.current?.(), (VICHY_DURATION + 3) * 1000);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); snd.stop(); film.dispose(); };
  }, [event.id]);

  const name = (p) => <b>{p?.name}</b>;
  const photo = t >= T_PHOTO;
  return (
    <div className={`cinematic-overlay vichy-overlay ${photo ? 'is-photo' : ''}`}>
      <div className="cinematic-stage">
        <div ref={mount} className="board3d" />
        <div className="vichy-grain" />
        <div className="vichy-vignette" />
        {photo && <div className="vichy-flash" key="flash" />}
        <div className="cinematic-bars top" />
        <div className="cinematic-bars bottom" />
        {t < T_SHAKE && (
          <div className="vichy-card">
            <small>Les Actualités</small>
            Entrevue en gare de Montoire
          </div>
        )}
        {t >= T_SHAKE + 0.3 && t < T_POSE && (
          <div className="vichy-card">{name(a)} et {name(b)} scellent leur collaboration</div>
        )}
        {photo && (
          <div className="vichy-title">
            <div className="vt-head">🤝 RÉGIME DE VICHY</div>
            <div className="vt-names">{name(a)} &amp; {name(b)}</div>
            <div className="vt-sub">Collaboration pendant {RULES.VICHY_ROUNDS} tours de table : pas de loyer entre eux, villes en commun, loyers partagés</div>
          </div>
        )}
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
