import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { playerById } from '../gameInfo.js';
import { BUSTED_DURATION } from '../busted.js';

const Board3D = lazy(() => import('./Board3D.jsx'));

// Arrestation montrée à tous les joueurs : course-poursuite, plaquage, puis « BUSTED » façon GTA
export default function BustedCinematic({ event, state, positions, onEnd }) {
  const p = playerById(state, event.pid);
  const [busted, setBusted] = useState(false);
  const cinematic = useMemo(
    () => ({ key: event.id, kind: 'busted', from: event.from, pid: event.pid, color: p?.color }),
    [event.id],
  );

  // filet de sécurité si le rendu 3D ne se termine pas (onglet en arrière-plan…)
  useEffect(() => {
    const to = setTimeout(onEnd, (BUSTED_DURATION + 3) * 1000);
    return () => clearTimeout(to);
  }, [event.id]);

  return (
    <div className={`cinematic-overlay ${busted ? 'is-busted' : ''}`}>
      <div className="cinematic-stage">
        <Suspense fallback={<div className="loading3d">Chargement…</div>}>
          <Board3D state={state} positions={positions} onCellClick={() => {}} highlights={{}}
            cinematic={cinematic} onCinematicEnd={onEnd} onCinematicCue={() => setBusted(true)} />
        </Suspense>
        <div className="cinematic-bars top" />
        <div className="cinematic-bars bottom" />
        {busted ? (
          <div className="busted-screen">
            <div className="busted-text">BUSTED</div>
            <div className="busted-sub">
              <b style={{ color: p?.color }}>{p?.name}</b> part en prison{event.heavy ? ' — peine doublée pour trafic' : ''}
            </div>
          </div>
        ) : (
          <div className="cinematic-caption police">
            <div className="cc-title">🚨 COURSE-POURSUITE</div>
            <div>{event.text}</div>
          </div>
        )}
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
