import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { BOARD, COUNTRY_CELLS, OWNABLE, RULES, CASINO, PLAYER_COLORS, casinoPayout } from '../../../shared/board.js';
import { Fight, ARENA } from '../../../server/fight.js';
import { Game } from '../../../server/game.js';
import { botStep } from '../../../server/bots.js';
import EndGameStats from './EndGameStats.jsx';
import Board2D from './Board2D.jsx';
import { Dice } from './CenterControls.jsx';
import HijackCinematic from './HijackCinematic.jsx';
import BustedCinematic from './BustedCinematic.jsx';
import FightOverlay from './FightOverlay.jsx';
import { EventBanner } from './Game.jsx';
import { useAnimatedPositions } from '../hooks.js';
import { eventSound } from '../sound.js';
import ThemePicker from './ThemePicker.jsx';
import SoundToggle from './SoundToggle.jsx';
import SlotMachine from './SlotMachine.jsx';
import { randomBotSkin } from '../../../shared/characters.js';

const PodiumCinematic = lazy(() => import('./PodiumCinematic.jsx'));

const SayMyNameCinematic = lazy(() => import('./SayMyNameCinematic.jsx'));

const AIRPORTS = BOARD.filter((c) => c.type === 'airport');
const CITIES = BOARD.filter((c) => c.type === 'city');

const PLAYERS = [
  { id: 'me', name: 'Vous', color: '#ef4444' },
  { id: 'tokyo', name: 'Bot Tokyo', color: '#3b82f6', isBot: true },
  { id: 'rio', name: 'Bot Rio', color: '#22c55e', isBot: true },
  { id: 'berlin', name: 'Bot Berlin', color: '#eab308', isBot: true },
];

// Partie fictive : chaque pays appartient à un joueur, avec quelques constructions
function makeDemoState(target) {
  const props = {};
  const countries = Object.keys(COUNTRY_CELLS);
  for (const i of OWNABLE) props[i] = { owner: null, houses: 0 };
  countries.forEach((k, n) => {
    const owner = PLAYERS[(n % 3) + 1].id;
    COUNTRY_CELLS[k].forEach((i, j) => { props[i] = { owner, houses: n % 2 ? 5 : j + 1 }; });
  });
  AIRPORTS.forEach((c, n) => { props[c.index].owner = n % 2 ? 'me' : 'tokyo'; });
  // les bâtiments visés sont déjà détruits dans l'état ; la cinématique les garde debout jusqu'à l'impact
  if (target != null) props[target].houses = 0;
  return {
    phase: 'playing',
    settings: { freeParkingPot: true, goulagMoney: RULES.GOULAG_RETURN_MONEY },
    pot: 350,
    props,
    turn: null,
    players: PLAYERS.map((p, k) => ({
      ...p, money: 1500, pos: [0, 12, 24, 33][k], status: 'alive', connected: true,
      jail: { in: false, turns: 0, heavy: false }, jailCards: [],
    })),
  };
}

// bâtiments de chaque ville dans la partie fictive (avant détournement)
const DEMO_HOUSES = Object.fromEntries(Object.entries(makeDemoState(null).props).map(([i, p]) => [i, p.houses]));

const BANNERS = [
  { type: 'card', deck: 'chance', pid: 'me', text: '💊 Trafic de drogue ! Vous transportez une cargaison. Au prochain passage par Départ vous toucherez un bonus… mais si vous tombez sur la prison, la peine est doublée !' },
  { type: 'traffic', pid: 'me', text: `Vous avez livré la marchandise : +${RULES.TRAFFIC_BONUS} $ 💰` },
  { type: 'jail', pid: 'me', text: '🚔 Vous vous faites arrêter en plein trafic ! Peine doublée.' },
  { type: 'card', deck: 'chance', pid: 'tokyo', text: '🔀 Échange forcé ! Une de vos villes est échangée au hasard contre une ville d’un autre joueur.' },
  { type: 'swap', pid: 'tokyo', text: '🔀 Échange forcé : Bot Tokyo donne Rome et reçoit Paris de Vous' },
  { type: 'card', deck: 'chest', pid: 'rio', text: 'C’est votre anniversaire : chaque joueur vous donne 10 $.' },
  { type: 'goulag', pid: 'berlin', text: '⛓️ Bot Berlin part au goulag !' },
  { type: 'fight', text: '⚔️ Combat du goulag : Bot Berlin vs Vous' },
  { type: 'goulagWin', pid: 'me', text: '🔥 Vous revenez du goulag avec 1 000 $ !' },
  { type: 'disconnect', pid: 'rio', text: '📴 Bot Rio s’est déconnecté' },
  { type: 'win', pid: 'me', text: '🏆 Vous remportez la partie !' },
];

