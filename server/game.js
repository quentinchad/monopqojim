import {
  BOARD, RULES, CASINO, COUNTRIES, COUNTRY_CELLS, OWNABLE, AIRPORT_RENTS, PLAYER_COLORS,
  housePrice, casinoPayout, resaleValue,
} from '../shared/board.js';
import { CHANCE_CARDS, CHEST_CARDS } from '../shared/cards.js';
import { Fight } from './fight.js';
import { cleanCharacter, randomBotSkin } from '../shared/characters.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const ALL_CARDS = Object.fromEntries([...CHANCE_CARDS, ...CHEST_CARDS].map((c) => [c.id, c]));
export const SKIN_TYPES = ['person', 'animal', 'vehicle', 'object', 'character'];
const BOT_NAMES = ['Bot Tokyo', 'Bot Rio', 'Bot Berlin', 'Bot Nairobi', 'Bot Oslo', 'Bot Lima', 'Bot Séoul', 'Bot Dakar'];

export class GameError extends Error {}
const buildingsLabel = (n) => (n === 5 ? 'l’hôtel' : n === 1 ? 'la maison' : `les ${n} maisons`);
const fail = (msg) => { throw new GameError(msg); };

export const DEFAULT_SETTINGS = {
  startMoney: RULES.START_MONEY,
  auction: true,
  freeParkingPot: true,
  goulag: true,
  goulagMoney: RULES.GOULAG_RETURN_MONEY,
  trafficCaughtOnVisit: true, // tomber sur la case Prison (simple visite) en trafiquant = arrestation
  abandonDelay: 120, // secondes avant qu'un joueur déconnecté abandonne (prolongeable par les autres)
  maxPlayers: RULES.MAX_PLAYERS,
};

export class Game {
  constructor(id, { onChange, onFightTick } = {}) {
    this.id = id;
    this.onChange = onChange || (() => {});
    this.onFightTick = onFightTick || (() => {});
    this.phase = 'lobby'; // lobby | playing | ended
    this.players = [];
    this.hostId = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.props = {};
    this.turn = null;
    this.auction = null;
    this.trades = [];
    this.log = [];
    this.chat = [];
    this.events = [];
    this.eventSeq = 0;
    this.pot = 0;
    this.winner = null;
    this.fight = null;
    this.decks = { chance: [], chest: [] };
    this.createdAt = Date.now();
    this.version = 0;
    this.stats = null;
  }

  // ---------- utilitaires ----------
  player(id) { return this.players.find((p) => p.id === id); }
  get alive() { return this.players.filter((p) => p.status === 'alive'); }
  get current() { return this.turn ? this.player(this.turn.pid) : null; }
  changed() { this.version++; this.onChange(this); }

  addLog(text, pid = null) {
    this.log.push({ id: uid(), t: Date.now(), text, pid });
    if (this.log.length > 150) this.log.shift();
  }

  addEvent(type, data) {
    this.events.push({ id: ++this.eventSeq, type, t: Date.now(), ...data });
    if (this.events.length > 12) this.events.shift();
  }

  addChat(pid, text) {
    const p = this.player(pid);
    if (!p) return;
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return;
    this.chat.push({ id: uid(), t: Date.now(), pid, name: p.name, color: p.color, text: clean });
    if (this.chat.length > 100) this.chat.shift();
    this.changed();
  }

