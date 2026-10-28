// Données du plateau partagées entre le serveur et le client.

export const RULES = {
  START_MONEY: 1500,
  GO_SALARY: 200,
  JAIL_POSITION: 10,
  GO_TO_JAIL_POSITION: 30,
  JAIL_FINE: 50,
  JAIL_TURNS: 3,
  // Trafic de drogue : peine doublée et bonus au passage par la case Départ
  TRAFFIC_JAIL_TURNS: 6,
  // Simple visite de la prison : le visiteur détrousse chaque prisonnier
  JAIL_VISIT_STEAL: 150,
  TRAFFIC_BONUS: 300,
  // Détournement d'avion : prix fixe, payé avant de savoir sur quelle ville adverse l'avion s'écrase
  HIJACK_PRICE: 150,
  HIJACK_PRICE_OWN: 50, // depuis un aéroport que l'on possède
  // Régime de Vichy : durée de l'alliance, en tours de table
  VICHY_ROUNDS: 5,
  // Goulag : argent rendu au gagnant du combat
  GOULAG_RETURN_MONEY: 1000,
  MAX_PLAYERS: 8,
  // Revente d'une propriété à la banque : ce pourcentage de son prix d'achat
  RESALE_RATIO: 0.5,
};

// Casino : machine à sous à 3 rouleaux, jusqu'à MAX_SPINS parties par arrêt sur la case.
// Trois symboles identiques : mise × multiplicateur du symbole ; deux identiques : mise × PAIR.
// Les rouleaux sont tirés au hasard de façon uniforme (espérance de gain ≈ 95 % de la mise).
export const CASINO = {
  MAX_SPINS: 5,
  PAIR: 1.5,
  SYMBOLS: [
    { s: '🍒', mult: 5 },
    { s: '🍋', mult: 8 },
    { s: '🍉', mult: 10 },
    { s: '🔔', mult: 12 },
    { s: '💎', mult: 15 },
    { s: '7️⃣', mult: 20 },
  ],
};

// Gain d'une combinaison de rouleaux (indices de CASINO.SYMBOLS) pour une mise donnée
export function casinoPayout(reels, bet) {
  const [a, b, c] = reels;
  if (a === b && b === c) return bet * CASINO.SYMBOLS[a].mult;
  if (a === b || b === c || a === c) return Math.floor(bet * CASINO.PAIR);
  return 0;
}

export const PLAYER_COLORS = [
  '#ef4444', // rouge
  '#3b82f6', // bleu
  '#22c55e', // vert
  '#eab308', // jaune
  '#a855f7', // violet
  '#f97316', // orange
  '#ec4899', // rose
  '#06b6d4', // cyan
];

export const COUNTRIES = {
  brazil: { name: 'Brésil', code: 'br', color: '#8d5524', housePrice: 50 },
  china: { name: 'Chine', code: 'cn', color: '#7dd3fc', housePrice: 50 },
  spain: { name: 'Espagne', code: 'es', color: '#e879f9', housePrice: 100 },
  germany: { name: 'Allemagne', code: 'de', color: '#fb923c', housePrice: 100 },
  italy: { name: 'Italie', code: 'it', color: '#f43f5e', housePrice: 150 },
  japan: { name: 'Japon', code: 'jp', color: '#facc15', housePrice: 150 },
  france: { name: 'France', code: 'fr', color: '#4ade80', housePrice: 200 },
  usa: { name: 'États-Unis', code: 'us', color: '#2563eb', housePrice: 200 },
};

const city = (name, country, price, rents) => ({
  type: 'city', name, country, price, rents,
});
const airport = (name, code) => ({ type: 'airport', name, code, price: 200 });
const utility = (name, icon) => ({ type: 'utility', name, icon, price: 150 });

export const BOARD = [
  { type: 'go', name: 'Départ' },
  city('Rio de Janeiro', 'brazil', 60, [2, 10, 30, 90, 160, 250]),
  { type: 'chest', name: 'Caisse de communauté' },
  city('São Paulo', 'brazil', 60, [4, 20, 60, 180, 320, 450]),
  { type: 'tax', name: 'Impôt sur le revenu', amount: 200 },
  airport('Aéroport de Dubaï', 'DXB'),
  city('Pékin', 'china', 100, [6, 30, 90, 270, 400, 550]),
  { type: 'chance', name: 'Chance' },
  { type: 'casino', name: 'Casino de Macao' },
  city('Hong Kong', 'china', 120, [8, 40, 100, 300, 450, 600]),
  { type: 'jail', name: 'Prison' },
  city('Séville', 'spain', 140, [10, 50, 150, 450, 625, 750]),
  utility("Compagnie d'électricité", '⚡'),
  city('Madrid', 'spain', 140, [10, 50, 150, 450, 625, 750]),
  city('Barcelone', 'spain', 160, [12, 60, 180, 500, 700, 900]),
  airport('Aéroport Charles de Gaulle', 'CDG'),
  city('Hambourg', 'germany', 180, [14, 70, 200, 550, 750, 950]),
  { type: 'chest', name: 'Caisse de communauté' },
  city('Munich', 'germany', 180, [14, 70, 200, 550, 750, 950]),
  city('Berlin', 'germany', 200, [16, 80, 220, 600, 800, 1000]),
  { type: 'parking', name: 'Parc gratuit' },
  city('Milan', 'italy', 220, [18, 90, 250, 700, 875, 1050]),
  { type: 'chance', name: 'Chance' },
  city('Venise', 'italy', 220, [18, 90, 250, 700, 875, 1050]),
  city('Rome', 'italy', 240, [20, 100, 300, 750, 925, 1100]),
  airport('Aéroport JFK', 'JFK'),
  city('Osaka', 'japan', 260, [22, 110, 330, 800, 975, 1150]),
  city('Kyoto', 'japan', 260, [22, 110, 330, 800, 975, 1150]),
  utility('Compagnie des eaux', '💧'),
  city('Tokyo', 'japan', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: 'gotojail', name: 'Allez en prison' },
  city('Marseille', 'france', 300, [26, 130, 390, 900, 1100, 1275]),
  city('Lyon', 'france', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: 'chest', name: 'Caisse de communauté' },
  city('Paris', 'france', 320, [28, 150, 450, 1000, 1200, 1400]),
  airport('Aéroport de Haneda', 'HND'),
  { type: 'chance', name: 'Chance' },
  city('Los Angeles', 'usa', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: 'tax', name: 'Taxe de luxe', amount: 100 },
  city('New York', 'usa', 400, [50, 200, 600, 1400, 1700, 2000]),
].map((c, i) => ({ ...c, index: i }));

export const OWNABLE = BOARD.filter((c) => c.price).map((c) => c.index);

export const COUNTRY_CELLS = Object.fromEntries(
  Object.keys(COUNTRIES).map((k) => [k, BOARD.filter((c) => c.country === k).map((c) => c.index)])
);

export const AIRPORT_RENTS = [25, 50, 100, 200];

export function housePrice(cell) {
  return cell.type === 'city' ? COUNTRIES[cell.country].housePrice : 0;
}

// Prix de revente d'une propriété à la banque
export function resaleValue(cell) {
  return Math.round((cell.price || 0) * RULES.RESALE_RATIO);
}

// Distance circulaire minimale entre deux cases
export function boardDistance(a, b) {
  const d = Math.abs(a - b) % 40;
  return Math.min(d, 40 - d);
}