// Joue une partie complète entre bots avec le vrai moteur, pour montrer l'écran de statistiques
function simulateGame(count = 4) {
  let shortest = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const game = new Game('DEMO');
    ['Vous', 'Bot Tokyo', 'Bot Rio', 'Bot Berlin', 'Bot Nairobi', 'Bot Oslo', 'Bot Lima', 'Bot Séoul'].slice(0, count).forEach((name, k) => {
      const p = game.addPlayer({ name, token: null, isBot: true });
      // les bots ont un pion au hasard, comme en partie
      if (k > 0) p.skin = { ...randomBotSkin(game.players.map((x) => x.skin?.preset).filter(Boolean)), v: k };
    });
    game.hostId = game.players[0].id;
    game.start(game.hostId);
    for (let k = 0; k < 30000 && game.phase === 'playing'; k++) {
      if (game.fight) { const f = game.fight; f.stop(); game.endFight(f.ids[Math.random() < 0.5 ? 0 : 1]); continue; }
      if (game.auction) { game.endAuction(); continue; }
      if (!botStep(game)) break;
    }
    game.destroy();
    if (game.phase === 'ended') {
      const s = game.publicState();
      s.stats.startedAt = s.stats.endedAt - (35 + Math.round(Math.random() * 30)) * 60000;
      // les bots seuls peuvent jouer très longtemps : on garde une partie de durée réaliste
      if (s.stats.turns < 700) return s;
      if (!shortest || s.stats.turns < shortest.stats.turns) shortest = s;
    }
  }
  return shortest;
}

function useLocalFight(active, withHuman) {
  const [handle, setHandle] = useState(null);
  useEffect(() => {
    if (!active) return;
    const subs = new Set();
    const players = withHuman
      ? [{ id: 'me', isBot: false, connected: true }, { id: 'berlin', isBot: true, connected: true }]
      : [{ id: 'tokyo', isBot: true, connected: true }, { id: 'berlin', isBot: true, connected: true }];
    const fight = new Fight(players, {
      onTick: (s) => subs.forEach((fn) => fn(s)),
      onEnd: () => {},
    });
    setHandle({
      key: Math.random(),
      ids: players.map((p) => p.id),
      source: {
        subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
        send: (inp) => fight.input('me', inp),
      },
    });
    return () => { fight.stop(); setHandle(null); };
  }, [active, withHuman]);
  return handle;
}

