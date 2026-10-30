import React, { useEffect, useRef, useState } from 'react';
import { COUNTRIES, RULES } from '../../../shared/board.js';
import { BOARD } from '../activeBoard.js';
import { act } from '../net.js';
import { money, playerById } from '../gameInfo.js';
import { flagSvg } from '../flags.js';
import SlotMachine from './SlotMachine.jsx';
import Roulette from './Roulette.jsx';
import { sfx } from '../sound.js';

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
    sfx.dice();
    const iv = setInterval(() => setShown([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 70);
    const to = setTimeout(() => { clearInterval(iv); setRolling(false); setShown(turn.dice); }, 650);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [turn?.rollId, turn?.pid]);
  // dé spécial : un seul dé doré qui affiche sa valeur
  if (!rolling && turn?.special) return <div className="dice"><div className="die special" title="Dé spécial">{turn.dice[0]}</div></div>;
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

export default function CenterControls({ state, me, onLeave, animating, onShowStats, onShowPodium }) {
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
        <div className="row">
          {onShowPodium && <button className="btn" onClick={onShowPodium}>🏆 Podium</button>}
          {state.stats && <button className="btn primary" onClick={onShowStats}>📊 Statistiques</button>}
          <button className="btn" onClick={onLeave}>Retour à l’accueil</button>
        </div>
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
        <small>Vendez des bâtiments ou revendez des propriétés à la banque (cliquez sur vos cases), ou déclarez faillite.</small>
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
    } else if (pend?.type === 'card') {
      // la carte s'applique seulement quand le joueur l'a lue et a cliqué
      const label = { moveTo: 'Y aller ➜', nearest: 'Y aller ➜', moveBy: 'Reculer ↩', jail: 'Aller en prison 🚔', jailCard: 'Garder la carte 🎫' }[pend.kind] || 'OK ✓';
      body = (
        <div className="decision">
          <div className={`drawn-card deck-${pend.deck}`}>
            <div className="ec-deck">{pend.deck === 'chance' ? '❓ CHANCE' : '📦 CAISSE DE COMMUNAUTÉ'}</div>
            <div className="ec-text">{pend.text}</div>
          </div>
          <button className="btn primary big" onClick={() => act('cardOk')}>{label}</button>
        </div>
      );
    } else if (pend?.type === 'casino') {
      const roulette = pend.game === 'roulette';
      body = (
        <div className="casino">
          <div className="casino-tabs">
            <button className={!roulette ? 'active' : ''} onClick={() => roulette && act('casinoGame', { game: 'slots' })}>🎰 Machine à sous</button>
            <button className={roulette ? 'active' : ''} onClick={() => !roulette && act('casinoGame', { game: 'roulette' })}>🎡 Roulette</button>
          </div>
          {roulette ? (
            <Roulette result={pend.roulette} spinsDone={pend.spins} interactive maxBet={Math.max(0, meP.money)} player={meP}
              onSpin={(bet, on) => act('rouletteSpin', { bet, on })} onLeave={() => act('casinoLeave')} />
          ) : (
            <SlotMachine spin={pend.last} spinsDone={pend.spins} interactive maxBet={Math.max(0, meP.money)} player={meP}
              onSpin={(bet) => act('casinoSpin', { bet })} onLeave={() => act('casinoLeave')} />
          )}
        </div>
      );
    } else if (pend?.type === 'hijack') {
      body = (
        <div className="decision hijack">
          <div className="hijack-title">✈️ Détournement d’avion</div>
          <div>Détourner un avion depuis <b>{BOARD[pend.from].name}</b> ?</div>
          {pend.own && <small className="hijack-own">✈️ C’est votre aéroport : tarif réduit !</small>}
          <small>Il s’écrasera sur une ville adverse construite tirée au hasard : maisons ou hôtel, vous le découvrirez en direct !</small>
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
          {!meP.jail.in && meP.specialDice?.length > 0 && (
            <div className="special-dice">
              <small>Ou jouez un dé spécial (avance exactement de sa valeur) :</small>
              <div className="row">
                {[...new Set(meP.specialDice)].map((v) => (
                  <button key={v} className="btn special-die-btn" onClick={() => act('useSpecialDie', { value: v })}>
                    <span className="die special mini">{v}</span> Jouer le {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } else if (t.phase === 'done') {
      body = <button className="btn primary big" onClick={() => act('endTurn')}>Terminer le tour ➜</button>;
    }
  } else if (cur && t.pending?.type === 'casino') {
    body = t.pending.game === 'roulette'
      ? <Roulette result={t.pending.roulette} spinsDone={t.pending.spins} player={cur} size={150} />
      : <SlotMachine spin={t.pending.last} spinsDone={t.pending.spins} player={cur} size={60} />;
  } else if (cur) {
    body = (
      <div className="status-msg">
        <span className="dot" style={{ background: cur.color }} /> <b>{cur.name}</b> joue…
        {t.pending?.type === 'buy' && <div className="sub">hésite à acheter {BOARD[t.pending.cell].name}</div>}
        {t.pending?.type === 'hijack' && <div className="sub">✈️ envisage de détourner un avion…</div>}
        {t.pending?.type === 'card' && <div className="sub">🃏 lit sa carte {t.pending.deck === 'chance' ? 'Chance' : 'Caisse de communauté'}…</div>}
      </div>
    );
  }

  return (
    <div className="center-controls">
      {state.phase !== 'ended' && !(t?.pending?.type === 'casino' && !animating) && <Dice turn={t} />}
      {myTurn && state.phase === 'playing' && !state.auction && <div className="your-turn">C’est votre tour !</div>}
      {body}
    </div>
  );
}
