# 🌍 Monopqojim — Monopoly mondial en ligne

Jeu de Monopoly multijoueur en temps réel (inspiré de richup.io) : les rues sont remplacées par des **villes du monde regroupées par pays**, avec des règles maison explosives.

## Lancer en local

```bash
npm install
npm run dev        # serveur (port 3000) + client Vite avec rechargement (http://localhost:5173)
```

Version « production » (un seul serveur qui sert aussi le client) :

```bash
npm run build
npm start          # http://localhost:3000
```

Test de robustesse du moteur (200 parties bots contre bots) : `npm test`.

## Mise en ligne (déploiement automatique)

Le jeu est en ligne sur **https://www.quentin-chirat.com/monopqojim**.

- **Render** fait tourner le serveur Node (`render.yaml`). À chaque push sur `main`, l’action GitHub `.github/workflows/deploy.yml` vérifie que le jeu compile puis appelle le *Deploy Hook* de Render (secret GitHub `RENDER_DEPLOY_HOOK_URL`), ce qui redéploie le jeu. Le plan gratuit se met en veille après 15 min sans visite ; pour l’éviter, le serveur se rend visite à lui-même toutes les 10 min (`/health`, via `RENDER_EXTERNAL_URL` fournie par Render ; désactivable avec la variable `KEEP_ALIVE=0`). Un service toujours allumé consomme ~744 h/mois, sous la limite de 750 h gratuites par compte Render (à condition de ne pas avoir d’autre service gratuit qui tourne en permanence). Après un redéploiement, le serveur redémarre et les parties en cours sont perdues.
- **OVH** (hébergement du site) sert seulement la page `deploy/ovh/` dans le dossier `www/monopqojim/` : elle affiche le jeu en plein écran (iframe), montre un écran d’attente pendant le réveil du serveur et garde dans la barre d’adresse un lien partageable vers la partie (`…/monopqojim?room=CODE`). Elle n’a besoin d’être déposée qu’une fois ; à re-déposer seulement si elle change.
- La variable `VITE_PUBLIC_URL` (définie dans `render.yaml`) fait pointer les liens d’invitation vers le site plutôt que vers Render. La démo est sur `…/monopqojim/demo`.

Mise en place (une seule fois) :
1. Sur render.com, se connecter avec GitHub, puis **New > Blueprint** et choisir le dépôt `quentinchad/monopqojim` : Render lit `render.yaml` et crée le service `monopqojim`.
2. Vérifier l’adresse du service (normalement `https://monopqojim.onrender.com`) ; si elle est différente, l’indiquer dans la variable `GAME` de `deploy/ovh/index.html`.
3. Déposer `deploy/ovh/index.html` et `deploy/ovh/.htaccess` par FTP dans `www/monopqojim/` sur l’hébergement OVH.
4. Dans Render, service > **Settings > Deploy Hook** : copier l’URL. Dans GitHub, dépôt > **Settings > Secrets and variables > Actions > New repository secret** : nom `RENDER_DEPLOY_HOOK_URL`, valeur = cette URL.

Autres options : `docker build -t monopqojim .` puis `docker run -p 3000:3000 monopqojim`, ou n’importe quel hébergeur Node avec WebSockets (build : `npm install && npm run build`, démarrage : `npm start`).

## Règles

### Plateau
8 pays : 🇧🇷 Brésil, 🇨🇳 Chine, 🇪🇸 Espagne, 🇩🇪 Allemagne, 🇮🇹 Italie, 🇯🇵 Japon, 🇫🇷 France, 🇺🇸 États-Unis (2 ou 3 villes chacun). Pour construire des maisons puis un hôtel, il faut posséder **toutes les villes du pays** (construction uniforme, comme au Monopoly classique). Les cases achetées prennent la couleur de leur propriétaire (contour + fond teinté en 2D, bordure lumineuse en 3D) et affichent le loyer actuel.

