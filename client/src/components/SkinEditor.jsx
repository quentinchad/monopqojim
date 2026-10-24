import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeSkinModel, SKIN_LABELS } from '../skin3d.js';
import { CHARACTERS, DEFAULT_CHARACTER, OPTIONS, characterPortrait } from '../characters.js';
import { dominantColors, skinInfo, detectType, vividColor } from '../skinImage.js';
import { analyzeFace } from '../faceAnalysis.js';
import { sendSkin } from '../net.js';
import { saveSkin, savedSkin } from '../skins.js';

const VIEW = 280; // taille de la zone de recadrage (px)
const OUT = 256; // taille de l'image envoyée
const SKIN_TONES = ['#f6d5bd', '#f1c7a5', '#e0ac87', '#c99a76', '#a8714f', '#7a4e33', '#4f3222'];
const IMAGE_TYPES = ['person', 'animal', 'vehicle', 'object'];

// Couleurs proposées pour chaque gabarit, à partir des couleurs de l'image
function suggestColors(type, canvas) {
  const dom = dominantColors(canvas);
  const lum = (h) => parseInt(h.slice(1, 3), 16) * 0.3 + parseInt(h.slice(3, 5), 16) * 0.59 + parseInt(h.slice(5, 7), 16) * 0.11;
  const darkest = [...dom].sort((a, b) => lum(a) - lum(b))[0];
  // (pour un personnage, l'analyse du visage affine ensuite vêtement, cheveux et peau)
  if (type === 'person') return [dom[0], darkest, '#334155', skinInfo(canvas).tone || '#e0ac87'];
  if (type === 'vehicle') return [vividColor(canvas) || dom[0], darkest];
  return [dom[0], dom[1] || darkest, darkest];
}

const COLOR_LABELS = {
  person: ['Haut (vêtement)', 'Cheveux', 'Pantalon', 'Peau'],
  animal: ['Pelage', 'Pattes, oreilles, queue'],
  vehicle: ['Carrosserie', 'Bas de caisse'],
  object: [],
};

// Libellés des couleurs de la tenue selon le haut choisi
const TOP_COLORS = {
  suit: ['Costume', 'Chemise', 'Cravate'],
  jacket: ['Veste', 'Dessous'],
  sweater: ['Pull', 'Col de chemise'],
  jersey: ['Maillot', 'Col / rayures'],
  racing: ['Combinaison', 'Bande', 'Liserés'],
  military: ['Uniforme', 'Ceinture'],
  pirate: ['Manteau', 'Chemise', 'Ceinture'],
};

// Aperçu 3D du pion, qui tourne sur lui-même
function Preview({ skin, src, face, color }) {
  const mount = useRef(null);
  const world = useRef(null);
  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.01, 20);
    camera.position.set(0, 0.75, 1.55);
    camera.lookAt(0, 0.33, 0);
    scene.add(new THREE.HemisphereLight('#ffffff', '#6b5b95', 1.3));
    const sun = new THREE.DirectionalLight('#ffffff', 1.8);
    sun.position.set(1, 2, 1.5);
    sun.castShadow = true;
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshStandardMaterial({ color: '#2a2148' }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const holder = new THREE.Group();
    scene.add(holder);
    // glisser pour tourner le pion, sinon il tourne tout seul
    let drag = null;
    const down = (e) => { drag = e.clientX; };
    const move = (e) => { if (drag != null) { holder.rotation.y += (e.clientX - drag) * 0.012; drag = e.clientX; } };
    const up = () => { drag = null; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (drag == null) holder.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    tick();
    world.current = { holder };
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);
  const key = JSON.stringify(skin) + (src || '').length + (face ? face.pts.length : 0) + color;
  useEffect(() => {
    const w = world.current;
    if (!w || !skin) return;
    while (w.holder.children.length) w.holder.remove(w.holder.children[0]);
    const m = makeSkinModel({ skin, src, face, color });
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    w.holder.add(m);
  }, [key, src]);
  return <div ref={mount} className="skin-preview" />;
}

