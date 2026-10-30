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
  MAX_PLAYERS: 16,
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

// Roulette européenne (37 cases, de 0 à 36). Paris : un numéro (×36), une douzaine (×3),
// rouge/noir, pair/impair, manque/passe (×2). Le zéro fait perdre tous les paris simples.
export const ROULETTE = {
  ORDER: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
  REDS: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
  BETS: {
    red: { label: 'Rouge', mult: 2, wins: (n) => ROULETTE.REDS.includes(n) },
    black: { label: 'Noir', mult: 2, wins: (n) => n > 0 && !ROULETTE.REDS.includes(n) },
    even: { label: 'Pair', mult: 2, wins: (n) => n > 0 && n % 2 === 0 },
    odd: { label: 'Impair', mult: 2, wins: (n) => n % 2 === 1 },
    low: { label: '1 à 18', mult: 2, wins: (n) => n >= 1 && n <= 18 },
    high: { label: '19 à 36', mult: 2, wins: (n) => n >= 19 },
    d1: { label: '1re douzaine', mult: 3, wins: (n) => n >= 1 && n <= 12 },
    d2: { label: '2e douzaine', mult: 3, wins: (n) => n >= 13 && n <= 24 },
    d3: { label: '3e douzaine', mult: 3, wins: (n) => n >= 25 },
  },
};
export const rouletteColor = (n) => (n === 0 ? 'green' : ROULETTE.REDS.includes(n) ? 'red' : 'black');
// pari valide : une clé de BETS ou un numéro de 0 à 36
export const validRouletteBet = (on) => Object.hasOwn(ROULETTE.BETS, on) || (Number.isInteger(on) && on >= 0 && on <= 36);
export function roulettePayout(on, n, bet) {
  if (Number.isInteger(on)) return on === n ? bet * 36 : 0;
  const b = ROULETTE.BETS[on];
  return b && b.wins(n) ? bet * b.mult : 0;
}
export const rouletteBetLabel = (on) => (Number.isInteger(on) ? `le ${on}` : ROULETTE.BETS[on]?.label || '?');

// Dé spécial (carte Chance) : valeur fixe tirée au moment où l'on pioche la carte
export const SPECIAL_DIE = { MIN: 1, MAX: 12 };

