// Test de robustesse : fait jouer des bots entre eux sur de nombreuses parties.
import { Game } from './game.js';
import { botStep } from './bots.js';
import { BOARD } from '../shared/board.js';

let games = 0, stats = { goulagFights: 0, hijacks: 0, swaps: 0, traffic: 0, casino: 0, wins: 0, stalls: 0 };
for (let g = 0; g < 200; g++) {
  const game = new Game('T' + g);
  game.goulagCinematicMs = 0; // pas d'affichage : le duel démarre tout de suite
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
  game.goulagCinematicMs = 0;
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

// Déconnexion : la partie attend pendant le décompte, puis un bot prend la place ; retour par jeton ou pseudo
{
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const game = new Game('D');
  const a = game.addPlayer({ name: 'Alice', token: 'ta' });
  const b = game.addPlayer({ name: 'Bob', token: 'tb' });
  game.start(a.id);
  const away = game.current;
  game.markDisconnected(away);
  away.disconnectedAt -= 60000; // déconnecté depuis longtemps, mais décompte pas fini
  assert(!botStep(game), 'personne ne joue pendant le décompte');
  away.abandonAt = Date.now() - 1;
  game.checkDisconnections(3000, true);
  assert(away.botControlled && away.status === 'alive', 'bot à la fin du décompte');
  assert(botStep(game), 'le bot joue à sa place');
  // retour depuis un autre appareil : nouveau jeton, même pseudo
  const back = game.findReturning('nouveau', away.name.toUpperCase());
  assert(back === away && away.token === 'nouveau', 'reprise par pseudo');
  game.markReconnected(back);
  assert(!away.botControlled && away.connected, 'reprend la main');
  assert(game.findReturning('inconnu', 'Bob') === null, 'pas de vol de place d’un joueur connecté');
  game.destroy();
  void b;
  console.log('déconnexion / bot / retour OK');
}

// Faillite : le créancier ne récupère que l'argent, les propriétés reviennent à la banque
{
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const game = new Game('B');
  game.goulagCinematicMs = 0;
  const a = game.addPlayer({ name: 'A', token: 'a' });
  game.addPlayer({ name: 'B', token: 'b' });
  game.addPlayer({ name: 'C', token: 'c' });
  game.start(a.id);
  const [p, creditor] = game.players;
  Object.assign(game.props[1], { owner: p.id, houses: 2 });
  Object.assign(game.props[3], { owner: p.id, houses: 2 });
  game.props[5].owner = p.id;
  p.jailCards = ['c_jailfree'];
  p.money = -40;
  p.debtCreditor = creditor.id;
  const before = creditor.money;
  game.bankrupt(p);
  assert(!game.props[1].owner && !game.props[3].owner && !game.props[5].owner, 'propriétés à la banque');
  assert(creditor.money === before + 60, 'le créancier récupère l’argent (bâtiments revendus 100 $ - dette 40 $)');
  assert(creditor.jailCards.length === 0 && game.decks.chance.includes('c_jailfree'), 'cartes rendues au paquet');
  game.destroy();
  console.log('faillite : argent seul au créancier OK');
}

// Simple visite : le visiteur vole 75 $ à chaque prisonnier (ce qui lui reste s'il a moins)
{
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const game = new Game('V');
  const a = game.addPlayer({ name: 'A', token: 'a' });
  game.addPlayer({ name: 'B', token: 'b' });
  game.addPlayer({ name: 'C', token: 'c' });
  game.addPlayer({ name: 'D', token: 'd' });
  game.start(a.id);
  const [v, rich, poor, free] = game.players;
  for (const q of [rich, poor]) { q.pos = 10; q.jail = { in: true, turns: 0, heavy: false }; }
  rich.money = 500;
  poor.money = 30;
  free.pos = 10;
  free.money = 500;
  const before = v.money;
  v.pos = 10;
  game.land(v);
  assert(rich.money === 425 && poor.money === 0, 'prisonniers détroussés');
  assert(free.money === 500, 'un simple visiteur n’est pas volé');
  assert(v.money === before + 105, 'le visiteur empoche 75 + 30');
  assert(game.events.filter((e) => e.type === 'jailVisit').length === 2, 'une cinématique par prisonnier');
  game.settings.jailVisitSteal = false;
  game.land(v);
  assert(rich.money === 425, 'règle désactivable');
  game.destroy();
  console.log('simple visite : vol des prisonniers OK');
}

// Pause : la moitié des joueurs humains connectés doit voter, pour mettre en pause comme pour reprendre
{
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const game = new Game('P');
  const a = game.addPlayer({ name: 'A', token: 'a' });
  const b = game.addPlayer({ name: 'B', token: 'b' });
  const c = game.addPlayer({ name: 'C', token: 'c' });
  game.addPlayer({ name: 'D', token: 'd' });
  game.start(a.id);
  const cur = game.player(game.turn.pid);
  game.handle(a.id, { type: 'votePause' });
  assert(!game.paused, 'un vote sur quatre ne suffit pas');
  game.handle(b.id, { type: 'votePause' });
  assert(game.paused && game.publicState().pause.on, 'deux votes sur quatre : pause');
  let refused = false;
  try { game.handle(cur.id, { type: 'roll' }); } catch { refused = true; }
  assert(refused, 'aucune action pendant la pause');
  game.handle(c.id, { type: 'votePause' });
  assert(game.paused, 'un vote ne suffit pas pour reprendre');
  game.handle(c.id, { type: 'votePause', on: false });
  assert(game.pause.votes.size === 0, 'vote retiré');
  game.handle(a.id, { type: 'votePause' });
  game.markDisconnected(b);
  game.markDisconnected(c);
  game.markDisconnected(game.players.find((p) => p.name === 'D'));
  assert(!game.paused, 'les déconnectés ne comptent plus : le vote restant suffit pour reprendre');
  game.destroy();
  console.log('pause par vote OK');
}

// Échanges avec un joueur dans le négatif, détournement depuis son aéroport, loyers en prison, Régime de Vichy
{
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const game = new Game('R');
  const a = game.addPlayer({ name: 'A', token: 'a' });
  const b = game.addPlayer({ name: 'B', token: 'b' });
  const c = game.addPlayer({ name: 'C', token: 'c' });
  game.start(a.id);
  assert(game.settings.auction === false, 'enchères décochées par défaut');
  // échanges : B est à -50 $
  b.money = -50;
  game.props[1].owner = b.id;
  game.props[3].owner = a.id;
  const t1 = game.actProposeTrade(a, { to: b.id, offer: { money: 100 }, request: { props: [1] } });
  assert(t1, 'on peut proposer de l’argent à un joueur dans le négatif');
  const t2 = game.actProposeTrade(b, { to: a.id, offer: { props: [1] }, request: { money: 80 } });
  assert(t2, 'un joueur dans le négatif peut proposer un échange');
  let refused = false;
  try { game.actProposeTrade(b, { to: a.id, offer: { money: 10 }, request: { props: [3] } }); } catch { refused = true; }
  assert(refused, 'il ne peut pas offrir de l’argent qu’il n’a pas');
  game.actAcceptTrade(b, t1.id);
  assert(b.money === 50 && game.props[1].owner === a.id, 'échange conclu, dette remboursée');
  // détournement : 50 $ depuis son propre aéroport
  game.props[5].owner = a.id;
  Object.assign(game.props[1], { owner: b.id, houses: 2 });
  game.offerHijack(a, 5);
  assert(game.turn.pending?.cost === 50, 'détournement à 50 $ depuis son aéroport');
  game.props[5].owner = c.id;
  game.offerHijack(a, 5);
  assert(game.turn.pending?.cost === 150, 'détournement à 150 $ sinon');
  game.turn.pending = null;
  // loyers en prison
  game.props[1].houses = 0;
  c.jail = { in: true, turns: 0, heavy: false };
  Object.assign(game.props[6], { owner: c.id, houses: 0 });
  game.settings.rentInJail = false;
  const before = a.money;
  a.pos = 6;
  game.land(a);
  assert(a.money === before, 'propriétaire en prison : pas de loyer si la règle est désactivée');
  game.settings.rentInJail = true;
  game.land(a);
  assert(a.money < before, 'loyer payé sinon');
  c.jail = { in: false, turns: 0, heavy: false };
  // Régime de Vichy
  game.formAlliance(a);
  const partner = game.player(game.partnerOf(a.id));
  assert(partner && partner.id !== a.id, 'alliance formée');
  const other = [b, c].find((p) => p.id !== partner.id);
  Object.assign(game.props[39], { owner: partner.id, houses: 0 });
  const am = a.money;
  a.pos = 39;
  game.land(a);
  assert(a.money === am, 'pas de loyer chez son collaborateur');
  const pm = partner.money;
  const aa = a.money;
  const om = other.money;
  other.pos = 39;
  game.land(other);
  const rent = om - other.money;
  assert(rent > 0 && partner.money - pm + (a.money - aa) === rent && a.money - aa === Math.floor(rent / 2), 'loyer partagé');
  game.turnCount += 100;
  game.expireAlliances();
  assert(!game.partnerOf(a.id), 'fin de l’alliance');
  game.destroy();
  console.log('négatif / détournement / prison / Vichy OK');
}
