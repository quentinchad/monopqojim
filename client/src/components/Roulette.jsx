import React, { useEffect, useRef, useState } from 'react';
import { CASINO, ROULETTE, rouletteColor, rouletteBetLabel } from '../../../shared/board.js';
import { money } from '../gameInfo.js';
import { sfx } from '../sound.js';

export const ROULETTE_SPIN = 4.6; // secondes avant que la bille ne s'arrête
const STEP = 360 / ROULETTE.ORDER.length;
const COLORS = { red: '#c1121f', black: '#16141f', green: '#15803d' };

// La roue : 37 cases dans l'ordre européen, le numéro sorti s'arrête sous le repère en haut
function Wheel({ result, spinId, size }) {
  const [rot, setRot] = useState(() => (result ? -ROULETTE.ORDER.indexOf(result.n) * STEP : 0));
  const [ball, setBall] = useState(0);
  const [moving, setMoving] = useState(false);
  const first = useRef(spinId);
  useEffect(() => {
    if (spinId == null || spinId === first.current) return;
    const k = ROULETTE.ORDER.indexOf(result.n);
    setMoving(true);
    setRot((r) => {
      const target = -k * STEP;
      const delta = ((((target - r) % 360) + 360) % 360);
      return r + 360 * 4 + delta;
    });
    setBall((b) => b - 360 * 6);
  }, [spinId]);
  const R = 100;
  return (
    <div className="roulette-wheel" style={{ width: size, height: size }}>
      <svg viewBox="-110 -110 220 220" style={{
        transform: `rotate(${rot}deg)`,
        transition: moving ? `transform ${ROULETTE_SPIN}s cubic-bezier(.12,.6,.25,1)` : 'none',
      }}>
        <circle r="108" fill="#5b3412" stroke="#f5c542" strokeWidth="3" />
        {ROULETTE.ORDER.map((n, k) => {
          const a0 = ((k - 0.5) * STEP - 90) * (Math.PI / 180);
          const a1 = ((k + 0.5) * STEP - 90) * (Math.PI / 180);
          const am = (k * STEP - 90) * (Math.PI / 180);
          const p = (a, r) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
          return (
            <g key={n}>
              <path d={`M ${p(a0, 58)} L ${p(a0, R)} A ${R} ${R} 0 0 1 ${p(a1, R)} L ${p(a1, 58)} A 58 58 0 0 0 ${p(a0, 58)} Z`}
                fill={COLORS[rouletteColor(n)]} stroke="#d4a72c" strokeWidth="0.6" />
              <text x={Math.cos(am) * 88} y={Math.sin(am) * 88} fill="#fff" fontSize="8.5" fontWeight="800"
                textAnchor="middle" dominantBaseline="central" transform={`rotate(${k * STEP} ${Math.cos(am) * 88} ${Math.sin(am) * 88})`}>{n}</text>
            </g>
          );
        })}
        <circle r="58" fill="#7c4a1e" stroke="#d4a72c" strokeWidth="1.5" />
        <circle r="40" fill="#a16207" />
        {[0, 1, 2, 3].map((k) => <rect key={k} x="-3" y="-38" width="6" height="76" rx="3" fill="#fde68a" transform={`rotate(${k * 45})`} />)}
        <circle r="9" fill="#fde68a" stroke="#92400e" />
      </svg>
      {/* la bille tourne en sens inverse et finit sous le repère */}
      <div className="roulette-ball-track" style={{
        transform: `rotate(${ball}deg)`,
        transition: moving ? `transform ${ROULETTE_SPIN}s cubic-bezier(.2,.55,.3,1)` : 'none',
      }}><i /></div>
      <div className="roulette-pointer" />
    </div>
  );
}

const OUTSIDE = ['red', 'black', 'even', 'odd', 'low', 'high', 'd1', 'd2', 'd3'];

// Table de roulette. `result` = dernier tirage { id, n, on, bet, win } ; l'animation se joue à chaque nouvel id.
export default function Roulette({ result, spinsDone = 0, interactive, maxBet, player, onSpin, onLeave, size = 190 }) {
  const [bet, setBet] = useState(() => Math.max(1, Math.min(maxBet || 1, 50)));
  const [on, setOn] = useState('red');
  const [revealed, setRevealed] = useState(true);
  const first = useRef(result?.id);
  useEffect(() => {
    if (!result || result.id === first.current) return;
    setRevealed(false);
    sfx.reels([ROULETTE_SPIN]); // cliquetis de la bille jusqu'à l'arrêt
    const t = setTimeout(() => {
      setRevealed(true);
      if (result.win > 0) (Number.isInteger(result.on) ? sfx.jackpot() : sfx.slotWin());
      else sfx.slotLose();
    }, ROULETTE_SPIN * 1000 + 150);
    return () => clearTimeout(t);
  }, [result?.id]);
  useEffect(() => { if (bet > maxBet) setBet(Math.max(1, maxBet)); }, [maxBet]);

  const left = CASINO.MAX_SPINS - spinsDone;
  const shown = result && revealed && result.id !== first.current ? result : null;
  const busy = !revealed;
  const clampBet = (v) => Math.max(1, Math.min(maxBet, Math.floor(+v || 0)));
  const mult = Number.isInteger(on) ? 36 : ROULETTE.BETS[on].mult;
  const color = shown && rouletteColor(shown.n);

  return (
    <div className={`roulette-table ${shown?.win ? 'win' : ''}`}>
      <div className="slot-title">🎡 ROULETTE DE MACAO</div>
      {player && <div className="slot-player">Joueur : <b style={{ color: player.color }}>{player.name}</b></div>}
      <Wheel result={result} spinId={result?.id} size={size} />
      <div className="slot-result">
        {busy ? <span className="spinning">Rien ne va plus…</span>
          : shown ? (
            <>
              <span className={`roulette-num c-${color}`}>{shown.n}</span>{' '}
              {shown.win
                ? <span className="won">Gagné sur {rouletteBetLabel(shown.on)} ! +{money(shown.win - shown.bet)}</span>
                : <span className="lost">Perdu sur {rouletteBetLabel(shown.on)}… −{money(shown.bet)}</span>}
            </>
          ) : <span className="muted">Faites vos jeux !</span>}
        {shown?.win > 0 && <div className="coins" key={shown.id}>{Array.from({ length: Number.isInteger(shown.on) ? 22 : 9 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.08}s` }}>🪙</i>)}</div>}
      </div>
      {interactive && (
        <div className="slot-controls">
          <div className="roulette-bets">
            {OUTSIDE.map((k) => (
              <button key={k} className={`rb rb-${k} ${on === k ? 'active' : ''}`} disabled={busy} onClick={() => setOn(k)}>
                {ROULETTE.BETS[k].label} <small>×{ROULETTE.BETS[k].mult}</small>
              </button>
            ))}
          </div>
          <div className="roulette-grid">
            <button className={`rn c-green zero ${on === 0 ? 'active' : ''}`} disabled={busy} onClick={() => setOn(0)}>0</button>
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
              <button key={n} className={`rn c-${rouletteColor(n)} ${on === n ? 'active' : ''}`} disabled={busy} onClick={() => setOn(n)}
                style={{ gridColumn: Math.ceil(n / 3) + 1, gridRow: 3 - ((n - 1) % 3) }}>{n}</button>
            ))}
          </div>
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
            <button className="btn primary" disabled={busy || left <= 0 || maxBet < 1} onClick={() => onSpin(clampBet(bet), on)}>
              🎡 {money(clampBet(bet))} sur {rouletteBetLabel(on)} <small>(gain {money(clampBet(bet) * mult)})</small>
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
