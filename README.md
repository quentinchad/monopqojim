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

- **Render** fait tourner le serveur Node (`render.yaml`). Chaque push sur `main` déclenche automatiquement un nouveau build et un redéploiement. Le plan gratuit se met en veille après 15 min sans visite : le premier chargement suivant prend jusqu’à ~1 min, et les parties en cours sont perdues à la mise en veille.
- **OVH** (hébergement du site) sert seulement la page `deploy/ovh/` dans le dossier `www/monopqojim/` : elle affiche le jeu en plein écran (iframe), montre un écran d’attente pendant le réveil du serveur et garde dans la barre d’adresse un lien partageable vers la partie (`…/monopqojim?room=CODE`). Elle n’a besoin d’être déposée qu’une fois ; à re-déposer seulement si elle change.
- La variable `VITE_PUBLIC_URL` (définie dans `render.yaml`) fait pointer les liens d’invitation vers le site plutôt que vers Render. La démo est sur `…/monopqojim/demo`.

Mise en place (une seule fois) :
1. Sur render.com, se connecter avec GitHub, puis **New > Blueprint** et choisir le dépôt `quentinchad/monopqojim` : Render lit `render.yaml` et crée le service `monopqojim`.
2. Vérifier l’adresse du service (normalement `https://monopqojim.onrender.com`) ; si elle est différente, l’indiquer dans la variable `GAME` de `deploy/ovh/index.html`.
3. Déposer `deploy/ovh/index.html` et `deploy/ovh/.htaccess` par FTP dans `www/monopqojim/` sur l’hébergement OVH.

Autres options : `docker build -t monopqojim .` puis `docker run -p 3000:3000 monopqojim`, ou n’importe quel hébergeur Node avec WebSockets (build : `npm install && npm run build`, démarrage : `npm start`).

## Règles

### Plateau
8 pays : 🇧🇷 Brésil, 🇨🇳 Chine, 🇪🇸 Espagne, 🇩🇪 Allemagne, 🇮🇹 Italie, 🇯🇵 Japon, 🇫🇷 France, 🇺🇸 États-Unis (2 ou 3 villes chacun). Pour construire des maisons puis un hôtel, il faut posséder **toutes les villes du pays** (construction uniforme, comme au Monopoly classique). Les cases achetées prennent la couleur de leur propriétaire (contour + fond teinté en 2D, bordure lumineuse en 3D) et affichent le loyer actuel.

### ✈️ Aéroports et détournements
Les gares sont remplacées par 4 aéroports (Dubaï, Charles de Gaulle, JFK, Haneda), loyers 25/50/100/200 $. Quand un joueur s’arrête sur un aéroport (acheté ou non), il peut **détourner un avion** pour détruire l’hôtel adverse le plus proche sur le plateau. Coût : **50 % du prix de construction de cet hôtel** (5 × prix d’une maison du pays), payé à la banque. La ville redevient un terrain nu.

Chaque détournement déclenche chez tous les joueurs une **cinématique 3D** (~9 s) : l’avion décolle de l’aéroport, vole jusqu’à l’hôtel et s’écrase dessus.

### 🚔 Prison
Chaque envoi en prison (case « Allez en prison », carte, 3 doubles, trafiquant contrôlé) déclenche chez tous les joueurs une **cinématique d’arrestation** (~8 s) : le pion avance jusqu’à la case, s’enfuit vers la prison, un policier le course et le plaque au sol, puis l’écran passe en noir et blanc avec **« BUSTED »** façon GTA.

### 💊 Trafic de drogue (carte Chance)
Le joueur qui tire la carte transporte de la drogue :
- au prochain passage par **Départ**, il touche **+300 $** en plus des 200 $ et le trafic s’arrête ;
- s’il est **envoyé en prison** avant (case « Allez en prison », carte, 3 doubles — et, option activée par défaut, s’il s’arrête sur la case Prison elle-même), la peine est **doublée : 6 tours**, sans caution ni carte « libéré de prison » : **seul un double le libère**.

### ⛓️ Goulag
Un joueur en faillite part au goulag (**une seule fois par partie**). Dès qu’il y a **2 joueurs au goulag et au moins 2 joueurs encore en jeu**, ils s’affrontent dans un **duel en arène** (ZQSD/WASD pour bouger, souris pour viser, clic pour tirer, Espace pour esquiver, 75 s max). Le perdant est éliminé définitivement, le gagnant revient sur la case Départ avec **1 000 $** (réglable). Sinon le joueur au goulag attend.

### 🔀 Échange forcé (carte Chance)
Une ville du joueur et une ville d’un adversaire sont tirées au hasard et échangées (parmi les propriétés dont le pays n’a pas de bâtiments).

### Le reste
**Déconnexions** : un joueur qui se déconnecte est joué par un pilote automatique prudent (il lance les dés et finit son tour, sans rien acheter). Un décompte (2 min par défaut, réglable dans le salon) s’affiche chez les autres joueurs, qui peuvent lui accorder +1 min. S’il revient avant la fin, il reprend la main ; sinon il abandonne (ses biens reviennent à la banque, sans goulag).

**Thèmes visuels** : 5 thèmes au choix (🌃 Nuit violette, 🌳 Classique jour, 🌊 Océan, 🌆 Néon, 🏜️ Désert), sélectionnables à tout moment. Chacun change les couleurs de l’interface et du plateau, et en 3D / FPS le ciel, la lumière et le décor autour du plateau (ville illuminée, parc arboré, île tropicale avec bateaux, ville néon, désert avec pyramides). Le choix est propre à chaque joueur.

**Statistiques de fin de partie** : à la fin, un écran s’ouvre pour tout le monde avec le classement, la courbe d’évolution du patrimoine de chaque joueur tour par tour (survol pour le détail, vue tableau), les loyers payés et perçus, des trophées (roi du loyer, pirate de l’air, baron de la drogue, roi des doubles…), la ville la plus visitée, la propriété la plus rentable et un tableau détaillé par joueur.

**Page de démo** (accessible uniquement par son adresse, aucun lien depuis l’accueil) : `/demo` permet de voir les animations sans jouer une partie (cinématique de l’avion, duel du goulag contre un bot ou entre bots, arrestation « BUSTED », cartes et annonces, dés, statistiques d’une partie simulée entre bots).

Enchères (proposées au joueur qui refuse d’acheter), cagnotte du Parc gratuit (option), hypothèques, échanges libres entre joueurs (argent, villes, cartes prison), faillite, bots pour compléter la partie, reconnexion après rafraîchissement.

## Structure

```
shared/   plateau, villes, pays, cartes (communs serveur/client)
server/   index.js (Express + Socket.IO), game.js (moteur de règles), fight.js (duel du goulag), bots.js (IA)
client/   React + Vite : plateau 2D, vue 3D three.js, lobby, échanges, combat
```

Les constantes de règles (bonus du trafic, ratio du détournement, argent du goulag…) sont dans `shared/board.js` (`RULES`).

Pour tester les règles spéciales en local : `node server/index.js --debug` active des commandes de test (jamais en production).
