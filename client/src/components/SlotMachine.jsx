import React, { useEffect, useRef, useState } from 'react';
import { CASINO } from '../../../shared/board.js';
import { money } from '../gameInfo.js';

const SYMBOLS = CASINO.SYMBOLS.map((x) => x.s);
const REEL_TIMES = [1.3, 1.85, 2.4]; // les rouleaux s'arrêtent l'un après l'autre (secondes)
export const SLOT_DURATION = REEL_TIMES[2] + 0.2;
const rand = () => Math.floor(Math.random() * SYMBOLS.length);

// Un rouleau : une bande de symboles qui défile et s'arrête sur le symbole tiré
function Reel({ target, spinId, k, size }) {
  const [strip, setStrip] = useState([target ?? k * 2]);
  const [offset, setOffset] = useState(0);
  const [moving, setMoving] = useState(false);
  const firstSpin = useRef(spinId);
  useEffect(() => {
    // à l'ouverture, le dernier résultat est affiché sans animation
    if (spinId == null || spinId === firstSpin.current) return;
    const prev = strip[strip.length - 1] ?? 0;
    const s = [prev, ...Array.from({ length: 18 + k * 7 }, rand), target];
    setMoving(false);
    setStrip(s);
    setOffset(0);
    let raf2;
    const raf = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => { setMoving(true); setOffset(s.length - 1); }); });
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(raf2); };
  }, [spinId]);
  return (
    <div className="reel" style={{ height: size, width: size * 0.95 }}>
      <div className={`reel-strip ${moving ? 'moving' : ''}`} style={{
        transform: `translateY(${-offset * size}px)`,
        transition: moving ? `transform ${REEL_TIMES[k]}s cubic-bezier(.15,.65,.3,1.08)` : 'none',
      }}>
        {strip.map((sym, i) => <div key={i} className="reel-sym" style={{ height: size, fontSize: size * 0.58 }}>{SYMBOLS[sym]}</div>)}
      </div>
    </div>
  );
}

// Machine à sous du casino. `spin` = dernier tirage { id, reels, bet, win } ; l'animation se joue à chaque nouvel id.
export default function SlotMachine({ spin, spinsDone = 0, interactive, maxBet, player, onSpin, onLeave, size = 74 }) {
  const [bet, setBet] = useState(() => Math.max(1, Math.min(maxBet || 1, 50)));
  const [revealed, setRevealed] = useState(true);
  const [pulling, setPulling] = useState(false);
  const firstSpin = useRef(spin?.id);
  useEffect(() => {
    if (!spin || spin.id === firstSpin.current) return;
    setRevealed(false);
    setPulling(true);
    const t1 = setTimeout(() => setPulling(false), 450);
    const t2 = setTimeout(() => setRevealed(true), SLOT_DURATION * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [spin?.id]);
  useEffect(() => { if (bet > maxBet) setBet(Math.max(1, maxBet)); }, [maxBet]);

  const left = CASINO.MAX_SPINS - spinsDone;
  const reels = spin?.reels || [0, 2, 5];
  const jackpot = spin && reels[0] === reels[1] && reels[1] === reels[2];
  const result = spin && revealed && spin.id !== firstSpin.current ? spin : null;
  const busy = !revealed;
  const clampBet = (v) => Math.max(1, Math.min(maxBet, Math.floor(+v || 0)));

  return (
    <div className={`slot-machine ${result?.win ? (jackpot ? 'win jackpot' : 'win') : ''}`}>
      <div className="slot-top">
        <div className="slot-lights">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 2) * 0.35}s` }} />)}</div>
        <div className="slot-title">🎰 CASINO DE MACAO</div>
        {player && <div className="slot-player">Joueur : <b style={{ color: player.color }}>{player.name}</b></div>}
      </div>
      <div className="slot-body">
        <div className="slot-window">
          {[0, 1, 2].map((k) => <Reel key={k} k={k} target={reels[k]} spinId={spin?.id} size={size} />)}
          <div className="slot-payline" />
        </div>
        <div className={`slot-lever ${pulling ? 'pulled' : ''}`}><i /><b /></div>
      </div>
      <div className="slot-result">
        {busy ? <span className="spinning">Les rouleaux tournent…</span>
          : result ? (result.win
            ? (result.win > result.bet
              ? <span className="won">{jackpot ? '💰 JACKPOT ! ' : 'Gagné ! '}+{money(result.win - result.bet)} <small>(mise {money(result.bet)} → {money(result.win)})</small></span>
              : <span className="won">Mise remboursée <small>({money(result.win)})</small></span>)
            : <span className="lost">Perdu… −{money(result.bet)}</span>)
            : <span className="muted">3 symboles identiques = jackpot</span>}
        {result?.win > 0 && <div className="coins" key={result.id}>{Array.from({ length: jackpot ? 22 : 9 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.08}s` }}>🪙</i>)}</div>}
      </div>
      <div className="slot-paytable">
        {CASINO.SYMBOLS.map((x) => <span key={x.s}>{x.s}{x.s}{x.s} ×{x.mult}</span>)}
        <span>2 identiques ×{CASINO.PAIR}</span>
      </div>
      {interactive && (
        <div className="slot-controls">
          <div className="row">
            <label className="bet-input">Mise
              <input type="number" min="1" max={maxBet} value={bet} disabled={busy || left <= 0}
                onChange={(e) => setBet(clampBet(e.target.value))} />
            </label>
            {[10, 50, 100].map((v) => <button key={v} className="btn tiny" disabled={busy || v > maxBet} onClick={() => setBet(v)}>{v}</button>)}
            <button className="btn tiny" disabled={busy} onClick={() => setBet(clampBet(maxBet / 2))}>½</button>
            <button className="btn tiny" disabled={busy} onClick={() => setBet(clampBet(maxBet))}>Tapis</button>
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy || left <= 0 || maxBet < 1} onClick={() => onSpin(clampBet(bet))}>
              🎰 Jouer {money(clampBet(bet))}
            </button>
            <button className="btn ghost" disabled={busy} onClick={onLeave}>Quitter le casino</button>
          </div>
          <small>{left > 0 ? `${left} partie${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} sur ${CASINO.MAX_SPINS}` : 'Plus de partie possible pour cette visite'}</small>
        </div>
      )}
      {!interactive && <small className="muted">{left > 0 ? `${spinsDone}/${CASINO.MAX_SPINS} parties jouées` : 'Dernière partie jouée'}</small>}
    </div>
  );
}
