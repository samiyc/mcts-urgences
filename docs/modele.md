# Le modèle des urgences, première version (22/10/2026)

Un simulateur à événements discrets d'une garde de 8 h, sans recherche encore : les patients, le tri, les
box, les médecins, et trois règles de référence. Tous les nombres sont dans `src/hypotheses.js` et sont
**des hypothèses, pas des données médicales** : des chiffres ronds pour un service plausible, à remplacer
par des chiffres publiés.

## Ce qui se passe

- **Les arrivées** : des patients à pied (6 par heure par défaut) et des ambulances (1,5 par heure),
  chacun avec un niveau réel de 1 (rouge) à 5 (bleu), selon des parts différentes pour les deux sources.
- **Le tri** donne une couleur : le bon niveau 8 fois sur 10, sinon un niveau à côté. La couleur est ce que
  le service voit ; **le niveau réel reste caché**.
- **Les délais maximaux** par couleur, sur le modèle de l'échelle de Manchester : rouge immédiat, orange
  10 min, jaune 60, vert 120, bleu 240.
- **Les soins** : un box et un médecin pour l'examen (de 10 à 60 min selon le niveau), puis le box seul pour
  les soins et les résultats (de 5 à 120 min). Les durées varient d'un patient à l'autre.
- **L'aggravation** : un patient de niveau 2 à 4 qui attend au-delà du délai de son niveau réel peut monter
  d'un niveau, après un délai tiré (90 min en moyenne). Son bracelet ne change pas : personne ne le voit.
- **L'accident** (`ACCIDENT`) : dix victimes amenées en une demi-heure, 1 h 30 après le début de la garde.
- **Les hôpitaux** (`HOSPITALS`) : de proximité (6 box, 2 médecins), moyen (12 et 4), grand CHU (24 et 8).
  Chacun tourne à environ 80 % de charge un jour ordinaire.

## Ce qu'on mesure

- **Le coût du retard**, le score principal : les minutes passées au-delà du délai du niveau réel, pondérées
  par le niveau (16 pour un rouge, 8, 4, 2, 1 pour un bleu). Plus bas, c'est mieux.
- Les patients vus en retard, les patients aggravés en attendant, la part des urgents (rouges et oranges)
  vus à temps, l'attente moyenne, le pic de la salle d'attente, l'occupation des box et des médecins.
- **Les règles se comparent par paires** : chaque règle joue les mêmes gardes tirées (`compareRules`), et
  l'écart avec l'ordre d'arrivée vient avec son intervalle à 95 % (`paired` de `mcts-commun`).

## Les règles de référence

| Règle | Ce qu'elle fait |
|---|---|
| ordre d'arrivée | le premier arrivé passe ; la couleur est ignorée |
| couleur, puis arrivée | la couleur la plus urgente d'abord |
| échéance la plus proche | l'arrivée plus le délai de la couleur, la plus proche d'abord |

## Premiers résultats (`npm run compare`, gardes tirées par paires)

Coût du retard moyen, et gain sur l'ordre d'arrivée avec son intervalle :

| Hôpital, situation | arrivée | couleur | échéance |
|---|---|---|---|
| moyen, jour ordinaire (200 gardes) | 1 751 | 1 039 (gain 572 à 852) | 965 (gain 625 à 946) |
| moyen, accident (200) | 24 876 | 20 914 (gain 3 114 à 4 810) | 26 026 (perte 411 à 1 888) |
| de proximité, accident (100) | 49 183 | 39 728 (gain 7 958 à 10 952) | 48 295 (−69 à 1 845) |
| grand CHU, accident (100) | 8 056 | 5 816 (gain 1 776 à 2 703) | 5 208 (gain 2 101 à 3 595) |

- **Trier sert toujours** : la couleur bat l'ordre d'arrivée partout.
- **L'échéance la plus proche s'effondre en surcharge** : excellente un jour ordinaire et au grand CHU,
  elle fait pire que l'ordre d'arrivée quand l'accident sature un hôpital moyen. C'est un résultat connu de
  l'ordonnancement : en surcharge, elle s'acharne sur les patients déjà en retard.
- **La meilleure règle dépend donc de l'hôpital et de la situation.** C'est la place d'un planificateur qui
  regarde l'état du service au lieu d'appliquer une règle fixe.
- **Les rouges vus à temps restent rares pendant l'accident** (17 à 34 %), parce qu'un rouge ne peut pas
  attendre du tout. Aucune règle n'utilise l'annonce des ambulances, 15 min à l'avance : garder un box et un
  médecin libres pour un rouge annoncé est exactement le genre de décision qu'une recherche peut prendre et
  qu'une règle ne prend pas.

## La suite

1. **La page** : une garde jouée sous une règle, les box en diagramme, la salle d'attente au fil du temps.
2. **Le planificateur** : `search` de `mcts-commun`, qui tire des niveaux réels compatibles avec les
   couleurs (et les annonces des ambulances), jugé contre la couleur et l'échéance sur les mêmes gardes.
3. **Réévaluer** un patient qui attend : une action qui révèle son niveau réel, au prix d'un peu de temps
   d'infirmier.
4. **L'hôpital en plan** : les salles, les couloirs, les déplacements (le module `grid`).
