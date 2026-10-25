// Fonctions d'aide côté client pour calculer loyers et infos d'affichage.
import { BOARD, COUNTRIES, COUNTRY_CELLS, AIRPORT_RENTS } from '../../shared/board.js';

export const money = (n) => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('fr-FR')} $`;

export function ownsCountry(state, pid, country) {
  return COUNTRY_CELLS[country].every((i) => state.props[i]?.owner === pid);
}

export function groupHasBuildings(state, index) {
  const c = BOARD[index];
  return c.type === 'city' && COUNTRY_CELLS[c.country].some((i) => state.props[i]?.houses > 0);
}

// Loyer actuel (pour les compagnies : multiplicateur affiché)
export function currentRent(state, index) {
  const cell = BOARD[index];
  const prop = state.props[index];
  if (!prop?.owner) return null;
  if (cell.type === 'city') {
    if (prop.houses > 0) return money(cell.rents[prop.houses]);
    return money(cell.rents[0] * (ownsCountry(state, prop.owner, cell.country) ? 2 : 1));
  }
  if (cell.type === 'airport') {
    const n = BOARD.filter((c) => c.type === 'airport' && state.props[c.index]?.owner === prop.owner).length;
    return money(AIRPORT_RENTS[n - 1]);
  }
  if (cell.type === 'utility') {
    const n = BOARD.filter((c) => c.type === 'utility' && state.props[c.index]?.owner === prop.owner).length;
    return `${n === 2 ? 10 : 4}× dés`;
  }
  return null;
}

export function countryOf(cell) {
  return cell.country ? COUNTRIES[cell.country] : null;
}

export const playerById = (state, id) => state.players.find((p) => p.id === id);

// Classement final : le vainqueur, puis les joueurs éliminés du plus tard au plus tôt
export function finalRanking(state) {
  const ps = state.stats?.players || {};
  return [...state.players].sort((a, b) => {
    if (a.id === state.winner) return -1;
    if (b.id === state.winner) return 1;
    return (ps[b.id]?.outTurn ?? Infinity) - (ps[a.id]?.outTurn ?? Infinity);
  });
}
