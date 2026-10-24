// Personnages : options, valeurs par défaut, personnages proposés et validation (communs au serveur et au client).

// ---------- options (servent aussi à l'éditeur et à la validation) ----------
export const OPTIONS = {
  build: { slim: 'Mince', normal: 'Normal', athletic: 'Athlétique', muscular: 'Bodybuilder', heavy: 'Corpulent' },
  hair: {
    bald: 'Chauve', buzz: 'Rasé court', short: 'Courts', receding: 'Dégarnis', slick: 'Plaqués en arrière', side: 'Raie sur le côté',
    quiff: 'Houppe', swoop: 'Mèche gonflée', messy: 'En bataille', curly: 'Bouclés', long: 'Longs', dreads: 'Dreadlocks',
  },
  beard: {
    none: 'Aucune', stubble: 'Barbe de 3 jours', full: 'Barbe', goatee: 'Bouc', mustache: 'Moustache',
    toothbrush: 'Petite moustache', pirate: 'Moustache + tresses',
  },
  glasses: { none: 'Aucune', rect: 'Lunettes', round: 'Rondes', sun: 'Lunettes de soleil', aviator: 'Aviateur' },
  hat: { none: 'Aucun', porkpie: 'Chapeau pork-pie', tricorn: 'Tricorne de pirate', cap: 'Casquette', beanie: 'Bonnet' },
  top: {
    tshirt: 'T-shirt', tank: 'Débardeur', shirt: 'Chemise', suit: 'Costume cravate', jacket: 'Veste', sweater: 'Pull',
    jersey: 'Maillot de foot', racing: 'Combinaison de course', military: 'Uniforme', pirate: 'Manteau de pirate',
  },
  extras: { chain: 'Chaîne et croix', beads: 'Perles dans les cheveux', bandana: 'Bandana', kohl: 'Yeux maquillés', earring: 'Boucle d’oreille' },
};

export const DEFAULT_CHARACTER = {
  build: 'normal', height: 1, skin: '#e0ac87', eyes: '#3b2a1e',
  hair: 'short', hairColor: '#4a3324', beard: 'none', beardColor: '#4a3324',
  glasses: 'none', lensColor: '#1f2937', hat: 'none', hatColor: '#1f2937',
  top: 'tshirt', topColor: '#2563eb', topColor2: '#ffffff', topColor3: '#facc15', number: '',
  stripes: false, pants: '#1e3a5f', shoes: '#1f2937', extras: [], twins: false,
};

