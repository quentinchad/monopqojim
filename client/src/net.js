import { io } from 'socket.io-client';
import { sfx } from './sound.js';

export const socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });

// Jeton secret qui identifie le joueur dans une partie. Mémorisé par partie dans l'onglet (rafraîchissement)
// ET dans le navigateur (onglet fermé puis rouvert, retour le lendemain…), pour toujours retrouver sa place.
const newToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const readMap = (store) => { try { return JSON.parse(store.getItem('mq_tokens') || '{}'); } catch { return {}; } };
const saveToken = (roomId, token) => {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const m = readMap(store);
      m[roomId] = token;
      // garde seulement les 20 dernières parties
      const keys = Object.keys(m);
      for (const k of keys.slice(0, Math.max(0, keys.length - 20))) delete m[k];
      store.setItem('mq_tokens', JSON.stringify(m));
    } catch { /* stockage indisponible */ }
  }
};
function tokenFor(roomId) {
  if (!roomId) return newToken();
  return readMap(sessionStorage)[roomId] || readMap(localStorage)[roomId] || newToken();
}

let toastHandler = () => {};
export const onToast = (fn) => { toastHandler = fn; };
export const toast = (msg, kind = 'error') => toastHandler(msg, kind);

function emit(event, payload, ms = 8000) {
  return new Promise((resolve) => {
    socket.timeout(ms).emit(event, payload, (err, res) => {
      if (err) { toast('Le serveur ne répond pas'); return resolve({ error: 'timeout' }); }
      if (res?.error) { toast(res.error); sfx.error(); }
      resolve(res || {});
    });
  });
}

export const act = (type, data = {}) => emit('action', { type, ...data });
export const lobby = (op, data = {}) => emit('lobby', { op, ...data });
export const sendSkin = (data) => emit('skin', data, 20000);
export async function join(roomId, name) {
  const token = tokenFor(roomId && String(roomId).toUpperCase());
  const res = await emit('join', { roomId, name, token });
  if (res.roomId && res.playerId) saveToken(res.roomId, token);
  return res;
}

// accès console pour le débogage (le serveur n'accepte les commandes debug qu'avec --debug)
window.__mqSocket = socket;
