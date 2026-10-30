// Géométrie du plateau : SIDE × SIDE cases (11 sur le plateau classique, 15 sur le grand),
// les coins font 1.6 unité, les autres 1 unité. Réglée par setBoardSide quand une partie s'affiche.
export const CORNER = 1.6;
export let SIDE = 11;
export let TOTAL = CORNER * 2 + SIDE - 2; // 12.2 unités sur le plateau classique
let S = SIDE - 1; // index du dernier rang

export function setBoardSide(side) {
  if (side === SIDE) return;
  SIDE = side;
  S = side - 1;
  TOTAL = CORNER * 2 + side - 2;
}

const colStart = (c) => (c === 0 ? 0 : CORNER + (c - 1)); // c : 0..S
const colWidth = (c) => (c === 0 || c === S ? CORNER : 1);

export function cellGrid(i) {
  if (i === 0) return { col: S, row: S, side: 'corner' };
  if (i < S) return { col: S - i, row: S, side: 'bottom' };
  if (i === S) return { col: 0, row: S, side: 'corner' };
  if (i < 2 * S) return { col: 0, row: 2 * S - i, side: 'left' };
  if (i === 2 * S) return { col: 0, row: 0, side: 'corner' };
  if (i < 3 * S) return { col: i - 2 * S, row: 0, side: 'top' };
  if (i === 3 * S) return { col: S, row: 0, side: 'corner' };
  return { col: S, row: i - 3 * S, side: 'right' };
}

// orientation d'un coin (0 : Départ, 1 : prison, 2 : parc, 3 : allez en prison)
export const cornerRank = (i) => i / S;

// Rectangle d'une case en unités de plateau (origine en haut à gauche)
export function cellRect(i) {
  const { col, row, side } = cellGrid(i);
  return { x: colStart(col), y: colStart(row), w: colWidth(col), h: colWidth(row), side };
}

export function cellCenter(i) {
  const r = cellRect(i);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export const pct = (u) => `${(u / TOTAL) * 100}%`;

// Décalage des pions quand plusieurs joueurs sont sur la même case
export function tokenOffset(k, n) {
  if (n <= 1) return { dx: 0, dy: 0 };
  const a = (k / n) * Math.PI * 2 - Math.PI / 2;
  const r = n <= 2 ? 0.2 : 0.27;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
}
