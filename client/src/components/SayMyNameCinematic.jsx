import React, { useEffect, useRef, useState } from 'react';
import { RULES } from '../../../shared/board.js';
import { playerById, money } from '../gameInfo.js';
import { createSayMyName, LINES, SAY_MY_NAME_DURATION, T_TITLE } from '../saymyname.js';
import { sayMyNameSound } from '../sound.js';

// Cinématique « Say my name » montrée à tous quand un trafiquant livre sa marchandise
export default function SayMyNameCinematic({ event, state, onEnd }) {
  const p = playerById(state, event.pid);
  const mount = useRef(null);
  const [t, setT] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const el = mount.current;
    const film = createSayMyName({ container: el, color: p?.color });
    // la taille est vérifiée à chaque image (fiable même si l'onglet était en arrière-plan à l'ouverture)
    let size = '';
    const fit = () => {
      const sig = `${el.clientWidth}x${el.clientHeight}`;
      if (sig !== size) { size = sig; film.resize(el.clientWidth, el.clientHeight); }
    };
    let raf;
    let last = performance.now();
    let time = 0;
    let shown = -1;
    const tick = (now) => {
      // suit le temps réel, même si l'ordinateur affiche peu d'images par seconde
      time += Math.min(0.5, (now - last) / 1000);
      last = now;
      fit();
      film.update(time);
      const tenth = Math.floor(time * 10);
      if (tenth !== shown) { shown = tenth; setT(time); }
      if (time >= SAY_MY_NAME_DURATION) { endRef.current?.(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const snd = sayMyNameSound({ title: T_TITLE, duration: SAY_MY_NAME_DURATION });
    // filet de sécurité si l'onglet est en arrière-plan
    const safety = setTimeout(() => endRef.current?.(), (SAY_MY_NAME_DURATION + 3) * 1000);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); snd.stop(); film.dispose(); };
  }, [event.id]);

  const line = LINES.find((l) => t >= l.from && t <= l.to);
  return (
    <div className="cinematic-overlay smn">
      <div className="cinematic-stage">
        <div ref={mount} className="board3d" />
        <div className="smn-grade" />
        <div className="cinematic-bars top" />
        <div className="cinematic-bars bottom" />
        {t < 3.2 && <div className="smn-place">Quelque part dans le désert du Nouveau-Mexique…</div>}
        {line && (
          <div className="smn-sub">
            <small style={{ color: line.who === 'walt' ? '#fde68a' : p?.color }}>{line.who === 'walt' ? 'Heisenberg' : p?.name}</small>
            {line.text}
          </div>
        )}
        {t >= T_TITLE && (
          <div className="smn-title">
            <div className="smn-logo"><span className="el"><i>2</i>He</span>isenberg</div>
            <div className="smn-gain">
              <b style={{ color: p?.color }}>{p?.name}</b> a livré la marchandise : <b className="plus">+{money(RULES.TRAFFIC_BONUS)}</b>
            </div>
          </div>
        )}
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
