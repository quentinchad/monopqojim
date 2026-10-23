// IA simple pour les bots (et pour les joueurs déconnectés depuis trop longtemps).
import { BOARD, COUNTRY_CELLS, housePrice } from '../shared/board.js';

// Un joueur humain déconnecté depuis ce délai est joué par un « pilote automatique prudent »
// (il lance les dés et finit son tour, sans rien acheter ni décider à sa place) en attendant
// son retour ou son abandon.
export const AUTOPILOT_DELAY = 8000;

export function isAI(game, p) {
  if (p.isBot) return true;
  return !p.connected && p.disconnectedAt && Date.now() - p.disconnectedAt > AUTOPILOT_DELAY;
}

const isCautious = (p) => !p.isBot;

const owned = (game, p) => Object.keys(game.props).map(Number).filter((i) => game.props[i].owner === p.id);

// Valeur estimée d'une propriété pour un joueur (bonus si elle complète un pays)
function valueFor(game, p, index, extraOwned = []) {
  const cell = BOARD[index];
  let v = cell.price;
  if (cell.type === 'city') {
    const group = COUNTRY_CELLS[cell.country];
    const have = group.filter((i) => game.props[i].owner === p.id || extraOwned.includes(i) || i === index).length;
    if (have === group.length) v *= 1.8;
    else if (have === group.length - 1) v *= 1.25;
  }
  if (cell.type === 'airport') {
    const n = BOARD.filter((c) => c.type === 'airport' && game.props[c.index].owner === p.id).length;
    v *= 1 + n * 0.2;
  }
  return v;
}

function tryAct(game, p, action) {
  try {
    game.handle(p.id, action);
    return true;
  } catch {
    return false;
  }
}

function raiseFunds(game, p) {
  const mine = owned(game, p);
  // vendre d'abord les bâtiments, puis revendre à la banque les propriétés les moins utiles
  const withHouses = mine.filter((i) => game.props[i].houses > 0)
    .sort((a, b) => game.props[b].houses - game.props[a].houses);
  for (const i of withHouses) if (tryAct(game, p, { type: 'sell', cell: i })) return true;
  const sellable = [...mine].sort((a, b) => valueFor(game, p, a) - valueFor(game, p, b));
  for (const i of sellable) if (tryAct(game, p, { type: 'sellProperty', cell: i })) return true;
  return tryAct(game, p, { type: 'bankrupt' });
}

function evaluateTrade(game, p, t) {
  const from = game.player(t.from);
  const gain = t.offer.money + t.offer.cards * 50 + t.offer.props.reduce((s, i) => s + valueFor(game, p, i, t.offer.props), 0);
  // ce que l'on cède vaut plus si cela complète un pays pour l'adversaire
  const loss = t.request.money + t.request.cards * 50 + t.request.props.reduce((s, i) => s + valueFor(game, from, i, t.request.props) * 1.1, 0);
  return gain > loss * 1.15 && p.money - t.request.money >= 0;
}

function tryBuild(game, p) {
  if (game.turn?.pid !== p.id) return false;
  const reserve = 250;
  for (const country of Object.keys(COUNTRY_CELLS)) {
    if (!game.ownsCountry(p.id, country)) continue;
    const cells = COUNTRY_CELLS[country];
    const min = Math.min(...cells.map((i) => game.props[i].houses));
    if (min >= 5) continue;
    const target = cells.find((i) => game.props[i].houses === min);
    if (p.money - housePrice(BOARD[target]) >= reserve && tryAct(game, p, { type: 'build', cell: target })) return true;
  }
  return false;
}

// Effectue au plus une action pour un joueur contrôlé par l'IA. Retourne true si quelque chose a été fait.
export function botStep(game) {
  if (game.phase !== 'playing' || game.fight) return false;
  const bots = game.players.filter((p) => p.status === 'alive' && isAI(game, p));
  if (!bots.length) return false;

  for (const p of bots) {
    if (p.money < 0) return raiseFunds(game, p);
  }

  for (const t of game.trades) {
    const p = game.player(t.to);
    if (p && p.isBot) {
      return tryAct(game, p, { type: evaluateTrade(game, p, t) ? 'acceptTrade' : 'declineTrade', id: t.id });
    }
  }

  const a = game.auction;
  if (a) {
    for (const p of bots) {
      if (a.bidder === p.id || isCautious(p)) continue;
      const max = Math.min(valueFor(game, p, a.cell) * (0.85 + Math.random() * 0.3), p.money - 150);
      const next = a.bid + (a.bid < 100 ? 10 : 20);
      if (next <= max) return tryAct(game, p, { type: 'bid', amount: next });
    }
    return false;
  }

  const p = game.current;
  if (!p || !isAI(game, p)) return false;
  const t = game.turn;
  const pend = t.pending;
  if (isCautious(p)) {
    if (pend?.type === 'buy') return tryAct(game, p, { type: 'decline' });
    if (pend?.type === 'hijack') return tryAct(game, p, { type: 'hijack', accept: false });
    if (pend?.type === 'casino') return tryAct(game, p, { type: 'casinoLeave' });
    if (pend?.type === 'card') return tryAct(game, p, { type: 'cardOk' });
    return tryAct(game, p, { type: t.phase === 'roll' ? 'roll' : 'endTurn' });
  }
  if (pend?.type === 'buy') {
    const cell = BOARD[pend.cell];
    const v = valueFor(game, p, pend.cell);
    const want = p.money >= cell.price && (p.money - cell.price >= 120 || v > cell.price * 1.5);
    if (want) return tryAct(game, p, { type: 'buy' });
    return (game.settings.auction && Math.random() < 0.5 && tryAct(game, p, { type: 'decline', auction: true }))
      || tryAct(game, p, { type: 'decline' });
  }
  if (pend?.type === 'hijack') {
    return tryAct(game, p, { type: 'hijack', accept: p.money - pend.cost > 300 && Math.random() < 0.6 });
  }
  if (pend?.type === 'card') return tryAct(game, p, { type: 'cardOk' });
  if (pend?.type === 'casino') {
    // tente sa chance une ou deux fois avec une petite mise quand il est à l'aise
    const bet = Math.floor(p.money * 0.08);
    if (pend.spins < 2 && p.money > 400 && Math.random() < 0.6) return tryAct(game, p, { type: 'casinoSpin', bet });
    return tryAct(game, p, { type: 'casinoLeave' });
  }
  if (t.phase === 'roll') {
    if (p.jail.in && !p.jail.heavy) {
      if (p.jailCards.length && tryAct(game, p, { type: 'useJailCard' })) return true;
      if (p.money > 400 && tryAct(game, p, { type: 'payJail' })) return true;
    }
    if (tryBuild(game, p)) return true;
    return tryAct(game, p, { type: 'roll' });
  }
  if (t.phase === 'done') {
    if (tryBuild(game, p)) return true;
    return tryAct(game, p, { type: 'endTurn' });
  }
  return false;
}