  // ---------- lobby ----------
  addPlayer({ name, token, isBot = false }) {
    if (this.phase !== 'lobby') fail('La partie a déjà commencé');
    if (this.players.length >= this.settings.maxPlayers) fail('La partie est complète');
    const used = new Set(this.players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c));
    const p = {
      id: uid(), token, isBot, connected: true, disconnectedAt: null, abandonAt: null, announcedDisconnect: false, botControlled: false,
      name: String(name || 'Joueur').trim().slice(0, 20) || 'Joueur',
      color, money: 0, pos: 0,
      jail: { in: false, turns: 0, heavy: false },
      jailCards: [], trafficking: false,
      status: 'alive', usedGoulag: false, goulagSince: null, debtCreditor: null,
      skin: null, // pion personnalisé : { type, colors, v } (l'image est servie à part, voir skinImage)
    };
    this.players.push(p);
    if (!this.hostId && !isBot) this.hostId = p.id;
    this.addLog(`${p.name} a rejoint la partie`, p.id);
    return p;
  }

  addBot(byId) {
    this.requireHost(byId);
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${this.players.length + 1}`;
    const bot = this.addPlayer({ name, token: null, isBot: true });
    // chaque bot reçoit un pion au hasard : personnage connu (pas déjà pris) ou perso composé
    const taken = this.players.map((p) => p.skin?.preset).filter(Boolean);
    bot.skin = { ...randomBotSkin(taken), v: Date.now() };
    this.changed();
  }

  removePlayer(byId, targetId) {
    if (this.phase !== 'lobby') fail('Impossible pendant la partie');
    if (byId !== targetId) this.requireHost(byId);
    this.players = this.players.filter((p) => p.id !== targetId);
    if (this.hostId === targetId) this.hostId = this.players.find((p) => !p.isBot)?.id || null;
    this.changed();
  }

  setColor(pid, color) {
    if (this.phase !== 'lobby') fail('Impossible pendant la partie');
    if (!PLAYER_COLORS.includes(color)) fail('Couleur invalide');
    if (this.players.some((p) => p.color === color && p.id !== pid)) fail('Couleur déjà prise');
    this.player(pid).color = color;
    this.changed();
  }

  setName(pid, name) {
    const clean = String(name || '').trim().slice(0, 20);
    if (!clean) return;
    this.player(pid).name = clean;
    this.changed();
  }

  updateSettings(byId, s) {
    this.requireHost(byId);
    if (this.phase !== 'lobby') fail('Impossible pendant la partie');
    const n = (v, min, max, d) => (Number.isFinite(+v) ? Math.max(min, Math.min(max, Math.round(+v))) : d);
    this.settings = {
      ...this.settings,
      startMoney: n(s.startMoney ?? this.settings.startMoney, 500, 5000, 1500),
      goulagMoney: n(s.goulagMoney ?? this.settings.goulagMoney, 100, 5000, 1000),
      auction: s.auction ?? this.settings.auction,
      freeParkingPot: s.freeParkingPot ?? this.settings.freeParkingPot,
      goulag: s.goulag ?? this.settings.goulag,
      trafficCaughtOnVisit: s.trafficCaughtOnVisit ?? this.settings.trafficCaughtOnVisit,
      abandonDelay: n(s.abandonDelay ?? this.settings.abandonDelay, 30, 900, 120),
    };
    this.changed();
  }

  // ---------- pion personnalisé ----------
  // data : { type, colors: ['#rrggbb'…], image: 'data:image/jpeg;base64,…' } ou null pour revenir au pion classique
  setSkin(pid, data) {
    const p = this.player(pid);
    if (!p) fail('Joueur inconnu');
    this.skinImages ||= {};
    if (!data) {
      p.skin = null;
      delete this.skinImages[pid];
      this.changed();
      return;
    }
    if (!SKIN_TYPES.includes(data.type)) fail('Type de pion inconnu');
    // personnage (prédéfini ou composé) : uniquement une petite configuration, sans image
    if (data.type === 'character') {
      const char = cleanCharacter(data.char);
      if (!char) fail('Personnage invalide');
      delete this.skinImages[pid];
      p.skin = { type: 'character', char, preset: typeof data.preset === 'string' ? data.preset.slice(0, 20) : null, v: Date.now() };
      this.changed();
      return;
    }
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(data.image || ''));
    if (!m) fail('Image invalide');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 400 * 1024) fail('Image trop lourde');
    const colors = (Array.isArray(data.colors) ? data.colors : [])
      .filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4);
    // visage analysé (personnage) : repères et triangles du maillage, servis à part (voir skinFace)
    let face = null;
    const f = data.face;
    const ints = (a, n, max) => Array.isArray(a) && a.length <= n && a.every((v) => Number.isInteger(v) && Math.abs(v) <= max);
    if (data.type === 'person' && f && ints(f.pts, 478 * 3, 5000) && f.pts.length === 478 * 3 && ints(f.tri, 3000, 477)) {
      face = { pts: f.pts, tri: f.tri };
    }
    const hair = data.hair && ['bald', 'short', 'long'].includes(data.hair.style)
      ? { style: data.hair.style, vol: Math.max(0, Math.min(0.6, +data.hair.vol || 0)) } : null;
    this.skinImages[pid] = { mime: m[1], buf, face };
    // cadrage du visage pour les pastilles (centre x, y et taille, en fraction de l'image)
    const fo = data.focus;
    const focus = fo && [fo.x, fo.y, fo.s].every((v) => Number.isFinite(+v) && +v >= 0 && +v <= 1)
      ? { x: +(+fo.x).toFixed(3), y: +(+fo.y).toFixed(3), s: Math.max(0.15, +(+fo.s).toFixed(3)) } : null;
    p.skin = { type: data.type, colors, v: Date.now(), face: !!face, hair, focus };
    this.changed();
  }

  skinImage(pid) { return this.skinImages?.[pid] || null; }

  requireHost(id) { if (id !== this.hostId) fail('Seul l’hôte peut faire ça'); }

  start(byId) {
    this.requireHost(byId);
    if (this.phase !== 'lobby') fail('Déjà commencée');
    if (this.players.length < 2) fail('Il faut au moins 2 joueurs');
    this.phase = 'playing';
    this.players = shuffle(this.players);
    for (const p of this.players) p.money = this.settings.startMoney;
    for (const i of OWNABLE) this.props[i] = { owner: null, houses: 0 };
    this.decks.chance = shuffle(CHANCE_CARDS.map((c) => c.id));
    this.decks.chest = shuffle(CHEST_CARDS.map((c) => c.id));
    this.stats = { turns: 0, startedAt: Date.now(), endedAt: null, history: [], cells: {}, players: {} };
    this.addLog('La partie commence ! Bonne chance à tous 🌍');
    this.beginTurn(this.players[0]);
    this.changed();
  }

  // ---------- statistiques ----------
  st(p) {
    if (!this.stats || !p) return {};
    return (this.stats.players[p.id] ||= {
      rentPaid: 0, rentReceived: 0, maxRentPaid: 0, bought: 0, spentOnProps: 0, auctionsWon: 0,
      houses: 0, hotels: 0, hijacks: 0, hotelsLost: 0, jail: 0, trafficArrests: 0, trafficDeliveries: 0,
      doubles: 0, rolls: 0, diceTotal: 0, goPasses: 0, cards: 0, taxes: 0, trades: 0, swaps: 0,
      goulagWins: 0, goulagLosses: 0, peakWorth: 0, outTurn: null,
      casinoSpins: 0, casinoBet: 0, casinoWon: 0, jackpots: 0, propsSold: 0,
    });
  }

  cellStat(i) {
    return this.stats ? (this.stats.cells[i] ||= { landings: 0, rent: 0 }) : {};
  }

  // Patrimoine de chaque joueur à un instant donné, pour la courbe de fin de partie
  snapshot() {
    if (!this.stats) return;
    const worth = {};
    for (const p of this.players) {
      worth[p.id] = p.status === 'alive' ? Math.round(this.netWorth(p)) : 0;
      const s = this.st(p);
      s.peakWorth = Math.max(s.peakWorth, worth[p.id]);
    }
    const h = this.stats.history;
    h.push({ turn: this.stats.turns, worth });
    // garde la courbe légère sur les très longues parties
    if (h.length > 500) this.stats.history = h.filter((_, i) => i % 2 === 0 || i === h.length - 1);
  }

  beginTurn(p) {
    if (this.stats) { this.stats.turns++; this.snapshot(); }
    this.turn = { pid: p.id, phase: 'roll', dice: null, rollId: 0, doubles: 0, extraRoll: false, pending: null, rolled: false };
  }

  // ---------- actions ----------
  handle(pid, action) {
    const p = this.player(pid);
    if (!p) fail('Joueur inconnu');
    const a = action || {};
    if (a.type === 'chat') return this.addChat(pid, a.text);
    if (this.phase !== 'playing') fail('La partie n’est pas en cours');
    if (a.type === 'extendTimeout') return this.actExtendTimeout(p, a.playerId);
    if (this.fight && a.type !== 'fightInput') fail('Un combat du goulag est en cours…');
    switch (a.type) {
      case 'roll': this.actRoll(p); break;
      case 'buy': this.actBuy(p); break;
      case 'decline': this.actDecline(p, !!a.auction); break;
      case 'bid': this.actBid(p, a.amount); break;
      case 'endTurn': this.actEndTurn(p); break;
      case 'payJail': this.actPayJail(p); break;
      case 'useJailCard': this.actUseJailCard(p); break;
      case 'build': this.actBuild(p, a.cell); break;
      case 'sell': this.actSell(p, a.cell); break;
      case 'sellProperty': this.actSellProperty(p, a.cell); break;
      case 'casinoSpin': this.actCasinoSpin(p, a.bet); break;
      case 'casinoLeave': this.actCasinoLeave(p); break;
      case 'hijack': this.actHijack(p, !!a.accept); break;
      case 'cardOk': this.actCardOk(p); break;
      case 'bankrupt': this.actBankrupt(p); break;
      case 'proposeTrade': this.actProposeTrade(p, a); break;
      case 'acceptTrade': this.actAcceptTrade(p, a.id); break;
      case 'declineTrade': this.actDeclineTrade(p, a.id); break;
      case 'counterTrade': this.actCounterTrade(p, a); break;
      default: fail('Action inconnue');
    }
    for (const fn of this.afterHooks || []) fn();
    this.afterHooks = [];
    this.changed();
  }

  requireTurn(p) {
    if (!this.turn || this.turn.pid !== p.id) fail('Ce n’est pas votre tour');
  }
  requireAlive(p) { if (p.status !== 'alive') fail('Vous n’êtes plus en jeu'); }

  rollDice() {
    const d = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    if (this.forcedDice?.length) return this.forcedDice.shift();
    return d;
  }

  actRoll(p) {
    this.requireTurn(p);
    const t = this.turn;
    if (t.phase !== 'roll' || t.pending || this.auction) fail('Vous ne pouvez pas lancer les dés maintenant');
    if (p.money < 0) fail('Remboursez vos dettes avant de jouer');
    const dice = this.rollDice();
    t.dice = dice;
    t.rollId++;
    t.rolled = true;
    const isDouble = dice[0] === dice[1];
    const sum = dice[0] + dice[1];
    const ps = this.st(p);
    ps.rolls++;
    ps.diceTotal += sum;
    if (isDouble) ps.doubles++;
    // durée approximative de l'animation côté client (dés + déplacement), pour que les bots attendent
    const fromPos = p.pos;
    this.after(() => { this.animUntil = Math.max(this.animUntil || 0, Date.now() + 800 + ((p.pos - fromPos + 40) % 40) * 110); });
    this.addLog(`${p.name} lance les dés : ${dice[0]} + ${dice[1]} = ${sum}${isDouble ? ' (double !)' : ''}`, p.id);

    if (p.jail.in) {
      const sentence = p.jail.heavy ? RULES.TRAFFIC_JAIL_TURNS : RULES.JAIL_TURNS;
      if (isDouble) {
        p.jail = { in: false, turns: 0, heavy: false };
        this.addLog(`${p.name} sort de prison grâce au double`, p.id);
        t.extraRoll = false;
        this.moveBy(p, sum);
      } else {
        p.jail.turns++;
        if (p.jail.turns >= sentence) {
          this.charge(p, RULES.JAIL_FINE, null);
          p.jail = { in: false, turns: 0, heavy: false };
          this.addLog(`${p.name} a purgé sa peine et paie ${RULES.JAIL_FINE} $`, p.id);
          t.extraRoll = false;
          this.moveBy(p, sum);
        } else {
          this.addLog(`${p.name} reste en prison (${p.jail.turns}/${sentence})`, p.id);
          t.extraRoll = false;
        }
      }
      this.updatePhase();
      return;
    }

    if (isDouble) {
      t.doubles++;
      if (t.doubles >= 3) {
        this.addLog(`${p.name} fait 3 doubles d’affilée : direction la prison !`, p.id);
        this.sendToJail(p, 'doubles');
        this.updatePhase();
        return;
      }
    }
    t.extraRoll = isDouble;
    this.moveBy(p, sum);
    this.updatePhase();
  }

  after(fn) { (this.afterHooks ||= []).push(fn); }

  updatePhase() {
    const t = this.turn;
    if (!t || !t.rolled || t.pending || this.auction) return;
    const p = this.current;
    if (!p || p.status !== 'alive') return;
    t.phase = t.extraRoll && !p.jail.in ? 'roll' : 'done';
  }

  // ---------- déplacements ----------
  moveBy(p, steps, opts = {}) {
    const from = p.pos;
    const to = (from + steps + 40) % 40;
    if (steps > 0 && from + steps >= 40) this.passGo(p);
    p.pos = to;
    this.land(p, opts);
  }

  moveTo(p, to, opts = {}) {
    if (to < p.pos || (to === 0 && p.pos !== 0)) this.passGo(p);
    p.pos = to;
    this.land(p, opts);
  }

  passGo(p) {
    this.st(p).goPasses++;
    p.money += RULES.GO_SALARY;
    this.addLog(`${p.name} passe par la case Départ et reçoit ${RULES.GO_SALARY} $`, p.id);
    if (p.trafficking) {
      p.trafficking = false;
      p.money += RULES.TRAFFIC_BONUS;
      this.st(p).trafficDeliveries++;
      this.addLog(`💊 ${p.name} écoule sa marchandise et empoche ${RULES.TRAFFIC_BONUS} $ de plus`, p.id);
      // cinématique « Say my name » chez tous les joueurs
      this.addEvent('delivery', { pid: p.id, text: `💊 ${p.name} a livré la marchandise : +${RULES.TRAFFIC_BONUS} $ 💰` });
      this.animUntil = Date.now() + 18000;
    }
  }

  sendToJail(p, reason = 'gotojail') {
    const heavy = p.trafficking;
    const from = p.pos;
    this.st(p).jail++;
    if (heavy) this.st(p).trafficArrests++;
    p.trafficking = false;
    p.pos = RULES.JAIL_POSITION;
    p.jail = { in: true, turns: 0, heavy };
    if (this.turn && this.turn.pid === p.id) this.turn.extraRoll = false;
    // case d'où part le pion : le client l'y fait aller avant de l'envoyer en prison
    p.jailFrom = from;
    const why = {
      gotojail: 'tombe sur la case « Allez en prison »',
      doubles: 'fait 3 doubles d’affilée',
      card: 'tire la carte « Allez en prison »',
      traffic: 'se fait contrôler à la prison avec la marchandise',
    }[reason] || 'est arrêté';
    if (heavy) {
      this.addLog(`🚔 ${p.name} est arrêté avec de la drogue : peine doublée (${RULES.TRAFFIC_JAIL_TURNS} tours, seul un double peut le libérer) !`, p.id);
    } else {
      this.addLog(`🚔 ${p.name} ${why} et part en prison`, p.id);
    }
    // cinématique d'arrestation chez tous les joueurs
    this.addEvent('busted', {
      pid: p.id, from, reason, heavy,
      text: heavy
        ? `🚔 ${p.name} ${why} : arrêté en plein trafic, peine doublée (${RULES.TRAFFIC_JAIL_TURNS} tours) !`
        : `🚔 ${p.name} ${why} : direction la prison !`,
    });
    this.animUntil = Date.now() + 9500;
  }

  land(p, opts = {}) {
    const cell = BOARD[p.pos];
    this.cellStat(p.pos).landings++;
    switch (cell.type) {
      case 'city':
      case 'airport':
      case 'utility': this.landOwnable(p, cell, opts); break;
      case 'tax': {
        this.addLog(`${p.name} paie ${cell.amount} $ (${cell.name})`, p.id);
        this.st(p).taxes += cell.amount;
        this.charge(p, cell.amount, null, true);
        break;
      }
      case 'chance': this.drawCard(p, 'chance'); break;
      case 'chest': this.drawCard(p, 'chest'); break;
      case 'gotojail': this.sendToJail(p, 'gotojail'); break;
      case 'jail':
        if (p.trafficking && this.settings.trafficCaughtOnVisit) {
          this.addLog(`🚔 Contrôle de police à la prison : ${p.name} est pris avec la marchandise !`, p.id);
          this.sendToJail(p, 'traffic');
        }
        break;
      case 'casino':
        if (this.turn?.pid === p.id && p.money > 0) {
          this.turn.pending = { type: 'casino', cell: p.pos, spins: 0, last: null };
        } else if (p.money <= 0) {
          this.addLog(`🎰 ${p.name} n’a pas d’argent à miser au casino`, p.id);
        }
        break;
      case 'parking':
        if (this.settings.freeParkingPot && this.pot > 0) {
          this.addLog(`🏖️ ${p.name} récupère la cagnotte du Parc gratuit : ${this.pot} $`, p.id);
          this.addEvent('pot', { pid: p.id, text: `${p.name} remporte la cagnotte : ${this.pot} $ 🏖️` });
          p.money += this.pot;
          this.pot = 0;
        }
        break;
      default: break;
    }
  }

  landOwnable(p, cell, opts) {
    const prop = this.props[cell.index];
    if (!prop.owner) {
      this.turn.pending = { type: 'buy', cell: cell.index, hijackAfter: cell.type === 'airport' };
      return;
    }
    if (prop.owner !== p.id) {
      const owner = this.player(prop.owner);
      let rent = this.rentFor(cell.index, opts);
      this.addLog(`${p.name} paie ${rent} $ de loyer à ${owner.name} (${cell.name})`, p.id);
      const ps = this.st(p);
      ps.rentPaid += rent;
      ps.maxRentPaid = Math.max(ps.maxRentPaid, rent);
      this.st(owner).rentReceived += rent;
      this.cellStat(cell.index).rent += rent;
      this.charge(p, rent, owner.id);
    }
    if (cell.type === 'airport') this.offerHijack(p, cell.index);
  }

  rentFor(index, opts = {}) {
    const cell = BOARD[index];
    const prop = this.props[index];
    if (!prop?.owner) return 0;
    if (cell.type === 'city') {
      if (prop.houses > 0) return cell.rents[prop.houses];
      return cell.rents[0] * (this.ownsCountry(prop.owner, cell.country) ? 2 : 1);
    }
    if (cell.type === 'airport') {
      const n = BOARD.filter((c) => c.type === 'airport' && this.props[c.index].owner === prop.owner).length;
      return AIRPORT_RENTS[n - 1] * (opts.rentMultiplier || 1);
    }
    if (cell.type === 'utility') {
      const n = BOARD.filter((c) => c.type === 'utility' && this.props[c.index].owner === prop.owner).length;
      const mult = opts.utilityMultiplier || (n === 2 ? 10 : 4);
      const dice = this.turn?.dice || [3, 4];
      return (dice[0] + dice[1]) * mult;
    }
    return 0;
  }

  ownsCountry(pid, country) {
    return COUNTRY_CELLS[country].every((i) => this.props[i].owner === pid);
  }

  // Paiement : le solde peut devenir négatif, le joueur doit alors vendre/hypothéquer ou faire faillite
  charge(p, amount, creditorId, toPot = false) {
    if (amount <= 0) return;
    p.money -= amount;
    if (creditorId) {
      const c = this.player(creditorId);
      if (c) c.money += amount;
    } else if (toPot && this.settings.freeParkingPot) {
      this.pot += amount;
    }
    if (p.money < 0) p.debtCreditor = creditorId || null;
  }

  // ---------- achat & enchères ----------
  actBuy(p) {
    this.requireTurn(p);
    const pend = this.turn.pending;
    if (pend?.type !== 'buy') fail('Rien à acheter');
    const cell = BOARD[pend.cell];
    if (p.money < cell.price) fail('Pas assez d’argent');
    p.money -= cell.price;
    this.props[cell.index].owner = p.id;
    this.addLog(`${p.name} achète ${cell.name} pour ${cell.price} $`, p.id);
    this.st(p).bought++;
    this.st(p).spentOnProps += cell.price;
    if (cell.type === 'city' && this.ownsCountry(p.id, cell.country)) {
      this.addLog(`🏳️ ${p.name} contrôle tout le pays ${COUNTRIES[cell.country].name} !`, p.id);
    }
    this.turn.pending = null;
    this.afterBuyResolved(p, pend);
  }

  // auction = true : le joueur choisit explicitement de mettre la propriété aux enchères
  actDecline(p, auction = false) {
    this.requireTurn(p);
    const pend = this.turn.pending;
    if (pend?.type !== 'buy') fail('Rien à refuser');
    const cell = BOARD[pend.cell];
    const bidders = this.alive.filter((x) => x.money > 0);
    if (auction && !this.settings.auction) fail('Les enchères sont désactivées dans cette partie');
    if (auction && bidders.length < 2) fail('Pas assez de joueurs pour une enchère');
    this.turn.pending = null;
    if (auction) {
      this.auction = { cell: cell.index, bid: 0, bidder: null, endsAt: Date.now() + 10000, after: pend };
      this.addLog(`${p.name} met ${cell.name} aux enchères !`, p.id);
      this.scheduleAuctionEnd();
    } else {
      this.addLog(`${p.name} n’achète pas ${cell.name}`, p.id);
      this.afterBuyResolved(p, pend);
    }
  }

  actBid(p, amount) {
    this.requireAlive(p);
    const a = this.auction;
    if (!a) fail('Aucune enchère en cours');
    amount = Math.round(+amount);
    if (!(amount > a.bid)) fail('Enchère trop basse');
    if (amount > p.money) fail('Pas assez d’argent');
    a.bid = amount;
    a.bidder = p.id;
    a.endsAt = Math.max(a.endsAt, Date.now() + 5000);
    this.addLog(`${p.name} enchérit ${amount} $`, p.id);
  }

  scheduleAuctionEnd() {
    clearTimeout(this.auctionTimer);
    if (!this.auction) return;
    const delay = Math.max(50, this.auction.endsAt - Date.now());
    this.auctionTimer = setTimeout(() => {
      if (!this.auction) return;
      if (Date.now() < this.auction.endsAt - 20) return this.scheduleAuctionEnd();
      this.endAuction();
      this.changed();
    }, delay);
  }

  endAuction() {
    const a = this.auction;
    this.auction = null;
    clearTimeout(this.auctionTimer);
    const cell = BOARD[a.cell];
    const w = a.bidder && this.player(a.bidder);
    if (w && w.status === 'alive' && w.money >= a.bid) {
      w.money -= a.bid;
      const ws = this.st(w);
      ws.auctionsWon++;
      ws.bought++;
      ws.spentOnProps += a.bid;
      this.props[a.cell].owner = w.id;
      this.addLog(`🔨 ${w.name} remporte ${cell.name} pour ${a.bid} $`, w.id);
    } else {
      this.addLog(`Personne n’a acheté ${cell.name}`);
    }
    const cur = this.current;
    if (cur) this.afterBuyResolved(cur, a.after);
  }

  afterBuyResolved(p, pend) {
    if (pend?.hijackAfter && p.status === 'alive') this.offerHijack(p, pend.cell);
    this.updatePhase();
  }

  // ---------- casino ----------
  actCasinoSpin(p, bet) {
    this.requireTurn(p);
    const pend = this.turn.pending;
    if (pend?.type !== 'casino') fail('Vous n’êtes pas au casino');
    if (pend.spins >= CASINO.MAX_SPINS) fail(`Maximum ${CASINO.MAX_SPINS} parties par visite`);
    bet = Math.floor(+bet);
    if (!(bet >= 1)) fail('Mise invalide');
    if (bet > p.money) fail('Vous ne pouvez pas miser plus que votre argent');
    const n = CASINO.SYMBOLS.length;
    const reels = [0, 1, 2].map(() => Math.floor(Math.random() * n));
    const win = casinoPayout(reels, bet);
    p.money += win - bet;
    pend.spins++;
    pend.last = { id: (this.casinoSeq = (this.casinoSeq || 0) + 1), reels, bet, win };
    const s = this.st(p);
    s.casinoSpins++;
    s.casinoBet += bet;
    s.casinoWon += win;
    const jackpot = reels[0] === reels[1] && reels[1] === reels[2];
    if (jackpot) s.jackpots++;
    const sym = reels.map((r) => CASINO.SYMBOLS[r].s).join(' ');
    this.addLog(`🎰 ${p.name} mise ${bet} $ : ${sym} → ${win ? `gagne ${win} $${jackpot ? ' (JACKPOT !)' : ''}` : 'perdu'}`, p.id);
    // laisse tourner les rouleaux avant que les bots enchaînent
    this.animUntil = Date.now() + 3000;
  }

  actCasinoLeave(p) {
    this.requireTurn(p);
    if (this.turn.pending?.type !== 'casino') fail('Vous n’êtes pas au casino');
    this.turn.pending = null;
    this.updatePhase();
  }

  // ---------- détournement d'avion ----------
  // Cible tirée au hasard parmi les villes adverses qui ont au moins une maison ou un hôtel
  hijackTarget(p) {
    const targets = BOARD.filter((c) => {
      const prop = c.type === 'city' && this.props[c.index];
      return prop && prop.houses > 0 && prop.owner && prop.owner !== p.id;
    });
    return targets.length ? targets[Math.floor(Math.random() * targets.length)].index : null;
  }

  // Proposé seulement s'il existe une cible ; la ville n'est tirée qu'au moment du paiement
  offerHijack(p, airportIndex) {
    if (this.hijackTarget(p) == null) return;
    this.turn.pending = { type: 'hijack', from: airportIndex, cost: RULES.HIJACK_PRICE };
  }

  actHijack(p, accept) {
    this.requireTurn(p);
    const pend = this.turn.pending;
    if (pend?.type !== 'hijack') fail('Aucun détournement possible');
    if (accept) {
      if (p.money < pend.cost) fail('Pas assez d’argent pour détourner l’avion');
      const target = this.hijackTarget(p);
      if (target == null) fail('Plus aucune ville adverse construite');
      const prop = this.props[target];
      const houses = prop.houses;
      const victim = this.player(prop.owner);
      p.money -= pend.cost;
      prop.houses = 0;
      this.st(p).hijacks++;
      this.st(victim).hotelsLost++;
      const cell = BOARD[target];
      const what = buildingsLabel(houses);
      this.addLog(`✈️ ${p.name} paie ${pend.cost} $ et détourne un avion depuis ${BOARD[pend.from].name}… où va-t-il s’écraser ?`, p.id);
      this.addEvent('hijack', {
        pid: p.id, victim: victim.id, from: pend.from, cell: target, houses,
        text: `✈️💥 ${p.name} a détruit ${what} de ${victim.name} à ${cell.name} !`,
      });
      // la cible n'apparaît dans le journal qu'après l'impact, pour ne pas gâcher la surprise
      const reveal = `💥 L’avion s’écrase sur ${cell.name} : ${what} de ${victim.name} ${houses === 1 || houses === 5 ? 'est détruit' + (houses === 1 ? 'e' : '') : 'sont détruites'}`;
      setTimeout(() => {
        if (this.phase === 'lobby') return;
        this.addLog(reveal, victim.id);
        this.changed();
      }, 9000);
      // laisse le temps à la cinématique de se jouer chez tout le monde avant que les bots enchaînent
      this.animUntil = Date.now() + 9500;
    } else {
      this.addLog(`${p.name} renonce au détournement`, p.id);
    }
    this.turn.pending = null;
    this.updatePhase();
  }

  // ---------- cartes ----------
  drawCard(p, deck) {
    const ids = this.decks[deck];
    const id = ids.shift();
    const card = ALL_CARDS[id];
    if (card.action.kind !== 'jailCard') ids.push(id);
    const label = deck === 'chance' ? 'Chance' : 'Caisse de communauté';
    this.addLog(`${p.name} tire une carte ${label} : « ${card.text} »`, p.id);
    this.st(p).cards++;
    this.addEvent('card', { pid: p.id, deck, text: card.text, cardId: card.id });
    // l'effet n'est appliqué que lorsque le joueur a lu la carte et cliqué (les bots attendent un peu)
    this.turn.pending = { type: 'card', deck, cardId: card.id, text: card.text, kind: card.action.kind };
    this.animUntil = Math.max(this.animUntil || 0, Date.now() + 3500);
  }

  actCardOk(p) {
    this.requireTurn(p);
    const pend = this.turn.pending;
    if (pend?.type !== 'card') fail('Aucune carte à jouer');
    this.turn.pending = null;
    this.applyCard(p, ALL_CARDS[pend.cardId]);
    this.updatePhase();
  }

  applyCard(p, card) {
    const a = card.action;
    switch (a.kind) {
      case 'moveTo': this.moveTo(p, a.to); break;
      case 'moveBy': this.moveBy(p, a.steps); break;
      case 'nearest': {
        let i = p.pos;
        do { i = (i + 1) % 40; } while (BOARD[i].type !== a.target);
        this.moveTo(p, i, a.target === 'airport' ? { rentMultiplier: 2 } : { utilityMultiplier: 10 });
        break;
      }
      case 'money':
        if (a.amount >= 0) p.money += a.amount;
        else this.charge(p, -a.amount, null, true);
        break;
      case 'jailCard': p.jailCards.push(card.id); break;
      case 'jail': this.sendToJail(p, 'card'); break;
      case 'repairs': {
        let total = 0;
        for (const [i, prop] of Object.entries(this.props)) {
          if (prop.owner !== p.id) continue;
          total += prop.houses === 5 ? a.hotel : prop.houses * a.house;
          void i;
        }
        if (total > 0) {
          this.addLog(`${p.name} paie ${total} $ de réparations`, p.id);
          this.charge(p, total, null, true);
        }
        break;
      }
      case 'payEach':
        for (const o of this.alive) if (o.id !== p.id) this.charge(p, a.amount, o.id);
        break;
      case 'collectEach':
        for (const o of this.alive) if (o.id !== p.id) this.charge(o, a.amount, p.id);
        break;
      case 'traffic':
        p.trafficking = true;
        this.addEvent('traffic', { pid: p.id, text: `💊 ${p.name} se lance dans le trafic de drogue…` });
        break;
      case 'swap': this.forcedSwap(p); break;
      default: break;
    }
  }

  groupHasBuildings(index) {
    const cell = BOARD[index];
    if (cell.type !== 'city') return false;
    return COUNTRY_CELLS[cell.country].some((i) => this.props[i].houses > 0);
  }

  forcedSwap(p) {
    const tradable = (i) => !this.groupHasBuildings(+i);
    const mine = Object.entries(this.props).filter(([i, pr]) => pr.owner === p.id && tradable(i)).map(([i]) => +i);
    const theirs = Object.entries(this.props)
      .filter(([i, pr]) => pr.owner && pr.owner !== p.id && tradable(i)).map(([i]) => +i);
    if (!mine.length || !theirs.length) {
      this.addLog('🔀 Échange forcé impossible : aucune propriété échangeable', p.id);
      this.addEvent('swap', { pid: p.id, text: '🔀 Échange forcé annulé : aucune propriété échangeable.' });
      return;
    }
    const a = mine[Math.floor(Math.random() * mine.length)];
    const b = theirs[Math.floor(Math.random() * theirs.length)];
    const other = this.player(this.props[b].owner);
    this.props[a].owner = other.id;
    this.props[b].owner = p.id;
    this.st(p).swaps++;
    this.cancelTradesWithProps([a, b]);
    const text = `🔀 Échange forcé : ${p.name} donne ${BOARD[a].name} et reçoit ${BOARD[b].name} de ${other.name}`;
    this.addLog(text, p.id);
    this.addEvent('swap', { pid: p.id, other: other.id, cells: [a, b], text });
  }

  // ---------- prison ----------
  actPayJail(p) {
    this.requireTurn(p);
    if (!p.jail.in || this.turn.phase !== 'roll') fail('Vous n’êtes pas en prison');
    if (p.jail.heavy) fail('Trafiquant : seul un double peut vous libérer !');
    if (p.money < RULES.JAIL_FINE) fail('Pas assez d’argent');
    this.charge(p, RULES.JAIL_FINE, null, true);
    p.jail = { in: false, turns: 0, heavy: false };
    this.addLog(`${p.name} paie la caution de ${RULES.JAIL_FINE} $`, p.id);
  }

  actUseJailCard(p) {
    this.requireTurn(p);
    if (!p.jail.in || this.turn.phase !== 'roll') fail('Vous n’êtes pas en prison');
    if (p.jail.heavy) fail('Trafiquant : seul un double peut vous libérer !');
    const id = p.jailCards.shift();
    if (!id) fail('Aucune carte');
    this.decks[id.startsWith('c_') ? 'chance' : 'chest'].push(id);
    p.jail = { in: false, turns: 0, heavy: false };
    this.addLog(`${p.name} utilise sa carte « Libéré de prison »`, p.id);
  }

  // ---------- constructions & hypothèques ----------
  actBuild(p, index) {
    this.requireTurn(p);
    this.requireAlive(p);
    const cell = BOARD[index];
    const prop = this.props[index];
    if (cell?.type !== 'city' || prop.owner !== p.id) fail('Ce n’est pas votre ville');
    if (!this.ownsCountry(p.id, cell.country)) fail(`Il faut posséder toutes les villes de ${COUNTRIES[cell.country].name}`);
    const group = COUNTRY_CELLS[cell.country].map((i) => this.props[i]);
    if (prop.houses >= 5) fail('Déjà un hôtel');
    if (prop.houses > Math.min(...group.map((g) => g.houses))) fail('Construisez uniformément dans le pays');
    const price = housePrice(cell);
    if (p.money < price) fail('Pas assez d’argent');
    p.money -= price;
    prop.houses++;
    if (prop.houses === 5) this.st(p).hotels++;
    else this.st(p).houses++;
    this.addLog(`${p.name} construit ${prop.houses === 5 ? 'un hôtel' : 'une maison'} à ${cell.name}`, p.id);
  }

  actSell(p, index) {
    this.requireAlive(p);
    const cell = BOARD[index];
    const prop = this.props[index];
    if (cell?.type !== 'city' || prop.owner !== p.id) fail('Ce n’est pas votre ville');
    if (prop.houses <= 0) fail('Aucun bâtiment');
    const group = COUNTRY_CELLS[cell.country].map((i) => this.props[i]);
    if (prop.houses < Math.max(...group.map((g) => g.houses))) fail('Vendez uniformément dans le pays');
    prop.houses--;
    p.money += housePrice(cell) / 2;
    this.addLog(`${p.name} vend un bâtiment à ${cell.name}`, p.id);
    this.clearDebt(p);
  }

  // Revente d'une propriété à la banque (remplace l'hypothèque) : elle redevient libre à l'achat
  actSellProperty(p, index) {
    this.requireAlive(p);
    const cell = BOARD[index];
    const prop = this.props[index];
    if (!prop || prop.owner !== p.id) fail('Ce n’est pas votre propriété');
    if (this.groupHasBuildings(index)) fail('Vendez d’abord les bâtiments du pays');
    if (this.turn?.pending?.type === 'buy' && this.turn.pending.cell === index) fail('Impossible maintenant');
    if (this.auction?.cell === index) fail('Propriété aux enchères');
    const value = resaleValue(cell);
    prop.owner = null;
    prop.houses = 0;
    p.money += value;
    this.st(p).propsSold++;
    this.cancelTradesWithProps([index]);
    this.addLog(`${p.name} revend ${cell.name} à la banque (+${value} $)`, p.id);
    this.clearDebt(p);
  }

  clearDebt(p) { if (p.money >= 0) p.debtCreditor = null; }

  // ---------- fin de tour ----------
  actEndTurn(p) {
    this.requireTurn(p);
    if (this.turn.phase !== 'done' || this.turn.pending || this.auction) fail('Vous ne pouvez pas finir votre tour maintenant');
    if (p.money < 0) fail('Remboursez vos dettes ou déclarez faillite');
    this.nextTurn();
  }

  nextTurn() {
    if (this.phase !== 'playing') return;
    const n = this.players.length;
    let idx = this.players.findIndex((p) => p.id === this.turn?.pid);
    for (let k = 1; k <= n; k++) {
      const cand = this.players[(idx + k) % n];
      if (cand.status === 'alive') {
        this.beginTurn(cand);
        return;
      }
    }
  }

  // ---------- faillite & goulag ----------
  netWorth(p) {
    let total = p.money;
    for (const [i, prop] of Object.entries(this.props)) {
      if (prop.owner !== p.id) continue;
      const cell = BOARD[i];
      total += resaleValue(cell);
      total += (prop.houses * housePrice(cell)) / 2;
    }
    return total;
  }

  actBankrupt(p) {
    this.requireAlive(p);
    // faillite volontaire possible à tout moment : sans dette, les biens reviennent à la banque
    if (p.money >= 0) p.debtCreditor = null;
    this.bankrupt(p);
  }

  bankrupt(p) {
    const creditor = p.debtCreditor ? this.player(p.debtCreditor) : null;
    const toPlayer = creditor && creditor.status === 'alive' ? creditor : null;
    const owned = Object.keys(this.props).filter((i) => this.props[i].owner === p.id).map(Number);
    for (const i of owned) {
      const prop = this.props[i];
      p.money += (prop.houses * housePrice(BOARD[i])) / 2;
      prop.houses = 0;
      if (toPlayer) prop.owner = toPlayer.id;
      else prop.owner = null;
    }
    if (toPlayer) {
      if (p.money > 0) toPlayer.money += p.money;
      toPlayer.jailCards.push(...p.jailCards);
    } else {
      for (const id of p.jailCards) this.decks[id.startsWith('c_') ? 'chance' : 'chest'].push(id);
    }
    p.jailCards = [];
    p.money = 0;
    p.trafficking = false;
    p.jail = { in: false, turns: 0, heavy: false };
    p.debtCreditor = null;
    this.trades = this.trades.filter((t) => t.from !== p.id && t.to !== p.id);
    if (this.auction?.bidder === p.id) { this.auction.bidder = null; this.auction.bid = 0; }

    this.st(p).outTurn = this.stats?.turns ?? null;
    this.addLog(`💀 ${p.name} fait faillite${toPlayer ? ` au profit de ${toPlayer.name}` : ''}`, p.id);
    if (this.settings.goulag && !p.usedGoulag) {
      p.status = 'goulag';
      p.usedGoulag = true;
      p.goulagSince = Date.now();
      this.addLog(`⛓️ ${p.name} est envoyé au goulag… il attend un adversaire pour tenter de revenir`, p.id);
      this.addEvent('goulag', { pid: p.id, text: `⛓️ ${p.name} part au goulag !` });
    } else {
      p.status = 'eliminated';
      this.addEvent('bankrupt', { pid: p.id, text: `💀 ${p.name} est éliminé !` });
    }

    const wasCurrent = this.turn?.pid === p.id;
    if (this.checkGameOver()) return;
    if (wasCurrent) {
      if (this.auction) { this.auction.after = null; }
      this.nextTurn();
    }
    this.checkGoulag();
  }

  checkGameOver() {
    const alive = this.alive;
    if (alive.length > 1) return false;
    this.phase = 'ended';
    this.winner = alive[0]?.id || null;
    if (this.stats) { this.stats.endedAt = Date.now(); this.snapshot(); }
    for (const p of this.players) if (p.status === 'goulag') p.status = 'eliminated';
    this.fight?.stop();
    this.fight = null;
    this.auction = null;
    clearTimeout(this.auctionTimer);
    if (alive[0]) {
      this.addLog(`🏆 ${alive[0].name} remporte la partie !`, alive[0].id);
      this.addEvent('win', { pid: alive[0].id, text: `🏆 ${alive[0].name} remporte la partie !` });
    }
    return true;
  }

  checkGoulag() {
    if (this.fight || this.phase !== 'playing') return;
    const waiting = this.players.filter((p) => p.status === 'goulag').sort((a, b) => a.goulagSince - b.goulagSince);
    if (waiting.length < 2 || this.alive.length < 2) return;
    const [a, b] = waiting;
    this.addLog(`⚔️ Combat du goulag : ${a.name} contre ${b.name} ! Le gagnant revient en jeu.`);
    this.addEvent('fight', { text: `⚔️ Combat du goulag : ${a.name} vs ${b.name}` });
    this.fight = new Fight([a, b], {
      onTick: (state) => this.onFightTick(this, state),
      onEnd: (winnerId) => this.endFight(winnerId),
    });
  }

  endFight(winnerId) {
    const f = this.fight;
    if (!f) return;
    this.fight = null;
    for (const id of f.ids) {
      const p = this.player(id);
      if (!p) continue;
      if (id === winnerId) {
        p.status = 'alive';
        this.st(p).goulagWins++;
        this.st(p).outTurn = null;
        p.money = this.settings.goulagMoney;
        p.pos = 0;
        p.jail = { in: false, turns: 0, heavy: false };
        this.addLog(`🔥 ${p.name} sort vainqueur du goulag et revient avec ${this.settings.goulagMoney} $ !`, p.id);
        this.addEvent('goulagWin', { pid: p.id, text: `🔥 ${p.name} revient du goulag avec ${this.settings.goulagMoney} $ !` });
      } else {
        p.status = 'eliminated';
        this.st(p).goulagLosses++;
        this.st(p).outTurn = this.stats?.turns ?? null;
        this.addLog(`☠️ ${p.name} perd au goulag et est définitivement éliminé`, p.id);
      }
    }
    this.checkGoulag();
    this.changed();
  }

  fightInput(pid, input) {
    this.fight?.input(pid, input);
  }

  // ---------- échanges ----------
  cleanOffer(o = {}) {
    return {
      money: Math.max(0, Math.round(+o.money || 0)),
      props: [...new Set((o.props || []).map(Number))].filter((i) => this.props[i]),
      cards: Math.max(0, Math.round(+o.cards || 0)),
    };
  }

  validateSide(p, o) {
    if (p.money < o.money) fail(`${p.name} n’a pas assez d’argent`);
    if (p.jailCards.length < o.cards) fail(`${p.name} n’a pas assez de cartes prison`);
    for (const i of o.props) {
      if (this.props[i].owner !== p.id) fail(`${BOARD[i].name} n’appartient pas à ${p.name}`);
      if (this.groupHasBuildings(i)) fail(`Vendez les bâtiments de ${COUNTRIES[BOARD[i].country].name} avant d’échanger`);
    }
  }

  actProposeTrade(p, a) {
    this.requireAlive(p);
    const to = this.player(a.to);
    if (!to || to.status !== 'alive' || to.id === p.id) fail('Joueur invalide');
    const offer = this.cleanOffer(a.offer);
    const request = this.cleanOffer(a.request);
    if (!offer.money && !offer.props.length && !offer.cards && !request.money && !request.props.length && !request.cards) fail('Échange vide');
    this.validateSide(p, offer);
    this.validateSide(to, request);
    const t = { id: uid(), from: p.id, to: to.id, offer, request, t: Date.now(), counter: !!a.counter };
    this.trades.push(t);
    this.addLog(a.counter ? `🤝 ${p.name} fait une contre-proposition à ${to.name}` : `🤝 ${p.name} propose un échange à ${to.name}`, p.id);
    return t;
  }

  // Négociation : remplace la proposition reçue par une contre-proposition envoyée à son auteur
  actCounterTrade(p, a) {
    const t = this.trades.find((x) => x.id === a.id);
    if (!t || t.to !== p.id) fail('Échange introuvable');
    const from = this.player(t.from);
    if (!from || from.status !== 'alive') fail('Joueur invalide');
    this.actProposeTrade(p, { to: from.id, offer: a.offer, request: a.request, counter: true });
    this.trades = this.trades.filter((x) => x.id !== t.id);
  }

  actAcceptTrade(p, id) {
    const t = this.trades.find((x) => x.id === id);
    if (!t || t.to !== p.id) fail('Échange introuvable');
    const from = this.player(t.from);
    this.validateSide(from, t.offer);
    this.validateSide(p, t.request);
    const move = (src, dst, o) => {
      src.money -= o.money; dst.money += o.money;
      for (const i of o.props) this.props[i].owner = dst.id;
      for (let k = 0; k < o.cards; k++) dst.jailCards.push(src.jailCards.shift());
    };
    move(from, p, t.offer);
    move(p, from, t.request);
    this.clearDebt(from);
    this.clearDebt(p);
    this.trades = this.trades.filter((x) => x.id !== id);
    this.cancelTradesWithProps([...t.offer.props, ...t.request.props]);
    this.addLog(`🤝 ${p.name} accepte l’échange de ${from.name}`, p.id);
    this.st(p).trades++;
    this.st(from).trades++;
    this.addEvent('trade', { text: `🤝 Échange conclu entre ${from.name} et ${p.name}` });
  }

  actDeclineTrade(p, id) {
    const t = this.trades.find((x) => x.id === id);
    if (!t || (t.to !== p.id && t.from !== p.id)) fail('Échange introuvable');
    this.trades = this.trades.filter((x) => x.id !== id);
    this.addLog(t.from === p.id ? `${p.name} annule sa proposition d’échange` : `${p.name} refuse l’échange`, p.id);
  }

  cancelTradesWithProps(list) {
    const s = new Set(list);
    this.trades = this.trades.filter((t) => ![...t.offer.props, ...t.request.props].some((i) => s.has(i)));
  }

  // ---------- déconnexions ----------
  markDisconnected(p) {
    p.connected = false;
    p.disconnectedAt = Date.now();
    if (this.phase === 'playing' && !p.isBot && p.status !== 'eliminated' && !p.botControlled) {
      p.abandonAt = Date.now() + this.settings.abandonDelay * 1000;
    }
  }

  // Joueur qui revient : par son jeton, ou à défaut par son pseudo s'il a changé d'appareil / d'onglet
  // (seulement une place humaine actuellement déconnectée)
  findReturning(token, name) {
    if (token) {
      const p = this.players.find((x) => x.token && x.token === token);
      if (p) return p;
    }
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    const p = this.players.find((x) => !x.isBot && !x.connected && x.name.trim().toLowerCase() === n);
    if (p && token) p.token = token;
    return p || null;
  }

  markReconnected(p) {
    p.connected = true;
    p.disconnectedAt = null;
    if (p.botControlled) {
      p.botControlled = false;
      this.addLog(`🔌 ${p.name} est de retour et reprend la main sur le bot`, p.id);
      this.addEvent('reconnect', { pid: p.id, text: `🔌 ${p.name} est de retour et reprend la main !` });
    } else if (p.abandonAt && p.announcedDisconnect) {
      this.addLog(`🔌 ${p.name} est de retour !`, p.id);
      this.addEvent('reconnect', { pid: p.id, text: `🔌 ${p.name} est de retour !` });
    }
    p.abandonAt = null;
    p.announcedDisconnect = false;
  }

  actExtendTimeout(by, targetId) {
    const t = this.player(targetId);
    if (!t?.abandonAt) fail('Ce joueur n’est pas déconnecté');
    if (by.id === t.id) fail('Impossible');
    t.abandonAt = Math.min(Date.now() + 10 * 60 * 1000, t.abandonAt + 60 * 1000);
    this.addLog(`⏱️ ${by.name} accorde 1 minute de plus à ${t.name}`, by.id);
    this.changed();
  }

  // Appelé régulièrement : annonce les déconnexions et fait abandonner ceux qui ne reviennent pas.
  // Si plus aucun humain n'est connecté, la partie est en pause et les décomptes aussi.
  checkDisconnections(elapsedMs, anyHumanConnected) {
    if (this.phase !== 'playing') return;
    const now = Date.now();
    let changed = false;
    for (const p of this.players) {
      if (!p.abandonAt) continue;
      if (!anyHumanConnected) { p.abandonAt += elapsedMs; continue; }
      if (!p.announcedDisconnect && now - p.disconnectedAt > 5000) {
        p.announcedDisconnect = true;
        const min = Math.ceil((p.abandonAt - now) / 60000);
        this.addLog(`📴 ${p.name} s’est déconnecté. La partie l’attend ${min} min, puis un bot jouera à sa place jusqu’à son retour.`, p.id);
        this.addEvent('disconnect', { pid: p.id, text: `📴 ${p.name} s’est déconnecté` });
        changed = true;
      }
      // décompte écoulé : un bot prend sa place (il garde ses biens et peut reprendre la main en revenant)
      if (now >= p.abandonAt) {
        this.botTakeover(p);
        changed = true;
      }
    }
    if (changed) this.changed();
  }

  botTakeover(p) {
    p.abandonAt = null;
    p.botControlled = true;
    this.addLog(`🤖 ${p.name} n’est pas revenu : un bot joue à sa place jusqu’à son retour`, p.id);
    this.addEvent('disconnect', { pid: p.id, text: `🤖 Un bot remplace ${p.name} jusqu’à son retour` });
  }

  // ---------- état public ----------
  publicState() {
    return {
      id: this.id,
      phase: this.phase,
      hostId: this.hostId,
      settings: this.settings,
      players: this.players.map(({ token, abandonAt, ...rest }) => ({
        ...rest,
        netWorth: this.phase === 'lobby' ? 0 : this.netWorth(rest),
        // temps restant (et non une date) pour ne pas dépendre de l'horloge du client
        abandonIn: abandonAt ? Math.max(0, abandonAt - Date.now()) : null,
      })),
      props: this.props,
      turn: this.turn,
      auction: this.auction && { ...this.auction, after: undefined, remaining: Math.max(0, this.auction.endsAt - Date.now()) },
      trades: this.trades,
      log: this.log.slice(-80),
      chat: this.chat.slice(-60),
      events: this.events,
      pot: this.pot,
      winner: this.winner,
      fight: this.fight ? this.fight.meta() : null,
      // les statistiques complètes ne sont envoyées qu'en fin de partie
      stats: this.phase === 'ended' ? this.stats : null,
      version: this.version,
    };
  }

  destroy() {
    clearTimeout(this.auctionTimer);
    clearTimeout(this.botTimer);
    this.fight?.stop();
  }
}
