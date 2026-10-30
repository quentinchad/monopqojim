// IA simple pour les bots (et pour les joueurs déconnectés depuis trop longtemps).
import { housePrice } from '../shared/board.js';

// Un joueur humain déconnecté n'est PAS remplacé pendant le décompte (la partie l'attend) ;
// une fois le décompte écoulé, un bot joue à sa place jusqu'à son retour.
export function isAI(game, p) {
  return p.isBot || (p.botControlled && !p.connected);
}

const owned = (game, p) => Object.keys(game.props).map(Number).filter((i) => game.props[i].owner === p.id);

// Valeur estimée d'une propriété pour un joueur (bonus si elle complète un pays)
function valueFor(game, p, index, extraOwned = []) {
  const cell = game.B.cells[index];
  let v = cell.price;
  if (cell.type === 'city') {
    const group = game.B.countryCells[cell.country];
    const have = group.filter((i) => game.props[i].owner === p.id || extraOwned.includes(i) || i === index).length;
    if (have === group.length) v *= 1.8;
    else if (have === group.length - 1) v *= 1.25;
  }
  if (cell.type === 'airport') {
    const n = game.B.cells.filter((c) => c.type === 'airport' && game.props[c.index].owner === p.id).length;
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

// ---------- échanges & négociation ----------
// Horloge des bots (remplaçable dans les tests pour simuler le temps qui passe)
const clock = (game) => (game.botClock ? game.botClock() : Date.now());
const round10 = (x) => Math.max(0, Math.round(x / 10) * 10);
const TRADE_THINK_MS = 2500; // délai de « réflexion » avant de répondre
const TRADE_EXPIRE_MS = 75000; // un bot retire sa proposition restée sans réponse

function tradeMemo(game) {
  return (game.botTrades ||= { next: {}, tried: {}, seen: {} });
}

// âge d'une proposition, selon l'horloge des bots
function tradeAge(game, t) {
  const memo = tradeMemo(game);
  const now = clock(game);
  if (memo.seen[t.id] == null) {
    memo.seen[t.id] = now;
    const ids = Object.keys(memo.seen);
    if (ids.length > 200) for (const id of ids) if (!game.trades.some((x) => x.id === id)) delete memo.seen[id];
  }
  return now - memo.seen[t.id];
}

// Bilan d'un échange pour p, son destinataire : ce qu'il reçoit et ce qu'il cède
function tradeBalance(game, p, t) {
  const from = game.player(t.from);
  const gain = t.offer.money + t.offer.cards * 50 + t.offer.props.reduce((s, i) => s + valueFor(game, p, i, t.offer.props), 0);
  // ce que l'on cède vaut plus si cela complète un pays pour l'adversaire
  const loss = t.request.money + t.request.cards * 50 + t.request.props.reduce((s, i) => s + valueFor(game, from, i, t.request.props) * 1.1, 0);
  return { gain, loss };
}

// marge exigée : le bot se montre de plus en plus conciliant au fil des contre-propositions
// (en fin de négociation, il accepte un échange équilibré qui l'aide aussi à avancer)
const RATIOS = [1.15, 1.05, 0.95, 0.88];
const wantedRatio = (t) => RATIOS[Math.min(RATIOS.length - 1, t.round || 0)];

// Contre-proposition : le bot paie moins, puis réclame plus d'argent, jusqu'à la marge qu'il vise
function counterOffer(game, p, t, gain, loss, ratio) {
  const from = game.player(t.from);
  const k = ratio * 1.03;
  // après la première réponse, le bot coupe la poire en deux plutôt que de réclamer tout ce qu'il veut
  let gap = (loss * k - gain) * ((t.round || 0) >= 1 ? 0.6 : 1);
  const give = { ...t.request };
  const take = { ...t.offer };
  const cut = Math.min(give.money, Math.ceil(gap / k / 10) * 10);
  give.money -= cut;
  gap -= cut * k;
  if (gap > 0) take.money += Math.ceil(gap / 10) * 10;
  if (take.money > Math.max(0, from.money) || give.money > Math.max(0, p.money)) return null;
  return { offer: give, request: take };
}

function respondToTrade(game, p, t) {
  const decline = () => tryAct(game, p, { type: 'declineTrade', id: t.id });
  const { gain, loss } = tradeBalance(game, p, t);
  const ratio = wantedRatio(t);
  if (gain > loss * ratio && p.money >= t.request.money) {
    // la situation a pu changer depuis la proposition (argent dépensé, bien vendu…)
    return tryAct(game, p, { type: 'acceptTrade', id: t.id }) || decline();
  }
  // offre ridicule ou négociation qui s'éternise : refus
  if ((t.round || 0) >= 3 || gain < loss * 0.5) return decline();
  const counter = counterOffer(game, p, t, gain, loss, ratio);
  return (counter && tryAct(game, p, { type: 'counterTrade', id: t.id, ...counter })) || decline();
}

// Le bot cherche à compléter un pays en rachetant à leur propriétaire les villes qui lui manquent
function proposeTrade(game, p) {
  const memo = tradeMemo(game);
  const now = clock(game);
  if (!memo.next[p.id]) memo.next[p.id] = now + 15000 + Math.random() * 30000;
  if (now < memo.next[p.id]) return false;
  memo.next[p.id] = now + 40000 + Math.random() * 50000;
  if (game.trades.some((t) => t.from === p.id)) return false;

  const deals = [];
  for (const [country, cells] of Object.entries(game.B.countryCells)) {
    if (cells.some((i) => game.props[i].houses > 0)) continue;
    const mine = cells.filter((i) => game.props[i].owner === p.id);
    const missing = cells.filter((i) => game.props[i].owner !== p.id);
    if (!mine.length || !missing.length || mine.length < missing.length) continue;
    const owners = new Set(missing.map((i) => game.props[i].owner));
    if (owners.size !== 1) continue;
    const target = game.player([...owners][0]);
    if (!target || target.status !== 'alive') continue;
    // un joueur ne reçoit qu'une proposition de bot à la fois
    if (game.trades.some((t) => t.to === target.id && game.player(t.from)?.isBot)) continue;
    const key = `${target.id}:${country}`;
    if (memo.tried[key] > now) continue;
    deals.push({ country, target, missing, key });
  }
  if (!deals.length) return false;
  const d = deals[Math.floor(Math.random() * deals.length)];
  memo.tried[d.key] = now + 4 * 60000;

  const worth = d.missing.reduce((s, i) => s + valueFor(game, p, i, d.missing), 0);
  const theirLoss = d.missing.reduce((s, i) => s + valueFor(game, d.target, i, d.missing) * 1.1, 0);
  const maxGive = worth / 1.15;
  // un bien qui intéresse l'autre (il possède déjà des villes du même pays) peut remplacer une partie de l'argent
  let sweetener = null;
  for (const i of owned(game, p)) {
    const cell = game.B.cells[i];
    if (game.groupHasBuildings(i) || (cell.type === 'city' && cell.country === d.country)) continue;
    if (cell.type === 'city' && game.B.countryCells[cell.country].some((j) => j !== i && game.props[j].owner === p.id)) continue;
    const forThem = valueFor(game, d.target, i, [i]);
    const cost = valueFor(game, p, i) * 1.1;
    if (forThem > cost * 1.1 && (!sweetener || forThem - cost > sweetener.forThem - sweetener.cost)) sweetener = { i, forThem, cost };
  }
  // offre d'ouverture un peu basse, pour garder de la marge dans la négociation
  const opening = theirLoss * 1.15 * (0.85 + Math.random() * 0.15);
  let money = round10(opening - (sweetener?.forThem || 0));
  money = Math.min(money, round10(maxGive - (sweetener?.cost || 0)), round10(p.money - 150));
  if (money + (sweetener?.cost || 0) > maxGive || (money <= 0 && !sweetener)) return false;
  return tryAct(game, p, {
    type: 'proposeTrade', to: d.target.id,
    offer: { money: Math.max(0, money), props: sweetener ? [sweetener.i] : [], cards: 0 },
    request: { money: 0, props: d.missing, cards: 0 },
  });
}

function handleTrades(game, bots) {
  for (const t of game.trades) {
    const p = game.player(t.to);
    if (!p?.isBot || p.status !== 'alive' || tradeAge(game, t) < TRADE_THINK_MS) continue;
    return respondToTrade(game, p, t);
  }
  for (const t of game.trades) {
    const p = game.player(t.from);
    if (p?.isBot && tradeAge(game, t) > TRADE_EXPIRE_MS) return tryAct(game, p, { type: 'declineTrade', id: t.id });
  }
  for (const p of bots) if (p.isBot && proposeTrade(game, p)) return true;
  return false;
}

// Dé spécial : le bot le joue s'il tombe pile sur une propriété libre qu'il peut s'offrir, ou chez lui
function specialDieWorthIt(game, p) {
  const B = game.B;
  for (const v of p.specialDice || []) {
    const cell = B.cells[(p.pos + v) % B.n];
    const prop = game.props[cell.index];
    if (prop && !prop.owner && cell.price <= p.money - 100 && valueFor(game, p, cell.index) > cell.price) return v;
    if (prop && prop.owner === p.id && Math.random() < 0.3) return v;
  }
  return null;
}

function tryBuild(game, p) {
  if (game.turn?.pid !== p.id) return false;
  const reserve = 250;
  for (const country of Object.keys(game.B.countryCells)) {
    if (!game.ownsCountry(p.id, country)) continue;
    const cells = game.B.countryCells[country];
    const min = Math.min(...cells.map((i) => game.props[i].houses));
    if (min >= 5) continue;
    const target = cells.find((i) => game.props[i].houses === min);
    if (p.money - housePrice(game.B.cells[target]) >= reserve && tryAct(game, p, { type: 'build', cell: target })) return true;
  }
  return false;
}

// Effectue au plus une action pour un joueur contrôlé par l'IA. Retourne true si quelque chose a été fait.
export function botStep(game) {
  if (game.phase !== 'playing' || game.fight || game.paused) return false;
  const bots = game.players.filter((p) => p.status === 'alive' && isAI(game, p));
  if (!bots.length) return false;

  for (const p of bots) {
    if (p.money < 0) return raiseFunds(game, p);
  }

  const a = game.auction;
  if (a) {
    for (const p of bots) {
      if (a.bidder === p.id) continue;
      const max = Math.min(valueFor(game, p, a.cell) * (0.85 + Math.random() * 0.3), p.money - 150);
      const next = a.bid + (a.bid < 100 ? 10 : 20);
      if (next <= max) return tryAct(game, p, { type: 'bid', amount: next });
    }
    return false;
  }

  if (handleTrades(game, bots)) return true;

  const p = game.current;
  if (!p || !isAI(game, p)) return false;
  const t = game.turn;
  const pend = t.pending;
  if (pend?.type === 'buy') {
    const cell = game.B.cells[pend.cell];
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
    if (pend.spins < 2 && p.money > 400 && Math.random() < 0.6) {
      // roulette une fois sur deux : rouge ou noir, parfois un numéro porte-bonheur
      if (Math.random() < 0.5) {
        const on = Math.random() < 0.15 ? Math.floor(Math.random() * 37) : Math.random() < 0.5 ? 'red' : 'black';
        return tryAct(game, p, { type: 'rouletteSpin', bet, on });
      }
      return tryAct(game, p, { type: 'casinoSpin', bet });
    }
    return tryAct(game, p, { type: 'casinoLeave' });
  }
  if (t.phase === 'roll') {
    if (p.jail.in && !p.jail.heavy) {
      if (p.jailCards.length && tryAct(game, p, { type: 'useJailCard' })) return true;
      if (p.money > 400 && tryAct(game, p, { type: 'payJail' })) return true;
    }
    if (tryBuild(game, p)) return true;
    const die = !p.jail.in && specialDieWorthIt(game, p);
    if (die != null && tryAct(game, p, { type: 'useSpecialDie', value: die })) return true;
    return tryAct(game, p, { type: 'roll' });
  }
  if (t.phase === 'done') {
    if (tryBuild(game, p)) return true;
    return tryAct(game, p, { type: 'endTurn' });
  }
  return false;
}
