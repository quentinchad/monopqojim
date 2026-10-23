// Intégration du jeu dans une page d'un autre site (iframe), ex. https://www.quentin-chirat.com/monopqojim
// La page hôte affiche le jeu en plein écran ; on lui indique la partie en cours pour qu'elle garde
// une adresse partageable (…/monopqojim?room=CODE) et on construit les liens d'invitation vers elle.

const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || '';

export const isEmbedded = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const hostOrigin = (() => {
  try { return PUBLIC_URL ? new URL(PUBLIC_URL).origin : '*'; } catch { return '*'; }
})();

export function inviteLink(roomId) {
  if (isEmbedded && PUBLIC_URL) return `${PUBLIC_URL}?room=${roomId}`;
  return `${window.location.origin}/room/${roomId}`;
}

// page : { room: 'CODE' } | { demo: true } | {} (accueil)
export function notifyHost(page) {
  if (!isEmbedded) return;
  window.parent.postMessage({ type: 'monopqojim:page', ...page }, hostOrigin);
}

export function notifyReady() {
  if (!isEmbedded) return;
  window.parent.postMessage({ type: 'monopqojim:ready' }, hostOrigin);
}
