import React, { useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { BOARD } from '../../../shared/board.js';
import { useElementSize } from '../hooks.js';
import { money, finalRanking } from '../gameInfo.js';

// Motif de trait par joueur : deuxième moyen d'identification en plus de la couleur
const DASHES = ['none', '7 4', '2 4', '10 4 2 4', '1 3', '12 3', '5 2 1 2', '8 2 2 2'];
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const fmtCompact = (n) => `${compact.format(n)} $`;

function niceMax(v) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function Legend({ players }) {
  return (
    <div className="chart-legend">
      {players.map((p, k) => (
        <span key={p.id} className="legend-item">
          <svg width="26" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="25" y2="5" stroke={p.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={DASHES[k % DASHES.length]} />
          </svg>
          {p.name}
        </span>
      ))}
    </div>
  );
}

function NetWorthChart({ history, players }) {
  const wrap = useRef(null);
  const { w } = useElementSize(wrap);
  const [hover, setHover] = useState(null);
  const H = 300;
  const labelEnds = players.length <= 4;
  const m = { l: 56, r: labelEnds ? 96 : 18, t: 14, b: 44 };
  const W = Math.max(320, w);
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const t0 = history[0]?.turn ?? 0;
  const t1 = history[history.length - 1]?.turn ?? 1;
  const maxV = niceMax(Math.max(...history.flatMap((h) => players.map((p) => h.worth[p.id] || 0))));
  const x = (t) => m.l + ((t - t0) / Math.max(1, t1 - t0)) * iw;
  const y = (v) => m.t + ih - (v / maxV) * ih;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * maxV);
  const xStep = Math.max(1, Math.ceil((t1 - t0) / 6 / 5) * 5);
  const xTicks = [];
  for (let t = Math.ceil(t0 / xStep) * xStep; t <= t1; t += xStep) xTicks.push(t);

  // étiquettes de fin : seulement pour les joueurs encore riches et sans chevauchement (la légende couvre les autres)
  const lastPt = history[history.length - 1];
  const endLabels = [];
  for (const p of [...players].filter((q) => (lastPt?.worth[q.id] || 0) > 0).sort((a, b) => (lastPt.worth[b.id] || 0) - (lastPt.worth[a.id] || 0))) {
    const py = y(lastPt.worth[p.id] || 0);
    if (endLabels.every((q) => Math.abs(y(lastPt.worth[q.id] || 0) - py) >= 15)) endLabels.push(p);
  }

  const onMove = (e) => {
    // position dans le repère du SVG entier (la zone survolée commence déjà après la marge gauche)
    const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const turn = t0 + ((px - m.l) / iw) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < history.length; i++) if (Math.abs(history[i].turn - turn) < Math.abs(history[best].turn - turn)) best = i;
    setHover(best);
  };

  const hp = hover != null ? history[hover] : null;
  const hx = hp ? x(hp.turn) : 0;

  return (
    <div className="chart-wrap" ref={wrap}>
      <svg width={W} height={H} role="img" aria-label="Évolution du patrimoine des joueurs au fil des tours">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} className="grid" />
            <text x={m.l - 8} y={y(v)} className="tick" textAnchor="end" dominantBaseline="middle">{fmtCompact(v)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={m.t + ih + 18} className="tick" textAnchor="middle">{t}</text>
        ))}
        <text x={m.l + iw / 2} y={H - 4} className="tick" textAnchor="middle">Tour de jeu</text>
        {players.map((p, k) => {
          const d = history.map((h, i) => `${i ? 'L' : 'M'}${x(h.turn).toFixed(1)},${y(h.worth[p.id] || 0).toFixed(1)}`).join('');
          return <path key={p.id} d={d} fill="none" stroke={p.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={DASHES[k % DASHES.length]} />;
        })}
        {labelEnds && endLabels.map((p) => {
          const last = history[history.length - 1];
          const v = last.worth[p.id] || 0;
          return (
            <g key={p.id}>
              <circle cx={x(last.turn)} cy={y(v)} r="4" fill={p.color} stroke="var(--panel)" strokeWidth="2" />
              <text x={x(last.turn) + 9} y={y(v)} className="end-label" dominantBaseline="middle">{p.name}</text>
            </g>
          );
        })}
        {hp && (
          <g>
            <line x1={hx} x2={hx} y1={m.t} y2={m.t + ih} className="crosshair" />
            {players.map((p) => (
              <circle key={p.id} cx={hx} cy={y(hp.worth[p.id] || 0)} r="4.5" fill={p.color} stroke="var(--panel)" strokeWidth="2" />
            ))}
          </g>
        )}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hp && (
        <div className="chart-tooltip" style={{ left: hx > W * 0.6 ? hx - 12 : hx + 12, top: m.t, transform: hx > W * 0.6 ? 'translateX(-100%)' : 'none' }}>
          <div className="tt-title">Tour {hp.turn}</div>
          {[...players].sort((a, b) => (hp.worth[b.id] || 0) - (hp.worth[a.id] || 0)).map((p) => (
            <div key={p.id} className="tt-row">
              <i style={{ background: p.color }} />
              <span>{p.name}</span>
              <b>{money(hp.worth[p.id] || 0)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Loyers payés (à gauche) et perçus (à droite) par joueur
function RentChart({ players, stats }) {
  const max = Math.max(1, ...players.flatMap((p) => [stats[p.id]?.rentPaid || 0, stats[p.id]?.rentReceived || 0]));
  return (
    <div className="rent-chart">
      <div className="rc-head"><span>← Loyers payés</span><span /><span>Loyers perçus →</span></div>
      {players.map((p) => {
        const s = stats[p.id] || {};
        return (
          <div key={p.id} className="rc-row" title={`${p.name} : payé ${money(s.rentPaid || 0)}, perçu ${money(s.rentReceived || 0)}`}>
            <div className="rc-side left">
              <span className="rc-val">{money(s.rentPaid || 0)}</span>
              <div className="rc-bar paid" style={{ width: `${((s.rentPaid || 0) / max) * 100}%` }} />
            </div>
            <div className="rc-name"><i style={{ background: p.color }} />{p.name}</div>
            <div className="rc-side right">
              <div className="rc-bar received" style={{ width: `${((s.rentReceived || 0) / max) * 100}%` }} />
              <span className="rc-val">{money(s.rentReceived || 0)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const AWARDS = [
  { key: 'rentReceived', icon: '👑', title: 'Roi du loyer', fmt: money },
  { key: 'rentPaid', icon: '💸', title: 'Vache à lait', fmt: money },
  { key: 'peakWorth', icon: '📈', title: 'Pic de fortune', fmt: money },
  { key: 'maxRentPaid', icon: '😱', title: 'Plus gros loyer payé', fmt: money },
  { key: 'buildings', icon: '🏗️', title: 'Bâtisseur', fmt: (v) => `${v} bâtiment${v > 1 ? 's' : ''}` },
  { key: 'hijacks', icon: '✈️', title: 'Pirate de l’air', fmt: (v) => `${v} ville${v > 1 ? 's' : ''} rasée${v > 1 ? 's' : ''}` },
  { key: 'trafficDeliveries', icon: '💊', title: 'Baron de la drogue', fmt: (v) => `${v} livraison${v > 1 ? 's' : ''}` },
  { key: 'jail', icon: '🚔', title: 'Habitué de la prison', fmt: (v) => `${v} séjour${v > 1 ? 's' : ''}` },
  { key: 'doubles', icon: '🎲', title: 'Roi des doubles', fmt: (v) => `${v} double${v > 1 ? 's' : ''}` },
  { key: 'goPasses', icon: '🌍', title: 'Globe-trotter', fmt: (v) => `${v} tour${v > 1 ? 's' : ''} du monde` },
  { key: 'jackpots', icon: '🎰', title: 'Flambeur', fmt: (v) => `${v} jackpot${v > 1 ? 's' : ''}` },
  { key: 'trades', icon: '🤝', title: 'Négociateur', fmt: (v) => `${v} échange${v > 1 ? 's' : ''}` },
  { key: 'goulagWins', icon: '⛓️', title: 'Survivant du goulag', fmt: (v) => `${v} duel${v > 1 ? 's' : ''} gagné${v > 1 ? 's' : ''}` },
];

const TABLE_ROWS = [
  ['Patrimoine final', (s, p, h) => money(h.worth[p.id] || 0)],
  ['Pic de patrimoine', (s) => money(s.peakWorth || 0)],
  ['Propriétés achetées', (s) => s.bought || 0],
  ['Dont aux enchères', (s) => s.auctionsWon || 0],
  ['Maisons / hôtels construits', (s) => `${s.houses || 0} / ${s.hotels || 0}`],
  ['Loyers perçus', (s) => money(s.rentReceived || 0)],
  ['Loyers payés', (s) => money(s.rentPaid || 0)],
  ['Taxes payées', (s) => money(s.taxes || 0)],
  ['Lancers / moyenne des dés', (s) => `${s.rolls || 0} / ${s.rolls ? (s.diceTotal / s.rolls).toFixed(1) : '–'}`],
  ['Doubles', (s) => s.doubles || 0],
  ['Passages par Départ', (s) => s.goPasses || 0],
  ['Séjours en prison', (s) => s.jail || 0],
  ['Livraisons / arrestations (trafic)', (s) => `${s.trafficDeliveries || 0} / ${s.trafficArrests || 0}`],
  ['Villes rasées / subies (avion)', (s) => `${s.hijacks || 0} / ${s.hotelsLost || 0}`],
  ['Casino : misé / gagné', (s) => `${money(s.casinoBet || 0)} / ${money(s.casinoWon || 0)}`],
  ['Cartes tirées', (s) => s.cards || 0],
  ['Échanges conclus', (s) => s.trades || 0],
  ['Duels du goulag gagnés / perdus', (s) => `${s.goulagWins || 0} / ${s.goulagLosses || 0}`],
];

export default function EndGameStats({ state, onClose }) {
  const stats = state.stats;
  const [view, setView] = useState('chart');
  const players = state.players;
  const ps = stats?.players || {};
  const last = stats?.history[stats.history.length - 1];

  const ranking = useMemo(() => finalRanking(state), [players, state.winner]);

  if (!stats || !last) return null;

  const awards = AWARDS.map((a) => {
    const val = (p) => (a.key === 'buildings' ? (ps[p.id]?.houses || 0) + (ps[p.id]?.hotels || 0) : ps[p.id]?.[a.key] || 0);
    const best = [...players].sort((x, y) => val(y) - val(x))[0];
    return { ...a, player: best, value: best ? val(best) : 0 };
  }).filter((a) => a.value > 0);

  const cells = Object.entries(stats.cells).map(([i, c]) => ({ index: +i, ...c }));
  const mostVisited = cells.filter((c) => BOARD[c.index].type === 'city').sort((a, b) => b.landings - a.landings)[0];
  const mostProfitable = [...cells].sort((a, b) => b.rent - a.rent)[0];
  const totalRolls = Object.values(ps).reduce((s, p) => s + (p.rolls || 0), 0);
  const totalDoubles = Object.values(ps).reduce((s, p) => s + (p.doubles || 0), 0);
  const totalHijacks = Object.values(ps).reduce((s, p) => s + (p.hijacks || 0), 0);
  const minutes = Math.max(1, Math.round(((stats.endedAt || Date.now()) - stats.startedAt) / 60000));
  const winner = players.find((p) => p.id === state.winner);

  // vue tableau de la courbe : une ligne tous les N tours
  const step = Math.max(1, Math.ceil(stats.history.length / 15));
  const sampled = stats.history.filter((_, i) => i % step === 0 || i === stats.history.length - 1);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-head">
          <div>
            <h2>🏁 Fin de partie</h2>
            <div className="muted">{stats.turns} tours · {minutes} min{winner && <> · vainqueur : <b className="txt">{winner.name}</b></>}</div>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="podium">
          {ranking.map((p, k) => (
            <div key={p.id} className={`podium-item rank-${k + 1}`}>
              <span className="podium-rank">{['🥇', '🥈', '🥉'][k] || `${k + 1}e`}</span>
              <Avatar state={state} p={p} />
              <div>
                <div className="pname">{p.name}</div>
                <small>{p.id === state.winner ? money(last.worth[p.id] || 0) : `éliminé au tour ${ps[p.id]?.outTurn ?? '?'}`}</small>
              </div>
            </div>
          ))}
        </div>

        <section className="stats-section">
          <div className="section-row">
            <h3>Évolution du patrimoine</h3>
            <div className="view-toggle small">
              <button className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>Graphique</button>
              <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Tableau</button>
            </div>
          </div>
          <p className="muted small-note">Argent + revente des propriétés et des bâtiments, à chaque tour. Survolez la courbe pour le détail.</p>
          {view === 'chart' ? (
            <>
              <Legend players={players} />
              <NetWorthChart history={stats.history} players={players} />
            </>
          ) : (
            <div className="table-scroll">
              <table className="stats-table">
                <thead><tr><th>Tour</th>{players.map((p) => <th key={p.id}><i style={{ background: p.color }} />{p.name}</th>)}</tr></thead>
                <tbody>
                  {sampled.map((h) => (
                    <tr key={h.turn}><td>{h.turn}</td>{players.map((p) => <td key={p.id}>{money(h.worth[p.id] || 0)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="stats-section">
          <h3>🏆 Trophées</h3>
          <div className="awards">
            {awards.map((a) => (
              <div key={a.key} className="award">
                <div className="award-icon">{a.icon}</div>
                <div>
                  <div className="award-title">{a.title}</div>
                  <div className="award-who"><i style={{ background: a.player.color }} />{a.player.name}</div>
                  <small>{a.fmt(a.value)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="stats-section two-col">
          <div>
            <h3>Loyers</h3>
            <RentChart players={players} stats={ps} />
          </div>
          <div>
            <h3>Le plateau</h3>
            <div className="facts">
              {mostVisited && <div className="fact"><span>📍 Ville la plus visitée</span><b>{BOARD[mostVisited.index].name}</b><small>{mostVisited.landings} passages</small></div>}
              {mostProfitable?.rent > 0 && <div className="fact"><span>💰 Propriété la plus rentable</span><b>{BOARD[mostProfitable.index].name}</b><small>{money(mostProfitable.rent)} de loyers</small></div>}
              <div className="fact"><span>🎲 Lancers de dés</span><b>{totalRolls}</b><small>dont {totalDoubles} doubles</small></div>
              <div className="fact"><span>✈️ Avions détournés</span><b>{totalHijacks}</b></div>
            </div>
          </div>
        </section>

        <section className="stats-section">
          <h3>Détail par joueur</h3>
          <div className="table-scroll">
            <table className="stats-table">
              <thead><tr><th />{players.map((p) => <th key={p.id}><i style={{ background: p.color }} />{p.name}</th>)}</tr></thead>
              <tbody>
                {TABLE_ROWS.map(([label, fn]) => (
                  <tr key={label}><td>{label}</td>{players.map((p) => <td key={p.id}>{fn(ps[p.id] || {}, p, last)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
