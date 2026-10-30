import React, { useState } from 'react';
import { COUNTRIES } from '../../../shared/board.js';
import { BOARD } from '../activeBoard.js';
import { act } from '../net.js';
import { money, playerById, groupHasBuildings } from '../gameInfo.js';
import { flagSvg } from '../flags.js';

function PropChip({ index, selected, disabled, onClick }) {
  const cell = BOARD[index];
  const c = cell.country && COUNTRIES[cell.country];
  return (
    <button className={`prop-chip ${selected ? 'selected' : ''}`} disabled={disabled} onClick={onClick}
      style={{ '--band': c?.color || '#64748b' }}>
      {c ? <span className="flag" dangerouslySetInnerHTML={{ __html: flagSvg(c.code) }} /> : <span>{cell.type === 'airport' ? '✈️' : cell.icon}</span>}
      {cell.name}
    </button>
  );
}

function Side({ state, player, side, setSide, title }) {
  const props = Object.keys(state.props).map(Number).filter((i) => state.props[i].owner === player.id);
  const toggle = (i) => {
    const s = new Set(side.props);
    s.has(i) ? s.delete(i) : s.add(i);
    setSide({ ...side, props: [...s] });
  };
  return (
    <div className="trade-side">
      <h4><span className="dot" style={{ background: player.color }} /> {title}</h4>
      <label>Argent (max {money(Math.max(0, player.money))})
        <input type="number" min="0" max={Math.max(0, player.money)} value={side.money || ''}
          onChange={(e) => setSide({ ...side, money: Math.max(0, Math.min(player.money, +e.target.value || 0)) })} />
      </label>
      <div className="chips">
        {props.length === 0 && <small className="muted">Aucune propriété</small>}
        {props.map((i) => (
          <PropChip key={i} index={i} selected={side.props.includes(i)} disabled={groupHasBuildings(state, i)} onClick={() => toggle(i)} />
        ))}
      </div>
      {player.jailCards.length > 0 && (
        <label>Cartes « libéré de prison »
          <input type="number" min="0" max={player.jailCards.length} value={side.cards}
            onChange={(e) => setSide({ ...side, cards: Math.max(0, Math.min(player.jailCards.length, +e.target.value || 0)) })} />
        </label>
      )}
    </div>
  );
}

// counter : proposition reçue à laquelle on répond par une contre-proposition (côtés inversés, pré-remplis)
export default function TradeModal({ state, me, initialTarget, counter, onClose }) {
  const others = state.players.filter((p) => p.status === 'alive' && p.id !== me);
  const [target, setTarget] = useState(initialTarget || others[0]?.id);
  const empty = { money: 0, props: [], cards: 0 };
  const [offer, setOffer] = useState(counter ? counter.request : empty);
  const [request, setRequest] = useState(counter ? counter.offer : empty);
  const meP = playerById(state, me);
  const tp = playerById(state, target);

  async function send() {
    const res = counter
      ? await act('counterTrade', { id: counter.id, offer, request })
      : await act('proposeTrade', { to: target, offer, request });
    if (!res.error) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{counter ? '💬 Contre-proposition' : '🤝 Proposer un échange'}</h3>
        {counter && <p className="note">Modifiez l’échange puis renvoyez-le : la proposition reçue sera remplacée par la vôtre.</p>}
        <div className="trade-targets" hidden={!!counter}>
          {others.map((p) => (
            <button key={p.id} className={`btn ${p.id === target ? 'primary' : ''}`}
              onClick={() => { setTarget(p.id); setRequest(empty); }}>
              <span className="dot" style={{ background: p.color }} /> {p.name}
            </button>
          ))}
        </div>
        {tp ? (
          <div className="trade-grid">
            <Side state={state} player={meP} side={offer} setSide={setOffer} title="Vous donnez" />
            <div className="trade-arrow">⇄</div>
            <Side key={tp.id} state={state} player={tp} side={request} setSide={setRequest} title={`${tp.name} donne`} />
          </div>
        ) : <p>Aucun joueur disponible.</p>}
        <p className="note">Les villes d’un pays où il y a des bâtiments ne peuvent pas être échangées.</p>
        <div className="row end">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!tp} onClick={send}>{counter ? 'Envoyer la contre-proposition' : 'Envoyer la proposition'}</button>
        </div>
      </div>
    </div>
  );
}

export function TradeSummary({ state, trade }) {
  const from = playerById(state, trade.from);
  const to = playerById(state, trade.to);
  const list = (o) => [
    o.money ? money(o.money) : null,
    ...o.props.map((i) => BOARD[i].name),
    o.cards ? `${o.cards} carte(s) prison` : null,
  ].filter(Boolean).join(', ') || 'rien';
  return (
    <div className="trade-summary">
      <div><b style={{ color: from?.color }}>{from?.name}</b> donne : {list(trade.offer)}</div>
      <div><b style={{ color: to?.color }}>{to?.name}</b> donne : {list(trade.request)}</div>
    </div>
  );
}
