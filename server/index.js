import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Game, GameError } from './game.js';
import { botStep } from './bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, '..', 'client', 'dist');
const ROOM_TTL = 30 * 60 * 1000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
// image du pion personnalisé d'un joueur (gardée hors de l'état de jeu pour ne pas l'alourdir)
app.get('/skin/:room/:pid/face', (req, res) => {
  const face = rooms.get(String(req.params.room).toUpperCase())?.skinImage(req.params.pid)?.face;
  if (!face) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  res.json(face);
});
app.get('/skin/:room/:pid', (req, res) => {
  const img = rooms.get(String(req.params.room).toUpperCase())?.skinImage(req.params.pid);
  if (!img) return res.status(404).end();
  res.set('Content-Type', img.mime);
  res.set('Cache-Control', 'public, max-age=86400, immutable'); // l'adresse change à chaque nouveau skin (?v=)
  res.send(img.buf);
});
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (_req, res) => res.send('Client non compilé : lancez « npm run build » ou « npm run dev ».'));
}

/** @type {Map<string, Game>} */
const rooms = new Map();

const newRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  while (rooms.has(id));
  return id;
};

function broadcast(game) {
  if (game.broadcastPending) return;
  game.broadcastPending = true;
  setImmediate(() => {
    game.broadcastPending = false;
    io.to(game.id).emit('state', game.publicState());
    scheduleBots(game);
  });
}

function scheduleBots(game) {
  if (game.botTimer || game.phase !== 'playing') return;
  // la partie se met en pause si plus aucun humain n'est connecté
  if (!game.players.some((p) => !p.isBot && p.connected)) return;
  game.botTimer = setTimeout(() => {
    game.botTimer = null;
    try {
      botStep(game);
    } catch (e) {
      console.error('Erreur bot', e);
    }
  }, Math.max(650 + Math.random() * 400, (game.animUntil || 0) - Date.now() + 400));
}

function createGame() {
  const id = newRoomId();
  const game = new Game(id, {
    onChange: (g) => broadcast(g),
    onFightTick: (g, state) => io.to(g.id).volatile.emit('fight', state),
  });
  game.lastActivity = Date.now();
  rooms.set(id, game);
  return game;
}

