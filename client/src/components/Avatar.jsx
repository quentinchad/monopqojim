import React from 'react';
import { skinUrl, skinBackground } from '../skin3d.js';

// Pastille d'un joueur : l'image de son pion personnalisé, sinon son initiale (ou 🤖)
export default function Avatar({ state, p }) {
  if (!p) return null;
  const url = skinUrl(state.id, p);
  return (
    <span className={`avatar ${url ? 'has-skin' : ''}`}
      style={{ background: p.color, ...skinBackground(state.id, p), '--pc': p.color }}>
      {p.isBot ? '🤖' : p.name[0]?.toUpperCase()}
    </span>
  );
}