// Les personnages proposés (silhouettes reconnaissables, sans logo ni symbole)
export const CHARACTERS = [
  { id: 'walter', name: 'Walter White', char: { skin: '#f1c7a5', hair: 'bald', beard: 'goatee', beardColor: '#7a6a5c', glasses: 'rect', lensColor: '#9fb0a0', hat: 'porkpie', hatColor: '#141414', top: 'jacket', topColor: '#2b2a26', topColor2: '#d9d4c7', pants: '#5b5446', shoes: '#3b2a1e' } },
  { id: 'saul', name: 'Saul Goodman', char: { skin: '#f0c4a0', hair: 'receding', hairColor: '#8b5a3c', top: 'suit', topColor: '#8ea4c8', topColor2: '#f2d16b', topColor3: '#9d174d', pants: '#8ea4c8', shoes: '#3b2a1e' } },
  { id: 'cr7', name: 'CR7', char: { build: 'athletic', height: 1.03, skin: '#d9a37c', hair: 'quiff', hairColor: '#1c1410', top: 'jersey', topColor: '#c8102e', topColor2: '#046a38', number: '7', pants: '#046a38', shoes: '#f5f5f5' } },
  { id: 'messi', name: 'Messi', char: { build: 'normal', height: 0.92, skin: '#e8b892', hair: 'short', hairColor: '#4a3324', beard: 'full', beardColor: '#4a3324', top: 'jersey', topColor: '#ffffff', topColor2: '#75aadb', stripes: true, number: '10', pants: '#111827', shoes: '#f59e0b' } },
  { id: 'hitler', name: 'Hitler', char: { skin: '#f1d0b5', hair: 'side', hairColor: '#1f1712', beard: 'toothbrush', beardColor: '#1f1712', top: 'military', topColor: '#7a6a4f', topColor2: '#2f2618', pants: '#3a3a35', shoes: '#111111' } },
  { id: 'trump', name: 'Trump', char: { build: 'heavy', height: 1.04, skin: '#f0a868', hair: 'swoop', hairColor: '#f2cf7a', top: 'suit', topColor: '#1e2a4a', topColor2: '#ffffff', topColor3: '#c8102e', pants: '#1e2a4a', shoes: '#111111' } },
  { id: 'epstein', name: 'Epstein', char: { skin: '#f0c8a8', hair: 'messy', hairColor: '#cfcfcf', top: 'sweater', topColor: '#1f2a44', topColor2: '#e5e7eb', pants: '#cbbf9f', shoes: '#5b4636' } },
  { id: 'tren', name: 'Tren Twins', char: { twins: true, build: 'muscular', skin: '#e9b48f', hair: 'short', hairColor: '#3b2a1e', beard: 'stubble', beardColor: '#3b2a1e', top: 'tank', topColor: '#111111', pants: '#4b5563', shoes: '#f5f5f5' } },
  { id: 'vin', name: 'Vin Diesel', char: { build: 'muscular', skin: '#c99a76', hair: 'bald', beard: 'stubble', beardColor: '#2b2118', top: 'tank', topColor: '#f5f5f5', pants: '#1f2f4f', shoes: '#111111', extras: ['chain'] } },
  { id: 'jack', name: 'Jack Sparrow', char: { build: 'slim', skin: '#c8956d', hair: 'dreads', hairColor: '#2a1d14', beard: 'pirate', beardColor: '#2a1d14', hat: 'tricorn', hatColor: '#3b2a1e', top: 'pirate', topColor: '#5b4632', topColor2: '#efe6d2', topColor3: '#9f1239', pants: '#3b2f2a', shoes: '#2b1d14', extras: ['bandana', 'kohl', 'beads'] } },
  { id: 'tyler', name: 'Tyler Durden', char: { build: 'athletic', skin: '#efc3a0', hair: 'messy', hairColor: '#8a6a45', glasses: 'sun', lensColor: '#b91c1c', top: 'jacket', topColor: '#991b1b', topColor2: '#e7dcc8', pants: '#3b3b3b', shoes: '#5b4636' } },
  { id: 'max', name: 'Max Verstappen', char: { skin: '#f1c7a5', hair: 'short', hairColor: '#5a3e2b', hat: 'cap', hatColor: '#1e2a5a', top: 'racing', topColor: '#1e2a5a', topColor2: '#dc2626', topColor3: '#facc15', number: '1', pants: '#1e2a5a', shoes: '#111827' } },
].map((c) => ({ ...c, char: { ...DEFAULT_CHARACTER, ...c.char } }));

// Validation d'une configuration reçue (serveur et client) : valeurs connues uniquement
export function cleanCharacter(c) {
  if (!c || typeof c !== 'object') return null;
  const color = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
  const pick = (v, list, d) => (Object.hasOwn(list, v) ? v : d);
  const D = DEFAULT_CHARACTER;
  return {
    build: pick(c.build, OPTIONS.build, D.build),
    height: Math.max(0.85, Math.min(1.1, +c.height || 1)),
    skin: color(c.skin, D.skin), eyes: color(c.eyes, D.eyes),
    hair: pick(c.hair, OPTIONS.hair, D.hair), hairColor: color(c.hairColor, D.hairColor),
    beard: pick(c.beard, OPTIONS.beard, D.beard), beardColor: color(c.beardColor, D.beardColor),
    glasses: pick(c.glasses, OPTIONS.glasses, D.glasses), lensColor: color(c.lensColor, D.lensColor),
    hat: pick(c.hat, OPTIONS.hat, D.hat), hatColor: color(c.hatColor, D.hatColor),
    top: pick(c.top, OPTIONS.top, D.top),
    topColor: color(c.topColor, D.topColor), topColor2: color(c.topColor2, D.topColor2), topColor3: color(c.topColor3, D.topColor3),
    number: String(c.number ?? '').replace(/[^0-9]/g, '').slice(0, 2),
    stripes: !!c.stripes,
    pants: color(c.pants, D.pants), shoes: color(c.shoes, D.shoes),
    extras: (Array.isArray(c.extras) ? c.extras : []).filter((e) => Object.hasOwn(OPTIONS.extras, e)).slice(0, 5),
    twins: !!c.twins,
  };
}
