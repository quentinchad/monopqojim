// Analyse d'un visage pour générer une vraie tête 3D : 478 repères du visage (MediaPipe Face Landmarker)
// et segmentation de la photo (cheveux, peau, vêtements) pour la coiffure et les couleurs.
// Les modèles sont chargés à la demande depuis un CDN, uniquement dans l'éditeur de pion.

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

let tools = null;
function load() {
  tools ||= (async () => {
    const mp = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`);
    const fs = await mp.FilesetResolver.forVisionTasks(`${MP}/wasm`);
    const [landmarker, segmenter] = await Promise.all([
      mp.FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: FACE_MODEL }, runningMode: 'IMAGE', numFaces: 1 }),
      mp.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: SEG_MODEL }, runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false }),
    ]);
    return { landmarker, segmenter };
  })().catch((e) => { tools = null; throw e; });
  return tools;
}

// Couleur des cheveux : moyenne des pixels de luminosité moyenne (ni reflets, ni ombres, ni bords mêlés au fond)
function hairTone(list) {
  const lum = ([r, g, b]) => r * 0.3 + g * 0.59 + b * 0.11;
  const sorted = [...list].sort((a, b) => lum(a) - lum(b));
  const mid = sorted.slice(Math.floor(sorted.length * 0.15), Math.ceil(sorted.length * 0.6));
  const m = [0, 1, 2].map((k) => mid.reduce((acc, p) => acc + p[k], 0) / mid.length);
  return hex(...m);
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Un visage humain bien visible dans l'image ? (sert à choisir le gabarit « personnage »)
export async function hasFace(canvas) {
  const { landmarker } = await load();
  const lm = landmarker.detect(canvas).faceLandmarks?.[0];
  return !!lm && Math.abs(lm[454].x - lm[234].x) > 0.12;
}

// Renvoie null si aucun visage n'est trouvé, sinon :
// { pts: [x, y, z…] (478 repères, entiers en millièmes de l'image), tri: triangles du maillage,
//   hair: { style, vol }, skin, hairColor, clothes }
export async function analyzeFace(canvas) {
  const { landmarker, segmenter } = await load();
  const lm = landmarker.detect(canvas).faceLandmarks?.[0];
  if (!lm) return null;

  // segmentation : 0 fond, 1 cheveux, 2 peau du corps, 3 peau du visage, 4 vêtements
  const W = canvas.width;
  const H = canvas.height;
  const res = segmenter.segment(canvas);
  const mask = res.categoryMask.getAsUint8Array();
  const mw = res.categoryMask.width;
  const mh = res.categoryMask.height;
  res.close?.();
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const sums = Array.from({ length: 6 }, () => [0, 0, 0, 0]);
  let hairTop = 1;
  let hairLow = 0;
  let hairCrown = 0;
  const hairPx = []; // cheveux juste au-dessus du front (zone où ils devraient être)
  const faceW = Math.abs(lm[454].x - lm[234].x);
  const fh = Math.abs(lm[152].y - lm[10].y);
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const cat = mask[y * mw + x];
      const ix = Math.floor((x / mw) * W);
      const iy = Math.floor((y / mh) * H);
      const i = (iy * W + ix) * 4;
      const s = sums[cat];
      s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; s[3]++;
      if (cat === 1) {
        hairPx.push([px[i], px[i + 1], px[i + 2]]);
        hairTop = Math.min(hairTop, y / mh);
        if (y / mh < lm[10].y + fh * 0.12 && y / mh > lm[10].y - fh * 0.6 && Math.abs(x / mw - lm[10].x) < faceW * 0.55) hairCrown++;
        // cheveux à côté du visage, plus bas que la bouche : cheveux longs
        if (y / mh > lm[13].y && Math.abs(x / mw - lm[1].x) > Math.abs(lm[454].x - lm[234].x) * 0.35) hairLow++;
      }
    }
  }
  const avg = (cat) => (sums[cat][3] ? hex(sums[cat][0] / sums[cat][3], sums[cat][1] / sums[cat][3], sums[cat][2] / sums[cat][3]) : null);
  const total = mw * mh;
  // part de la zone au-dessus du front couverte de cheveux (la zone peut sortir du cadrage)
  const crownTop = Math.max(0, lm[10].y - fh * 0.6);
  const crownArea = Math.max(1, (lm[10].y + fh * 0.12 - crownTop) * mh * faceW * 1.1 * mw);
  const crown = hairCrown / crownArea;
  // cheveux coupés par le haut du cadrage : volume moyen
  const vol = hairTop <= 0.01 ? 0.3 : Math.max(0, Math.min(0.6, (lm[10].y - hairTop) / fh));
  const style = crown < 0.1 ? 'bald' : hairLow / total > 0.01 ? 'long' : 'short';

  const pts = [];
  for (const p of lm) pts.push(Math.round(p.x * 1000), Math.round(p.y * 1000), Math.round(p.z * 1000));
  return {
    pts,
    tri: await faceTriangles(),
    hair: { style, vol: Math.round(vol * 100) / 100 },
    skin: avg(3) || avg(2),
    hairColor: hairPx.length > 120 ? hairTone(hairPx) : null,
    clothes: sums[4][3] / total > 0.03 ? avg(4) : null,
  };
}

// Triangles du maillage du visage (852), fournis par MediaPipe ; mis en cache après le premier chargement
let triangles = null;
export async function faceTriangles() {
  if (triangles) return triangles;
  const mp = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`);
  const T = mp.FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  triangles = [];
  for (let k = 0; k + 2 < T.length; k += 3) triangles.push(T[k].start, T[k + 1].start, T[k + 2].start);
  return triangles;
}
