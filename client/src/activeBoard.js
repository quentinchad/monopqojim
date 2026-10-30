// Plateau de la partie affichée (classique ou grand). Les composants importent BOARD, COUNTRY_CELLS…
// d'ici : ce sont des liaisons vivantes, mises à jour par useActiveBoard avant le rendu du plateau.
import { BOARDS, boardFor } from '../../shared/board.js';
import { setBoardSide } from './layout.js';

export let BOARD = BOARDS.classic.cells;
export let COUNTRY_CELLS = BOARDS.classic.countryCells;
export let OWNABLE = BOARDS.classic.ownable;
export let BOARD_N = BOARDS.classic.n;
export let JAIL = BOARDS.classic.jail;
export let GOTOJAIL = BOARDS.classic.gotojail;

export function setActiveBoard(settings) {
  const b = boardFor(settings);
  BOARD = b.cells;
  COUNTRY_CELLS = b.countryCells;
  OWNABLE = b.ownable;
  BOARD_N = b.n;
  JAIL = b.jail;
  GOTOJAIL = b.gotojail;
  setBoardSide(b.side + 1);
}

// à appeler en tête du composant de partie : le plateau est réglé avant que ses enfants ne s'affichent
export const useActiveBoard = (state) => setActiveBoard(state?.settings);
