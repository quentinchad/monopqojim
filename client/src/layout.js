// Géométrie du plateau : 11 × 11 cases, les coins font 1.6 unité, les autres 1 unité.
export const CORNER = 1.6;
export const TOTAL = CORNER * 2 + 9; // 12.2 unités

const colStart = (c) => (c === 0 ? 0 : CORNER + (c - 1)); // c : 0..10
const colWidth = (c) => (c === 0 || c === 10 ? CORNER : 1);

export function cellGrid(i) {
  if (i === 0) return { col: 10, row: 10, side: 'corner' };
  if (i < 10) return { col: 10 - i, row: 10, side: 'bottom' };
  if (i === 10) return { col: 0, row: 10, side: 'corner' };
  if (i < 20) return { col: 0, row: 20 - i, side: 'left' };
  if (i === 20) return { col: 0, row: 0, side: 'corner' };
  if (i < 30) return { col: i - 20, row: 0, side: 'top' };
  if (i === 30) return { col: 10, row: 0, side: 'corner' };
  return { col: 10, row: i - 30, side: 'right' };
}

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
