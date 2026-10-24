import React from 'react';
import { BOARD, COUNTRIES } from '../../../shared/board.js';
import { cellRect, cellCenter, pct, tokenOffset, CORNER, TOTAL } from '../layout.js';
import { flagSvg } from '../flags.js';
import { currentRent, money, playerById } from '../gameInfo.js';
import { skinUrl, skinBackground } from '../skin3d.js';

const ICONS = { chance: '❓', chest: '📦', tax: '💸', airport: '✈️', casino: '🎰' };

function Houses({ n }) {
  if (!n) return null;
  if (n === 5) return <span className="houses"><i className="hotel" /></span>;
  return <span className="houses">{Array.from({ length: n }, (_, k) => <i key={k} className="house" />)}</span>;
}

function CellContent({ cell, state }) {
  const prop = state.props[cell.index];
  const owner = prop?.owner && playerById(state, prop.owner);
  const priceLine = owner
    ? <div className="owner-tag" style={{ background: owner.color }}>{currentRent(state, cell.index)}</div>
    : cell.price ? <div className="price">{money(cell.price)}</div> : null;

  switch (cell.type) {
    case 'city': {
      const c = COUNTRIES[cell.country];
      return (
        <>
          <div className="band" style={{ background: c.color }}>
            <span className="flag" dangerouslySetInnerHTML={{ __html: flagSvg(c.code) }} />
            <Houses n={prop?.houses} />
          </div>
          <div className="cbody">
            <div className="cname">{cell.name}</div>
            {priceLine}
          </div>
        </>
      );
    }
    case 'airport':
    case 'utility':
      return (
        <div className="cbody">
          <div className="cicon">{cell.type === 'airport' ? '✈️' : cell.icon}</div>
          <div className="cname">{cell.type === 'airport' ? cell.code : cell.name}</div>
          {priceLine}
        </div>
      );
    case 'chance':
    case 'chest':
      return (
        <div className="cbody">
          <div className="cicon big">{ICONS[cell.type]}</div>
          <div className="cname">{cell.type === 'chance' ? 'Chance' : 'Caisse'}</div>
        </div>
      );
    case 'casino':
      return (
        <div className="cbody casino-cell">
          <div className="cicon big">{ICONS.casino}</div>
          <div className="cname">Casino</div>
          <div className="price">Macao</div>
        </div>
      );
    case 'tax':
      return (
        <div className="cbody">
          <div className="cicon">{ICONS.tax}</div>
          <div className="cname">{cell.name}</div>
          <div className="price">{money(cell.amount)}</div>
        </div>
      );
    case 'go':
      return <div className="corner go"><div className="corner-icon">⬅️</div><b>DÉPART</b><small>+200 $</small></div>;
    case 'jail':
      return <div className="corner jail"><div className="bars">🚔</div><b>PRISON</b><small>simple visite</small></div>;
    case 'parking':
      return (
        <div className="corner parking">
          <div className="corner-icon">🏖️</div><b>PARC GRATUIT</b>
          {state.settings.freeParkingPot && <small className="pot">{money(state.pot)}</small>}
        </div>
      );
    case 'gotojail':
      return <div className="corner gotojail"><div className="corner-icon">👮</div><b>ALLEZ EN PRISON</b></div>;
    default:
      return null;
  }
}

export default function Board2D({ state, size, positions, onCellClick, highlights = {}, children }) {
  const players = state.players.filter((p) => p.status === 'alive');
  const byCell = {};
  for (const p of players) {
    const pos = positions[p.id] ?? p.pos;
    (byCell[pos] ||= []).push(p);
  }

  return (
    <div className="board2d" style={{ width: size, height: size, fontSize: size / 80 }}>
      {BOARD.map((cell) => {
        const r = cellRect(cell.index);
        const prop = state.props[cell.index];
        const owner = prop?.owner && playerById(state, prop.owner);
        const cls = [
          'cell', `side-${r.side}`, `t-${cell.type}`,
          owner && 'owned', highlights[cell.index],
        ].filter(Boolean).join(' ');
        return (
          <div key={cell.index} className={cls} onClick={() => onCellClick(cell.index)}
            style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h), '--owner': owner?.color }}>
            <CellContent cell={cell} state={state} />
          </div>
        );
      })}

      <div className="board-center" style={{ left: pct(CORNER), top: pct(CORNER), width: pct(TOTAL - 2 * CORNER), height: pct(TOTAL - 2 * CORNER) }}>
        {children}
      </div>

      {Object.entries(byCell).flatMap(([pos, list]) => list.map((p, k) => {
        const c = cellCenter(+pos);
        let { dx, dy } = tokenOffset(k, list.length);
        if (+pos === 10) {
          // dans la prison : en haut à droite ; en visite : sur le bord
          if (p.jail.in) { dx = dx * 0.6 + 0.25; dy = dy * 0.6 - 0.25; } else { dx = dx * 0.6 - 0.45; dy = dy * 0.6 + 0.45; }
        }
        const isTurn = state.turn?.pid === p.id;
        const url = skinUrl(state.id, p);
        return (
          <div key={p.id} className={`token ${isTurn ? 'active' : ''} ${url ? 'has-skin' : ''}`} title={p.name}
            style={{ left: pct(c.x + dx), top: pct(c.y + dy), background: p.color, ...skinBackground(state.id, p), '--pc': p.color }}>
            {p.isBot ? '🤖' : p.name[0]?.toUpperCase()}
          </div>
        );
      }))}
    </div>
  );
}
