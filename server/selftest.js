// Test de robustesse : fait jouer des bots entre eux sur de nombreuses parties.
import { Game } from './game.js';
import { botStep } from './bots.js';
import { BOARD } from '../shared/board.js';

let games = 0, stats = { goulagFights: 0, hijacks: 0, swaps: 0, traffic: 0, wins: 0, stalls: 0 };
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
