// Combat du goulag : duel à mort dans une cour de béton, vue de dessus, simulé par le serveur à 30 images/s.
// Armes : pistolet (clic gauche), machette au corps à corps (clic droit ou F : gros dégâts, recul, saignement),
// fusil à pompe à ramasser dans les caisses qui tombent régulièrement. Espace pour esquiver (roulade).
// Le serveur envoie aussi les évènements (tirs, impacts, coups de machette, mort) pour les effets sanglants.

export const ARENA = {
  W: 960,
  H: 540,
  obstacles: [
    { x: 300, y: 110, w: 40, h: 120 },
    { x: 620, y: 310, w: 40, h: 120 },
    { x: 440, y: 245, w: 80, h: 50 },
    { x: 150, y: 380, w: 110, h: 30 },
    { x: 700, y: 130, w: 110, h: 30 },
  ],
};

const TICK = 1000 / 30;
const DT = 1 / 30;
const R = 18;
const SPEED = 230;
const BULLET_R = 5;
export const INTRO = 13; // staredown puis entrée dans l'arène (cinématique chez les joueurs)
const COUNTDOWN = 3.5;
const DURATION = 60;
export const OVER_DELAY = 5; // après la mort, retour automatique à la partie
const DASH_COOLDOWN = 1.3;
const DASH_TIME = 0.16;

export const WEAPONS = {
  pistol: { cooldown: 0.28, damage: 9, speed: 640, life: 1.4, pellets: 1, spread: 0.03, knock: 60 },
  shotgun: { cooldown: 0.75, damage: 9, speed: 720, life: 0.42, pellets: 7, spread: 0.26, knock: 120, ammo: 6 },
};
const MACHETE = { cooldown: 0.55, damage: 28, reach: R + 44, arc: 0.75, knock: 520, bleed: 3 };
const BLEED_DPS = 4;
const PICKUP_EVERY = 7;

const circleRect = (x, y, r, o) => {
  const cx = Math.max(o.x, Math.min(x, o.x + o.w));
  const cy = Math.max(o.y, Math.min(y, o.y + o.h));
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
};
const blocked = (x, y, r) =>
  x < r || y < r || x > ARENA.W - r || y > ARENA.H - r || ARENA.obstacles.some((o) => circleRect(x, y, r, o));