export default function Demo() {
  const [airport, setAirport] = useState(15);
  const [target, setTarget] = useState(-1); // -1 : au hasard, comme en partie
  const [hijack, setHijack] = useState(null);
  const [arrestFrom, setArrestFrom] = useState(30);
  const [arrest, setArrest] = useState(null);
  const [fightMode, setFightMode] = useState(null); // 'human' | 'bots'
  const [banner, setBanner] = useState(null);
  const [statsState, setStatsState] = useState(null);
  const [podiumState, setPodiumState] = useState(null);
  const [podiumCount, setPodiumCount] = useState(5);
  const [smnColor, setSmnColor] = useState(PLAYER_COLORS[0]);
  const [smn, setSmn] = useState(null);
  const [casino, setCasino] = useState(null); // { money, spins, last }
  const bannerIdx = useRef(0);
  const [boardState, setBoardState] = useState(() => makeDemoState(null));
  const [positions] = useAnimatedPositions(boardState.players);
  const fight = useLocalFight(!!fightMode, fightMode === 'human');

  const hijackState = useMemo(() => makeDemoState(hijack?.cell), [hijack?.id]);

  function playHijack() {
    const cell = target >= 0 ? target : CITIES[Math.floor(Math.random() * CITIES.length)].index;
    const victim = makeDemoState(null).props[cell]?.owner;
    setHijack({ id: Date.now(), type: 'hijack', pid: 'me', victim: victim === 'me' ? 'tokyo' : victim, from: airport, cell, houses: DEMO_HOUSES[cell] });
  }

  function nextBanner() {
    const b = BANNERS[bannerIdx.current % BANNERS.length];
    bannerIdx.current++;
    setBanner({ ...b, id: Date.now() });
    eventSound(b.type);
  }

  function roll() {
    const d = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    setBoardState((s) => ({
      ...s,
      turn: { pid: 'me', dice: d, rollId: (s.turn?.rollId || 0) + 1 },
      players: s.players.map((p) => (p.id === 'me' ? { ...p, pos: (p.pos + d[0] + d[1]) % 40 } : p)),
    }));
  }

  // casino local : même tirage et mêmes gains que sur le serveur
  function casinoSpin(bet) {
    setCasino((c) => {
      const reels = [0, 1, 2].map(() => Math.floor(Math.random() * CASINO.SYMBOLS.length));
      const win = casinoPayout(reels, bet);
      return { money: c.money - bet + win, spins: c.spins + 1, last: { id: Date.now(), reels, bet, win } };
    });
  }

  const fightState = fight && {
    ...hijackState,
    settings: { goulagMoney: RULES.GOULAG_RETURN_MONEY },
    fight: { ids: fight.ids, W: ARENA.W, H: ARENA.H, obstacles: ARENA.obstacles },
  };

  return (
    <div className="demo">
      <div className="demo-head">
        <a className="logo small" href="/">MONOP<span>QOJIM</span></a>
        <h2>🎬 Animations</h2>
        <ThemePicker />
        <SoundToggle />
      </div>

      <div className="demo-grid">
        <section className="panel">
          <h3>✈️ Détournement d’avion (cinématique 3D)</h3>
          <p className="muted">Montrée à tous les joueurs quand quelqu’un détourne un avion.</p>
          <label className="demo-field">Aéroport de départ
            <select value={airport} onChange={(e) => setAirport(+e.target.value)}>
              {AIRPORTS.map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}
            </select>
          </label>
          <label className="demo-field">Ville visée
            <select value={target} onChange={(e) => setTarget(+e.target.value)}>
              <option value={-1}>🎲 Au hasard (comme en partie)</option>
              {CITIES.map((c) => <option key={c.index} value={c.index}>{c.name} — {DEMO_HOUSES[c.index] === 5 ? 'hôtel' : `${DEMO_HOUSES[c.index]} maison${DEMO_HOUSES[c.index] > 1 ? 's' : ''}`}</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={playHijack}>▶ Lancer la cinématique</button>
        </section>

        <section className="panel">
          <h3>🚔 Arrestation (« BUSTED »)</h3>
          <p className="muted">Montrée à tous quand un joueur part en prison : course-poursuite, plaquage, BUSTED.</p>
          <label className="demo-field">Le pion part de
            <select value={arrestFrom} onChange={(e) => setArrestFrom(+e.target.value)}>
              <option value={30}>Case « Allez en prison »</option>
              <option value={7}>Chance (carte « Allez en prison »)</option>
              <option value={22}>Chance (côté Italie)</option>
              <option value={10}>Case Prison (trafiquant contrôlé)</option>
            </select>
          </label>
          <button className="btn primary" onClick={() => setArrest({
            id: Date.now(), type: 'busted', pid: 'me', from: arrestFrom, heavy: arrestFrom === 10,
            text: arrestFrom === 10 ? '🚔 Vous vous faites contrôler à la prison avec la marchandise : peine doublée (6 tours) !' : '🚔 Vous tombez sur la case « Allez en prison » : direction la prison !',
          })}>▶ Lancer l’arrestation</button>
        </section>

        <section className="panel">
          <h3>🎰 Casino (machine à sous)</h3>
          <p className="muted">Misez la somme de votre choix, {CASINO.MAX_SPINS} parties max par visite. 3 symboles identiques = jackpot.</p>
          <button className="btn primary" onClick={() => setCasino({ money: 1500, spins: 0, last: null })}>▶ Entrer au casino (1 500 $)</button>
        </section>

        <section className="panel">
          <h3>💊 « Say my name » (cinématique 3D)</h3>
          <p className="muted">Montrée à tous quand un trafiquant livre sa marchandise en passant par Départ.</p>
          <div className="color-picker">
            {PLAYER_COLORS.map((c) => (
              <button key={c} className={`swatch ${smnColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setSmnColor(c)} title="Couleur de votre pion" />
            ))}
          </div>
          <button className="btn primary" onClick={() => setSmn({ id: Date.now(), type: 'delivery', pid: 'me' })}>▶ Lancer la cinématique</button>
        </section>

        <section className="panel">
          <h3>⚔️ Combat du goulag</h3>
          <p className="muted">ZQSD / WASD / flèches pour bouger, souris pour viser, clic pour tirer, Espace pour esquiver.</p>
          <button className="btn primary" onClick={() => setFightMode('human')}>▶ Jouer contre un bot</button>
          <button className="btn" onClick={() => setFightMode('bots')}>👀 Regarder bot contre bot</button>
        </section>

        <section className="panel">
          <h3>🃏 Cartes et annonces</h3>
          <p className="muted">Trafic, arrestation, échange forcé, goulag, victoire… (cliquez plusieurs fois)</p>
          <button className="btn primary" onClick={nextBanner}>▶ Annonce suivante</button>
        </section>

        <section className="panel">
          <h3>🏆 Podium de fin de partie (3D)</h3>
          <p className="muted">Simule une partie entre bots, puis présente les perdants, le 3e, le 2e et le vainqueur.</p>
          <label className="demo-field">Nombre de joueurs
            <select value={podiumCount} onChange={(e) => setPodiumCount(+e.target.value)}>
              {[2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={() => setPodiumState(simulateGame(podiumCount))}>▶ Lancer le podium</button>
        </section>

        <section className="panel">
          <h3>📊 Statistiques de fin de partie</h3>
          <p className="muted">Simule une vraie partie entre 4 bots puis affiche ses statistiques (courbes, trophées…).</p>
          <button className="btn primary" onClick={() => setStatsState(simulateGame())}>▶ Simuler une partie</button>
        </section>

        <section className="panel">
          <h3>🎲 Dés et déplacement</h3>
          <p className="muted">Les dés roulent, puis le pion avance case par case.</p>
          <button className="btn primary" onClick={roll}>🎲 Lancer les dés</button>
        </section>
      </div>

      <div className="demo-board">
        <Board2D state={boardState} size={Math.min(640, window.innerWidth - 32)} positions={positions} onCellClick={() => {}}>
          <div className="center-controls">
            <Dice turn={boardState.turn} />
          </div>
          <EventBanner event={banner} state={boardState} onClose={() => setBanner(null)} />
        </Board2D>
      </div>

      {statsState && <EndGameStats state={statsState} onClose={() => setStatsState(null)} />}
      {podiumState && (
        <Suspense fallback={<div className="cinematic-overlay"><div className="loading3d">Chargement…</div></div>}>
          <PodiumCinematic state={podiumState} onEnd={() => { setStatsState(podiumState); setPodiumState(null); }} />
        </Suspense>
      )}
      {casino && (
        <div className="modal-backdrop" onClick={() => setCasino(null)}>
          <div className="casino-modal" onClick={(e) => e.stopPropagation()}>
            <SlotMachine spin={casino.last} spinsDone={casino.spins} interactive maxBet={Math.max(0, casino.money)}
              player={{ name: `Vous · ${casino.money.toLocaleString('fr-FR')} $`, color: '#fde047' }} size={84}
              onSpin={casinoSpin} onLeave={() => setCasino(null)} />
            {casino.spins >= CASINO.MAX_SPINS && (
              <button className="btn" onClick={() => setCasino((c) => ({ ...c, spins: 0 }))}>🔄 Nouvelle visite</button>
            )}
          </div>
        </div>
      )}
      {smn && (
        <Suspense fallback={<div className="cinematic-overlay"><div className="loading3d">Chargement…</div></div>}>
          <SayMyNameCinematic event={smn} onEnd={() => setSmn(null)}
            state={{ ...boardState, players: boardState.players.map((p) => (p.id === 'me' ? { ...p, color: smnColor } : p)) }} />
        </Suspense>
      )}
      {arrest && <BustedCinematic event={arrest} state={hijackState} positions={{}} onEnd={() => setArrest(null)} />}
      {hijack && (
        <HijackCinematic event={hijack} state={hijackState} positions={{}} onEnd={() => setHijack(null)} />
      )}
      {fightState && (
        <FightOverlay key={fight.key} state={fightState} me="me" source={fight.source} onClose={() => setFightMode(null)} />
      )}
    </div>
  );
}
