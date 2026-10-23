import React from 'react';
import { BOARD, COUNTRIES, COUNTRY_CELLS, AIRPORT_RENTS, RULES, CASINO, housePrice, resaleValue } from '../../../shared/board.js';
import { act } from '../net.js';
import { money, playerById, ownsCountry, groupHasBuildings } from '../gameInfo.js';
import { flagSvg } from '../flags.js';

const DESCRIPTIONS = {
  go: `Recevez ${RULES.GO_SALARY} $ à chaque passage. Les trafiquants touchent ${RULES.TRAFFIC_BONUS} $ de plus en écoulant leur marchandise.`,
  jail: 'Simple visite… sauf pour les trafiquants : la police contrôle les visiteurs (selon les règles de la partie).',
  gotojail: `Direction la prison ! Un trafiquant arrêté écope de ${RULES.TRAFFIC_JAIL_TURNS} tours et ne peut sortir qu’en faisant un double.`,
  parking: 'Les taxes et amendes alimentent la cagnotte, récupérée par le joueur qui s’arrête ici.',
  chance: 'Tirez une carte Chance. Attention au trafic de drogue et aux échanges forcés !',
  chest: 'Tirez une carte Caisse de communauté.',
  tax: 'Payez la taxe à la banque (ou à la cagnotte du Parc gratuit).',
  casino: `Machine à sous : misez la somme de votre choix, jusqu’à ${CASINO.MAX_SPINS} parties par arrêt. Trois symboles identiques : mise × 5 à × 20 (7️⃣ = × 20). Deux identiques : mise × ${CASINO.PAIR}.`,
};

export default function CellCard({ state, me, index, onClose }) {
  const cell = BOARD[index];
  const prop = state.props[index];
  const owner = prop?.owner && playerById(state, prop.owner);
  const country = cell.country && COUNTRIES[cell.country];
  const mine = prop?.owner === me;
  const myTurn = state.turn?.pid === me;

  let rows = null;
  if (cell.type === 'city') {
    const labels = ['Loyer', 'Avec 1 maison', 'Avec 2 maisons', 'Avec 3 maisons', 'Avec 4 maisons', 'Avec un hôtel'];
    const full = prop?.owner && ownsCountry(state, prop.owner, cell.country);
    rows = labels.map((l, k) => (
      <tr key={k} className={prop?.owner && prop.houses === k && !(k === 0 && full) ? 'current' : ''}>
        <td>{l}</td><td>{money(cell.rents[k])}</td>
      </tr>
    ));
    rows.splice(1, 0, (
      <tr key="full" className={full && !prop.houses ? 'current' : 'muted'}>
        <td>Pays complet (sans maison)</td><td>{money(cell.rents[0] * 2)}</td>
      </tr>
    ));
  } else if (cell.type === 'airport') {
    rows = AIRPORT_RENTS.map((r, k) => <tr key={k}><td>{k + 1} aéroport{k ? 's' : ''}</td><td>{money(r)}</td></tr>);
  } else if (cell.type === 'utility') {
    rows = [
      <tr key="1"><td>1 compagnie</td><td>4 × les dés</td></tr>,
      <tr key="2"><td>2 compagnies</td><td>10 × les dés</td></tr>,
    ];
  }

  const canBuild = mine && cell.type === 'city' && myTurn && ownsCountry(state, me, cell.country) && prop.houses < 5;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cell-card" onClick={(e) => e.stopPropagation()}>
        <div className="cc-head" style={{ background: country?.color || '#3b2f63' }}>
          {country && <span className="flag big" dangerouslySetInnerHTML={{ __html: flagSvg(country.code) }} />}
          <div>
            <div className="cc-name">{cell.type === 'airport' ? `✈️ ${cell.name}` : cell.type === 'utility' ? `${cell.icon} ${cell.name}` : cell.name}</div>
            {country && <div className="cc-country">{country.name} · {COUNTRY_CELLS[cell.country].length} villes</div>}
          </div>
        </div>
        <div className="cc-body">
          {DESCRIPTIONS[cell.type] && <p>{DESCRIPTIONS[cell.type]}</p>}
          {rows && <table className="rent-table"><tbody>{rows}</tbody></table>}
          {cell.type === 'city' && (
            <div className="cc-info">
              <span>🏠 Maison : {money(housePrice(cell))}</span>
              <span>🏨 Hôtel : {money(housePrice(cell))} + 4 maisons</span>
            </div>
          )}
          {cell.type === 'airport' && (
            <p className="note">En vous arrêtant ici, vous pouvez détourner un avion pour {money(RULES.HIJACK_PRICE)} : il s’écrase sur une ville adverse construite tirée au hasard et en détruit les maisons ou l’hôtel.</p>
          )}
          {cell.price && (
            <div className="cc-info">
              <span>Prix : {money(cell.price)}</span>
              <span>Revente à la banque : {money(resaleValue(cell))}</span>
            </div>
          )}
          {cell.price && (
            <div className="cc-owner">
              {owner
                ? <>Propriétaire : <b style={{ color: owner.color }}>{owner.name}</b>{prop.houses === 5 ? ' · 🏨 hôtel' : prop.houses ? ` · 🏠 × ${prop.houses}` : ''}</>
                : 'Disponible à l’achat'}
            </div>
          )}
          {mine && (
            <div className="cc-actions">
              {cell.type === 'city' && (
                <>
                  <button className="btn primary" disabled={!canBuild} title={!myTurn ? 'Seulement pendant votre tour' : ''}
                    onClick={() => act('build', { cell: index })}>
                    {prop.houses === 4 ? 'Construire un hôtel' : 'Construire une maison'} ({money(housePrice(cell))})
                  </button>
                  <button className="btn" disabled={!prop.houses} onClick={() => act('sell', { cell: index })}>Vendre un bâtiment (+{money(housePrice(cell) / 2)})</button>
                </>
              )}
              <button className="btn danger" disabled={groupHasBuildings(state, index)}
                title={groupHasBuildings(state, index) ? 'Vendez d’abord les bâtiments du pays' : 'La propriété redevient libre à l’achat'}
                onClick={() => confirm(`Revendre ${cell.name} à la banque pour ${money(resaleValue(cell))} ?`) && act('sellProperty', { cell: index })}>
                Revendre à la banque (+{money(resaleValue(cell))})
              </button>
            </div>
          )}
          {mine && cell.type === 'city' && !ownsCountry(state, me, cell.country) && (
            <p className="note">Possédez toutes les villes de {country.name} pour construire.</p>
          )}
        </div>
        <button className="btn ghost close" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
