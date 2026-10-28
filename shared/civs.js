// Civilisations : purement esthétiques, elles changent le style des bâtiments (5 niveaux, du plus modeste
// au monument). Communes au serveur (validation) et au client (affichage).
export const CIVS = {
  classique: { name: 'Classique', icon: '🏠', levels: ['Maisonnette', 'Maison', 'Villa', 'Manoir', 'Hôtel'] },
  rome: { name: 'Rome antique', icon: '🏛️', levels: ['Domus', 'Villa à colonnes', 'Temple', 'Arc de triomphe', 'Colisée'] },
  egypte: { name: 'Égypte ancienne', icon: '🐫', levels: ['Maison de terre', 'Maison à terrasse', 'Obélisque', 'Temple', 'Grande pyramide'] },
  japon: { name: 'Japon féodal', icon: '⛩️', levels: ['Minka', 'Machiya', 'Sanctuaire', 'Pagode', 'Château'] },
  medieval: { name: 'Moyen Âge', icon: '🏰', levels: ['Chaumière', 'Maison à colombages', 'Tour', 'Donjon', 'Château fort'] },
  maya: { name: 'Mayas', icon: '🗿', levels: ['Hutte', 'Maison de pierre', 'Autel', 'Temple', 'Pyramide à degrés'] },
};

export const DEFAULT_CIV = 'classique';
export const cleanCiv = (c) => (Object.hasOwn(CIVS, c) ? c : DEFAULT_CIV);
export const randomCiv = () => {
  const ids = Object.keys(CIVS);
  return ids[Math.floor(Math.random() * ids.length)];
};
// civilisation affichée pour un joueur (la règle peut être désactivée par l'hôte)
export const civOf = (state, pid) => {
  if (state?.settings?.civs === false) return DEFAULT_CIV;
  return cleanCiv(state?.players?.find((p) => p.id === pid)?.civ);
};