export const PLAYER_COLORS = [
  '#ef4444', // rouge
  '#3b82f6', // bleu
  '#22c55e', // vert
  '#eab308', // jaune
  '#a855f7', // violet
  '#f97316', // orange
  '#ec4899', // rose
  '#06b6d4', // cyan
  // jusqu'à 16 joueurs : couleurs assez foncées pour la lettre blanche des pions
  '#0d9488', // sarcelle
  '#65a30d', // vert pomme
  '#92400e', // brun
  '#1e40af', // bleu marine
  '#9f1239', // bordeaux
  '#475569', // ardoise
  '#c026d3', // fuchsia
  '#4f46e5', // indigo
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
  // pays du grand plateau
  mexico: { name: 'Mexique', code: 'mx', color: '#a3e635', housePrice: 50 },
  india: { name: 'Inde', code: 'in', color: '#f59e0b', housePrice: 100 },
  russia: { name: 'Russie', code: 'ru', color: '#94a3b8', housePrice: 150 },
  uk: { name: 'Royaume-Uni', code: 'gb', color: '#14b8a6', housePrice: 200 },
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

// Grand plateau : 56 cases (13 par côté), 4 pays en plus, une Chance, une Caisse, un aéroport… et une 3e compagnie
export const BIG_BOARD = [
  { type: 'go', name: 'Départ' },
  city('Rio de Janeiro', 'brazil', 60, [2, 10, 30, 90, 160, 250]),
  { type: 'chest', name: 'Caisse de communauté' },
  city('São Paulo', 'brazil', 60, [4, 20, 60, 180, 320, 450]),
  { type: 'tax', name: 'Impôt sur le revenu', amount: 200 },
  airport('Aéroport de Dubaï', 'DXB'),
  city('Guadalajara', 'mexico', 80, [5, 25, 75, 225, 360, 500]),
  { type: 'chance', name: 'Chance' },
  city('Monterrey', 'mexico', 80, [5, 25, 75, 225, 360, 500]),
  city('Mexico', 'mexico', 100, [6, 30, 90, 270, 400, 550]),
  { type: 'casino', name: 'Casino de Macao' },
  city('Pékin', 'china', 100, [6, 30, 90, 270, 400, 550]),
  { type: 'chest', name: 'Caisse de communauté' },
  city('Hong Kong', 'china', 120, [8, 40, 100, 300, 450, 600]),
  { type: 'jail', name: 'Prison' },
  city('Bangalore', 'india', 140, [10, 50, 150, 450, 625, 750]),
  utility("Compagnie d'électricité", '⚡'),
  city('Bombay', 'india', 140, [10, 50, 150, 450, 625, 750]),
  city('Delhi', 'india', 160, [12, 60, 180, 500, 700, 900]),
  airport('Aéroport Charles de Gaulle', 'CDG'),
  city('Séville', 'spain', 180, [14, 70, 200, 550, 750, 950]),
  { type: 'chance', name: 'Chance' },
  city('Madrid', 'spain', 180, [14, 70, 200, 550, 750, 950]),
  city('Barcelone', 'spain', 200, [16, 80, 220, 600, 800, 1000]),
  city('Hambourg', 'germany', 200, [16, 80, 220, 600, 800, 1000]),
  { type: 'chest', name: 'Caisse de communauté' },
  city('Munich', 'germany', 200, [16, 80, 220, 600, 800, 1000]),
  city('Berlin', 'germany', 220, [18, 90, 250, 700, 875, 1050]),
  { type: 'parking', name: 'Parc gratuit' },
  city('Kazan', 'russia', 220, [18, 90, 250, 700, 875, 1050]),
  { type: 'chance', name: 'Chance' },
  city('Saint-Pétersbourg', 'russia', 220, [18, 90, 250, 700, 875, 1050]),
  city('Moscou', 'russia', 240, [20, 100, 300, 750, 925, 1100]),
  airport('Aéroport JFK', 'JFK'),
  city('Milan', 'italy', 260, [22, 110, 330, 800, 975, 1150]),
  city('Venise', 'italy', 260, [22, 110, 330, 800, 975, 1150]),
  utility('Compagnie des eaux', '💧'),
  city('Rome', 'italy', 280, [24, 120, 360, 850, 1025, 1200]),
  city('Osaka', 'japan', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: 'chest', name: 'Caisse de communauté' },
  city('Kyoto', 'japan', 280, [24, 120, 360, 850, 1025, 1200]),
  city('Tokyo', 'japan', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: 'gotojail', name: 'Allez en prison' },
  city('Manchester', 'uk', 300, [26, 130, 390, 900, 1100, 1275]),
  city('Liverpool', 'uk', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: 'chance', name: 'Chance' },
  city('Londres', 'uk', 320, [28, 150, 450, 1000, 1200, 1400]),
  airport('Aéroport de Haneda', 'HND'),
  city('Marseille', 'france', 320, [28, 150, 450, 1000, 1200, 1400]),
  utility('Compagnie du gaz', '🔥'),
  city('Lyon', 'france', 320, [28, 150, 450, 1000, 1200, 1400]),
  city('Paris', 'france', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: 'chance', name: 'Chance' },
  city('Los Angeles', 'usa', 380, [40, 185, 550, 1200, 1450, 1700]),
  { type: 'tax', name: 'Taxe de luxe', amount: 100 },
  city('New York', 'usa', 450, [55, 220, 650, 1500, 1800, 2100]),
].map((c, i) => ({ ...c, index: i }));

// Toutes les infos dérivées d'un plateau : cases, propriétés, pays présents, cases spéciales
function describe(cells) {
  const n = cells.length;
  const countryCells = {};
  for (const c of cells) if (c.country) (countryCells[c.country] ||= []).push(c.index);
  return {
    cells, n,
    side: n / 4, // cases par côté, coin compris
    ownable: cells.filter((c) => c.price).map((c) => c.index),
    countryCells,
    jail: cells.findIndex((c) => c.type === 'jail'),
    gotojail: cells.findIndex((c) => c.type === 'gotojail'),
    find: (name) => cells.find((c) => c.name === name)?.index,
  };
}
export const BOARDS = { classic: describe(BOARD), big: describe(BIG_BOARD) };
// plateau d'une partie, selon ses réglages (le grand plateau est une option du lobby)
export const boardFor = (settings) => (settings?.bigBoard ? BOARDS.big : BOARDS.classic);
export const boardOf = (state) => boardFor(state?.settings);

export const OWNABLE = BOARDS.classic.ownable;
export const COUNTRY_CELLS = BOARDS.classic.countryCells;

export const AIRPORT_RENTS = [25, 50, 100, 200];

export function housePrice(cell) {
  return cell.type === 'city' ? COUNTRIES[cell.country].housePrice : 0;
}

// Prix de revente d'une propriété à la banque
export function resaleValue(cell) {
  return Math.round((cell.price || 0) * RULES.RESALE_RATIO);
}

// Distance circulaire minimale entre deux cases
export function boardDistance(a, b, n = 40) {
  const d = Math.abs(a - b) % n;
  return Math.min(d, n - d);
}
