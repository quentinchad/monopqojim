import React from 'react';
import { act } from '../net.js';
import { playerById } from '../gameInfo.js';

// Pause par vote : il faut la moitié des joueurs (humains connectés encore en jeu) pour mettre en pause,
// puis de nouveau la moitié pour reprendre.
function usePause(state, me) {
  const pause = state.pause || { on: false, votes: [], needed: 1 };
  const meP = playerById(state, me);
  const canVote = state.phase === 'playing' && meP && !meP.isBot && meP.status !== 'eliminated';
  const voted = pause.votes.includes(me);
  const vote = () => act('votePause', { on: !voted });
  return { pause, canVote, voted, vote };
}

export function PauseButton({ state, me }) {
  const { pause, canVote, voted, vote } = usePause(state, me);
  if (!canVote || pause.on) return null;
  return (
    <button className={`btn tiny pause-btn ${voted ? 'voted' : ''}`} onClick={vote}
      title={voted ? 'Retirer mon vote' : 'Voter pour mettre la partie en pause'}>
      ⏸️ {voted ? 'Vote pause envoyé' : 'Pause'} ({pause.votes.length}/{pause.needed})
    </button>
  );
}

export function PauseOverlay({ state, me }) {
  const { pause, canVote, voted, vote } = usePause(state, me);
  if (!pause.on) return null;
  const names = pause.votes.map((id) => playerById(state, id)?.name).filter(Boolean);
  return (
    <div className="pause-overlay">
      <div className="pause-card">
        <div className="pause-icon">⏸️</div>
        <h2>Partie en pause</h2>
        <p className="muted">Rien ne bouge : tours, enchères, duels et bots sont figés.</p>
        <p className="muted">Il faut {pause.needed} vote{pause.needed > 1 ? 's' : ''} pour reprendre.</p>
        {canVote && (
          <button className={`btn ${voted ? '' : 'primary'}`} onClick={vote}>
            {voted ? '↩️ Retirer mon vote' : '▶️ Voter pour reprendre'} ({pause.votes.length}/{pause.needed})
          </button>
        )}
        {names.length > 0 && <p className="pause-voters">Prêts à reprendre : {names.join(', ')}</p>}
      </div>
    </div>
  );
}
