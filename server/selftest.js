// Test de robustesse : fait jouer des bots entre eux sur de nombreuses parties.
import { Game } from './game.js';
import { botStep } from './bots.js';
import { BOARD } from '../shared/board.js';

let games = 0, stats = { goulagFights: 0, hijacks: 0, swaps: 0, traffic: 0, casino: 0, wins: 0, stalls: 0 };
for (let g = 0; g < 200; g++) {
  const game = new Game('T' + g);
  for (let i = 0; i < 5; i++) game.addPlayer({ name: 'B' + i, token: null, isBot: true });
  game.hostId = game.players[0].id;
  game.start(game.hostId);
  let steps = 0, idle = 0;
  while (game.phase === 'playing' && steps < 20000) {
    steps++;
    if (game.fight) {
      stats.goulagFights++;
      const f = game.fight;
      f.stop();
      game.endFight(f.ids[Math.random() < 0.5 ? 0 : 1]);
      continue;
    }
    if (game.auction) { game.endAuction(); continue; }
    const acted = botStep(game);
    if (!acted) { idle++; if (idle > 5) { stats.stalls++; console.log('STALL', JSON.stringify(game.turn), game.players.map(p => [p.name, p.money, p.status])); break; } }
    else idle = 0;
    // invariants
    for (const [i, pr] of Object.entries(game.props)) {
      if (pr.houses < 0 || pr.houses > 5) throw new Error('houses');
      if (pr.owner && !game.player(pr.owner)) throw new Error('owner');
      if (pr.owner && game.player(pr.owner).status !== 'alive') throw new Error('dead owner ' + BOARD[i].name);
    }
  }
  for (const e of game.events) { if (e.type === 'hijack') stats.hijacks++; }
  stats.hijacks += game.log.filter(l => l.text.includes('détourne')).length;
  stats.swaps += game.log.filter(l => l.text.includes('Échange forcé :')).length;
  stats.traffic += game.log.filter(l => l.text.includes('marchandise')).length;
  stats.casino += game.log.filter(l => l.text.startsWith("🎰")).length;
  if (game.phase === 'ended') stats.wins++;
  games++;
  game.destroy();
}
console.log('parties', games, stats);

// Statistiques : une partie terminée doit avoir un historique cohérent
{
  const game = new Game('S');
  for (let i = 0; i < 4; i++) game.addPlayer({ name: 'B' + i, token: null, isBot: true });
  game.hostId = game.players[0].id;
  game.start(game.hostId);
  for (let k = 0; k < 20000 && game.phase === 'playing'; k++) {
    if (game.fight) { const f = game.fight; f.stop(); game.endFight(f.ids[0]); continue; }
    if (game.auction) { game.endAuction(); continue; }
    botStep(game);
  }
  const st = game.publicState().stats;
  if (game.phase === 'ended') {
    if (!st || st.history.length < 2) throw new Error('historique manquant');
    const sum = Object.values(st.players).reduce((a, p) => a + p.rolls, 0);
    console.log('stats OK : tours', st.turns, '· points de courbe', st.history.length, '· lancers', sum);
  }
}

