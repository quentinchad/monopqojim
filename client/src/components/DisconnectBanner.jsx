import React, { useEffect, useRef, useState } from 'react';
import { act } from '../net.js';
import { playerById } from '../gameInfo.js';

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Décompte avant qu'un bot remplace un joueur déconnecté, avec bouton pour lui laisser plus de temps
export default function DisconnectBanner({ state, me }) {
  const away = state.players.filter((p) => p.abandonIn != null && p.announcedDisconnect);
  const deadlines = useRef({});
  const [, tick] = useState(0);

  // le serveur envoie un temps restant : on le convertit en échéance locale à chaque mise à jour
  useEffect(() => {
    const now = Date.now();
    deadlines.current = Object.fromEntries(away.map((p) => [p.id, now + p.abandonIn]));
  }, [state.version]);

  useEffect(() => {
    if (!away.length) return;
    const iv = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(iv);
  }, [away.length]);

  if (!away.length || state.phase !== 'playing') return null;
  const meP = playerById(state, me);
  const canExtend = meP && meP.status !== 'eliminated' && meP.connected !== false;

  return (
    <div className="disconnect-banner">
      {away.map((p) => (
        <div key={p.id} className="dc-row">
          <span className="dot" style={{ background: p.color }} />
          <span><b>{p.name}</b> est déconnecté · la partie l’attend, un bot le remplace dans <b className="dc-time">{fmt((deadlines.current[p.id] ?? Date.now() + p.abandonIn) - Date.now())}</b></span>
          {canExtend && p.id !== me && (
            <button className="btn tiny" onClick={() => act('extendTimeout', { playerId: p.id })}>+1 min</button>
          )}
        </div>
      ))}
    </div>
  );
}
