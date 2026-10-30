import React, { Suspense, lazy, useState } from 'react';
import Avatar from './Avatar.jsx';

const SkinEditor = lazy(() => import('./SkinEditor.jsx'));
import { PLAYER_COLORS, RULES } from '../../../shared/board.js';
import { CIVS, cleanCiv } from '../../../shared/civs.js';
import { lobby, toast } from '../net.js';
import ThemePicker from './ThemePicker.jsx';
import SoundToggle from './SoundToggle.jsx';
import RulesButton from './RulesSheet.jsx';
import { inviteLink } from '../embed.js';

export default function Lobby({ state, me, onLeave }) {
  const isHost = state.hostId === me;
  const meP = state.players.find((p) => p.id === me);
  const s = state.settings;
  const link = inviteLink(state.id);
  const [copied, setCopied] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);

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
        <RulesButton settings={s} />
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
                <Avatar state={state} p={p} />
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
              {s.civs !== false && (
                <>
                  <h3>Votre civilisation <small className="muted">(style de vos bâtiments)</small></h3>
                  <div className="civ-picker">
                    {Object.entries(CIVS).map(([id, c]) => (
                      <button key={id} className={`civ-btn ${cleanCiv(meP.civ) === id ? 'active' : ''}`} onClick={() => lobby('civ', { civ: id })}
                        title={c.levels.join(' → ')}>
                        <span className="civ-icon">{c.icon}</span>{c.name}
                      </button>
                    ))}
                  </div>
                  <small className="muted">{CIVS[cleanCiv(meP.civ)].levels.join(' → ')}</small>
                </>
              )}
              <h3>Votre pion</h3>
              <div className="row" style={{ justifyContent: 'flex-start' }}>
                <Avatar state={state} p={meP} />
                <button className="btn" onClick={() => setSkinOpen(true)}>🎨 {meP.skin ? 'Modifier mon pion' : 'Créer mon pion à partir d’une image'}</button>
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
            <label>Attente d’un joueur déconnecté avant qu’un bot le remplace
              <select disabled={!isHost} value={s.abandonDelay} onChange={(e) => set({ abandonDelay: +e.target.value })}>
                {[60, 120, 300, 600].map((v) => <option key={v} value={v}>{v / 60} min</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.trafficCaughtOnVisit} onChange={(e) => set({ trafficCaughtOnVisit: e.target.checked })} /> Un trafiquant qui s’arrête sur la case Prison se fait arrêter</label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.jailVisitSteal ?? true} onChange={(e) => set({ jailVisitSteal: e.target.checked })} /> En simple visite à la prison, on vole {RULES.JAIL_VISIT_STEAL} $ à chaque prisonnier</label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.rentInJail ?? true} onChange={(e) => set({ rentInJail: e.target.checked })} /> Un joueur en prison touche quand même ses loyers</label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={s.civs ?? true} onChange={(e) => set({ civs: e.target.checked })} /> Civilisations (chaque joueur choisit le style de ses bâtiments)</label>
            <label className="check"><input type="checkbox" disabled={!isHost} checked={!!s.bigBoard} onChange={(e) => set({ bigBoard: e.target.checked })} /> Grand plateau : 56 cases, 4 pays en plus (Mexique, Inde, Russie, Royaume-Uni) — parties plus longues</label>
          </div>
          <div className="rules-box">
            <p><b>🏙️ Villes & pays</b> — construisez maisons et hôtels quand vous possédez toutes les villes d’un pays.</p>
            <p><b>✈️ Aéroports</b> — en vous arrêtant sur un aéroport, vous pouvez payer 150 $ (50 $ si c’est le vôtre) pour détourner un avion : il s’écrase sur une ville adverse construite tirée au hasard, que l’on découvre en direct, et en détruit les maisons ou l’hôtel.</p>
            <p><b>💊 Trafic de drogue</b> — carte Chance : +300 $ au prochain passage par Départ, mais si vous allez en prison la peine est doublée (6 tours) et seul un double vous libère.</p>
            <p><b>⛓️ Goulag</b> — un joueur en faillite part au goulag (une seule fois par partie). Dès que 2 joueurs y sont et qu’il reste au moins 2 joueurs en jeu, ils s’affrontent en duel : le vainqueur revient, le perdant est éliminé.</p>
            <p><b>🎰 Casino</b> — misez la somme de votre choix à la machine à sous ou à la roulette (5 parties max par arrêt) : trois symboles identiques ou le bon numéro rapportent gros.</p>
            <p><b>🎲 Dé spécial</b> — carte Chance : un dé truqué avec un chiffre fixe (de 1 à 12), à jouer à la place des dés quand vous voulez.</p>
            <p><b>🏦 Pas d’hypothèque</b> — pour trouver de l’argent, vendez vos bâtiments ou revendez vos propriétés à la banque (moitié du prix).</p>
            <p><b>🤝 Régime de Vichy</b> — carte Chance : vous collaborez avec un joueur tiré au hasard pendant {RULES.VICHY_ROUNDS} tours de table (3 joueurs minimum) : pas de loyer entre vous, vos villes comptent ensemble et vous partagez les loyers encaissés.</p>
            <p><b>🔀 Échange forcé</b> — carte Chance : une de vos villes est échangée au hasard avec celle d’un adversaire.</p>
            <RulesButton settings={s} className="btn tiny" label="📜 Fiche complète des règles" />
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
      {skinOpen && (
        <Suspense fallback={null}>
          <SkinEditor me={meP} onClose={() => setSkinOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
