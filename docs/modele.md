# Le modèle des urgences, première version (22/10/2026)

Un simulateur à événements discrets d'une garde de 8 h : les patients, le tri, les box, les médecins, trois
règles de référence, et depuis le soir du 22/10 la recherche (plus bas). Tous les nombres sont dans `src/hypotheses.js` et sont
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

## La recherche (22/10, `src/search.js`)

**Comment elle joue.** À chaque choix (un box et un médecin libres, au moins deux patients qui attendent, ou
une ambulance annoncée), `search` de `mcts-commun` joue des mondes compatibles avec ce que le service sait :
- le **niveau réel** de chaque patient pas encore vu est retiré au sort d'après sa couleur (le tri se
  trompe 2 fois sur 10, d'un niveau) et d'après la fréquence de chaque niveau selon la source ;
- les durées d'examen et de soins, et l'aggravation pendant l'attente, sont retirées au sort ;
- les **arrivées non annoncées** sont retirées au sort aux taux habituels ; les ambulances annoncées sont
  connues, avec leur couleur ;
- les soins en cours sont supposés connus (on sait quand un box se libère).

Elle choisit parmi les favoris des trois règles (4 au plus), et peut aussi **attendre** une ambulance
annoncée, en gardant un box et un médecin libres. Aucune règle ne fait ce coup-là. Chaque monde est joué
deux choix plus loin, puis avec la règle de la couleur jusqu'à ce que les patients des deux heures à venir
soient entrés. Il est noté sur leur coût du retard. 100 itérations par choix, sur des **mondes communs** : la
k-ième visite de chaque coup joue le même monde. Sans eux, le bruit d'une garde à venir écrasait l'écart entre
deux patients, et la première version perdait contre la couleur.

**Ce qu'elle donne** (`scripts/search-bench.js`, hôpital moyen, 40 gardes, mêmes patients pour toutes les
règles). Gain sur la règle de la couleur, en coût du retard :

| Situation | couleur | recherche | gain (IC 95 %) | gardes gagnées / nulles / perdues |
|---|---|---|---|---|
| jour ordinaire | 1 972 | 1 705 | **+266 (+21 à +512)**, −13,5 % | 30 / 3 / 7 |
| accident | 24 959 | 26 324 | −1 364 (−3 277 à +548) | 20 / 0 / 20 |

Un jour ordinaire, elle fait mieux que la meilleure règle ; dans la surcharge de l'accident, elle fait jeu
égal.

Son score est très plat (`échelle / (échelle + coût)` : 10 % de coût en plus ne retire que 0,025), et l'on
pouvait craindre que l'exploration de l'arbre noie l'écart entre deux patients. Ce n'est pas le cas
(22/10, mêmes 40 gardes) : avec une exploration de 0,7, 0,15 et 0,05, l'accident donne −1 364, −1 376 et
−1 250, le jour ordinaire +266, +317 et +246, chaque fois dans les intervalles les uns des autres. La
limite n'est pas dans l'arbre, elle est dans ce que la recherche sait des patients (plus bas).

**Ce qu'il y a à gagner, et où.** Une recherche **omnisciente**, qui voit les vrais niveaux et l'avenir (une
mesure, jamais un assistant : comme l'Omniscient de Lopin), fait −31 % sur la couleur pendant l'accident
(20 gardes gagnées sur 20). On a séparé les deux savoirs :

| La recherche connaît… | coût pendant l'accident (20 gardes) | gain sur la couleur |
|---|---|---|
| ce que sait le service | 24 522 | −331 (−2 555 à +1 893) |
| les arrivées à venir | 25 076 | −886 |
| les vrais niveaux et durées des patients présents | 15 719 | **+8 472 (+6 721 à +10 222)** |
| tout | 16 564 | +7 627 |

**Le levier n'est pas de prévoir l'avenir, c'est de mieux connaître les patients qui sont déjà là** : leur
vrai niveau (le tri se trompe), leur aggravation, leurs durées. D'où la prochaine étape : une action
**réévaluer** un patient qui attend, au prix d'un peu de temps d'infirmier, qui révèle son vrai niveau. La
recherche choisirait qui réévaluer, et quand : c'est le geste propre du POMCP, s'informer avant d'agir.

## La réévaluation, et la mesure qui change le verdict (22/10, soir)

**Ce qui est modélisé.** Un infirmier d'accueil (`nurses: 1`) peut revoir un patient qui attend, 30 min
après son arrivée puis 30 min après chaque passage ; cela lui prend 5 min. Le bracelet montre alors le
**niveau réel du moment**, aggravation comprise. Qui revoir est un second type de choix : une règle
d'infirmier (le tour de la salle d'attente, ou le plus en retard sur sa couleur) ou la recherche, qui
peut aussi ne revoir personne. Sans infirmier, tout est comme avant (vérifié sur 56 gardes, règles et
recherche).