function Field({ label, children }) {
  return <label className="cc-field"><span>{label}</span>{children}</label>;
}

function Select({ value, options, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

function Color({ value, onChange, title }) {
  return <input type="color" title={title} value={value} onChange={(e) => onChange(e.target.value)} />;
}

// Composition d'un personnage sur mesure
function CustomBuilder({ char, setChar }) {
  const set = (patch) => setChar((c) => ({ ...c, ...patch }));
  const topLabels = TOP_COLORS[char.top] || ['Couleur'];
  const toggleExtra = (e) => set({ extras: char.extras.includes(e) ? char.extras.filter((x) => x !== e) : [...char.extras, e] });
  return (
    <div className="cc-builder">
      <Field label="Partir de">
        <select value="" onChange={(e) => { const p = CHARACTERS.find((x) => x.id === e.target.value); if (p) setChar({ ...p.char }); }}>
          <option value="">— un personnage existant —</option>
          {CHARACTERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Morphologie">
        <div className="cc-row">
          <Select value={char.build} options={OPTIONS.build} onChange={(v) => set({ build: v })} />
          <input type="range" min="0.85" max="1.1" step="0.01" value={char.height} title="Taille" onChange={(e) => set({ height: +e.target.value })} />
        </div>
      </Field>
      <Field label="Peau">
        <div className="cc-row">
          {SKIN_TONES.map((t) => (
            <button key={t} className={`cc-swatch ${char.skin === t ? 'active' : ''}`} style={{ background: t }} onClick={() => set({ skin: t })} />
          ))}
          <Color value={char.skin} onChange={(v) => set({ skin: v })} title="Autre teinte" />
          <Color value={char.eyes} onChange={(v) => set({ eyes: v })} title="Couleur des yeux" />
        </div>
      </Field>
      <Field label="Cheveux">
        <div className="cc-row"><Select value={char.hair} options={OPTIONS.hair} onChange={(v) => set({ hair: v })} /><Color value={char.hairColor} onChange={(v) => set({ hairColor: v })} /></div>
      </Field>
      <Field label="Barbe">
        <div className="cc-row"><Select value={char.beard} options={OPTIONS.beard} onChange={(v) => set({ beard: v })} /><Color value={char.beardColor} onChange={(v) => set({ beardColor: v })} /></div>
      </Field>
      <Field label="Lunettes">
        <div className="cc-row"><Select value={char.glasses} options={OPTIONS.glasses} onChange={(v) => set({ glasses: v })} />{char.glasses !== 'none' && <Color value={char.lensColor} onChange={(v) => set({ lensColor: v })} title="Verres" />}</div>
      </Field>
      <Field label="Chapeau">
        <div className="cc-row"><Select value={char.hat} options={OPTIONS.hat} onChange={(v) => set({ hat: v })} />{char.hat !== 'none' && <Color value={char.hatColor} onChange={(v) => set({ hatColor: v })} />}</div>
      </Field>
      <Field label="Haut">
        <div className="cc-row">
          <Select value={char.top} options={OPTIONS.top} onChange={(v) => set({ top: v })} />
          {topLabels.map((l, i) => {
            const k = ['topColor', 'topColor2', 'topColor3'][i];
            return <Color key={k} value={char[k]} title={l} onChange={(v) => set({ [k]: v })} />;
          })}
        </div>
        {(char.top === 'jersey' || char.top === 'racing') && (
          <div className="cc-row">
            <input className="cc-number" placeholder="N°" maxLength={2} value={char.number} onChange={(e) => set({ number: e.target.value.replace(/\D/g, '') })} />
            {char.top === 'jersey' && <label className="cc-check"><input type="checkbox" checked={char.stripes} onChange={(e) => set({ stripes: e.target.checked })} /> Rayures</label>}
          </div>
        )}
      </Field>
      <Field label="Bas · chaussures">
        <div className="cc-row"><Color value={char.pants} onChange={(v) => set({ pants: v })} title="Pantalon" /><Color value={char.shoes} onChange={(v) => set({ shoes: v })} title="Chaussures" /></div>
      </Field>
      <Field label="Accessoires">
        <div className="cc-row wrap">
          {Object.entries(OPTIONS.extras).map(([k, v]) => (
            <label key={k} className="cc-check"><input type="checkbox" checked={char.extras.includes(k)} onChange={() => toggleExtra(k)} /> {v}</label>
          ))}
          <label className="cc-check"><input type="checkbox" checked={char.twins} onChange={(e) => set({ twins: e.target.checked })} /> En double (jumeaux)</label>
        </div>
      </Field>
    </div>
  );
}

export default function SkinEditor({ me, onClose }) {
  const saved = savedSkin();
  const color = me?.color || '#ef4444';
  const savedIsChar = saved?.type === 'character';
  const [mode, setMode] = useState(savedIsChar ? (saved.preset ? 'presets' : 'custom') : saved?.image ? 'image' : 'presets');
  const [presetId, setPresetId] = useState(savedIsChar ? saved.preset : null);
  const [char, setChar] = useState(() => ({ ...DEFAULT_CHARACTER, topColor: color, ...(savedIsChar && !saved.preset ? saved.char : {}) }));

  // ---------- pion depuis une image ----------
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [src, setSrc] = useState(!savedIsChar && saved?.image ? saved.image : null); // image recadrée (data URL)
  const [type, setType] = useState(!savedIsChar && IMAGE_TYPES.includes(saved?.type) ? saved.type : 'person');
  const [colors, setColors] = useState(!savedIsChar && saved?.colors ? saved.colors : []);
  const [detect, setDetect] = useState(null); // { busy } ou { type, label }
  const [busy, setBusy] = useState(false);
  const view = useRef(null);
  const drag = useRef(null);
  const lastOut = useRef(null); // dernier recadrage (l'analyse peut finir après un nouveau réglage)
  // visage analysé (personnage) : { busy } | { none } | { data: { pts, tri }, hair }
  const [faceInfo, setFaceInfo] = useState(!savedIsChar && saved?.face ? { data: saved.face, hair: saved.hair } : null);
  const faceSeq = useRef(0);

  // analyse du visage : repères, coiffure et couleurs (vêtement, cheveux, peau) tirés de la photo
  async function runFace(out) {
    const seq = ++faceSeq.current;
    setFaceInfo({ busy: true });
    let res = null;
    try { res = await analyzeFace(out); } catch { res = null; }
    if (seq !== faceSeq.current) return;
    if (!res) { setFaceInfo({ none: true }); return; }
    setFaceInfo({ data: { pts: res.pts, tri: res.tri }, hair: res.hair });
    setColors((c) => [res.clothes || c[0], res.hairColor || c[1], c[2] || '#334155', res.skin || c[3]]);
  }

  // chargement d'une image (fichier, glisser-déposer ou collage)
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => { setMode('image'); setImg(im); setZoom(1); setOffset({ x: 0, y: 0 }); setDetect(null); setFaceInfo(null); };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
      if (f) loadFile(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // dessin de l'image recadrée (zone visible = ce qui sera gardé)
  const base = img ? Math.max(VIEW / img.width, VIEW / img.height) : 1;
  function draw(ctx, size) {
    const k = size / VIEW;
    const s = base * zoom * k;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, size / 2 - (img.width * s) / 2 + offset.x * k, size / 2 - (img.height * s) / 2 + offset.y * k, img.width * s, img.height * s);
  }
  useEffect(() => {
    if (!img || !view.current) return;
    draw(view.current.getContext('2d'), VIEW);
  }, [img, zoom, offset, mode]);

  // après chaque réglage du recadrage : image de sortie, couleurs, détection
  useEffect(() => {
    if (!img) return undefined;
    const to = setTimeout(async () => {
      const out = document.createElement('canvas');
      out.width = out.height = OUT;
      draw(out.getContext('2d'), OUT);
      lastOut.current = out;
      setSrc(out.toDataURL('image/jpeg', 0.86));
      if (!detect) {
        setDetect({ busy: true });
        const d = await detectType(out);
        setDetect(d);
        setType(d.type);
        setColors(suggestColors(d.type, lastOut.current));
        if (d.type === 'person') runFace(lastOut.current);
      } else if (!detect.busy) {
        setColors(suggestColors(type, out));
        if (type === 'person') runFace(out);
      }
    }, 350);
    return () => clearTimeout(to);
  }, [img, zoom, offset]);

  function pickType(t) {
    setType(t);
    if (img) {
      const out = document.createElement('canvas');
      out.width = out.height = OUT;
      draw(out.getContext('2d'), OUT);
      setColors(suggestColors(t, out));
      if (t === 'person') runFace(out);
    }
  }

  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    const d = drag.current;
    if (d) setOffset({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e) => setZoom((z) => Math.max(0.5, Math.min(6, z * (e.deltaY < 0 ? 1.1 : 0.9))));

  // ---------- pion affiché dans l'aperçu ----------
  const preset = CHARACTERS.find((p) => p.id === presetId);
  const current = mode === 'presets'
    ? (preset ? { type: 'character', char: preset.char } : null)
    : mode === 'custom'
      ? { type: 'character', char }
      : (src ? { type, colors, hair: type === 'person' ? faceInfo?.hair : null, face: type === 'person' && !!faceInfo?.data } : null);
  const portraits = useMemo(() => Object.fromEntries(CHARACTERS.map((p) => [p.id, characterPortrait(p.char)])), []);

  async function save() {
    if (!current) return;
    setBusy(true);
    let skin;
    if (current.type === 'character') {
      skin = { type: 'character', char: current.char, preset: mode === 'presets' ? presetId : null };
    } else {
      const face = type === 'person' && faceInfo?.data ? faceInfo.data : null;
      // pastilles : centrées sur le visage
      let focus = null;
      if (face) {
        const P = (i) => [face.pts[i * 3] / 1000, face.pts[i * 3 + 1] / 1000];
        const w = Math.abs(P(454)[0] - P(234)[0]);
        focus = { x: (P(234)[0] + P(454)[0]) / 2, y: (P(10)[1] + P(152)[1]) / 2, s: Math.min(1, w * 1.7) };
      }
      skin = { type, colors, image: src, face, hair: face ? faceInfo.hair : null, focus };
    }
    const res = await sendSkin(skin);
    setBusy(false);
    if (!res.error) { saveSkin(skin); onClose(); }
  }
  async function reset() {
    await sendSkin({ remove: true });
    saveSkin(null);
    onClose();
  }

  const labels = COLOR_LABELS[type] || [];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="skin-editor" onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }}>
        <h3>🎨 Personnaliser mon pion</h3>
        <div className="skin-tabs">
          <button className={mode === 'presets' ? 'active' : ''} onClick={() => setMode('presets')}>🎭 Personnages</button>
          <button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}>🛠️ Perso sur mesure</button>
          <button className={mode === 'image' ? 'active' : ''} onClick={() => setMode('image')}>🖼️ Depuis une image</button>
        </div>
        <div className="skin-grid">
          <div className="skin-col">
            {mode === 'presets' && (
              <div className="char-grid">
                {CHARACTERS.map((p) => (
                  <button key={p.id} className={`char-card ${presetId === p.id ? 'active' : ''}`} onClick={() => setPresetId(p.id)}>
                    {portraits[p.id] ? <img src={portraits[p.id]} alt="" /> : <span className="char-ph">🎭</span>}
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            {mode === 'custom' && <CustomBuilder char={char} setChar={setChar} />}
            {mode === 'image' && (
              <>
                <div className="skin-step">1. Choisissez une image</div>
                <label className="btn primary skin-upload">
                  📁 Importer une image
                  <input type="file" accept="image/*" hidden onChange={(e) => loadFile(e.target.files[0])} />
                </label>
                <small className="muted">ou glissez-déposez / collez (Ctrl+V) une image : visage, animal, voiture, objet…</small>
                <div className="skin-step">2. Cadrez ce que vous voulez garder</div>
                <div className="skin-crop" style={{ width: VIEW, height: VIEW }}>
                  {img ? (
                    <canvas ref={view} width={VIEW} height={VIEW} onPointerDown={onDown} onPointerMove={onMove}
                      onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} />
                  ) : src ? <img src={src} alt="" /> : <div className="skin-empty">Aucune image</div>}
                  <div className="skin-mask" />
                </div>
                {img && (
                  <label className="skin-zoom">🔍 Zoom
                    <input type="range" min="0.5" max="6" step="0.01" value={zoom} onChange={(e) => setZoom(+e.target.value)} />
                  </label>
                )}
                {img && <small className="muted">Glissez l’image pour la déplacer, molette ou curseur pour zoomer. Le rond = la partie la plus visible.</small>}
              </>
            )}
          </div>
          <div className="skin-col">
            <div className="skin-step">{mode === 'presets' ? (preset ? preset.name : 'Choisissez un personnage') : 'Votre pion'}</div>
            {current ? (
              <Preview skin={current} src={current.type === 'character' ? null : src}
                face={current.type === 'person' ? faceInfo?.data : null} color={color} />
            ) : <div className="skin-preview empty">L’aperçu 3D apparaîtra ici</div>}
            <small className="muted">Glissez sur l’aperçu pour faire tourner le pion.</small>
            {mode === 'image' && (
              <>
                {type === 'person' && faceInfo?.busy && <small className="muted">🧠 Reconstruction du visage en 3D…</small>}
                {type === 'person' && faceInfo?.data && (
                  <small className="muted">🧠 Visage reconstruit en 3D · coiffure : {{ bald: 'crâne rasé', short: 'cheveux courts', long: 'cheveux longs' }[faceInfo.hair?.style]}</small>
                )}
                {type === 'person' && faceInfo?.none && <small className="muted">Aucun visage détecté : tête simple avec l’image. Cadrez le visage de face pour une vraie tête 3D.</small>}
                {detect?.busy && <small className="muted">🔎 Analyse de l’image…</small>}
                {detect && !detect.busy && <small className="muted">🔎 Reconnu : <b>{detect.label}</b> → {SKIN_LABELS[detect.type].name.toLowerCase()}</small>}
                <div className="skin-types">
                  {IMAGE_TYPES.map((k) => (
                    <button key={k} className={`btn tiny ${type === k ? 'primary' : ''}`} onClick={() => pickType(k)}>{SKIN_LABELS[k].icon} {SKIN_LABELS[k].name}</button>
                  ))}
                </div>
                <div className="skin-colors">
                  {labels.map((l, i) => l && (
                    <label key={i}>
                      <input type="color" value={colors[i] || '#888888'} onChange={(e) => setColors((c) => { const n = [...c]; n[i] = e.target.value; return n; })} />
                      {l}
                    </label>
                  ))}
                </div>
              </>
            )}
            <small className="muted">Le socle prend la couleur de votre joueur.</small>
          </div>
        </div>
        <div className="row end">
          {(saved || me?.skin) && <button className="btn ghost" onClick={reset}>↩ Pion classique</button>}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!current || busy || (mode === 'image' && (detect?.busy || faceInfo?.busy))} onClick={save}>✓ Utiliser ce pion</button>
        </div>
      </div>
    </div>
  );
}
