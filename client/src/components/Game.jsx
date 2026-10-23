import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Board2D from './Board2D.jsx';
import CenterControls from './CenterControls.jsx';
import CellCard from './CellCard.jsx';
import TradeModal from './TradeModal.jsx';
import FightOverlay from './FightOverlay.jsx';
import HijackCinematic from './HijackCinematic.jsx';
import DisconnectBanner from './DisconnectBanner.jsx';
import ThemePicker from './ThemePicker.jsx';
import EndGameStats from './EndGameStats.jsx';
import { HIJACK_DURATION } from '../cinematic.js';
import { PlayersPanel, TradesPanel, MyProperties, LogChat } from './Panels.jsx';
import { useAnimatedPositions, useElementSize } from '../hooks.js';
import { playerById } from '../gameInfo.js';
import { toast, act } from '../net.js';
import { inviteLink } from '../embed.js';

const Board3D = lazy(() => import('./Board3D.jsx'));

// File d'attente des évènements marquants (cartes, détournements, goulag…)
function useEventQueue(events, paused) {
  const seen = useRef(events.length ? events[events.length - 1].id : 0);
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    const fresh = events.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].id;
    const recv = Date.now();
    setQueue((q) => [...q, ...fresh.map((e) => ({ ...e, recv }))].slice(-4));
  }, [events]);
  const [activeId, setActiveId] = useState(null);
  const head = queue[0];
  const remove = (id) => {
    setQueue((q) => q.filter((e) => e.id !== id));
    setActiveId(null);
  };
  // un nouvel évènement attend que les pions aient fini de bouger avant de s'afficher ;
  // une fois affiché, il reste jusqu'au bout de sa durée même si un pion se remet à bouger
  useEffect(() => {
    if (!head || activeId === head.id || paused) return;
    // resté trop longtemps en attente : il n'a plus d'intérêt
    if (Date.now() - head.recv > 7000) { setQueue((q) => q.slice(1)); return; }
    setActiveId(head.id);
  }, [head?.id, paused, activeId]);
  useEffect(() => {
    if (activeId == null) return;
    const ev = queue.find((e) => e.id === activeId);
    const ms = ev?.type === 'hijack' ? (HIJACK_DURATION + 4) * 1000 : ev?.type === 'card' ? 4200 : 3400;
    const to = setTimeout(() => remove(activeId), ms);
    return () => clearTimeout(to);
  }, [activeId]);
  const current = head && head.id === activeId ? head : null;
  return [current, () => current && remove(current.id)];
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
  // les statistiques s'ouvrent d'elles-mêmes à la fin de la partie
  const wasEnded = useRef(state.phase === 'ended');
  useEffect(() => {
    if (state.phase === 'ended' && !wasEnded.current) setShowStats(true);
    wasEnded.current = state.phase === 'ended';
  }, [state.phase]);
  const boardWrap = useRef(null);
  const { w, h } = useElementSize(boardWrap);
  const [positions, animating] = useAnimatedPositions(state.players);
  const [event, nextEvent] = useEventQueue(state.events, animating);
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
  if (pend?.type === 'hijack') highlights[pend.target] = 'target';
  if (pend?.type === 'buy') highlights[pend.cell] = 'focus';
  if (event?.type === 'swap' && event.cells) for (const c of event.cells) highlights[c] = 'flash';
  if (event?.type === 'hijack' && event.cell != null) highlights[event.cell] = 'boom';
  // la cinématique remplace la bannière pour les détournements
  const cinematic = event?.type === 'hijack' && event.from != null ? event : null;
  const bannerEvent = cinematic ? null : event;

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
        <PlayersPanel state={state} me={me} onTrade={(id) => setTrade(id)} />
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
        <h4 className="section-title">Mes propriétés</h4>
        <MyProperties state={state} me={me} onCell={setSelected} />
      </aside>

      {selected != null && <CellCard state={state} me={me} index={selected} onClose={() => setSelected(null)} />}
      {trade && <TradeModal state={state} me={me} initialTarget={trade === true ? null : trade} onClose={() => setTrade(null)} />}
      {showStats && state.stats && <EndGameStats state={state} onClose={() => setShowStats(false)} />}
      {cinematic && <HijackCinematic event={cinematic} state={state} positions={positions} onEnd={nextEvent} />}
      {state.fight && <FightOverlay key={state.fight.ids.join()} state={state} me={me} />}
    </div>
  );
}