**Ce que la réévaluation révèle surtout, ce sont des aggravations.** Pendant l'accident, 31 bracelets
montent d'un niveau par garde contre 1,4 qui descendent : à 30 min, les patients sur-triés sont déjà
passés, il reste ceux qui se sont aggravés en attendant.

**La première mesure ne voyait pas l'aggravation.** Le coût du retard comptait les minutes au-delà du délai
du niveau **à l'arrivée**, au poids de ce niveau. Un vert devenu orange en salle d'attente pesait toujours
comme un vert : rattraper son aggravation ne rapportait rien, et le faire passer devant coûtait. D'où une
seconde mesure, à côté de la première (aucun chiffre plus haut n'a changé), le **coût du retard au niveau du
moment** (`lateCostNow`) : chaque minute d'attente au-delà du délai compte au poids du niveau réel du
patient à cette minute, et le délai se resserre quand il s'aggrave.

**Elle change le verdict** (`scripts/search-bench.js`, hôpital moyen, 40 gardes, coût au niveau du moment) :

| Règle ou recherche | jour ordinaire | accident | accident, gain sur la couleur (IC 95 %) |
|---|---|---|---|
| couleur | 4 486 | 69 471 | — |
| échéance la plus proche | 3 147 | 61 419 | +8 051 (+5 117 à +10 986) |
| couleur + tour de la salle | 5 129 | 79 145 | **−9 675** (−14 068 à −5 281) |
| échéance + le plus en retard | **2 481** | 64 597 | +4 873 (+1 570 à +8 177) |
| **recherche, notée au niveau du moment** | 2 578 | **49 625** | **+19 845 (+14 581 à +25 110)**, 38 gardes sur 40 |
| la même, qui choisit aussi qui revoir | 2 587 | 51 814 | +17 656 (+12 922 à +22 391) |

- **L'échéance la plus proche bat la couleur même pendant l'accident**, au niveau du moment : son
  « effondrement en surcharge » (plus haut) venait de la mesure, qui ne comptait pas les aggravations.
- **La recherche, notée sur la bonne mesure, fait la différence sous la surcharge** : contre l'échéance, la
  meilleure règle, +11 794 par garde (+6 567 à +17 020, 29 gardes sur 40), −19 %. Un jour ordinaire, jeu
  égal (+569, −626 à +1 764). Notée sur la première mesure, elle ne faisait que jeu égal avec la couleur :
  c'est la mesure, pas l'arbre, qui la retenait.
- **La réévaluation aide les règles un jour ordinaire** (échéance + le plus en retard : 3 147 → 2 481) **et les
  fait chuter sous la surcharge** : la couleur fait passer devant chaque patient trouvé aggravé, les autres
  attendent davantage et s'aggravent à leur tour (25 → 32 aggravés par garde). C'est le mécanisme qui fait
  chuter l'échéance la plus proche sur la première mesure : servir d'abord ceux qui sont déjà en retard.
  Avec un infirmier qui revoit le plus en retard, sur 100 gardes d'accident, l'ordre d'arrivée devient la
  meilleure des trois règles : il ignore les couleurs, donc la cascade.
- **La réévaluation n'apporte rien à la recherche** (2 578 contre 2 587, 49 625 contre 51 814). Elle n'arrive
  qu'après 30 min et révèle surtout des aggravations que la recherche, qui tire déjà au sort l'aggravation
  des patients qui attendent, anticipe en partie. L'omnisciente gagnait parce qu'elle connaissait le **vrai
  niveau dès l'arrivée**, c'est-à-dire les erreurs du tri, que la réévaluation à 30 min ne rattrape plus.

**Ce qu'on en retient.** Une information ne vaut que par la décision qui l'utilise : la même réévaluation
aide l'échéance un jour ordinaire et fait chuter la couleur dans l'accident. Et le score décide de tout : la
même recherche fait jeu égal ou gagne 19 % selon ce qu'on lui demande de minimiser. **Le coût au niveau du
moment est le bon score** pour la suite (proposition, à valider par Sami) : il compte ce que la réévaluation
est faite pour éviter.

## La garde, minute par minute (23/10, Sami)

Sami : « c'est encore un peu dur de visualiser ce qu'il se passe vraiment dans l'hôpital ». La page rejoue
donc la garde jouée sur un plan du service, minute par minute (`sceneAt` dans `web/view.js`, pur et testé),
à 1, 5, 15 ou 30 minutes de garde par seconde, ou à la main avec un curseur :
- **l'entrée**, avec les ambulances annoncées et les minutes qu'il leur reste ;
- **la salle d'attente** : une pastille par patient, de la couleur de son bracelet, les premiers arrivés
  d'abord ; un point au centre quand son niveau réel est plus grave que le bracelet (erreur de tri ou
  aggravation : ce que personne ne voit) ; cerclée de rouge quand il attend plus que son bracelet ne le
  permet ; 🧑‍⚕️ quand l'infirmier le réévalue ;
