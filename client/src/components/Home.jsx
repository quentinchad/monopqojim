import React, { useState } from 'react';
import { flagSvg } from '../flags.js';
import ThemePicker from './ThemePicker.jsx';
import SoundToggle from './SoundToggle.jsx';

const FLAGS = ['br', 'cn', 'es', 'de', 'it', 'jp', 'fr', 'us'];

export default function Home({ initialRoom, onEnter }) {
  const [name, setName] = useState(localStorage.getItem('mq_name') || '');
  const [code, setCode] = useState(initialRoom || '');
  const [busy, setBusy] = useState(false);

  async function go(roomId) {
    const n = name.trim() || `Joueur${Math.floor(Math.random() * 900 + 100)}`;
    localStorage.setItem('mq_name', n);
    setBusy(true);
    await onEnter(roomId, n);
    setBusy(false);
  }

  return (
    <div className="home">
      <div className="home-flags">
        {FLAGS.map((f, i) => (
          <span key={f} className="home-flag" style={{ animationDelay: `${i * 0.3}s` }} dangerouslySetInnerHTML={{ __html: flagSvg(f) }} />
        ))}
      </div>
      <h1 className="logo">MONOP<span>QOJIM</span></h1>
      <p className="tagline">Le Monopoly mondial en ligne — achetez des villes, contrôlez des pays, détournez des avions.</p>
      <div className="home-card">
        <label>Votre pseudo</label>
        <input value={name} maxLength={20} placeholder="Entrez un pseudo" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go(initialRoom || null)} autoFocus />
        {initialRoom ? (
          <button className="btn primary big" disabled={busy} onClick={() => go(initialRoom)}>Rejoindre la partie {initialRoom}</button>
        ) : (
          <>
            <button className="btn primary big" disabled={busy} onClick={() => go(null)}>🎲 Créer une partie</button>
            <div className="or"><span>ou</span></div>
            <div className="join-row">
              <input value={code} maxLength={6} placeholder="CODE" onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && code && go(code)} />
              <button className="btn" disabled={busy || code.length < 4} onClick={() => go(code)}>Rejoindre</button>
            </div>
          </>
        )}
      </div>
      <div className="row"><ThemePicker /><SoundToggle /></div>
      <div className="home-rules">
        <div><b>✈️ Aéroports</b> Détournez un avion : il s’écrase au hasard sur une ville adverse.</div>
        <div><b>💊 Trafic</b> Bonus au passage par Départ… ou peine de prison doublée.</div>
        <div><b>⛓️ Goulag</b> Éliminé ? Battez-vous en duel pour revenir en jeu.</div>
        <div><b>🔀 Échange forcé</b> Une carte Chance qui échange vos villes au hasard.</div>
        <div><b>🎰 Casino</b> Misez ce que vous voulez à la machine à sous de Macao.</div>
      </div>
    </div>
  );
}
