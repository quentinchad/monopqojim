import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BOARD } from '../activeBoard.js';
import { playerById } from '../gameInfo.js';
import { HIJACK_DURATION, T_IMPACT } from '../cinematic.js';
import { hijackSound } from '../sound.js';

const Board3D = lazy(() => import('./Board3D.jsx'));

// Plein écran montré à tous les joueurs quand un avion est détourné
export default function HijackCinematic({ event, state, positions, onEnd }) {
  const pilot = playerById(state, event.pid);
  const victim = playerById(state, event.victim);
  // la ville visée n'est révélée qu'à l'impact
  const [impact, setImpact] = useState(false);
  const cinematic = useMemo(
    () => ({ key: event.id, from: event.from, cell: event.cell, houses: event.houses ?? 5, color: pilot?.color }),
    [event.id],
  );

  // filet de sécurité si le rendu 3D ne se termine pas (onglet en arrière-plan…)
  useEffect(() => {
    const to = setTimeout(onEnd, (HIJACK_DURATION + 3) * 1000);
    // révélation garantie même si l'animation 3D prend du retard (ordinateur lent)
    const reveal = setTimeout(() => setImpact(true), (T_IMPACT + 1) * 1000);
    const snd = hijackSound();
    return () => { clearTimeout(to); clearTimeout(reveal); snd.stop(); };
  }, [event.id]);

  return (
    <div className="cinematic-overlay">
      <div className="cinematic-stage">
        <Suspense fallback={<div className="loading3d">Chargement…</div>}>
          <Board3D state={state} positions={positions} onCellClick={() => {}} highlights={{}}
            cinematic={cinematic} onCinematicEnd={onEnd} onCinematicCue={(c) => c === 'impact' && setImpact(true)} />
        </Suspense>
        <div className="cinematic-bars top" />
        <div className="cinematic-bars bottom" />
        <div className={`cinematic-caption ${impact ? 'reveal' : ''}`}>
          <div className="cc-title">{impact ? '💥 IMPACT !' : '✈️ DÉTOURNEMENT D’AVION'}</div>
          {impact ? (
            <div>
              L’avion s’écrase sur <b>{BOARD[event.cell]?.name}</b> : {event.houses && event.houses < 5 ? (event.houses === 1 ? 'la maison' : `les ${event.houses} maisons`) : 'l’hôtel'} de{' '}
              <b style={{ color: victim?.color }}>{victim?.name}</b> {event.houses && event.houses < 5 ? (event.houses === 1 ? 'est détruite' : 'sont détruites') : 'est détruit'} !
            </div>
          ) : (
            <div>
              <b style={{ color: pilot?.color }}>{pilot?.name}</b> fait décoller un avion depuis <b>{BOARD[event.from]?.name}</b>… où va-t-il s’écraser ?
            </div>
          )}
        </div>
        <button className="btn tiny ghost cinematic-skip" onClick={onEnd}>Passer ⏭</button>
      </div>
    </div>
  );
}