- **les box** : le patient, 🩺 pendant l'examen, et une barre pour le séjour.

On y voit d'un coup d'œil ce que les chiffres disaient. Pendant l'accident, des box restent **vides** alors
que des patients attendent : les médecins sont tous en examen. Et des bracelets jaunes cachent un niveau rouge.

Le simulateur garde désormais chaque réévaluation (`lookedAt` : début, fin, couleur donnée), pour que la
page montre le bracelet tel qu'il était à chaque minute. Les résultats n'ont pas bougé (même empreinte).


## Jouer la garde soi-même (23/10, Sami : l'étape 2, les replays avec un humain)

Dans la page, « Jouer la garde vous-même » : la personne décide qui entre dans un box libre (ou d'attendre), sur la garde choisie (hôpital, situation, numéro) ; l'infirmier de tri garde la règle de la page. **Seul**, ou **aidé par l'assistant**, qui montre le patient que la recherche ferait entrer (la recherche notée au niveau du moment, sa meilleure version). La logique est pure et testée (`src/play.js`), la page ne fait que dessiner (`web/player.js`).
- **À la fin**, la garde jouée contre la couleur, l'échéance la plus proche et l'assistant seul, sur les mêmes patients (le coût du retard au niveau du moment, et les patients en retard). En suivant l'assistant à chaque choix, on retrouve exactement l'assistant seul (vérifié dans la page : 31 945 sur la garde 1 de l'hôpital moyen avec l'accident).
- **Les replays** : la garde se rejoue à l'identique depuis son hôpital, son numéro, la règle de l'infirmier et la suite des choix (`urgences-replay/1`) ; les 20 dernières sont gardées dans le navigateur, et se téléchargent.
- **Les écarts, avec le recul** : à chaque choix, chaque patient qui pouvait entrer est essayé, puis la garde jouée jusqu'au bout sous l'échéance la plus proche, avec les vrais patients à venir ; l'écart est ce que le choix a coûté à lui seul. On voit aussi combien de choix ont suivi l'assistant. **Le recul connaît le vrai niveau des patients** : il préfère parfois un jaune à un orange (un jaune qui était plus grave) ; il dit où un choix a coûté, pas ce qu'on pouvait voir sur le moment. Les écarts ne s'additionnent pas : chacun suppose la suite jouée par la règle.
- La comparaison des trois manières de jouer (seul, aidé, l'assistant seul) se fera sur plusieurs gardes jouées par Sami : c'est l'argument de la démonstration (feuille de route § 3).


## Les premières mesures de nuit (23/10 au soir, mcts-backlog)

200 gardes par situation, le coût du retard **à l'arrivée** (la mesure de `npm run compare`), la recherche notée elle aussi à l'arrivée (son réglage par défaut) : jour ordinaire, hôpital moyen : couleur 1 039, échéance 965, **recherche 870** ; avec l'accident : moyen, couleur **20 914**, recherche 22 163 ; de proximité, couleur **37 549**, recherche 40 591 ; grand CHU, échéance 5 377, **recherche 5 035**.
- Le jour ordinaire et le grand CHU : la recherche devant. Les accidents dans les petits hôpitaux : la couleur devant, comme le disait déjà la mesure du 22/10 avec la recherche notée à l'arrivée.
- **À refaire** : `compare` ne sait pas encore noter la recherche au niveau du moment, sa meilleure version (la seule qui battait la couleur pendant l'accident, +19 845) ; il faudra une option `--now` et la colonne du coût au niveau du moment, puis relancer ces quatre mesures.

## La suite

Les étapes communes aux trois dépôts sont dans la [feuille de route](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md) § 6 (Sami, 23/10 au soir) : l'ordonnanceur en commun pour les mesures de nuit, les replays avec un humain pour analyser les écarts, la vitrine. Le journal des versions est dans la page (`web/changelog.html`).

1. **Les mesures de nuit** — prêtes (23/10) : `night.json` à la racine du dépôt, à ajouter à la file de la machine par `mcts-backlog --add-file` (mcts-commun), puis à lancer par `mcts-backlog` ; (l'ordonnanceur en commun) : la recherche contre les règles sur des centaines de
   gardes, au coût du moment.
2. **Les replays** — faits le 23/10 (« Jouer la garde vous-même », plus haut) ; reste à jouer plusieurs gardes de
   chaque manière (seul, aidé, l'assistant seul) et à en tirer l'écart, l'argument de la démonstration.
3. **L'hôpital en plan** : les salles, les couloirs, les déplacements (le module `grid`, comme l'entrepôt) ;
   un médecin ou un infirmier joué au clavier (Z Q S D et E, Sami), qui ajoute l'aléa d'un vrai joueur.
4. **Choisir le score principal** : le coût au niveau du moment, si Sami le valide ; et **revoir plus tôt**
   (`recheck` à 10-15 min) pour rattraper les erreurs du tri.
