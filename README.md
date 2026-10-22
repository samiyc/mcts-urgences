# mcts-urgences

Un assistant d'organisation pour les urgences d'un hôpital : quel patient passe, dans quel box, avec quel
médecin, quand l'afflux dépasse les ressources. **Il propose, l'humain décide. Il ne donne jamais d'avis
médical** : il organise les files d'attente, les box, les blocs et les médecins, en temps de crise.

Statut (22/10/2026) : le simulateur d'une garde, trois règles de référence et leur comparaison par paires
sur trois hôpitaux (`npm run compare`, [`docs/modele.md`](docs/modele.md)), et la recherche (ISMCTS sur des
mondes communs) : −13,5 % de coût du retard sur la meilleure règle un jour ordinaire. Le soir, la
réévaluation par un infirmier d'accueil et une seconde mesure, le coût du retard au niveau du moment (les
aggravations en attente comptent) : sur elle, pendant l'accident, la recherche fait −19 % sur la meilleure
règle. C'est l'étape 2 de la
[feuille de route](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md),
juste après l'ordonnanceur de Lopin, dont il reprend toutes les pièces.

## Voir la page

`npm install` (une fois : il relie `../mcts-commun`), puis `npm run page` et ouvrir
http://127.0.0.1:4801/web/. Une garde tirée, jouée sous la règle choisie, dans l'hôpital choisi, avec ou sans
l'accident : la garde rejouée sur un plan du service (l'entrée, la salle d'attente, les box, à la vitesse
choisie), les box au fil de la garde, la salle d'attente, les patients les plus mal servis avec leur
niveau réel (ce que personne ne voyait), puis les trois règles sur les mêmes 100 gardes. Avec la recherche, la
comparaison se fait sur 12 gardes, jouées côte à côte dans des *workers* (`web/shift-worker.js`, tous les cœurs
sauf deux) : une dizaine de secondes au lieu de plusieurs minutes sur un seul cœur (23/10/2026).

## Le problème

- **Les ressources** : les box et les lits, les médecins et les infirmiers, les blocs opératoires, le
  matériel limité (l'imagerie, par exemple).
- **Les arrivées** : les patients à pied, et les ambulances des pompiers, annoncées un peu à l'avance.
- **Le tri** : la couleur du bracelet donne une priorité et un délai maximal d'attente. L'échelle de
  Manchester en est un exemple : immédiat, 10, 60, 120 ou 240 minutes.
- **Le caché** : l'état réel du patient, que la couleur ne fait qu'estimer, et qui peut s'aggraver pendant
  l'attente. C'est la main adverse de Lopin : on la devine d'après ce qu'on voit.
- **Le parcours** : une suite de prérequis, du tri au box, à l'imagerie, à l'avis, puis au bloc ou à la
  sortie.

| Dans l'ordonnanceur de Lopin | Aux urgences |
|---|---|
| un job | un patient |
| la priorité 1, 2 ou 3 | la couleur du bracelet |
| l'échéance (`due`) | le délai maximal de sa couleur |
| les prérequis (`after`) | le parcours |
| les fils, la RAM | les box, les médecins, les blocs |
| la durée réelle, cachée | l'état réel, caché |

## La démarche

1. **Un simulateur pur et testé**, à événements discrets (`events` et `schedule` de `mcts-commun`).
2. **Des règles de référence**, mesurées sur les mêmes crises : l'ordre d'arrivée, la couleur puis
   l'arrivée, la règle de Smith pondérée par la couleur.
3. **Le planificateur** : une recherche (`mcts` de `mcts-commun`) qui tire des états réels compatibles avec
   ce qu'on sait des patients (la famille POMCP), jugée contre les règles, par paires, sur les mêmes crises.
4. **La page** : une crise jouée de trois façons, l'humain seul, l'humain aidé par l'assistant, l'assistant
   seul. L'écart entre les deux premières est l'argument de la démonstration.
5. **Dans un deuxième temps, l'hôpital en plan** : un hôpital factice « standard », avec l'accueil et le
   tri, la salle d'attente, les box, le déchocage, l'imagerie, le bloc et l'UHCD. Les patients et les
   soignants se déplacent, la salle d'attente sature, les couloirs se bouchent, un patient impatient peut
   causer un incident, et l'on appelle la sécurité (le module `grid` de `mcts-commun`).

## D'où ça vient

- [`planification.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/planification.md) § 3 :
  le problème en détail, la correspondance avec l'ordonnanceur, un scénario de crise, les limites.
- [`feuille-de-route.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md) :
  l'ordre des projets, la coopération entre un humain et des robots, la bibliothèque commune.
