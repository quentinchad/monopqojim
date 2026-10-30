// Drapeaux simplifiés en SVG (utilisables dans le DOM et dans les textures 3D, sans dépendance externe).

function star(cx, cy, r, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = rot + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#FFDE00"/>`;
}

const usStripes = Array.from({ length: 13 }, (_, i) =>
  `<rect y="${(i * 20) / 13}" width="30" height="${20 / 13 + 0.05}" fill="${i % 2 ? '#fff' : '#B22234'}"/>`).join('');
const usStars = Array.from({ length: 20 }, (_, i) =>
  `<circle cx="${1.2 + (i % 5) * 2.4}" cy="${1.2 + Math.floor(i / 5) * 2.6}" r="0.55" fill="#fff"/>`).join('');

const BODIES = {
  fr: '<rect width="10" height="20" fill="#0055A4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#EF4135"/>',
  it: '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE2B37"/>',
  de: '<rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#DD0000"/><rect y="13.33" width="30" height="6.67" fill="#FFCE00"/>',
  es: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
  jp: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>',
  cn: `<rect width="30" height="20" fill="#DE2910"/>${star(5, 5, 3)}${star(10, 2, 1)}${star(12, 4.2, 1)}${star(12, 7, 1)}${star(10, 9, 1)}`,
  br: '<rect width="30" height="20" fill="#009C3B"/><polygon points="15,2 28,10 15,18 2,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/><path d="M11 9.4 Q15 8 19 10.6" stroke="#fff" stroke-width="0.7" fill="none"/>',
  us: `${usStripes}<rect width="12.6" height="${(7 * 20) / 13}" fill="#3C3B6E"/>${usStars}`,
  // pays du grand plateau
  mx: '<rect width="10" height="20" fill="#006847"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE1126"/><circle cx="15" cy="10" r="2.6" fill="#8B5A2B"/><path d="M12.6 11.6 Q15 13.6 17.4 11.6" stroke="#006847" stroke-width="0.7" fill="none"/>',
  in: '<rect width="30" height="6.67" fill="#FF9933"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width="0.6"/><circle cx="15" cy="10" r="0.6" fill="#000080"/>',
  ru: '<rect width="30" height="6.67" fill="#fff"/><rect y="6.67" width="30" height="6.67" fill="#0039A6"/><rect y="13.33" width="30" height="6.67" fill="#D52B1E"/>',
  gb: '<rect width="30" height="20" fill="#012169"/><path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 L30 20 M30 0 L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0 V20 M0 10 H30" stroke="#fff" stroke-width="6"/><path d="M15 0 V20 M0 10 H30" stroke="#C8102E" stroke-width="3.4"/>',
};

export function flagSvg(code) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" preserveAspectRatio="none">${BODIES[code] || '<rect width="30" height="20" fill="#888"/>'}</svg>`;
}

export function flagDataUrl(code) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(flagSvg(code))}`;
}
