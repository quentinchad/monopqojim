// Combat du goulag : duel en arène vue de dessus, simulé par le serveur à 30 images/s.
// Commandes : ZQSD / WASD / flèches pour bouger, souris pour viser, clic pour tirer, Espace pour esquiver (dash).

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
const BULLET_SPEED = 620;
const BULLET_R = 5;
const DAMAGE = 10;
const FIRE_COOLDOWN = 0.26;
const DASH_COOLDOWN = 1.4;
const DASH_TIME = 0.16;
const COUNTDOWN = 3.5;
const DURATION = 75;
const OVER_DELAY = 3.5;

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

export class Fight {
  constructor(players, { onTick, onEnd }) {
    this.players = players;
    this.ids = players.map((p) => p.id);
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.phase = 'countdown';
    this.time = 0;
    this.winner = null;
    this.bullets = [];
    this.fighters = players.map((p, i) => ({
      id: p.id,
      x: i === 0 ? 80 : ARENA.W - 80,
      y: ARENA.H / 2,
      hp: 100,
      angle: i === 0 ? 0 : Math.PI,
      cooldown: 0,
      dashCd: 0,
      dashT: 0,
      dashDir: [0, 0],
      input: { up: 0, down: 0, left: 0, right: 0, angle: i === 0 ? 0 : Math.PI, shoot: false, dash: false },
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
    f.input = {
      up: inp.up ? 1 : 0,
      down: inp.down ? 1 : 0,
      left: inp.left ? 1 : 0,
      right: inp.right ? 1 : 0,
      angle: Number.isFinite(+inp.angle) ? +inp.angle : f.input.angle,
      shoot: !!inp.shoot,
      dash: !!inp.dash,
    };
  }

  isAI(f) {
    const p = this.players.find((x) => x.id === f.id);
    return p.isBot || !p.connected;
  }

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
    // se rapproche si pas de visibilité ou trop loin, recule si trop près, sinon tourne autour
    let mx = -ny * ai.strafe;
    let my = nx * ai.strafe;
    const want = see ? 260 : 120;
    if (dist > want + 40) { mx += nx * 1.2; my += ny * 1.2; }
    if (dist < want - 60) { mx -= nx; my -= ny; }
    // éviter de rester coincé contre un obstacle
    if (blocked(f.x + mx * 20, f.y + my * 20, R)) { ai.strafe *= -1; mx = -mx; my = -my; }
    const noise = (Math.random() - 0.5) * 0.35;
    const danger = this.bullets.some((b) => b.owner !== f.id && Math.hypot(b.x - f.x, b.y - f.y) < 70);
    f.input = {
      up: my < -0.3 ? 1 : 0,
      down: my > 0.3 ? 1 : 0,
      left: mx < -0.3 ? 1 : 0,
      right: mx > 0.3 ? 1 : 0,
      angle: Math.atan2(dy, dx) + noise,
      shoot: see && Math.random() < 0.55,
      dash: danger && Math.random() < 0.25,
    };
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

  step() {
    this.time += DT;
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

    const [a, b] = this.fighters;
    for (const f of this.fighters) {
      const enemy = f === a ? b : a;
      if (this.isAI(f)) this.think(f, enemy);
      const inp = f.input;
      f.cooldown = Math.max(0, f.cooldown - DT);
      f.dashCd = Math.max(0, f.dashCd - DT);
      f.hitFlash = Math.max(0, f.hitFlash - DT);
      f.angle = inp.angle;
      let vx = inp.right - inp.left;
      let vy = inp.down - inp.up;
      const len = Math.hypot(vx, vy);
      if (len) { vx /= len; vy /= len; }
      if (inp.dash && f.dashCd === 0) {
        f.dashCd = DASH_COOLDOWN;
        f.dashT = DASH_TIME;
        f.dashDir = len ? [vx, vy] : [Math.cos(f.angle), Math.sin(f.angle)];
      }
      let speed = SPEED;
      if (f.dashT > 0) {
        f.dashT -= DT;
        [vx, vy] = f.dashDir;
        speed = SPEED * 3.4;
      }
      const nx = f.x + vx * speed * DT;
      if (!blocked(nx, f.y, R)) f.x = nx;
      const ny = f.y + vy * speed * DT;
      if (!blocked(f.x, ny, R)) f.y = ny;
      if (inp.shoot && f.cooldown === 0) {
        f.cooldown = FIRE_COOLDOWN;
        this.bullets.push({
          owner: f.id,
          x: f.x + Math.cos(f.angle) * (R + 6),
          y: f.y + Math.sin(f.angle) * (R + 6),
          vx: Math.cos(f.angle) * BULLET_SPEED,
          vy: Math.sin(f.angle) * BULLET_SPEED,
          life: 1.4,
        });
      }
    }

    this.bullets = this.bullets.filter((bl) => {
      bl.x += bl.vx * DT;
      bl.y += bl.vy * DT;
      bl.life -= DT;
      if (bl.life <= 0 || blocked(bl.x, bl.y, BULLET_R)) return false;
      for (const f of this.fighters) {
        if (f.id === bl.owner || f.dashT > 0) continue;
        if (Math.hypot(f.x - bl.x, f.y - bl.y) < R + BULLET_R) {
          f.hp = Math.max(0, f.hp - DAMAGE);
          f.hitFlash = 0.15;
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
      this.winner = winner.id;
      this.phase = 'over';
      this.time = 0;
    }
    this.broadcast();
  }

  broadcast() {
    if (this.silent) return;
    this.onTick({
      phase: this.phase,
      winner: this.winner,
      timeLeft: this.phase === 'fight' ? Math.max(0, DURATION - this.time) : this.phase === 'countdown' ? COUNTDOWN - this.time : 0,
      fighters: this.fighters.map((f) => ({
        id: f.id, x: Math.round(f.x), y: Math.round(f.y), hp: f.hp,
        angle: +f.angle.toFixed(2), dash: f.dashT > 0, dashCd: +f.dashCd.toFixed(2), hit: f.hitFlash > 0,
      })),
      bullets: this.bullets.map((b) => [Math.round(b.x), Math.round(b.y)]),
    });
  }

  stop() {
    this.stopped = true;
    clearInterval(this.interval);
  }
}
