import React, { useEffect, useRef, useState } from 'react';
import { BOARD, COUNTRIES, COUNTRY_CELLS } from '../../../shared/board.js';
import { act, toast } from '../net.js';
import { money, playerById } from '../gameInfo.js';
import { flagSvg } from '../flags.js';
import { sfx } from '../sound.js';

// Rouvre la fenêtre d'une proposition reçue (bouton « Voir » du panneau des échanges)
export const openTradeOffer = (id) => window.dispatchEvent(new CustomEvent('mq-open-trade', { detail: id }));

function PropTile({ state, index, receiver }) {
  const cell = BOARD[index];
  const c = cell.country && COUNTRIES[cell.country];
  const prop = state.props[index];
  // la ville complète-t-elle un pays pour celui qui la reçoit ?
  const completes = c && COUNTRY_CELLS[cell.country].every((i) => i === index || state.props[i]?.owner === receiver);
  return (
    <div className="offer-tile" style={{ '--band': c?.color || '#64748b' }}>
      <div className="ot-band">
        {c ? <span className="flag" dangerouslySetInnerHTML={{ __html: flagSvg(c.code) }} /> : <span>{cell.type === 'airport' ? '✈️' : cell.icon}</span>}
      </div>
      <div className="ot-name">{cell.name}</div>
      <div className="ot-sub">{c ? c.name : cell.type === 'airport' ? 'Aéroport' : 'Compagnie'} · {money(cell.price)}</div>
      {prop?.houses > 0 && <div className="ot-sub">{prop.houses === 5 ? '🏨' : '🏠'.repeat(prop.houses)}</div>}
      {completes && <div className="ot-complete">✓ complète {c.name}</div>}
    </div>
  );
}

function OfferSide({ state, side, title, receiver, tone }) {
  const empty = !side.money && !side.props.length && !side.cards;
  return (
    <div className={`offer-side ${tone}`}>
      <h4>{title}</h4>
      {empty && <div className="muted offer-empty">Rien</div>}
      {side.money > 0 && <div className="offer-money">💵 {money(side.money)}</div>}
      {side.cards > 0 && <div className="offer-cards">🎫 {side.cards} carte{side.cards > 1 ? 's' : ''} « libéré de prison »</div>}
      <div className="offer-tiles">
        {side.props.map((i) => <PropTile key={i} state={state} index={i} receiver={receiver} />)}
      </div>
    </div>
  );
}

// Fenêtre qui s'ouvre chez le joueur qui reçoit une proposition d'échange
export default function TradeOfferModal({ state, me, paused, onCounter }) {
  const [dismissed, setDismissed] = useState(() => new Set());
  const known = useRef(new Set(state.trades.map((t) => t.id)));
  const outgoing = useRef(state.trades.filter((t) => t.from === me));

  // nouvelles propositions reçues : carillon ; propositions envoyées refusées : notification
  useEffect(() => {
    const fresh = state.trades.filter((t) => t.to === me && !known.current.has(t.id));
    for (const t of state.trades) known.current.add(t.id);
    if (fresh.length) sfx.chime();
    const gone = outgoing.current.filter((t) => !state.trades.some((x) => x.id === t.id));
    for (const t of gone) {
      const to = playerById(state, t.to);
      const recent = state.log.slice(-12).reverse().find((l) => l.pid === t.to);
      if (recent?.text.includes('refuse')) { toast(`${to?.name} a refusé votre proposition d’échange`, 'info'); sfx.refuse(); }
    }
    outgoing.current = state.trades.filter((t) => t.from === me);
  }, [state.trades]);

  useEffect(() => {
    const onOpen = (e) => setDismissed((d) => { const n = new Set(d); n.delete(e.detail); return n; });
    window.addEventListener('mq-open-trade', onOpen);
    return () => window.removeEventListener('mq-open-trade', onOpen);
  }, []);

  const trade = state.trades.find((t) => t.to === me && !dismissed.has(t.id));
  if (!trade || paused || state.phase !== 'playing') return null;
  const from = playerById(state, trade.from);
  const close = () => setDismissed((d) => new Set(d).add(trade.id));

  return (
    <div className="modal-backdrop trade-offer-backdrop">
      <div className="trade-offer" style={{ '--from': from?.color }}>
        <div className="to-head">
          <span className="avatar" style={{ background: from?.color }}>{from?.isBot ? '🤖' : from?.name[0]?.toUpperCase()}</span>
          <div>
            <div className="to-kicker">{trade.counter ? '🔁 Contre-proposition' : '🤝 Proposition d’échange'}</div>
            <div className="to-title"><b style={{ color: from?.color }}>{from?.name}</b> vous propose un échange</div>
          </div>
        </div>
        <div className="offer-grid">
          <OfferSide state={state} side={trade.offer} title="Vous recevez" receiver={me} tone="gain" />
          <div className="trade-arrow">⇄</div>
          <OfferSide state={state} side={trade.request} title="Vous donnez" receiver={trade.from} tone="loss" />
        </div>
        <div className="row to-actions">
          <button className="btn primary big" onClick={() => act('acceptTrade', { id: trade.id })}>✓ Accepter</button>
          <button className="btn big" onClick={() => { close(); onCounter(trade); }}>💬 Négocier</button>
          <button className="btn danger big" onClick={() => act('declineTrade', { id: trade.id })}>✕ Refuser</button>
        </div>
        <button className="btn ghost tiny to-later" onClick={close}>Répondre plus tard (la proposition reste dans « Échanges »)</button>
      </div>
    </div>
  );
}
