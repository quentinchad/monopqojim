import React, { useEffect, useRef, useState } from 'react';
import { BOARD, COUNTRIES, RULES } from '../../../shared/board.js';
import { act } from '../net.js';
import { money, playerById } from '../gameInfo.js';
import { flagSvg } from '../flags.js';

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Die({ v, rolling }) {
  return (
    <div className={`die ${rolling ? 'rolling' : ''}`}>
      {Array.from({ length: 9 }, (_, k) => <span key={k} className={PIPS[v]?.includes(k) ? 'pip' : ''} />)}
    </div>
  );
}

export function Dice({ turn }) {
  const [shown, setShown] = useState(turn?.dice || [1, 1]);
  const [rolling, setRolling] = useState(false);
  const lastRoll = useRef(turn?.rollId);
  const lastPid = useRef(turn?.pid);
  useEffect(() => {
    if (!turn?.dice) return;
    if (turn.rollId === lastRoll.current && turn.pid === lastPid.current) return;
    lastRoll.current = turn.rollId;
    lastPid.current = turn.pid;
    setRolling(true);
    const iv = setInterval(() => setShown([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 70);
    const to = setTimeout(() => { clearInterval(iv); setRolling(false); setShown(turn.dice); }, 650);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [turn?.rollId, turn?.pid]);
  return <div className="dice"><Die v={shown[0]} rolling={rolling} /><Die v={shown[1]} rolling={rolling} /></div>;
}

function MiniCard({ index }) {
  const cell = BOARD[index];
  const c = cell.country && COUNTRIES[cell.country];
  return (
    <div className="mini-card">
      <div className="mini-band" style={{ background: c ? c.color : '#64748b' }}>
        {c && <span className="flag" dangerouslySetInnerHTML={{ __html: flagSvg(c.code) }} />}
        {!c && (cell.type === 'airport' ? '✈️' : cell.icon)}
      </div>
      <div className="mini-name">{cell.name}</div>
      {c && <div className="mini-sub">{c.name}</div>}
      <div className="mini-price">{money(cell.price)}</div>
    </div>
  );
}

function Auction({ state, me }) {
  const a = state.auction;
  const [left, setLeft] = useState(a.remaining);
  const deadline = useRef(Date.now() + a.remaining);
  useEffect(() => { deadline.current = Date.now() + a.remaining; }, [state.version]);
  useEffect(() => {
    const iv = setInterval(() => setLeft(Math.max(0, deadline.current - Date.now())), 100);
    return () => clearInterval(iv);
  }, []);
  const meP = playerById(state, me);
  const bidder = a.bidder && playerById(state, a.bidder);
  const canBid = meP?.status === 'alive';
  const [custom, setCustom] = useState('');
  return (
    <div className="auction">
      <div className="auction-title">🔨 Enchères</div>
      <MiniCard index={a.cell} />
      <div className="auction-bid">
        {bidder ? <>Meilleure offre : <b style={{ color: bidder.color }}>{bidder.name}</b> — <b>{money(a.bid)}</b></> : 'Aucune offre pour l’instant'}
      </div>
      <div className="timer-bar"><div style={{ width: `${Math.min(100, (left / 10000) * 100)}%` }} /></div>
      {canBid && (
        <div className="row">
          {[10, 50, 100].map((inc) => (
            <button key={inc} className="btn" disabled={a.bid + inc > meP.money} onClick={() => act('bid', { amount: a.bid + inc })}>+{inc}</button>
          ))}
          <input className="small-input" type="number" placeholder="Montant" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn" onClick={() => { act('bid', { amount: +custom }); setCustom(''); }}>Miser</button>
        </div>
      )}
    </div>
  );
}

export default function CenterControls({ state, me, onLeave, animating }) {
  const t = state.turn;
  const meP = playerById(state, me);
  const cur = t && playerById(state, t.pid);
  const myTurn = t?.pid === me;

  let body = null;
  if (state.phase === 'ended') {
    const w = playerById(state, state.winner);
    body = (
      <div className="ended">
        <div className="trophy">🏆</div>
        <div className="win-text"><b style={{ color: w?.color }}>{w?.name}</b> remporte la partie !</div>
        <button className="btn primary" onClick={onLeave}>Retour à l’accueil</button>
      </div>
    );
  } else if (state.auction) {
    body = <Auction state={state} me={me} />;
  } else if (meP?.status === 'goulag') {
    body = <div className="status-msg">⛓️ Vous êtes au goulag. Dès qu’un autre joueur vous rejoint (et qu’il reste au moins 2 joueurs en jeu), un duel décidera de votre retour.</div>;
  } else if (meP?.money < 0 && !animating) {
    body = (
      <div className="debt">
        <div>💸 Vous êtes endetté de <b>{money(-meP.money)}</b>.</div>
        <small>Vendez des bâtiments ou hypothéquez des propriétés (cliquez sur vos cases), ou déclarez faillite.</small>
        <button className="btn danger" onClick={() => confirm('Déclarer faillite ?') && act('bankrupt')}>Déclarer faillite</button>
      </div>
    );
  } else if (animating && state.phase === 'playing') {
    // le pion se déplace : on attend qu'il arrive avant d'afficher la suite
    body = cur && <div className="status-msg"><span className="dot" style={{ background: cur.color }} /> <b>{cur.name}</b> se déplace…</div>;
  } else if (myTurn) {
    const pend = t.pending;
    if (pend?.type === 'buy') {
      const cell = BOARD[pend.cell];
      body = (
        <div className="decision">
          <MiniCard index={pend.cell} />
          <div className="row">
            <button className="btn primary" disabled={meP.money < cell.price} onClick={() => act('buy')}>Acheter {money(cell.price)}</button>
            {state.settings.auction && <button className="btn" onClick={() => act('decline', { auction: true })}>🔨 Mettre aux enchères</button>}
            <button className="btn ghost" onClick={() => act('decline')}>Ne pas acheter</button>
          </div>
        </div>
      );
    } else if (pend?.type === 'hijack') {
      const target = BOARD[pend.target];
      const victim = playerById(state, state.props[pend.target].owner);
      body = (
        <div className="decision hijack">
          <div className="hijack-title">✈️ Détournement d’avion</div>
          <div>Détourner un avion depuis <b>{BOARD[pend.from].name}</b> pour détruire l’hôtel de <b style={{ color: victim?.color }}>{victim?.name}</b> à <b>{target.name}</b> ?</div>
          <div className="row">
            <button className="btn danger" disabled={meP.money < pend.cost} onClick={() => act('hijack', { accept: true })}>💥 Détourner ({money(pend.cost)})</button>
            <button className="btn" onClick={() => act('hijack', { accept: false })}>Non merci</button>
          </div>
        </div>
      );
    } else if (t.phase === 'roll') {
      body = (
        <div className="decision">
          {meP.jail.in && (
            <div className="jail-box">
              <div>🚔 Vous êtes en prison ({meP.jail.turns}/{meP.jail.heavy ? RULES.TRAFFIC_JAIL_TURNS : RULES.JAIL_TURNS})</div>
              {meP.jail.heavy ? <small>Arrêté pour trafic : seul un double peut vous libérer.</small> : (
                <div className="row">
                  <button className="btn" disabled={meP.money < RULES.JAIL_FINE} onClick={() => act('payJail')}>Payer {RULES.JAIL_FINE} $</button>
                  {meP.jailCards.length > 0 && <button className="btn" onClick={() => act('useJailCard')}>Utiliser la carte</button>}
                </div>
              )}
            </div>
          )}
          <button className="btn primary big" onClick={() => act('roll')}>🎲 {meP.jail.in ? 'Tenter un double' : t.rolled ? 'Relancer (double !)' : 'Lancer les dés'}</button>
        </div>
      );
    } else if (t.phase === 'done') {
      body = <button className="btn primary big" onClick={() => act('endTurn')}>Terminer le tour ➜</button>;
    }
  } else if (cur) {
    body = (
      <div className="status-msg">
        <span className="dot" style={{ background: cur.color }} /> <b>{cur.name}</b> joue…
        {t.pending?.type === 'buy' && <div className="sub">hésite à acheter {BOARD[t.pending.cell].name}</div>}
        {t.pending?.type === 'hijack' && <div className="sub">✈️ envisage de détourner un avion…</div>}
      </div>
    );
  }

  return (
    <div className="center-controls">
      {state.phase !== 'ended' && <Dice turn={t} />}
      {myTurn && state.phase === 'playing' && !state.auction && <div className="your-turn">C’est votre tour !</div>}
      {body}
    </div>
  );
}
