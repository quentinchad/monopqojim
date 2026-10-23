import React, { useEffect, useRef, useState } from 'react';
import { BOARD, COUNTRIES, COUNTRY_CELLS } from '../../../shared/board.js';
import { act } from '../net.js';
import { money, playerById, ownsCountry } from '../gameInfo.js';
import { flagSvg } from '../flags.js';
import { TradeSummary } from './TradeModal.jsx';

export function PlayersPanel({ state, me, onTrade }) {
  return (
    <div className="players-panel">
      {state.players.map((p) => {
        const isTurn = state.turn?.pid === p.id && state.phase === 'playing';
        const owned = Object.keys(state.props).map(Number).filter((i) => state.props[i].owner === p.id);
        return (
          <div key={p.id} className={`player-row ${isTurn ? 'turn' : ''} status-${p.status}`} style={{ '--pc': p.color }}>
            <span className="avatar" style={{ background: p.color }}>{p.isBot ? '🤖' : p.name[0]?.toUpperCase()}</span>
            <div className="pinfo">
              <div className="pname">
                {p.name}{p.id === me && <small> (vous)</small>}
                {p.status === 'alive' && p.jail.in && <span title={p.jail.heavy ? 'En prison (peine doublée)' : 'En prison'}> 🚔</span>}
                {p.trafficking && <span title="Transporte de la drogue"> 💊</span>}
                {p.jailCards.length > 0 && <span title="Carte libéré de prison"> 🎫</span>}
                {p.status === 'goulag' && <span title="Au goulag"> ⛓️</span>}
                {p.status === 'eliminated' && <span title="Éliminé"> 💀</span>}
                {!p.connected && !p.isBot && <span title={p.abandonIn != null ? 'Déconnecté : abandon automatique s’il ne revient pas' : 'Déconnecté'}> 📴</span>}
              </div>
              <div className="owned-dots">
                {owned.map((i) => (
                  <i key={i} title={BOARD[i].name} style={{ background: BOARD[i].country ? COUNTRIES[BOARD[i].country].color : '#94a3b8', opacity: state.props[i].mortgaged ? 0.35 : 1 }} />
                ))}
              </div>
            </div>
            <div className="pmoney">
              <div className={p.money < 0 ? 'neg' : ''}>{p.status === 'alive' ? money(p.money) : p.status === 'goulag' ? 'Goulag' : 'Éliminé'}</div>
              {p.status === 'alive' && <small title="Patrimoine (argent + hypothèques + revente des bâtiments)">≈ {money(p.netWorth)}</small>}
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
  const others = state.trades.length - mine.length;
  if (!state.trades.length) return null;
  return (
    <div className="trades-panel">
      <h4>Échanges</h4>
      {mine.map((t) => (
        <div key={t.id} className={`trade-item ${t.to === me ? 'incoming' : ''}`}>
          <TradeSummary state={state} trade={t} />
          <div className="row">
            {t.to === me && <button className="btn tiny primary" onClick={() => act('acceptTrade', { id: t.id })}>Accepter</button>}
            <button className="btn tiny" onClick={() => act('declineTrade', { id: t.id })}>{t.to === me ? 'Refuser' : 'Annuler'}</button>
          </div>
        </div>
      ))}
      {others > 0 && <small className="muted">{others} échange(s) en cours entre d’autres joueurs</small>}
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
                <div key={i} className={`pg-item ${pr.mortgaged ? 'mortgaged' : ''}`} onClick={() => onCell(i)}>
                  {BOARD[i].name}
                  <span>{pr.houses === 5 ? '🏨' : '🏠'.repeat(pr.houses)}{pr.mortgaged && ' (hyp.)'}</span>
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
