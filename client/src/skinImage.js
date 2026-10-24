// Analyse de l'image d'un pion personnalisé : couleurs dominantes, teinte de peau, et détection
// automatique du gabarit (personnage, animal, véhicule, objet).
// La détection utilise MobileNet (TensorFlow.js, chargé à la demande depuis un CDN) ; sans réseau
// ou en cas d'échec, une estimation simple sur la proportion de peau prend le relais.

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Pixels de l'image ; `center` limite au disque central (le sujet est en général au milieu du cadrage)
function pixels(canvas, size = 48, center = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size).data;
  const out = [];
  const r2 = (center * size / 2) ** 2;
  for (let i = 0; i < d.length; i += 4) {
    const x = (i / 4) % size - size / 2 + 0.5;
    const y = Math.floor(i / 4 / size) - size / 2 + 0.5;
    if (d[i + 3] > 200 && x * x + y * y <= r2) out.push([d[i], d[i + 1], d[i + 2]]);
  }
  return out;
}

const isSkin = ([r, g, b]) => r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 15 && r > g && r > b;

// k-moyennes sur les pixels : couleurs dominantes triées par importance
export function dominantColors(canvas, k = 4) {
  const px = pixels(canvas, 48, 0.55);
  if (!px.length) return ['#888888'];
  let centers = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)].slice());
  let counts = [];
  for (let it = 0; it < 8; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let best = 0;
      let bd = Infinity;
      centers.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      });
      const s = sums[best];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    centers = sums.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[j]));
    counts = sums.map((s) => s[3]);
  }
  return centers.map((c, j) => ({ c, n: counts[j] })).sort((a, b) => b.n - a.n).map(({ c }) => hex(...c));
}

// Couleur la plus « vive » parmi les couleurs bien présentes (carrosserie, pelage…) plutôt que le fond
export function vividColor(canvas) {
  const px = pixels(canvas, 48, 0.75);
  const sat = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) || 1);
  const buckets = {};
  for (const p of px) {
    if (sat(p) < 0.35 || Math.max(...p) < 60) continue;
    const key = p.map((v) => Math.floor(v / 48)).join();
    (buckets[key] ||= []).push(p);
  }
  const best = Object.values(buckets).sort((a, b) => b.length - a.length)[0];
  if (!best || best.length < px.length * 0.06) return null;
  return hex(...[0, 1, 2].map((k) => best.reduce((s, p) => s + p[k], 0) / best.length));
}

export function skinInfo(canvas) {
  const px = pixels(canvas);
  const sk = px.filter(isSkin);
  const ratio = px.length ? sk.length / px.length : 0;
  const avg = sk.length ? sk.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / sk.length) : null;
  return { ratio, tone: avg ? hex(...avg) : null };
}

// ---------- détection automatique ----------
const ANIMALS = ['dog', 'terrier', 'retriever', 'spaniel', 'hound', 'poodle', 'shepherd', 'collie', 'bulldog', 'pug', 'chihuahua',
  'husky', 'malamute', 'setter', 'pointer', 'schnauzer', 'beagle', 'corgi', 'dalmatian', 'boxer', 'mastiff', 'pinscher', 'labrador',
  'rottweiler', 'doberman', 'pomeranian', 'samoyed', 'chow', 'shih-tzu', 'maltese', 'papillon', 'basset', 'bloodhound', 'whippet',
  'greyhound', 'wolf', 'fox', 'coyote', 'dingo', 'hyena', 'cat', 'tabby', 'siamese', 'persian', 'kitten', 'lynx', 'cougar', 'lion',
  'tiger', 'leopard', 'cheetah', 'jaguar', 'panther', 'bear', 'panda', 'horse', 'sorrel', 'zebra', 'ox', 'bison', 'pig', 'hog',
  'boar', 'sheep', 'ram', 'goat', 'llama', 'camel', 'rabbit', 'hare', 'hamster', 'guinea pig', 'squirrel', 'elephant', 'monkey',
  'gorilla', 'chimpanzee', 'orangutan', 'baboon', 'koala', 'deer', 'gazelle', 'impala', 'otter', 'beaver', 'badger', 'raccoon',
  'skunk', 'mongoose', 'meerkat', 'weasel', 'mink', 'ferret', 'hippopotamus', 'rhinoceros', 'kangaroo', 'wallaby', 'cow'];
const VEHICLES = ['car', 'cab', 'jeep', 'limousine', 'minivan', 'convertible', 'racer', 'wagon', 'pickup', 'truck', 'van',
  'ambulance', 'bus', 'trolleybus', 'tractor', 'go-kart', 'scooter', 'moped', 'motorcycle', 'bike', 'bicycle', 'tank', 'locomotive',
  'grille', 'car wheel', 'fire engine', 'police', 'tow truck', 'trailer', 'snowmobile', 'forklift', 'golfcart', 'airliner', 'warplane',
  'speedboat', 'yacht', 'submarine', 'catamaran', 'airship'];

const has = (name, words) => words.some((w) => new RegExp(`\\b${w}s?\\b`, 'i').test(name));

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

let modelPromise = null;
function loadModel() {
  modelPromise ||= (async () => {
    if (!window.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    if (!window.mobilenet) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
    return window.mobilenet.load({ version: 2, alpha: 1.0 });
  })().catch((e) => { modelPromise = null; throw e; });
  return modelPromise;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);

// Renvoie { type, label } : le gabarit conseillé et ce qui a été reconnu
export async function detectType(canvas) {
  const skin = skinInfo(canvas);
  // un visage humain détecté l'emporte (MediaPipe est bien plus fiable que MobileNet pour les personnes)
  try {
    const { hasFace } = await import('./faceAnalysis.js');
    if (await withTimeout(hasFace(canvas), 20000)) return { type: 'person', label: 'visage' };
  } catch { /* détecteur de visage indisponible : on continue */ }
  try {
    const model = await withTimeout(loadModel(), 20000);
    const preds = await model.classify(canvas, 10);
    // on additionne les probabilités de toutes les classes « animal » et « véhicule » reconnues
    const score = (words) => preds.filter((p) => has(p.className, words)).reduce((s, p) => s + p.probability, 0);
    const best = (words) => preds.find((p) => has(p.className, words))?.className.split(',')[0];
    const sv = score(VEHICLES);
    const sa = score(ANIMALS);
    if (Math.max(sv, sa) > 0.04) {
      return sv >= sa ? { type: 'vehicle', label: best(VEHICLES) } : { type: 'animal', label: best(ANIMALS) };
    }
    if (skin.ratio > 0.12) return { type: 'person', label: 'visage / personne' };
    return { type: 'object', label: preds[0]?.className.split(',')[0] || 'objet' };
  } catch {
    // pas de modèle disponible : estimation sur la peau visible
    return skin.ratio > 0.12 ? { type: 'person', label: 'visage / personne (estimation)' } : { type: 'object', label: 'objet (estimation)' };
  }
}
