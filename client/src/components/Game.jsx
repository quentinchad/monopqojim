import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Board2D from './Board2D.jsx';
import CenterControls from './CenterControls.jsx';
import CellCard from './CellCard.jsx';
import TradeModal from './TradeModal.jsx';
import FightOverlay from './FightOverlay.jsx';
import HijackCinematic from './HijackCinematic.jsx';
import BustedCinematic from './BustedCinematic.jsx';
import TradeOfferModal from './TradeOfferModal.jsx';
import DisconnectBanner from './DisconnectBanner.jsx';
import ThemePicker from './ThemePicker.jsx';
import SoundToggle from './SoundToggle.jsx';
import EndGameStats from './EndGameStats.jsx';
import { HIJACK_DURATION } from '../cinematic.js';
import { BUSTED_DURATION } from '../busted.js';
import { PlayersPanel, TradesPanel, MyProperties, LogChat } from './Panels.jsx';
import { useAnimatedPositions, useElementSize, useDisplayedPlayers, useHoldAfterChange } from '../hooks.js';
import { SLOT_DURATION } from './SlotMachine.jsx';
import { playerById } from '../gameInfo.js';
import { toast, act } from '../net.js';
import { inviteLink } from '../embed.js';
import { useGameSounds } from '../useGameSounds.js';

const Board3D = lazy(() => import('./Board3D.jsx'));
const SkinEditor = lazy(() => import('./SkinEditor.jsx'));
const SayMyNameCinematic = lazy(() => import('./SayMyNameCinematic.jsx'));
const SAY_MY_NAME_MS = 18000;
const CINEMATICS = ['busted', 'hijack', 'delivery'];

// File d'attente des évènements marquants (cartes, détournements, goulag…)
function useEventQueue(events, paused) {
  const seen = useRef(events.length ? events[events.length - 1].id : 0);
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    const fresh = events.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].id;
    const recv = Date.now();
    setQueue((q) => [...q, ...fresh.map((e) => ({ ...e, recv }))].slice(-6));
  }, [events]);
  const [activeId, setActiveId] = useState(null);
  const head = queue[0];
  const remove = (id) => {
    setQueue((q) => q.filter((e) => e.id !== id));
    setActiveId(null);
  };
  // un nouvel évènement attend que les pions aient fini de bouger avant de s'afficher ;
  // une fois affiché, il reste jusqu'au bout de sa durée même si un pion se remet à bouger
  // moment où l'évènement de tête a commencé à attendre (les pions bougeaient)
  const headSince = useRef({ id: null, t: 0 });
  if (head && headSince.current.id !== head.id) headSince.current = { id: head.id, t: Date.now() };
  useEffect(() => {
    if (!head || activeId === head.id || paused) return;
    // une annonce bloquée trop longtemps par les déplacements n'a plus d'intérêt (sauf les cinématiques)
    const cinematicEvent = CINEMATICS.includes(head.type);
    if (!cinematicEvent && Date.now() - headSince.current.t > 7000) { setQueue((q) => q.slice(1)); return; }
    setActiveId(head.id);
  }, [head?.id, paused, activeId]);
  useEffect(() => {
    if (activeId == null) return;
    const ev = queue.find((e) => e.id === activeId);
    // durées d'affichage : assez longues pour que chacun ait le temps de lire
    const ms = ev?.type === 'hijack' ? (HIJACK_DURATION + 4) * 1000
      : ev?.type === 'busted' ? (BUSTED_DURATION + 4) * 1000
        : ev?.type === 'delivery' ? SAY_MY_NAME_MS + 4000
          : ev?.type === 'card' ? 6500 : 5000;
    const to = setTimeout(() => remove(activeId), ms);
    return () => clearTimeout(to);
  }, [activeId]);
  const current = head && head.id === activeId ? head : null;
  // une cinématique attend son tour : l'argent affiché reste gelé jusqu'à ce qu'elle se joue
  const cinematicQueued = queue.some((e) => CINEMATICS.includes(e.type));
  return [current, () => current && remove(current.id), cinematicQueued];
}