### 🎰 Casino de Macao
La case Casino remplace Shanghai (la Chine compte donc 2 villes : Pékin et Hong Kong). Le joueur qui s’y arrête peut jouer à la **machine à sous** : il mise la somme de son choix (au plus son argent), **5 parties maximum** par arrêt, et peut partir quand il veut. Les 3 rouleaux sont tirés au hasard : **3 symboles identiques** rapportent la mise × 5 à × 20 selon le symbole (7️⃣ = × 20), **2 identiques** rapportent la mise × 1,5, sinon la mise est perdue (espérance ≈ 95 % de la mise). Tous les joueurs voient les rouleaux tourner.

### 🏦 Pas d’hypothèque
Il n’y a plus d’hypothèque : pour trouver de l’argent, on vend ses bâtiments (moitié du prix) puis on **revend ses propriétés à la banque** pour la moitié de leur prix d’achat. Elles redeviennent libres à l’achat.

### ✈️ Aéroports et détournements
Les gares sont remplacées par 4 aéroports (Dubaï, Charles de Gaulle, JFK, Haneda), loyers 25/50/100/200 $. Quand un joueur s’arrête sur un aéroport (acheté ou non), il peut payer **150 $** (prix fixe, réglable dans `RULES.HIJACK_PRICE`) pour **détourner un avion**. La cible n’est **pas annoncée** : au moment du paiement, une **ville adverse construite** (1 à 4 maisons ou un hôtel) est tirée au hasard, et tous les joueurs la découvrent en direct dans la cinématique. Tous ses bâtiments sont détruits et la ville redevient un terrain nu.

Chaque détournement déclenche chez tous les joueurs une **cinématique 3D** (~9 s) : l’avion décolle de l’aéroport, vole jusqu’à la ville tirée au sort et s’écrase sur ses maisons ou son hôtel ; la ville et la victime ne sont révélées qu’à l’impact (et dans le journal juste après).

### 🚔 Prison
Chaque envoi en prison (case « Allez en prison », carte, 3 doubles, trafiquant contrôlé) déclenche chez tous les joueurs une **cinématique d’arrestation** (~8 s) : le pion avance jusqu’à la case, s’enfuit vers la prison, un policier le course et le plaque au sol, puis l’écran passe en noir et blanc avec **« BUSTED »** façon GTA.

### 💊 Trafic de drogue (carte Chance)
Le joueur qui tire la carte transporte de la drogue :
- au prochain passage par **Départ**, il touche **+300 $** en plus des 200 $ et le trafic s’arrête. Une **cinématique 3D « Say my name »** (~18 s) se joue alors chez tous les joueurs : dans le désert, Heisenberg (pion à chapeau pork-pie, lunettes et bouc) fait face au pion du joueur, entouré de sa voiture, de Mike et Jesse et des 4×4 noirs d’en face ;
- s’il est **envoyé en prison** avant (case « Allez en prison », carte, 3 doubles — et, option activée par défaut, s’il s’arrête sur la case Prison elle-même), la peine est **doublée : 6 tours**, sans caution ni carte « libéré de prison » : **seul un double le libère**.

### ⛓️ Goulag
Un joueur en faillite part au goulag (**une seule fois par partie**). Dès qu’il y a **2 joueurs au goulag et au moins 2 joueurs encore en jeu**, ils s’affrontent dans un **duel en arène** (ZQSD/WASD pour bouger, souris pour viser, clic pour tirer, Espace pour esquiver, 75 s max). Le perdant est éliminé définitivement, le gagnant revient sur la case Départ avec **1 000 $** (réglable). Sinon le joueur au goulag attend.

### 🔀 Échange forcé (carte Chance)
Une ville du joueur et une ville d’un adversaire sont tirées au hasard et échangées (parmi les propriétés dont le pays n’a pas de bâtiments).

