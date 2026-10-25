// Bruitages déclenchés par les changements d'état de la partie (tour, argent, achats, constructions, enchères, annonces)
import { useEffect, useRef } from 'react';
import { sfx, eventSound } from './sound.js';

const CINEMATICS = ['busted', 'hijack', 'delivery', 'goulag'];

// shownPlayers : joueurs tels qu'affichés (argent gelé pendant les animations), pour caler le son des pièces
export function useGameSounds(state, me, event, shownPlayers = state.players) {
  const prev = useRef(null);
  const ownSoundAt = useRef(0); // achat / revente : leur propre son remplace celui des pièces

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
    if (bought === me || built || sold || released === 1) ownSoundAt.current = Date.now();

    // enchères
    if (state.auction && state.auction.bid > (p.auction?.bid || 0)) sfx.bid();
    if (p.auction && !state.auction) sfx.gavel();
  }, [state.version]);

  // mon argent, au moment où il change à l'écran (le casino et les achats ont leurs propres sons)
  const myMoney = shownPlayers.find((x) => x.id === me)?.money;
  const prevMoney = useRef(myMoney);
  useEffect(() => {
    const before = prevMoney.current;
    prevMoney.current = myMoney;
    if (before == null || myMoney == null || myMoney === before) return;
    if (state.turn?.pending?.type === 'casino' || Date.now() - ownSoundAt.current < 1500) return;
    if (myMoney > before) sfx.coin();
    else sfx.pay();
  }, [myMoney]);

  // annonces (les cinématiques ont leur propre bande-son)
  useEffect(() => {
    if (event && !CINEMATICS.includes(event.type)) eventSound(event.type);
  }, [event?.id]);
}
