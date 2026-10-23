import React from 'react';
import { setSoundEnabled, setSoundVolume, sfx, useSoundSettings } from '../sound.js';

// Bouton pour couper / remettre les bruitages, avec le volume
export default function SoundToggle() {
  const { enabled, volume } = useSoundSettings();
  return (
    <div className="sound-toggle">
      <button className={`btn tiny ${enabled ? '' : 'muted-btn'}`} title={enabled ? 'Couper les bruitages' : 'Activer les bruitages'}
        onClick={() => { setSoundEnabled(!enabled); if (!enabled) setTimeout(() => sfx.coin(), 50); }}>
        {enabled ? '🔊' : '🔇'} {enabled ? 'Son' : 'Muet'}
      </button>
      {enabled && (
        <input type="range" min="0" max="1" step="0.05" value={volume} title="Volume des bruitages"
          onChange={(e) => setSoundVolume(e.target.value)} onPointerUp={() => sfx.coin()} />
      )}
    </div>
  );
}
