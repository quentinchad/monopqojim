// Thèmes visuels : couleurs de l'interface (variables CSS) + ambiance de la scène 3D.
// Le choix est propre à chaque joueur (enregistré dans le navigateur).
import { useEffect, useState } from 'react';

export const THEMES = {
  nuit: {
    name: 'Nuit violette',
    icon: '🌃',
    css: {
      bg: '#0f0b1e', 'bg-glow': '#241a48', panel: '#1a1430', 'panel-2': '#231b40', deep: '#120d24',
      line: '#352a5c', text: '#f4f1ff', muted: '#9d93c4', accent: '#8b5cf6', 'accent-2': '#a78bfa',
      cell: '#241d3d', 'cell-line': '#3a3063', board: '#17122b', 'on-accent': '#ffffff',
    },
    scene: {
      skyTop: '#05030f', skyBottom: '#2b1a52', fog: '#140d2b', fogNear: 32, fogFar: 95,
      hemi: ['#ffffff', '#2a1f4d', 1.0], sun: ['#c7c2ff', 1.4], ground: '#120d24',
      base: '#16112b', cellSide: '#1d1733', cellBg: '#2a2346', cellLine: '#463b6e', cellText: '#ffffff',
      price: '#c4b5fd', centerA: '#2d2350', centerB: '#17122b', logoA: '#ffffff', logoB: '#a78bfa',
      decor: 'city', stars: true, night: true,
    },
  },
  classique: {
    name: 'Classique (jour)',
    icon: '🌳',
    css: {
      bg: '#e4ecdf', 'bg-glow': '#f6faf2', panel: '#ffffff', 'panel-2': '#f0f5ec', deep: '#e6eee0',
      line: '#c8d5bf', text: '#1d2a1c', muted: '#5d6e59', accent: '#16a34a', 'accent-2': '#15803d',
      cell: '#fbf7ec', 'cell-line': '#b9c6ae', board: '#cfe2c4', 'on-accent': '#ffffff',
    },
    scene: {
      skyTop: '#3d9be0', skyBottom: '#d6efff', fog: '#cfe7f7', fogNear: 40, fogFar: 110,
      hemi: ['#ffffff', '#6f9a5c', 1.25], sun: ['#fff4dc', 2.2], ground: '#5d9b47',
      base: '#2f5d2a', cellSide: '#d8ccb2', cellBg: '#fbf7ec', cellLine: '#b9a988', cellText: '#1d2a1c',
      price: '#166534', centerA: '#e9f5df', centerB: '#bfdcae', logoA: '#14532d', logoB: '#16a34a',
      decor: 'park', stars: false, night: false,
    },
  },
  ocean: {
    name: 'Océan',
    icon: '🌊',
    css: {
      bg: '#04131f', 'bg-glow': '#0b3550', panel: '#0b2233', 'panel-2': '#10304a', deep: '#071a29',
      line: '#1d4a66', text: '#e6f6ff', muted: '#8fb6cc', accent: '#0ea5e9', 'accent-2': '#38bdf8',
      cell: '#0d2a40', 'cell-line': '#1f4f6e', board: '#082033', 'on-accent': '#ffffff',
    },
    scene: {
      skyTop: '#1b6fb0', skyBottom: '#bfe6f7', fog: '#9ccfe6', fogNear: 38, fogFar: 105,
      hemi: ['#ffffff', '#1b5c80', 1.2], sun: ['#fff7e6', 2.0], ground: '#0f5f8f',
      base: '#e8d3a2', cellSide: '#0d2a40', cellBg: '#0f3049', cellLine: '#2a6688', cellText: '#ffffff',
      price: '#7dd3fc', centerA: '#16507a', centerB: '#0b2c45', logoA: '#ffffff', logoB: '#38bdf8',
      decor: 'ocean', stars: false, night: false,
    },
  },
  neon: {
    name: 'Néon',
    icon: '🌆',
    css: {
      bg: '#05040a', 'bg-glow': '#2a0838', panel: '#0e0b1a', 'panel-2': '#161229', deep: '#08060f',
      line: '#3b1d5c', text: '#f5f3ff', muted: '#a59ccc', accent: '#ec4899', 'accent-2': '#22d3ee',
      cell: '#100c1f', 'cell-line': '#4c1d95', board: '#07050e', 'on-accent': '#ffffff',
    },
    scene: {
      skyTop: '#020106', skyBottom: '#3a0a4a', fog: '#12041d', fogNear: 30, fogFar: 90,
      hemi: ['#d8b4fe', '#12041d', 0.8], sun: ['#f0abfc', 1.1], ground: '#06040c',
      base: '#0a0614', cellSide: '#160b28', cellBg: '#120b22', cellLine: '#ec4899', cellText: '#ffffff',
      price: '#22d3ee', centerA: '#220a35', centerB: '#07040e', logoA: '#ec4899', logoB: '#22d3ee',
      decor: 'neon', stars: true, night: true,
    },
  },
  desert: {
    name: 'Désert',
    icon: '🏜️',
    css: {
      bg: '#24170d', 'bg-glow': '#5a3416', panel: '#3a2617', 'panel-2': '#4a311d', deep: '#2b1c11',
      line: '#6b4a2c', text: '#fff4e3', muted: '#d2b48c', accent: '#f59e0b', 'accent-2': '#fbbf24',
      cell: '#43301e', 'cell-line': '#6e4f30', board: '#34241a', 'on-accent': '#1f1206',
    },
    scene: {
      skyTop: '#e0773a', skyBottom: '#fde3b0', fog: '#efc18a', fogNear: 36, fogFar: 100,
      hemi: ['#fff1d6', '#9a6a3a', 1.15], sun: ['#ffd9a0', 2.1], ground: '#d9a865',
      base: '#7a5230', cellSide: '#5a3d24', cellBg: '#4a3420', cellLine: '#8a6440', cellText: '#fff4e3',
      price: '#fcd34d', centerA: '#6b4a2c', centerB: '#3a2617', logoA: '#fff4e3', logoB: '#fbbf24',
      decor: 'desert', stars: false, night: false,
    },
  },
};

const KEY = 'mq_theme';
const listeners = new Set();

export function getThemeId() {
  try {
    const id = localStorage.getItem(KEY);
    return THEMES[id] ? id : 'nuit';
  } catch {
    return 'nuit';
  }
}

export function applyTheme(id = getThemeId()) {
  const t = THEMES[id] || THEMES.nuit;
  const root = document.documentElement;
  // sans transitions pendant le changement, sinon certains fonds restent sur l'ancienne couleur
  root.classList.add('theme-switching');
  for (const [k, v] of Object.entries(t.css)) root.style.setProperty(`--${k}`, v);
  void root.offsetHeight;
  setTimeout(() => root.classList.remove('theme-switching'), 60);
  root.dataset.theme = id;
  root.style.colorScheme = id === 'classique' ? 'light' : 'dark';
}

export function setThemeId(id) {
  if (!THEMES[id]) return;
  try { localStorage.setItem(KEY, id); } catch { /* stockage indisponible */ }
  applyTheme(id);
  listeners.forEach((fn) => fn(id));
}

export function useThemeId() {
  const [id, setId] = useState(getThemeId);
  useEffect(() => {
    listeners.add(setId);
    return () => listeners.delete(setId);
  }, []);
  return id;
}
