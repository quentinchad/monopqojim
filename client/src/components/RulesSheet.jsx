import React, { useEffect, useState } from 'react';
import { RULES, CASINO, ROULETTE, SPECIAL_DIE, BOARDS, COUNTRIES } from '../../../shared/board.js';
import { CIVS } from '../../../shared/civs.js';

// Fiche des règles : les bases du Monopoly et tous les ajouts propres à Monopqojim.
// `settings` (facultatif) : les réglages de la partie, pour afficher ce que l'hôte a activé ou non.
function Section({ icon, title, children, off }) {
  return (
    <section className={`rs-section ${off ? 'off' : ''}`}>
      <h4>{icon} {title}{off && <span className="tag">désactivé dans cette partie</span>}</h4>
      {children}
    </section>
  );
}

export function RulesSheet({ settings, onClose }) {
  const s = settings || {};
  const off = (k) => settings && s[k] === false;
  const startMoney = s.startMoney || RULES.START_MONEY;
  const goulagMoney = s.goulagMoney || RULES.GOULAG_RETURN_MONEY;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="rules-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rs-head">
          <h2>📜 Règles de Monopqojim</h2>
          <button className="btn tiny ghost" onClick={onClose} title="Fermer">✕</button>
        </div>
        <div className="rs-body">
          <h3>Les bases</h3>
          <Section icon="🎯" title="But du jeu">
            <p>Être le dernier joueur en jeu : achetez des villes, faites payer des loyers aux autres et ruinez-les.</p>
          </Section>
          <Section icon="🎲" title="Un tour de jeu">
            <ul>
              <li>Lancez les deux dés et avancez. Un double vous fait rejouer ; trois doubles d’affilée vous envoient en prison.</li>
              <li>Chaque passage par Départ rapporte {RULES.GO_SALARY} $. Chaque joueur commence avec {startMoney} $.</li>
              <li>Sur une propriété libre, vous pouvez l’acheter. Sur celle d’un adversaire, vous payez son loyer.</li>
            </ul>
          </Section>
          <Section icon="🏙️" title="Villes, pays et bâtiments">
            <ul>
              <li>Posséder toutes les villes d’un pays double le loyer des villes nues et permet de construire.</li>
              <li>Chaque ville a un seul bâtiment qui s’agrandit sur 5 niveaux (4 maisons puis l’hôtel). Construisez et vendez uniformément dans un pays.</li>
              <li>Aéroports : le loyer augmente avec le nombre d’aéroports possédés. Compagnies : loyer selon les dés.</li>
            </ul>
          </Section>
          <Section icon="🏦" title="Argent et faillite">
            <ul>
              <li>Pas d’hypothèque : pour trouver de l’argent, vendez vos bâtiments (moitié du prix) ou revendez une propriété à la banque ({Math.round(RULES.RESALE_RATIO * 100)} % de son prix).</li>
              <li>Votre solde peut passer dans le négatif : remboursez avant la fin de votre tour ou déclarez faillite.</li>
            </ul>
          </Section>
          <Section icon="⛓️" title="Prison">
            <ul>
              <li>Sortez en faisant un double, en payant {RULES.JAIL_FINE} $ ou avec une carte « Libéré de prison ». Au bout de {RULES.JAIL_TURNS} tours, vous payez et sortez.</li>
              <li>Un prisonnier touche quand même ses loyers{off('rentInJail') ? ' — sauf dans cette partie : en prison, on ne touche rien.' : ' (l’hôte peut désactiver cette règle).'}</li>
            </ul>
          </Section>
          <Section icon="🤝" title="Échanges">
            <ul>
              <li>Proposez à tout moment des villes, des aéroports, des compagnies et de l’argent à un autre joueur.</li>
              <li>On peut échanger même avec un solde négatif, tant qu’on a l’argent qu’on propose.</li>
              <li>Les échanges en cours entre les autres joueurs sont visibles dans le panneau des échanges.</li>
            </ul>
          </Section>
          <Section icon="🔨" title="Enchères" off={!settings ? false : !s.auction}>
            <p>Option de l’hôte (désactivée par défaut) : si un joueur refuse d’acheter, la propriété est mise aux enchères.</p>
          </Section>
          <Section icon="🅿️" title="Cagnotte du Parc gratuit" off={off('freeParkingPot')}>
            <p>Les taxes et amendes vont dans une cagnotte, remportée par le joueur qui s’arrête sur le Parc gratuit.</p>
          </Section>

          <h3>Les ajouts de Monopqojim</h3>
          <Section icon="✈️" title="Détournement d’avion">
            <p>En vous arrêtant sur un aéroport, payez {RULES.HIJACK_PRICE} $ ({RULES.HIJACK_PRICE_OWN} $ si l’aéroport est à vous) pour détourner un avion : il s’écrase sur une ville adverse construite tirée au hasard, en direct, et détruit son bâtiment.</p>
          </Section>
          <Section icon="💊" title="Trafic de drogue">
            <p>Carte Chance : +{RULES.TRAFFIC_BONUS} $ au prochain passage par Départ. Mais si vous allez en prison avant, la peine est doublée ({RULES.TRAFFIC_JAIL_TURNS} tours) et seul un double vous libère.
              {off('trafficCaughtOnVisit') ? '' : ' Attention : s’arrêter sur la case Prison en simple visite vous fait aussi arrêter.'}</p>
          </Section>
          <Section icon="🦹" title="Simple visite à la prison" off={off('jailVisitSteal')}>
            <p>Le visiteur entre dans la prison et vole {RULES.JAIL_VISIT_STEAL} $ (ou ce qu’il leur reste) à chaque prisonnier.</p>
          </Section>
          <Section icon="🇫🇷" title="Régime de Vichy">
            <p>Carte Chance (3 joueurs minimum) : vous collaborez avec un joueur tiré au hasard pendant {RULES.VICHY_ROUNDS} tours de table. Vous ne vous payez plus de loyer, vos villes comptent ensemble pour les pays et vous partagez les loyers encaissés. Ensuite, chacun récupère ses biens.</p>
          </Section>
          <Section icon="🔀" title="Échange forcé">
            <p>Carte Chance : une de vos villes est échangée au hasard contre celle d’un adversaire.</p>
          </Section>
          <Section icon="🎰" title="Casino de Macao">
            <p>Choisissez votre jeu et misez la somme de votre choix ({CASINO.MAX_SPINS} parties max par arrêt, tous jeux confondus).</p>
            <ul>
              <li>Machine à sous : trois symboles identiques rapportent de ×{Math.min(...CASINO.SYMBOLS.map((x) => x.mult))} à ×{Math.max(...CASINO.SYMBOLS.map((x) => x.mult))} la mise, deux identiques ×{CASINO.PAIR}.</li>
              <li>Roulette ({ROULETTE.ORDER.length} cases, de 0 à 36) : un numéro ×36, une douzaine ×3, rouge/noir, pair/impair, 1-18/19-36 ×2. Le 0 fait perdre les paris simples.</li>
            </ul>
          </Section>
          <Section icon="🎲" title="Dé spécial">
            <p>Carte Chance : vous gagnez un dé truqué avec un chiffre fixe (de {SPECIAL_DIE.MIN} à {SPECIAL_DIE.MAX}, tiré au moment de la pioche). Gardez-le et jouez-le quand vous voulez à la place des dés : vous avancez exactement de sa valeur (ce n’est jamais un double). Inutile en prison.</p>
          </Section>
          <Section icon="🗺️" title="Grand plateau" off={settings ? !s.bigBoard : false}>
            <p>Option de l’hôte : {BOARDS.big.n} cases au lieu de {BOARDS.classic.n}, avec {Object.keys(BOARDS.big.countryCells).filter((k) => !BOARDS.classic.countryCells[k]).map((k) => COUNTRIES[k].name).join(', ')} en plus, une 3e compagnie (gaz) et des loyers un peu plus chers. Parties plus longues.</p>
          </Section>
          <Section icon="⚔️" title="Goulag" off={off('goulag')}>
            <ul>
              <li>Un joueur en faillite part au goulag (une seule fois par partie). Dès que deux joueurs y sont et qu’il en reste au moins deux en jeu, ils s’affrontent en duel à la première personne.</li>
              <li>Le vainqueur revient avec {goulagMoney} $, le perdant est éliminé. Les autres regardent en spectateurs.</li>
              <li>Commandes : souris pour viser, ZQSD / WASD pour bouger, clic gauche pour tirer, clic droit ou F pour la machette, Espace pour la roulade.</li>
            </ul>
          </Section>
          <Section icon="🏛️" title="Civilisations" off={off('civs')}>
            <p>Purement esthétique : chaque joueur choisit le style de ses bâtiments.</p>
            <ul className="rs-civs">
              {Object.values(CIVS).map((c) => <li key={c.name}><b>{c.icon} {c.name}</b> : {c.levels.join(' → ')}</li>)}
            </ul>
          </Section>
          <Section icon="⏸️" title="Pause">
            <p>Il faut que la moitié des joueurs connectés votent pour mettre la partie en pause, et la moitié pour la reprendre.</p>
          </Section>
          <Section icon="🔌" title="Déconnexion">
            <p>Un joueur déconnecté est remplacé par un bot après un délai (prolongeable par les autres). Il garde ses biens et reprend la main en revenant.</p>
          </Section>
          <Section icon="👀" title="Astuces">
            <ul>
              <li>Survolez le nom d’un joueur pour voir toutes ses propriétés sur le plateau.</li>
              <li>Cliquez sur une case pour voir ses loyers et son propriétaire.</li>
              <li>Trois vues au choix : plateau 2D, 3D, ou à la première personne depuis votre pion.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

// Bouton qui ouvre la fiche des règles
export default function RulesButton({ settings, className = 'btn', label = '📜 Règles' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} title="Toutes les règles du jeu">{label}</button>
      {open && <RulesSheet settings={settings} onClose={() => setOpen(false)} />}
    </>
  );
}