// Règles ajoutées : casino, revente à la banque, contre-proposition d'échange
{
  const { CASINO, casinoPayout, resaleValue } = await import('../shared/board.js');
  const assert = (c, m) => { if (!c) throw new Error(m); };
  assert(casinoPayout([5, 5, 5], 10) === 200 && casinoPayout([0, 0, 3], 10) === 15 && casinoPayout([0, 1, 2], 10) === 0, 'gains casino');
  const game = new Game('R');
  const a = game.addPlayer({ name: 'A', token: 'a' });
  const b = game.addPlayer({ name: 'B', token: 'b' });
  game.start(a.id);
  const cur = game.current;
  const casino = BOARD.findIndex((c) => c.type === 'casino');
  cur.pos = casino - 3;
  game.forcedDice = [[1, 2]];
  game.handle(cur.id, { type: 'roll' });
  assert(game.turn.pending?.type === 'casino', 'arrivée au casino');
  for (let k = 0; k < CASINO.MAX_SPINS; k++) game.handle(cur.id, { type: 'casinoSpin', bet: 10 });
  let refused = false;
  try { game.handle(cur.id, { type: 'casinoSpin', bet: 10 }); } catch { refused = true; }
  assert(refused, 'limite de parties');
  game.handle(cur.id, { type: 'casinoLeave' });
  assert(!game.turn.pending && game.turn.phase === 'done', 'sortie du casino');
  const other = game.players.find((p) => p.id !== cur.id);
  game.props[1].owner = cur.id;
  const before = cur.money;
  game.handle(cur.id, { type: 'sellProperty', cell: 1 });
  assert(!game.props[1].owner && cur.money === before + resaleValue(BOARD[1]), 'revente');
  game.props[3].owner = other.id;
  game.handle(cur.id, { type: 'proposeTrade', to: other.id, offer: { money: 10 }, request: { props: [3] } });
  const t = game.trades[0];
  game.handle(other.id, { type: 'counterTrade', id: t.id, offer: { props: [3] }, request: { money: 100 } });
  assert(game.trades.length === 1 && game.trades[0].counter && game.trades[0].to === cur.id, 'contre-proposition');
  game.handle(cur.id, { type: 'acceptTrade', id: game.trades[0].id });
  assert(game.props[3].owner === cur.id, 'échange conclu');
  game.destroy();
  console.log('casino / revente / négociation OK');
}

// Détournement : prix fixe, cible tirée au hasard au paiement parmi les villes adverses construites
{
  const { RULES } = await import('../shared/board.js');
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const seen = new Set();
  for (let k = 0; k < 60; k++) {
    const game = new Game('H');
    const a = game.addPlayer({ name: 'A', token: 'a' });
    game.addPlayer({ name: 'B', token: 'b' });
    game.start(a.id);
    const cur = game.current;
    const other = game.players.find((p) => p.id !== cur.id);
    Object.assign(game.props[1], { owner: other.id, houses: 2 });
    Object.assign(game.props[39], { owner: other.id, houses: 5 });
    Object.assign(game.props[37], { owner: cur.id, houses: 3 }); // la sienne n'est jamais visée
    cur.pos = 3;
    game.forcedDice = [[1, 1]];
    game.handle(cur.id, { type: 'roll' });
    if (game.turn.pending?.type === 'buy') game.handle(cur.id, { type: 'decline' });
    const pend = game.turn.pending;
    assert(pend?.type === 'hijack' && pend.target === undefined && pend.cost === RULES.HIJACK_PRICE, 'offre sans cible');
    const money = cur.money;
    game.handle(cur.id, { type: 'hijack', accept: true });
    const ev = game.events.find((e) => e.type === 'hijack');
    assert([1, 39].includes(ev.cell) && game.props[ev.cell].houses === 0 && cur.money === money - RULES.HIJACK_PRICE, 'destruction');
    assert(game.props[37].houses === 3, 'sa ville épargnée');
    seen.add(ev.cell);
    game.destroy();
  }
  assert(seen.size === 2, 'tirage aléatoire');
  console.log('détournement aléatoire OK');
}

// Cartes : l'effet attend que le joueur ait cliqué
{
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const game = new Game('C');
  const a = game.addPlayer({ name: 'A', token: 'a' });
  game.addPlayer({ name: 'B', token: 'b' });
  game.start(a.id);
  const cur = game.current;
  game.decks.chance = ['c_ny', ...game.decks.chance.filter((x) => x !== 'c_ny')];
  game.forcedDice = [[3, 4]];
  game.handle(cur.id, { type: 'roll' });
  assert(cur.pos === 7 && game.turn.pending?.type === 'card' && game.turn.pending.cardId === 'c_ny', 'carte en attente');
  let blocked = false;
  try { game.handle(cur.id, { type: 'endTurn' }); } catch { blocked = true; }
  assert(blocked, 'tour bloqué tant que la carte n’est pas validée');
  game.handle(cur.id, { type: 'cardOk' });
  assert(cur.pos === 39 && game.turn.pending?.type === 'buy', 'déplacement après le clic');
  game.destroy();
  console.log('cartes validées par le joueur OK');
}