io.on('connection', (socket) => {
  const ctx = () => {
    const game = rooms.get(socket.data.roomId);
    return { game, pid: socket.data.playerId };
  };

  const safe = (fn) => (payload, ack) => {
    try {
      const g = rooms.get(socket.data.roomId);
      if (g) g.lastActivity = Date.now();
      fn(payload || {});
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (!(e instanceof GameError)) console.error(e);
      if (typeof ack === 'function') ack({ error: e instanceof GameError ? e.message : 'Erreur serveur' });
    }
  };

  socket.on('join', ({ roomId, token, name } = {}, ack) => {
    try {
      let game = roomId ? rooms.get(String(roomId).toUpperCase()) : null;
      if (roomId && !game) return ack?.({ error: 'Partie introuvable' });
      if (!game) game = createGame();
      if (socket.data.roomId) socket.leave(socket.data.roomId);
      let p = game.findReturning(token, name);
      if (p) {
        game.markReconnected(p);
      } else if (game.phase === 'lobby') {
        p = game.addPlayer({ name, token });
      }
      game.lastActivity = Date.now();
      socket.data.roomId = game.id;
      socket.data.playerId = p?.id || null;
      socket.join(game.id);
      game.changed();
      ack?.({ ok: true, roomId: game.id, playerId: p?.id || null, state: game.publicState() });
    } catch (e) {
      ack?.({ error: e instanceof GameError ? e.message : 'Erreur serveur' });
    }
  });

  socket.on('lobby', safe(({ op, ...data }) => {
    const { game, pid } = ctx();
    if (!game || !pid) throw new GameError('Pas dans une partie');
    switch (op) {
      case 'addBot': game.addBot(pid); break;
      case 'kick': game.removePlayer(pid, data.playerId); break;
      case 'color': game.setColor(pid, data.color); break;
      case 'name': game.setName(pid, data.name); break;
      case 'settings': game.updateSettings(pid, data.settings || {}); break;
      case 'start': game.start(pid); break;
      default: throw new GameError('Opération inconnue');
    }
  }));

  socket.on('skin', safe((data) => {
    const { game, pid } = ctx();
    if (!game || !pid) throw new GameError('Pas dans une partie');
    game.setSkin(pid, data.remove ? null : data);
  }));

  socket.on('action', safe((a) => {
    const { game, pid } = ctx();
    if (!game || !pid) throw new GameError('Vous êtes spectateur');
    game.handle(pid, a);
  }));

  // Outils de test, actifs uniquement avec « node server/index.js --debug »
  if (process.argv.includes('--debug')) {
    socket.on('debug', safe(({ op, ...d }) => {
      const { game, pid } = ctx();
      const me = game.player(pid);
      const others = game.players.filter((p) => p.id !== pid && p.status === 'alive');
      if (op === 'dice') game.forcedDice = [[d.a, d.b]];
      if (op === 'money') me.money = d.amount;
      if (op === 'traffic') me.trafficking = true;
      if (op === 'hotels') {
        // un adversaire possède toute l'Allemagne avec des hôtels
        for (const i of [16, 18, 19]) Object.assign(game.props[i], { owner: others[0].id, houses: 5 });
      }
      if (op === 'country') {
        for (const i of d.cells) Object.assign(game.props[i], { owner: pid, houses: 0 });
      }
      if (op === 'card') {
        const deck = d.id.startsWith('c_') ? 'chance' : 'chest';
        game.decks[deck] = [d.id, ...game.decks[deck].filter((x) => x !== d.id)];
      }
      if (op === 'fight') {
        // envoie le joueur et un bot au goulag pour tester le duel
        for (const p of [me, others[0]]) { p.money = -1; p.debtCreditor = null; game.bankrupt(p); }
      }
      game.changed();
    }));
  }

  socket.on('fightInput', (inp) => {
    const { game, pid } = ctx();
    if (game && pid) game.fightInput(pid, inp);
  });

  socket.on('disconnect', () => {
    const { game, pid } = ctx();
    if (!game || !pid) return;
    const p = game.player(pid);
    const stillHere = [...(io.sockets.adapter.rooms.get(game.id) || [])]
      .some((sid) => io.sockets.sockets.get(sid)?.data.playerId === pid);
    if (!p || stillHere) return;
    if (game.phase === 'lobby') {
      // dans le salon, un joueur qui part libère sa place (sauf s'il revient dans la minute)
      p.connected = false;
      p.disconnectedAt = Date.now();
      setTimeout(() => {
        if (!p.connected && game.phase === 'lobby') {
          game.players = game.players.filter((x) => x.id !== pid);
          if (game.hostId === pid) game.hostId = game.players.find((x) => !x.isBot)?.id || null;
          game.changed();
        }
      }, 60000);
    } else {
      game.markDisconnected(p);
    }
    game.changed();
  });
});

// Entretien : réveille les bots (pilote auto des déconnectés) et nettoie les parties abandonnées
setInterval(() => {
  const now = Date.now();
  for (const [id, game] of rooms) {
    const humans = game.players.filter((p) => !p.isBot && p.connected).length;
    if (!humans && now - game.lastActivity > ROOM_TTL) {
      game.destroy();
      rooms.delete(id);
      continue;
    }
    game.checkDisconnections(3000, humans > 0);
    scheduleBots(game);
  }
}, 3000);

server.listen(PORT, () => console.log(`🎲 Monopqojim en écoute sur http://localhost:${PORT}`));

// Anti-veille Render (plan gratuit) : le service s'endort après 15 min sans visite.
// Il se rend visite à lui-même toutes les 10 min via son adresse publique (fournie par Render
// dans RENDER_EXTERNAL_URL). Désactivable avec KEEP_ALIVE=0.
const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (SELF_URL && process.env.KEEP_ALIVE !== '0') {
  setInterval(() => {
    fetch(`${SELF_URL}/health`).catch((e) => console.warn('Anti-veille : échec du ping', e.message));
  }, 10 * 60 * 1000);
  console.log(`⏰ Anti-veille actif : ping de ${SELF_URL}/health toutes les 10 min`);
}
