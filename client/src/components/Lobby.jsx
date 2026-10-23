import React, { useState } from 'react';
import { PLAYER_COLORS } from '../../../shared/board.js';
import { lobby, toast } from '../net.js';
import ThemePicker from './ThemePicker.jsx';
import SoundToggle from './SoundToggle.jsx';
import { inviteLink } from '../embed.js';

export default function Lobby({ state, me, onLeave }) {
  const isHost = state.hostId === me;
  const meP = state.players.find((p) => p.id === me);
  const s = state.settings;
  const link = inviteLink(state.id);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast('Copiez le lien manuellement', 'info'); }
  };
  const set = (patch) => lobby('settings', { settings: patch });

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1 className="logo small" onClick={onLeave}>MONOP<span>QOJIM</span></h1>
        <ThemePicker />
        <SoundToggle />
        <div className="room-code">Partie <b>{state.id}</b></div>
      </div>
      <div className="lobby-grid">
        <section className="panel">
          <h3>Inviter des amis</h3>
          <div className="invite">
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={copy}>{copied ? '✓ Copié' : 'Copier'}</button>
          </div>
          <h3>Joueurs ({state.players.length}/{s.maxPlayers})</h3>
          <ul className="lobby-players">
            {state.players.map((p) => (
              <li key={p.id} className={p.connected || p.isBot ? '' : 'offline'}>
                <span className="avatar" style={{ background: p.color }}>{p.isBot ? '🤖' : p.name[0]?.toUpperCase()}</span>
                <span className="pname">{p.name}{p.id === me && ' (vous)'}</span>
                {p.id === state.hostId && <span className="tag">👑 hôte</span>}
                {p.isBot && <span className="tag">bot</span>}
                {isHost && p.id !== me && <button className="btn tiny ghost" title="Retirer" onClick={() => lobby('kick', { playerId: p.id })}>✕</button>}
              </li>
            ))}
          </ul>
          {meP && (
            <>
              <h3>Votre couleur</h3>
              <div className="color-picker">
                {PLAYER_COLORS.map((c) => {
                  const taken = state.players.some((p) => p.color === c && p.id !== me);
                  return (
                    <button key={c} className={`swatch ${meP.color === c ? 'active' : ''}`} disabled={taken}
                      style={{ background: c }} onClick={() => lobby('color', { color: c })} />
                  );
                })}
              </div>
            </>
          )}
          {isHost && (
            <button className="btn" disabled={state.players.length >= s.maxPlayers} onClick={() => lobby('addBot')}>🤖 Ajouter un bot</button>
          )}
          {!meP && <div className="waiting">Vous êtes spectateur.</div>}
        </section>

        <section className="panel">
          <h3>Règles de la partie {!isHost && <small>(choisies par l’hôte)</small>}</h3>
          <div className="settings">
            <label>Argent de départ
              <select disabled={!isHost} value={s.startMoney} onChange={(e) => set({ startMoney: +e.target.value })}>
                {[500, 750, 1000, 1500, 2000, 2500, 3000].map((v) => <option key={v} value={v}>{v} $</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.auction} onChange={(e) => set({ auction: e.target.checked })} /> Enchères si un joueur refuse d’acheter</label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.freeParkingPot} onChange={(e) => set({ freeParkingPot: e.target.checked })} /> Cagnotte du Parc gratuit (taxes et amendes)</label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.goulag} onChange={(e) => set({ goulag: e.target.checked })} /> Goulag (seconde chance pour les éliminés)</label>
            <label>Argent au retour du goulag
              <select disabled={!isHost || !s.goulag} value={s.goulagMoney} onChange={(e) => set({ goulagMoney: +e.target.value })}>
                {[500, 750, 1000, 1500].map((v) => <option key={v} value={v}>{v} $</option>)}
              </select>
            </label>
            <label>Délai avant abandon d’un joueur déconnecté
              <select disabled={!isHost} value={s.abandonDelay} onChange={(e) => set({ abandonDelay: +e.target.value })}>
                {[60, 120, 300, 600].map((v) => <option key={v} value={v}>{v / 60} min</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.trafficCaughtOnVisit} onChange={(e) => set({ trafficCaughtOnVisit: e.target.checked })} /> Un trafiquant qui s’arrête sur la case Prison se fait arrêter</label>
          </div>
          <div className="rules-box">
            <p><b>🏙️ Villes & pays</b> — construisez maisons et hôtels quand vous possédez toutes les villes d’un pays.</p>
            <p><b>✈️ Aéroports</b> — en vous arrêtant sur un aéroport, vous pouvez détourner un avion pour détruire l’hôtel adverse le plus proche (moitié du prix de construction d’un hôtel).</p>
            <p><b>💊 Trafic de drogue</b> — carte Chance : +300 $ au prochain passage par Départ, mais si vous allez en prison la peine est doublée (6 tours) et seul un double vous libère.</p>
            <p><b>⛓️ Goulag</b> — un joueur en faillite part au goulag (une seule fois par partie). Dès que 2 joueurs y sont et qu’il reste au moins 2 joueurs en jeu, ils s’affrontent en duel : le vainqueur revient, le perdant est éliminé.</p>
            <p><b>🎰 Casino</b> — misez la somme de votre choix à la machine à sous (5 parties max par arrêt) : trois symboles identiques rapportent gros.</p>
            <p><b>🏦 Pas d’hypothèque</b> — pour trouver de l’argent, vendez vos bâtiments ou revendez vos propriétés à la banque (moitié du prix).</p>
            <p><b>🔀 Échange forcé</b> — carte Chance : une de vos villes est échangée au hasard avec celle d’un adversaire.</p>
          </div>
          {isHost ? (
            <button className="btn primary big" disabled={state.players.length < 2} onClick={() => lobby('start')}>
              {state.players.length < 2 ? 'Il faut au moins 2 joueurs' : '🚀 Lancer la partie'}
            </button>
          ) : (
            <div className="waiting">En attente du lancement par l’hôte…</div>
          )}
        </section>
      </div>
    </div>
  );
}
