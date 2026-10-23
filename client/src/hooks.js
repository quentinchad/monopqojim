import { useEffect, useRef, useState } from 'react';

const DICE_DELAY = 700; // laisse les dés finir de rouler avant que le pion bouge
const STEP_MS = 125;

// Fait avancer les pions case par case jusqu'à leur position réelle.
// Renvoie aussi `animating` : vrai tant qu'un pion n'a pas atteint sa case,
// pour n'afficher les infos (achat, carte…) qu'une fois le pion arrivé.
export function useAnimatedPositions(players) {
  const [disp, setDisp] = useState(() => Object.fromEntries(players.map((p) => [p.id, p.pos])));
  const targets = useRef({}); // id -> { to, startAt, jump }
  const sig = players.map((p) => `${p.id}:${p.pos}:${p.jail.in}`).join('|');

  useEffect(() => {
    const now = Date.now();
    for (const p of players) {
      const cur = disp[p.id] ?? p.pos;
      const dist = (p.pos - cur + 40) % 40;
      if (dist === 0) { delete targets.current[p.id]; continue; }
      const prev = targets.current[p.id];
      const startAt = prev ? prev.startAt : now + DICE_DELAY;
      // envoyé en prison : le pion avance d'abord jusqu'à la case qui l'y envoie, puis saute en prison
      const jailed = p.jail.in && p.pos === 10;
      if (jailed && p.jailFrom != null && p.jailFrom !== 10) {
        const toFrom = (p.jailFrom - cur + 40) % 40;
        if (toFrom > 0 && toFrom <= 12) {
          targets.current[p.id] = { to: p.jailFrom, jump: false, startAt, then: 10 };
          continue;
        }
      }
      // téléportations : prison, recul de 3 cases
      const jump = dist > 36 || jailed;
      targets.current[p.id] = { to: p.pos, jump, startAt };
    }
  }, [sig]);

  useEffect(() => {
    const iv = setInterval(() => {
      const t = targets.current;
      if (!Object.keys(t).length) return;
      const now = Date.now();
      setDisp((d) => {
        const next = { ...d };
        for (const [id, tg] of Object.entries(t)) {
          if (now < tg.startAt) continue;
          if (tg.jump || next[id] == null) next[id] = tg.to;
          else if (next[id] !== tg.to) next[id] = (next[id] + 1) % 40;
          if (next[id] === tg.to) {
            // étape suivante éventuelle (prison) après une courte pause sur la case
            if (tg.then != null) t[id] = { to: tg.then, jump: true, startAt: now + 500 };
            else delete t[id];
          }
        }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(iv);
  }, []);

  const animating = players.some((p) => p.status === 'alive' && (disp[p.id] ?? p.pos) !== p.pos);
  return [disp, animating];
}

export function useElementSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return size;
}
