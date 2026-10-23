// Bruitages déclenchés par les changements d'état de la partie (tour, argent, achats, constructions, enchères, annonces)
import { useEffect, useRef } from 'react';
import { sfx, eventSound } from './sound.js';

const CINEMATICS = ['busted', 'hijack', 'delivery'];

export function useGameSounds(state, me, event) {
  const prev = useRef(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!p || p.id !== state.id || state.phase === 'lobby') return;

    // c'est à moi de jouer
    if (state.phase === 'playing' && state.turn?.pid === me && p.turn?.pid !== me) setTimeout(() => sfx.yourTurn(), 250);

    // propriétés : achats, reventes, constructions
    let bought = null;
    let released = 0;
    let built = false;
    let sold = false;
    for (const [i, pr] of Object.entries(state.props)) {
      const old = p.props[i];
      if (!old) continue;
      if (!old.owner && pr.owner) bought = pr.owner;
      if (old.owner && !pr.owner) released++;
      if (pr.houses > old.houses) built = true;
      if (pr.houses === old.houses - 1) sold = true;
    }
    if (bought) sfx.buy();
    else if (built) sfx.build();
    else if (sold || released === 1) sfx.sell();

    // mon argent (le casino a ses propres sons, révélés à l'arrêt des rouleaux)
    const casino = state.turn?.pending?.type === 'casino' || p.turn?.pending?.type === 'casino';
    const before = p.players.find((x) => x.id === me)?.money;
    const after = state.players.find((x) => x.id === me)?.money;
    if (!casino && before != null && after != null && after !== before && !(bought === me) && !sold && released !== 1) {
      if (after > before) sfx.coin();
      else sfx.pay();
    }

    // enchères
    if (state.auction && state.auction.bid > (p.auction?.bid || 0)) sfx.bid();
    if (p.auction && !state.auction) sfx.gavel();
  }, [state.version]);

  // annonces (les cinématiques ont leur propre bande-son)
  useEffect(() => {
    if (event && !CINEMATICS.includes(event.type)) eventSound(event.type);
  }, [event?.id]);
}
