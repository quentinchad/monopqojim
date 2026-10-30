import React, { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { COUNTRIES } from '../../../shared/board.js';
import { BOARD, COUNTRY_CELLS } from '../activeBoard.js';
import { act } from '../net.js';
import { money, playerById, ownsCountry } from '../gameInfo.js';
import { flagSvg } from '../flags.js';
import { TradeSummary } from './TradeModal.jsx';
import { openTradeOffer } from './TradeOfferModal.jsx';
import { CIVS, civOf } from '../../../shared/civs.js';

export function PlayersPanel({ state, me, onTrade, onHover, hoverPid }) {
  return (
    <div className="players-panel">
      {state.players.map((p) => {
        const isTurn = state.turn?.pid === p.id && state.phase === 'playing';
        const owned = Object.keys(state.props).map(Number).filter((i) => state.props[i].owner === p.id);
        const al = (state.alliances || []).find((x) => x.a === p.id || x.b === p.id);
        const ally = al && playerById(state, al.a === p.id ? al.b : al.a);
        const civ = state.settings?.civs !== false && CIVS[civOf(state, p.id)];
        return (
          <div key={p.id} className={`player-row ${isTurn ? 'turn' : ''} ${hoverPid === p.id ? 'hovered' : ''} status-${p.status}`} style={{ '--pc': p.color }}
            onMouseEnter={() => onHover?.(p.id)} onMouseLeave={() => onHover?.(null)}
            title={owned.length ? 'Ses propriétés sont mises en évidence sur le plateau' : undefined}>
            <Avatar state={state} p={p} />
            <div className="pinfo">
              <div className="pname">
                {p.name}{p.id === me && <small> (vous)</small>}
                {civ && civ !== CIVS.classique && <span title={`Civilisation : ${civ.name}`}> {civ.icon}</span>}
                {ally && <span className="ally-tag" style={{ '--ac': ally.color }} title={`Régime de Vichy : collabore avec ${ally.name} (loyers partagés, pas de loyer entre eux) — encore ${al.turnsLeft} tour(s)`}>🤝 {ally.name} · {al.turnsLeft}</span>}
                {p.status === 'alive' && p.jail.in && <span title={p.jail.heavy ? 'En prison (peine doublée)' : 'En prison'}> 🚔</span>}
                {p.trafficking && <span title="Transporte de la drogue"> 💊</span>}
                {p.jailCards.length > 0 && <span title="Carte libéré de prison"> 🎫</span>}
                {p.specialDice?.length > 0 && <span title={`Dé spécial : ${p.specialDice.join(', ')}`}> 🎲{p.specialDice.join('·')}</span>}
                {p.status === 'goulag' && <span title="Au goulag"> ⛓️</span>}
                {p.status === 'eliminated' && <span title="Éliminé"> 💀</span>}
                {!p.connected && !p.isBot && !p.botControlled && <span title={p.abandonIn != null ? 'Déconnecté : un bot le remplacera à la fin du décompte' : 'Déconnecté'}> 📴</span>}
                {p.botControlled && !p.connected && <span title="Déconnecté : un bot joue à sa place jusqu’à son retour"> 🤖</span>}
              </div>
              <div className="owned-dots">
                {owned.map((i) => (
                  <i key={i} title={BOARD[i].name} style={{ background: BOARD[i].country ? COUNTRIES[BOARD[i].country].color : '#94a3b8' }} />
                ))}
              </div>
            </div>
            <div className="pmoney">
              <div className={p.money < 0 ? 'neg' : ''}>{p.status === 'alive' ? money(p.money) : p.status === 'goulag' ? 'Goulag' : 'Éliminé'}</div>
              {p.status === 'alive' && <small title="Patrimoine (argent + revente des propriétés et des bâtiments)">≈ {money(p.netWorth)}</small>}
            </div>
            {p.id !== me && p.status === 'alive' && playerById(state, me)?.status === 'alive' && state.phase === 'playing' && (
              <button className="btn tiny" title="Proposer un échange" onClick={() => onTrade(p.id)}>🤝</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TradesPanel({ state, me }) {
  const mine = state.trades.filter((t) => t.to === me || t.from === me);
  const others = state.trades.filter((t) => t.to !== me && t.from !== me);
  if (!state.trades.length) return null;
  return (
    <div className="trades-panel">
      <h4>Échanges</h4>
      {mine.map((t) => (
        <div key={t.id} className={`trade-item ${t.to === me ? 'incoming' : ''}`}>
          <small className="muted">{t.to === me ? (t.counter ? '🔁 Contre-proposition reçue' : '📥 Proposition reçue') : '📤 En attente de réponse'}</small>
          <TradeSummary state={state} trade={t} />
          <div className="row">
            {t.to === me && <button className="btn tiny" onClick={() => openTradeOffer(t.id)}>👁 Voir</button>}
            {t.to === me && <button className="btn tiny primary" onClick={() => act('acceptTrade', { id: t.id })}>Accepter</button>}
            <button className="btn tiny" onClick={() => act('declineTrade', { id: t.id })}>{t.to === me ? 'Refuser' : 'Annuler'}</button>
          </div>
        </div>
      ))}
      {others.length > 0 && (
        <details className="trades-others">
          <summary>👀 {others.length} échange(s) en cours entre d’autres joueurs</summary>
          {others.map((t) => {
            const from = playerById(state, t.from);
            const to = playerById(state, t.to);
            return (
              <div key={t.id} className="trade-item">
                <small className="muted">
                  <b style={{ color: from?.color }}>{from?.name}</b> {t.counter ? 'répond à' : 'propose à'} <b style={{ color: to?.color }}>{to?.name}</b>
                </small>
                <TradeSummary state={state} trade={t} />
              </div>
            );
          })}
        </details>
      )}
    </div>
  );
}

export function MyProperties({ state, me, onCell }) {
  const owned = Object.keys(state.props).map(Number).filter((i) => state.props[i].owner === me);
  if (!owned.length) return <div className="my-props empty">Vous ne possédez aucune propriété.</div>;
  const groups = {};
  for (const i of owned) {
    const key = BOARD[i].country || BOARD[i].type;
    (groups[key] ||= []).push(i);
  }
  return (
    <div className="my-props">
      {Object.entries(groups).map(([key, list]) => {
        const c = COUNTRIES[key];
        const total = c ? COUNTRY_CELLS[key].length : null;
        const full = c && ownsCountry(state, me, key);
        return (
          <div key={key} className="prop-group">
            <div className="pg-head" style={{ borderColor: c?.color || '#94a3b8' }}>
              {c ? <span className="flag" dangerouslySetInnerHTML={{ __html: flagSvg(c.code) }} /> : key === 'airport' ? '✈️' : '🏭'}
              <span>{c ? c.name : key === 'airport' ? 'Aéroports' : 'Compagnies'}</span>
              {total && <small className={full ? 'full' : ''}>{list.length}/{total}{full && ' ✓'}</small>}
            </div>
            {list.map((i) => {
              const pr = state.props[i];
              return (
                <div key={i} className="pg-item" onClick={() => onCell(i)}>
                  {BOARD[i].name}
                  <span>{pr.houses === 5 ? '🏨' : '🏠'.repeat(pr.houses)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function LogChat({ state, me }) {
  const [tab, setTab] = useState('log');
  const [text, setText] = useState('');
  const [seenChat, setSeenChat] = useState(state.chat.length);
  const listRef = useRef(null);
  const items = tab === 'log' ? state.log : state.chat;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (tab === 'chat') setSeenChat(state.chat.length);
  }, [items.length, tab]);
  const unread = Math.max(0, state.chat.length - seenChat);
  const send = () => {
    if (!text.trim()) return;
    act('chat', { text });
    setText('');
  };
  return (
    <div className="logchat">
      <div className="tabs">
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Journal</button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat {unread > 0 && <span className="badge">{unread}</span>}</button>
      </div>
      <div className="lc-list" ref={listRef}>
        {tab === 'log'
          ? state.log.map((l) => {
            const p = l.pid && playerById(state, l.pid);
            return <div key={l.id} className="log-line" style={{ borderColor: p?.color || 'transparent' }}>{l.text}</div>;
          })
          : state.chat.map((m) => (
            <div key={m.id} className="chat-line"><b style={{ color: m.color }}>{m.name}</b> {m.text}</div>
          ))}
      </div>
      {tab === 'chat' && playerById(state, me) && (
        <div className="chat-input">
          <input value={text} maxLength={300} placeholder="Message…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className="btn" onClick={send}>➤</button>
        </div>
      )}
    </div>
  );
}