export function EventBanner({ event, state, onClose }) {
  if (!event) return null;
  const p = event.pid && playerById(state, event.pid);
  if (event.type === 'card') {
    return (
      <div className={`event-card deck-${event.deck}`} onClick={onClose}>
        <div className="ec-deck">{event.deck === 'chance' ? '❓ CHANCE' : '📦 CAISSE DE COMMUNAUTÉ'}</div>
        <div className="ec-who" style={{ color: p?.color }}>{p?.name}</div>
        <div className="ec-text">{event.text}</div>
      </div>
    );
  }
  return <div className={`event-banner ev-${event.type}`} onClick={onClose}>{event.text}</div>;
}

export default function Game({ state, me, onLeave }) {
  const [view, setView] = useState(() => localStorage.getItem('mq_view') || '2d');
  const [selected, setSelected] = useState(null);
  const [trade, setTrade] = useState(null); // id du joueur ciblé ou true
  const [leftOpen, setLeftOpen] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);
  // les statistiques s'ouvrent d'elles-mêmes à la fin de la partie
  const wasEnded = useRef(state.phase === 'ended');
  useEffect(() => {
    if (state.phase === 'ended' && !wasEnded.current) setShowStats(true);
    wasEnded.current = state.phase === 'ended';
  }, [state.phase]);
  const boardWrap = useRef(null);
  const { w, h } = useElementSize(boardWrap);
  const [positions, animating] = useAnimatedPositions(state.players);
  const [event, nextEvent, cinematicQueued] = useEventQueue(state.events, animating);
  const size = Math.max(320, Math.min(w, h) - 16);

  useEffect(() => { localStorage.setItem('mq_view', view); }, [view]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setSelected(null); setTrade(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // en vue FPS on suit son propre pion, ou celui du joueur actif si on n'est plus en jeu
  const followId = playerById(state, me)?.status === 'alive' ? me : state.turn?.pid;

  const highlights = {};
  const pend = animating ? null : state.turn?.pending;
  if (pend?.type === 'buy') highlights[pend.cell] = 'focus';
  if (event?.type === 'swap' && event.cells) for (const c of event.cells) highlights[c] = 'flash';
  if (event?.type === 'hijack' && event.cell != null) highlights[event.cell] = 'boom';
  // la cinématique remplace la bannière pour les détournements
  const cinematic = (event?.type === 'hijack' && event.from != null) || event?.type === 'busted' || event?.type === 'delivery' ? event : null;
  // la carte que je dois valider est déjà affichée au centre, avec son bouton
  const myCard = event?.type === 'card' && event.pid === me && state.turn?.pending?.type === 'card';
  const bannerEvent = cinematic || myCard ? null : event;

  // l'argent des joueurs n'est mis à jour qu'une fois l'action visible à l'écran
  const casinoSpinning = useHoldAfterChange(state.turn?.pending?.last?.id, SLOT_DURATION * 1000);
  const shownPlayers = useDisplayedPlayers(state.players, animating || cinematicQueued || casinoSpinning);
  const shownState = { ...state, players: shownPlayers };
  useGameSounds(state, me, event, shownPlayers);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink(state.id)); toast('Lien copié !', 'info'); } catch { /* ignore */ }
  };

  const controls = <CenterControls state={state} me={me} onLeave={onLeave} animating={animating} onShowStats={() => setShowStats(true)} />;

  return (
    <div className={`game ${leftOpen ? '' : 'left-closed'}`}>
      <aside className="side left">
        <div className="side-head">
          <h1 className="logo small" onClick={onLeave} title="Quitter">MONOP<span>QOJIM</span></h1>
          <button className="btn tiny" onClick={copyLink} title="Copier le lien d’invitation">🔗 {state.id}</button>
        </div>
        <div className="view-toggle">
          <button className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>Plateau 2D</button>
          <button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>Vue 3D</button>
          <button className={view === 'fps' ? 'active' : ''} onClick={() => setView('fps')} title="Vue à la première personne depuis votre pion">Vue FPS</button>
        </div>
        <ThemePicker />
        <SoundToggle />
        <LogChat state={state} me={me} />
      </aside>

      <main className="board-area" ref={boardWrap}>
        <button className="btn tiny toggle-left" onClick={() => setLeftOpen((v) => !v)}>{leftOpen ? '⟨' : '⟩'}</button>
        <DisconnectBanner state={state} me={me} />
        {w > 0 && (view === '2d' ? (
          <Board2D state={state} size={size} positions={positions} onCellClick={setSelected} highlights={highlights}>
            {controls}
            <EventBanner event={bannerEvent} state={state} onClose={nextEvent} />
          </Board2D>
        ) : (
          <div className={`board3d-wrap ${view === 'fps' ? 'fps' : ''}`} style={{ width: w, height: h }}>
            <Suspense fallback={<div className="loading3d">Chargement de la 3D…</div>}>
              <Board3D state={state} positions={positions} onCellClick={setSelected} highlights={highlights}
                mode={view === 'fps' ? 'fps' : 'orbit'} followId={followId} />
            </Suspense>
            {view === 'fps' && (
              <div className="fps-hint">
                👁️ {followId === me ? 'Votre pion' : `Pion de ${playerById(state, followId)?.name}`} · glissez pour regarder autour
              </div>
            )}
            <div className="overlay-controls">{controls}</div>
            <div className="overlay-event"><EventBanner event={bannerEvent} state={state} onClose={nextEvent} /></div>
          </div>
        ))}
      </main>

      <aside className="side right">
        <PlayersPanel state={shownState} me={me} onTrade={(id) => setTrade(id)} />
        {playerById(state, me)?.status === 'alive' && state.phase === 'playing' && (
          <button className="btn wide" onClick={() => setTrade(true)}>🤝 Proposer un échange</button>
        )}
        <TradesPanel state={state} me={me} />
        {playerById(state, me)?.status === 'alive' && state.phase === 'playing' && (
          <button className="btn ghost danger-text wide" onClick={() => {
            const goulag = state.settings.goulag && !playerById(state, me).usedGoulag;
            if (confirm(`Déclarer faillite ? Vos propriétés reviennent à la banque${goulag ? ' et vous partez au goulag' : ' et vous êtes éliminé'}.`)) act('bankrupt');
          }}>🏳️ Déclarer faillite</button>
        )}
        {playerById(state, me) && <button className="btn ghost wide" onClick={() => setSkinOpen(true)}>🎨 Personnaliser mon pion</button>}
        <h4 className="section-title">Mes propriétés</h4>
        <MyProperties state={state} me={me} onCell={setSelected} />
      </aside>

      {selected != null && <CellCard state={state} me={me} index={selected} onClose={() => setSelected(null)} />}
      {trade && (
        <TradeModal state={state} me={me} counter={trade.counter} onClose={() => setTrade(null)}
          initialTarget={trade === true || trade.counter ? trade.counter?.from ?? null : trade} />
      )}
      {skinOpen && <Suspense fallback={null}><SkinEditor me={playerById(state, me)} onClose={() => setSkinOpen(false)} /></Suspense>}
      {showStats && state.stats && <EndGameStats state={state} onClose={() => setShowStats(false)} />}
      {cinematic?.type === 'hijack' && <HijackCinematic event={cinematic} state={state} positions={positions} onEnd={nextEvent} />}
      {cinematic?.type === 'busted' && <BustedCinematic event={cinematic} state={state} positions={positions} onEnd={nextEvent} />}
      {cinematic?.type === 'delivery' && (
        <Suspense fallback={<div className="cinematic-overlay"><div className="loading3d">Chargement…</div></div>}>
          <SayMyNameCinematic event={cinematic} state={state} onEnd={nextEvent} />
        </Suspense>
      )}
      <TradeOfferModal state={state} me={me} paused={!!cinematic} onCounter={(t) => setTrade({ counter: t })} />
      {state.fight && <FightOverlay key={state.fight.ids.join()} state={state} me={me} />}
    </div>
  );
}
