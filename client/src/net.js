import { io } from 'socket.io-client';
import { sfx } from './sound.js';

export const socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });

// Jeton secret par onglet : permet de se reconnecter après un rafraîchissement
export function getToken() {
  let t = sessionStorage.getItem('mq_token');
  if (!t) {
    t = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    sessionStorage.setItem('mq_token', t);
  }
  return t;
}

let toastHandler = () => {};
export const onToast = (fn) => { toastHandler = fn; };
export const toast = (msg, kind = 'error') => toastHandler(msg, kind);

function emit(event, payload) {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload, (err, res) => {
      if (err) { toast('Le serveur ne répond pas'); return resolve({ error: 'timeout' }); }
      if (res?.error) { toast(res.error); sfx.error(); }
      resolve(res || {});
    });
  });
}

export const act = (type, data = {}) => emit('action', { type, ...data });
export const lobby = (op, data = {}) => emit('lobby', { op, ...data });
export const join = (roomId, name) => emit('join', { roomId, name, token: getToken() });

// accès console pour le débogage (le serveur n'accepte les commandes debug qu'avec --debug)
window.__mqSocket = socket;
