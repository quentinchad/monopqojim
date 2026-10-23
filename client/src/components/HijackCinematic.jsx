import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { BOARD } from '../../../shared/board.js';
import { playerById } from '../gameInfo.js';
import { HIJACK_DURATION } from '../cinematic.js';
import { hijackSound } from '../sound.js';

const Board3D = lazy(() => import('./Board3D.jsx'));

// Plein écran montré à tous les joueurs quand un avion est détourné
export default function HijackCinematic({ event, state, positions, onEnd }) {
  const pilot = playerById(state, event.pid);
  const victim = playerById(state, event.victim);
  const cinematic = useMemo(
    () => ({ key: event.id, from: event.from, cell: event.cell, color: pilot?.color }),
    [event.id],
  );

  // filet de sécurité si le rendu 3D ne se termine pas (onglet en arrière-plan…)
  useEffect(() => {
    const to = setTimeout(onEnd, (HIJACK_DURATION + 3) * 1000);
    const snd = hijackSound();
    return () => { clearTimeout(to); snd.stop(); };
  }, [event.id]);

  return (
    <div className="cinematic-overlay">
      <div className="cinematic-stage">
        <Suspense fallback={<div className="loading3d">Chargement…</div>}>
          <Board3D state={state} positions={positions} onCellClick={() => {}} highlights={{}}
            cinematic={cinematic} onCinematicEnd={onEnd} />
        </Suspense>
        <div className="cinematic-bars top" />
        <div className="cinematic-bars bottom" />
        <div className="cinematic-caption">
          <div className="cc-title">✈️ DÉTOURNEMENT D’AVION</div>
          <div>
            <b style={{ color: pilot?.color }}>{pilot?.name}</b> fait décoller un avion depuis <b>{BOARD[event.from]?.name}</b>
            {' '}vers l’hôtel de <b style={{ color: victim?.color }}>{victim?.name}</b> à <b>{BOARD[event.cell]?.name}</b>
          </div>
        </div>
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