function lineOfSight(a, b) {
  const steps = 24;
  for (let i = 1; i < steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const y = a.y + ((b.y - a.y) * i) / steps;
    if (ARENA.obstacles.some((o) => circleRect(x, y, 2, o))) return false;
  }
  return true;
}

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Fight {
  constructor(players, { onTick, onEnd }) {
    this.players = players;
    this.ids = players.map((p) => p.id);
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.phase = 'intro';
    this.time = 0;
    this.winner = null;
    this.bullets = [];
    this.pickups = [];
    this.pickupT = 3;
    this.events = []; // envoyés au prochain affichage puis vidés
    this.seq = 0;
    this.fighters = players.map((p, i) => ({
      id: p.id,
      x: i === 0 ? 80 : ARENA.W - 80,
      y: ARENA.H / 2,
      hp: 100,
      angle: i === 0 ? 0 : Math.PI,
      weapon: 'pistol',
      ammo: 0,
      cooldown: 0,
      meleeCd: 0,
      swing: 0,
      dashCd: 0,
      dashT: 0,
      dashDir: [0, 0],
      kx: 0,
      ky: 0,
      bleed: 0,
      input: { up: 0, down: 0, left: 0, right: 0, angle: i === 0 ? 0 : Math.PI, shoot: false, melee: false, dash: false },
      ai: { strafe: 1, switchT: 0 },
      hitFlash: 0,
    }));
    // la simulation rattrape le temps réel si les minuteurs sont ralentis (onglet en arrière-plan, machine lente)
    this.last = Date.now();
    this.interval = setInterval(() => this.loop(), TICK);
  }

  meta() {
    return {
      ids: this.ids,
      W: ARENA.W,
      H: ARENA.H,
      obstacles: ARENA.obstacles,
      phase: this.phase,
      winner: this.winner,
    };
  }

  input(pid, inp) {
    const f = this.fighters.find((x) => x.id === pid);
    if (!f || !inp) return;
    const clamp = (v) => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0);
    f.input = {
      up: inp.up ? 1 : 0,
      down: inp.down ? 1 : 0,
      left: inp.left ? 1 : 0,
      right: inp.right ? 1 : 0,
      // vue à la première personne : déplacement déjà orienté selon le regard
      mx: clamp(inp.mx),
      my: clamp(inp.my),
      angle: Number.isFinite(+inp.angle) ? +inp.angle : f.input.angle,
      shoot: !!inp.shoot,
      melee: !!inp.melee,
      dash: !!inp.dash,
    };
  }

  isAI(f) {
    const p = this.players.find((x) => x.id === f.id);
    return p.isBot || !p.connected;
  }

  emit(type, data) { this.events.push({ id: ++this.seq, type, ...data }); }

  think(f, enemy) {
    const ai = f.ai;
    ai.switchT -= DT;
    if (ai.switchT <= 0) {
      ai.strafe = Math.random() < 0.5 ? -1 : 1;
      ai.switchT = 0.6 + Math.random() * 1.2;
    }
    const dx = enemy.x - f.x;
    const dy = enemy.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const see = lineOfSight(f, enemy);
    // une caisse d'arme à portée : on va la chercher
    const crate = this.pickups.find((p) => Math.hypot(p.x - f.x, p.y - f.y) < 260);
    let mx = -ny * ai.strafe;
    let my = nx * ai.strafe;
    if (crate && f.weapon === 'pistol') {
      const cd = Math.hypot(crate.x - f.x, crate.y - f.y) || 1;
      mx = (crate.x - f.x) / cd;
      my = (crate.y - f.y) / cd;
    } else {
      // fusil à pompe ou ennemi blessé : on fonce au contact ; sinon on tourne autour à distance
      const want = !see ? 110 : f.weapon === 'shotgun' || enemy.hp < 35 ? 60 : 230;
      if (dist > want + 40) { mx += nx * 1.3; my += ny * 1.3; }
      if (dist < want - 60) { mx -= nx; my -= ny; }
    }
    if (blocked(f.x + mx * 20, f.y + my * 20, R)) { ai.strafe *= -1; mx = -mx; my = -my; }
    const noise = (Math.random() - 0.5) * 0.3;
    const danger = this.bullets.some((b) => b.owner !== f.id && Math.hypot(b.x - f.x, b.y - f.y) < 70);
    f.input = {
      up: my < -0.3 ? 1 : 0,
      down: my > 0.3 ? 1 : 0,
      left: mx < -0.3 ? 1 : 0,
      right: mx > 0.3 ? 1 : 0,
      angle: Math.atan2(dy, dx) + noise,
      shoot: see && (f.weapon === 'shotgun' ? dist < 230 : Math.random() < 0.55),
      melee: dist < MACHETE.reach + R,
      dash: (danger && Math.random() < 0.25) || (enemy.swing > 0 && dist < 80 && Math.random() < 0.3),
    };
  }

  hurt(victim, dmg, from, kind, knock = 0) {
    if (victim.hp <= 0) return;
    victim.hp = Math.max(0, victim.hp - dmg);
    victim.hitFlash = 0.12;
    if (knock) {
      victim.kx += Math.cos(from) * knock;
      victim.ky += Math.sin(from) * knock;
    }
    this.emit('hit', { victim: victim.id, x: Math.round(victim.x), y: Math.round(victim.y), a: +from.toFixed(2), dmg: Math.round(dmg), kind });
  }

  step() {
    this.time += DT;
    if (this.phase === 'intro') {
      if (this.time >= INTRO) { this.phase = 'countdown'; this.time = 0; }
      this.broadcast();
      return;
    }
    if (this.phase === 'countdown') {
      if (this.time >= COUNTDOWN) { this.phase = 'fight'; this.time = 0; }
      this.broadcast();
      return;
    }
    if (this.phase === 'over') {
      if (this.time >= OVER_DELAY) {
        this.stop();
        this.onEnd(this.winner);
      } else this.broadcast();
      return;
    }

    // caisses d'armes parachutées
    this.pickupT -= DT;
    if (this.pickupT <= 0 && this.pickups.length < 2) {
      this.pickupT = PICKUP_EVERY;
      for (let tries = 0; tries < 30; tries++) {
        const x = 120 + Math.random() * (ARENA.W - 240);
        const y = 60 + Math.random() * (ARENA.H - 120);
        if (!blocked(x, y, 26)) { this.pickups.push({ id: ++this.seq, x, y, kind: 'shotgun' }); this.emit('drop', { x: Math.round(x), y: Math.round(y) }); break; }
      }
    }

    const [a, b] = this.fighters;
    for (const f of this.fighters) {
      const enemy = f === a ? b : a;
      if (this.isAI(f)) this.think(f, enemy);
      const inp = f.input;
      f.cooldown = Math.max(0, f.cooldown - DT);
      f.meleeCd = Math.max(0, f.meleeCd - DT);
      f.swing = Math.max(0, f.swing - DT);
      f.dashCd = Math.max(0, f.dashCd - DT);
      f.hitFlash = Math.max(0, f.hitFlash - DT);
      f.angle = inp.angle;
      let vx = inp.right - inp.left + (inp.mx || 0);
      let vy = inp.down - inp.up + (inp.my || 0);
      const len = Math.hypot(vx, vy);
      if (len) { vx /= len; vy /= len; }
      if (inp.dash && f.dashCd === 0) {
        f.dashCd = DASH_COOLDOWN;
        f.dashT = DASH_TIME;
        f.dashDir = len ? [vx, vy] : [Math.cos(f.angle), Math.sin(f.angle)];
      }
      // blessé à mort, on se traîne
      let speed = SPEED * (f.hp < 25 ? 0.75 : 1);
      if (f.dashT > 0) {
        f.dashT -= DT;
        [vx, vy] = f.dashDir;
        speed = SPEED * 3.4;
      }
      const mvx = vx * speed * DT + f.kx * DT;
      const mvy = vy * speed * DT + f.ky * DT;
      f.kx *= 0.82;
      f.ky *= 0.82;
      if (!blocked(f.x + mvx, f.y, R)) f.x += mvx;
      if (!blocked(f.x, f.y + mvy, R)) f.y += mvy;

      // saignement
      if (f.bleed > 0) {
        f.bleed -= DT;
        f.hp = Math.max(0, f.hp - BLEED_DPS * DT);
      }

      // ramassage d'une caisse
      const pick = this.pickups.find((p) => Math.hypot(p.x - f.x, p.y - f.y) < R + 16);
      if (pick) {
        this.pickups = this.pickups.filter((p) => p !== pick);
        f.weapon = pick.kind;
        f.ammo = WEAPONS[pick.kind].ammo;
        this.emit('pickup', { pid: f.id, kind: pick.kind });
      }

      // tir
      if (inp.shoot && f.cooldown === 0) {
        const w = WEAPONS[f.weapon];
        f.cooldown = w.cooldown;
        for (let k = 0; k < w.pellets; k++) {
          const ang = f.angle + (Math.random() - 0.5) * 2 * w.spread;
          this.bullets.push({
            owner: f.id,
            x: f.x + Math.cos(f.angle) * (R + 8),
            y: f.y + Math.sin(f.angle) * (R + 8),
            vx: Math.cos(ang) * w.speed * (0.9 + Math.random() * 0.2),
            vy: Math.sin(ang) * w.speed * (0.9 + Math.random() * 0.2),
            life: w.life,
            dmg: w.damage,
            knock: w.knock,
            kind: f.weapon,
          });
        }
        this.emit('shot', { pid: f.id, kind: f.weapon, x: Math.round(f.x), y: Math.round(f.y), a: +f.angle.toFixed(2) });
        if (f.weapon === 'shotgun') {
          f.kx -= Math.cos(f.angle) * 140; // recul
          f.ky -= Math.sin(f.angle) * 140;
          if (--f.ammo <= 0) f.weapon = 'pistol';
        }
      }

      // coup de machette : arc devant soi
      if (inp.melee && f.meleeCd === 0) {
        f.meleeCd = MACHETE.cooldown;
        f.swing = 0.2;
        this.emit('swing', { pid: f.id, a: +f.angle.toFixed(2) });
        const d = Math.hypot(enemy.x - f.x, enemy.y - f.y);
        const dir = Math.atan2(enemy.y - f.y, enemy.x - f.x);
        if (enemy.dashT <= 0 && d < MACHETE.reach + R && Math.abs(angleDiff(dir, f.angle)) < MACHETE.arc) {
          this.hurt(enemy, MACHETE.damage, dir, 'slash', MACHETE.knock);
          enemy.bleed = MACHETE.bleed;
        }
      }
    }

    this.bullets = this.bullets.filter((bl) => {
      bl.x += bl.vx * DT;
      bl.y += bl.vy * DT;
      bl.life -= DT;
      if (bl.life <= 0) return false;
      if (blocked(bl.x, bl.y, BULLET_R)) { this.emit('ricochet', { x: Math.round(bl.x), y: Math.round(bl.y) }); return false; }
      for (const f of this.fighters) {
        if (f.id === bl.owner || f.dashT > 0 || f.hp <= 0) continue;
        if (Math.hypot(f.x - bl.x, f.y - bl.y) < R + BULLET_R) {
          this.hurt(f, bl.dmg, Math.atan2(bl.vy, bl.vx), bl.kind, bl.knock);
          return false;
        }
      }
      return true;
    });

    const dead = this.fighters.filter((f) => f.hp <= 0);
    if (dead.length || this.time >= DURATION) {
      let winner;
      if (dead.length === 1) winner = this.fighters.find((f) => f.hp > 0);
      else if (a.hp !== b.hp) winner = a.hp > b.hp ? a : b;
      else winner = Math.random() < 0.5 ? a : b;
      const loser = this.fighters.find((f) => f !== winner);
      loser.hp = 0;
      this.winner = winner.id;
      this.phase = 'over';
      this.time = 0;
      this.emit('death', { victim: loser.id, x: Math.round(loser.x), y: Math.round(loser.y), a: +Math.atan2(loser.y - winner.y, loser.x - winner.x).toFixed(2) });
    }
    this.broadcast();
  }

  loop() {
    const due = Math.min(30, Math.max(1, Math.floor((Date.now() - this.last) / TICK)));
    this.last = Math.max(this.last + due * TICK, Date.now() - TICK * 30);
    for (let i = 0; i < due && !this.stopped; i++) {
      this.silent = i < due - 1;
      this.step();
    }
    this.silent = false;
  }

  broadcast() {
    if (this.silent) return;
    const events = this.events;
    this.events = [];
    this.onTick({
      phase: this.phase,
      winner: this.winner,
      timeLeft: this.phase === 'fight' ? Math.max(0, DURATION - this.time)
        : this.phase === 'countdown' ? COUNTDOWN - this.time
          : this.phase === 'intro' ? INTRO - this.time
            : this.phase === 'over' ? Math.max(0, OVER_DELAY - this.time) : 0,
      fighters: this.fighters.map((f) => ({
        id: f.id, x: Math.round(f.x), y: Math.round(f.y), hp: Math.round(f.hp),
        angle: +f.angle.toFixed(2), dash: f.dashT > 0, dashCd: +f.dashCd.toFixed(2), hit: f.hitFlash > 0,
        weapon: f.weapon, ammo: f.ammo, swing: f.swing > 0, bleeding: f.bleed > 0,
      })),
      bullets: this.bullets.map((b) => [Math.round(b.x), Math.round(b.y), b.kind === 'shotgun' ? 1 : 0]),
      pickups: this.pickups.map((p) => [Math.round(p.x), Math.round(p.y), p.kind]),
      events,
    });
  }

  stop() {
    this.stopped = true;
    clearInterval(this.interval);
  }
}
