// Pion personnalisé du joueur : mémorisé dans le navigateur pour être réutilisé dans chaque partie.
import { sendSkin } from './net.js';

export function savedSkin() {
  try { return JSON.parse(localStorage.getItem('mq_skin') || 'null'); } catch { return null; }
}

export function saveSkin(skin) {
  try {
    if (skin) localStorage.setItem('mq_skin', JSON.stringify(skin));
    else localStorage.removeItem('mq_skin');
  } catch { /* stockage indisponible ou plein */ }
}

// En arrivant dans une partie, on y envoie son pion enregistré (s'il n'y est pas déjà)
export function applySavedSkin(state, playerId) {
  const me = state?.players.find((p) => p.id === playerId);
  const skin = savedSkin();
  if (me && skin && !me.skin) sendSkin(skin);
}