### Le reste
**Déconnexions** : quand un joueur se déconnecte, la partie **l’attend** pendant un décompte (2 min par défaut, réglable dans le salon) affiché chez les autres joueurs, qui peuvent lui accorder +1 min ; personne ne joue à sa place pendant ce temps. À la fin du décompte, **un bot prend sa place** (il garde ses biens et joue comme les autres bots). Dès qu’il revient, le joueur reprend la main, même après le remplacement. Pour retrouver sa place, il suffit de rouvrir le lien de la partie : le navigateur mémorise un jeton par partie (même après avoir fermé l’onglet) ; depuis un autre appareil, rejoindre avec **le même pseudo** reprend la place d’un joueur déconnecté. Seul un duel du goulag ne peut pas attendre : un joueur déconnecté y est joué par l’IA.

**Thèmes visuels** : 5 thèmes au choix (🌃 Nuit violette, 🌳 Classique jour, 🌊 Océan, 🌆 Néon, 🏜️ Désert), sélectionnables à tout moment. Chacun change les couleurs de l’interface et du plateau, et en 3D / FPS le ciel, la lumière et le décor autour du plateau (ville illuminée, parc arboré, île tropicale avec bateaux, ville néon, désert avec pyramides). Le choix est propre à chaque joueur.

**Échanges** : une proposition reçue s’ouvre dans une fenêtre chez le destinataire (avec un carillon), qui peut accepter, refuser ou **négocier** : la contre-proposition, pré-remplie, remplace l’offre reçue et s’ouvre à son tour chez l’autre joueur. « Répondre plus tard » la laisse dans le panneau Échanges (bouton 👁 Voir). L’auteur est prévenu d’un refus.

**Argent de départ** : de 500 $ à 3 000 $, réglable dans le salon.

**🔊 Bruitages** : sons synthétisés en direct (Web Audio, aucun fichier à charger) pour les dés, les pas des pions, votre tour, achats, constructions, loyers et gains, cartes, enchères (mises et marteau), échanges, casino (levier, rouleaux, jackpot), duel du goulag (compte à rebours, tirs, touches), annonces, et une bande-son pour chaque cinématique (réacteurs et explosion, sirène et plaquage, vent du désert et impact du titre « Heisenberg »). Bouton 🔊 / 🔇 et volume réglable dans le salon, l’accueil, la partie et la démo ; le choix est mémorisé dans le navigateur.

**Statistiques de fin de partie** : à la fin, un écran s’ouvre pour tout le monde avec le classement, la courbe d’évolution du patrimoine de chaque joueur tour par tour (survol pour le détail, vue tableau), les loyers payés et perçus, des trophées (roi du loyer, pirate de l’air, baron de la drogue, roi des doubles…), la ville la plus visitée, la propriété la plus rentable et un tableau détaillé par joueur.

**Page de démo** (accessible uniquement par son adresse, aucun lien depuis l’accueil) : `/demo` permet de voir les animations sans jouer une partie (cinématique de l’avion, « Say my name », machine à sous du casino, duel du goulag contre un bot ou entre bots, arrestation « BUSTED », cartes et annonces, dés, statistiques d’une partie simulée entre bots).

Enchères (proposées au joueur qui refuse d’acheter), cagnotte du Parc gratuit (option), revente à la banque, échanges libres entre joueurs (argent, villes, cartes prison), faillite, bots pour compléter la partie, reconnexion après rafraîchissement.

## Structure

```
shared/   plateau, villes, pays, cartes (communs serveur/client)
server/   index.js (Express + Socket.IO), game.js (moteur de règles), fight.js (duel du goulag), bots.js (IA)
client/   React + Vite : plateau 2D, vue 3D three.js, lobby, échanges, combat
```

Les constantes de règles (bonus du trafic, ratio du détournement, argent du goulag, revente…) sont dans `shared/board.js` (`RULES`), et celles du casino (symboles, gains, nombre de parties) dans `CASINO`.

Pour tester les règles spéciales en local : `node server/index.js --debug` active des commandes de test (jamais en production).
