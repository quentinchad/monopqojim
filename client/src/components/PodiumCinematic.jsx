import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPodium } from '../podium.js';
import { finalRanking } from '../gameInfo.js';
import { sfx } from '../sound.js';

const PLACE = { 1: '🥇 1er', 2: '🥈 2e', 3: '🥉 3e' };

// Podium 3D de fin de partie, montré à tous avant les statistiques
export default function PodiumCinematic({ state, onEnd }) {
  const ranking = useMemo(() => finalRanking(state), [state.id, state.winner]);
  const mount = useRef(null);
  const [shown, setShown] = useState([]); // joueurs déjà présentés
  const [caption, setCaption] = useState(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const el = mount.current;
    const podium = createPodium({
      container: el,
      ranking,
      roomId: state.id,
      onStep: (step, phase) => {
        if (phase === 'start') {
          setCaption(step);
          if (step.drumroll) sfx.drumroll(1.1);
        } else {
          setShown((s) => [...s, step]);
          if (step.isWinner) { sfx.win(); sfx.cheer(); } else sfx.land();
        }
      },
    });
    let size = '';
    let raf;
    let last = performance.now();
    let time = 0;
    const tick = (now) => {
      const dt = Math.min(0.5, (now - last) / 1000);
      time += dt;
      last = now;
      const sig = `${el.clientWidth}x${el.clientHeight}`;
      if (sig !== size) { size = sig; podium.resize(el.clientWidth, el.clientHeight); }
      podium.update(time, Math.min(dt, 0.1));
      if (time >= podium.duration) { endRef.current?.(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // filet de sécurité si l'onglet est en arrière-plan
    const safety = setTimeout(() => endRef.current?.(), (podium.duration + 4) * 1000);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); podium.dispose(); };
  }, []);

  const rankLabel = (r) => PLACE[r] || `${r}e`;
  return (
    <div className="cinematic-overlay podium-overlay">
      <div className="cinematic-stage">
        <div ref={mount} className="board3d" />
        <div className="podium-title">🏁 Fin de la partie</div>
        {caption && (
          <div key={caption.rank} className={`podium-caption ${caption.isWinner ? 'winner' : ''}`}>
            <span className="pc-rank">{caption.isWinner ? '🏆 Vainqueur' : rankLabel(caption.rank)}</span>
            <b style={{ color: caption.player.color }}>{caption.player.name}</b>
          </div>
        )}
        <div className="podium-list">
          {[...shown].sort((a, b) => a.rank - b.rank).map((s) => (
            <div key={s.rank} className={s.isWinner ? 'win' : ''}>
              <span>{rankLabel(s.rank)}</span> <b style={{ color: s.player.color }}>{s.player.name}</b>
            </div>
          ))}
        </div>
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
