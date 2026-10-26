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
- **Refait le soir même, au niveau du moment** (`npm run compare -- --search --now` : la recherche notée au coût du moment, sa meilleure version, et le tableau à ce coût ; 200 gardes par situation, jobs `urg-*-2026-10-23c`). Coût du moment, arrivée / couleur / échéance / **recherche** :

| situation | arrivée | couleur | échéance | recherche | recherche contre l'arrivée (IC 95 %) |
|---|---|---|---|---|---|
| moyen, jour ordinaire | 2 113 | 2 007 | 1 416 | **1 255** | +858 (+697 à +1 019) |
| moyen, accident | **39 318** | 56 196 | 51 193 | 39 626 | −309 (−1 769 à +1 151) |
| proximité, accident | 98 347 | 119 693 | 116 749 | **95 803** | +2 544 (+429 à +4 660) |
| grand CHU, accident | 9 810 | 13 147 | 7 470 | **6 921** | +2 889 (+2 467 à +3 312) |

- **Au coût du moment, la couleur est la pire règle pendant un accident** : faire passer les rouges et les oranges laisse s'aggraver les jaunes qui attendent, et l'ordre d'arrivée fait bien mieux qu'elle (−17 000 dans l'hôpital moyen).
- **La recherche est la meilleure ou à égalité avec la meilleure partout** : devant de 11 % un jour ordinaire, de 3 % à l'hôpital de proximité, de 7 % au grand CHU (sur l'échéance), à égalité avec l'arrivée dans l'hôpital moyen. Elle ne perd plus nulle part, alors qu'à l'arrivée la couleur la battait dans les petits hôpitaux.

## Le service en plan, un soignant au clavier (23/10 au soir, Sami : l'étape 3)

La même garde (les mêmes patients, examens, séjours, aggravations et réévaluations), mais **sur un plan du
service où l'on marche** (`src/plans.js`, `src/ward.js`, pur et testé ; `web/ward-panel.js` dessine). Un plan
par hôpital, en texte comme ceux de l'entrepôt : `#` un mur, `E` l'entrée, `w` une chaise de la salle
d'attente, `T` le tri, `D` la salle des médecins, `b` le lit d'un box (autant de lits que de box).
- **Une case, c'est quelques mètres, et un pas 6 s de garde.** Les gens se croisent dans les couloirs (pas de
  réservations comme pour les robots de l'entrepôt). Le patient marche de l'entrée à une chaise, puis, une fois
  appelé, jusqu'au lit ; **l'examen commence quand le patient et le médecin sont tous les deux au lit**, et
  l'attente compte jusque-là. L'infirmier marche jusqu'au patient pour le réévaluer.
- **Qui entre en box reste la règle de la page**, comme sans plan. Le médecin envoyé est le libre le plus
  proche du lit. La recherche, elle, voit la garde sans marche : les patients appelés y commencent quand le
  plus lent des deux est arrivé au lit.
- **Au clavier** (Z Q S D ou les flèches, et E), on joue :
  - **un médecin** : E au lit d'un box pour examiner le patient qui y est couché. C'est le vôtre, ou celui
    d'un collègue pas encore commencé, et vous échangez alors vos patients ;
  - **ou l'infirmier de tri** : E à côté d'un patient qui attend depuis 30 min, pour le réévaluer.
  - Le médecin qui ne vient pas laisse son patient attendre. C'est l'aléa d'un vrai joueur que Sami voulait.
    Au bout d'une nuit après la fin de la garde (12 h), un patient jamais examiné est compté vu à ce
    moment-là.
- **À la fin**, la garde contre la même, sur le même plan, avec un robot à votre place. Le replay
  (`urgences-plan/1` : les réglages et les touches, chacune avec son pas) se rejoue à l'identique ; il est
  gardé dans le navigateur et dans `replays/` (hors de git).

**Ce que coûte la marche**, robots seuls, 20 gardes par case (coût au niveau du moment) :

| | sans marche | sur le plan |
|---|---|---|
| hôpital moyen, jour ordinaire, couleur | 2 349 | 3 289 |
| hôpital moyen, accident, couleur | 62 261 | 73 900 |
| hôpital moyen, accident, arrivée | 44 612 | 54 920 |
| grand CHU, accident, couleur | 11 429 | 19 433 |

- Quelques minutes de marche par patient, et un médecin qui attend au lit que son patient arrive : la marche
  pèse surtout là où le service tourne au plus juste (le grand CHU double).
- L'hôpital de proximité, lui, est déjà débordé sans marche. Sur son plan, certaines gardes laissent des
  patients jamais vus avant la nuit (8 sur 20 gardes un jour ordinaire, sous la couleur).
- Le plan sert d'abord à **voir et à jouer**. Les règles s'y comparent sur les mêmes gardes, mais le coût
  absolu dépend du dessin du plan.

## Les premières parties de Sami (23/10 au soir)

Quatre parties, toutes dans l'hôpital moyen pendant l'accident ; le coût du retard au niveau du moment (moins, c'est mieux). Les écarts avec le recul rejouent la suite sous l'échéance la plus proche ; quand la recherche joue l'infirmier, ces rejeux le jouent par la règle du plus en retard (sinon l'analyse d'une garde durait des heures, `89f5ccf`).

**Les deux gardes jouées sur la page (les choix de box) :**

| | Sami | couleur | échéance | assistant seul |
|---|---|---|---|---|
| garde 3, aidé, l'infirmier joué par la recherche | 27 715 | 21 265 | 22 125 | **8 752** |
| garde 1, seul, sans infirmier | 44 044 | 40 686 | **27 075** | 31 945 |

- **Sami joue surtout la couleur** : comme la règle couleur 47 choix sur 74 (aidé) et 57 sur 66 (seul) ; comme l'assistant 24 fois sur 74. C'est la règle qui perd pendant un accident au coût du moment (« Les premières mesures de nuit »).
- **Ses choix les plus coûteux se ressemblent** : un rouge ou un orange qui vient d'arriver, quand l'assistant propose un vert ou un jaune qui attend depuis longtemps (13h00 : le n°47 rouge plutôt que le n°28 vert, +7 243). Les écarts se concentrent de 9 h à 14 h, juste après l'arrivée des victimes.
- **Aidé, il fait moins bien que la couleur seule** : suivre l'assistant une fois sur trois ne marche pas, son plan suppose qu'on le suit ensuite.
- Le recul connaît le vrai niveau des patients : il dit où un choix a coûté, pas ce qu'on voyait sur le moment.

**Le médecin au clavier sur le plan (garde 1)** : Sami 84 567, un médecin robot à sa place 59 078 (+43 %). Un patient que la règle lui envoie attend en moyenne **30 min** au lit avant son examen (70 au plus), 1,8 min avec un robot : 331 min de garde avec un patient à lui qu'il n'avait pas rejoint, 11 examens. La page envoie un patient au médecin humain comme à un robot, et seule la ligne d'état le dit.

**L'infirmier de tri au clavier sur le plan (garde 1)** : Sami **58 680**, sans infirmier 59 078, l'infirmier robot du tour de salle 67 664, celui du plus en retard 70 296. Il bat les deux robots avec deux fois moins de réévaluations (71 contre 141), et trouve 21 bracelets faux ou aggravés (cinq verts en fait rouges). Mais il fait à peine mieux que personne : sous la règle couleur, un patient revu plus grave passe devant et les autres s'aggravent, la règle des box gâche ce que l'infirmier apprend (déjà vu le 22/10, « La réévaluation »).

**Sami (23/10)** : la garde lui plaît pour la prise de choix ; sur le plan, il n'est pas encore sûr des objectifs.

## La page (23/10, tard)

**Le recul plus rapide** (`89f5ccf`) : quand la recherche joue l'infirmier, les rejeux avec le recul le jouent par la règle du plus en retard ; l'analyse d'une garde passe de plusieurs heures à 8 s (la garde elle-même se rejoue avec son vrai infirmier).

**Les replays rangés seuls** (Sami, 23/10 au soir) : chaque partie gardée par la page est aussi envoyée au serveur de la page (`POST /api/replays` de mcts-commun), qui l'écrit dans `replays/`, hors de git (comme `replays/` dans Lopin). Un serveur lancé avant cette version répond 404 : il faut relancer `npm run page`.

**L'allure** (Sami, 23/10, tard) : la page prend l'allure commune des projets (`mcts-commun/web/theme.css`, dans l'esprit de Lopin) : un bandeau dans la couleur de l'application, les réglages en carte, les sections pliables bien visibles (une barre, un chevron qui tourne, « Ouvrir / Fermer »), les tableaux et le thème sombre. Ici, rouge et blanc, comme une croix-rouge, avec une croix rouge sur un carré blanc devant le titre.

## Le parcours détaillé, étape 1 (25/10, Sami)

Sami veut suivre chaque patient « comme dans un vrai hôpital » : plus de rôles, plus de pièces, les ressources rares
au-delà des lits. Les recherches sont dans [`docs/recherche/`](recherche/README.md), et les six étapes dans sa
[feuille de route](recherche/feuille-de-route.md). **Le parcours vient à côté de la garde simple** : `simulate.js`,
`ward.js`, la page et leurs mesures ne changent pas.

**Ce qu'il simule** (`src/pathway.js`, `src/pathway-scenario.js`, et les nombres dans `src/pathway-hypotheses.js`) :
- **une journée de 24 h à partir de 8 h**, puis jusqu'à un jour de plus pour les patients encore là ;
- les arrivées suivent l'heure : peu la nuit, un pic l'après-midi. Le taux moyen de 8 h à 16 h est celui de la
  garde simple, et un médecin de renfort vient de 10 h à 22 h ;
- le patient passe par toutes les étapes :
  - l'inscription, puis le tri par l'IOA ;
  - l'attente d'une place et d'un médecin : la SAUV pour un rouge, la chambre d'isolement, sinon un box ;
  - l'examen, puis les examens de son parcours caché : la biologie (prélèvement, puis 70 min de rendu), le
    scanner (un patient à la fois), l'avis d'un spécialiste d'astreinte ;
  - la lecture des résultats par un médecin, puis les soins ;
  - la sortie : le domicile, l'UHCD, un lit d'aval, le bloc, un transfert ;
- un patient valide, trié 3 à 5, attend ses résultats assis, et rend son box ;
- **le boarding** : un patient à hospitaliser sans lit garde son box, ou passe en UHCD si une place y est libre ;
- les lits d'aval se libèrent par service, surtout vers midi ;
- un patient trié 3 à 5 peut partir sans être vu ;
- le 15 envoie ailleurs les ambulances non rouges tant que 20 patients attendent une place ;
- **deux décisions sont laissées à une règle** : qui prend la place et le médecin libres (les règles de
  `rules.js`), et qui prend le lit qu'un service libère (`BED_RULES` : la décision la plus ancienne, celui qui tient
  un box, les 75 ans et plus d'abord).

**Un jour ordinaire face à la DREES** : 50 journées, hôpital moyen, règle couleur.

| | le parcours | la DREES, enquête 2023 |
|---|---|---|
| patients par jour | 127 | — |
| délai avant le tri, médiane | 8 min | 8 min |
| tri à plus de 30 min | 1 % | 11 % |
| durée de passage, médiane | 2 h 16 | 3 h 10 |
| sortis en moins de 4 h | 81 % | — |
| résultats lus, médiane après la demande | 83 min | troponine rendue en 81 min |
| hospitalisés, bloc ou transfert | 20 % | 16 % hospitalisés |
| partis sans être vus | 0,7 % | 3,4 % |

- Le modèle va un peu plus vite que la France de 2023 : son jour ordinaire est moins chargé, et ses lits plus
  nombreux qu'un grand hôpital.
- La ressource la plus occupée est **l'UHCD** (66 % en moyenne) ; les box le sont à 33 % sur la journée, nuit
  comprise.

**Les règles sur les mêmes journées** (`node scripts/pathway-compare.js`, 50 journées) :

| | coût au moment | partis | pic en attente | attente max d'un rouge ou orange | sortis en < 4 h |
|---|---|---|---|---|---|
| jour ordinaire, ordre d'arrivée | 3 854 | 0,1 | 7,0 | 50 min | 82 % |
| jour ordinaire, couleur | 2 943 | 0,9 | 7,8 | 37 min | 81 % |
| jour ordinaire, échéance | **2 533** | 0,4 | 7,7 | 36 min | 81 % |
| accident, ordre d'arrivée | 41 742 | **3,1** | 19,8 | 175 min | 59 % |
| accident, couleur | 42 188 | 14,6 | 24,4 | **105 min** | 57 % |
| accident, échéance | **40 187** | 9,0 | 23,5 | 149 min | 49 % |

- **Un jour ordinaire, l'échéance gagne**, comme dans la garde simple : + 1 322 sur l'ordre d'arrivée (de 230 à
  2 413).
- **Pendant l'accident, aucune règle ne se détache au coût du moment** : les intervalles se chevauchent tous. Mais
  les max montrent ce que la moyenne cache :
  - la couleur prend les rouges et les oranges plus vite (105 min au pire, contre 175 à l'ordre d'arrivée) ;
  - mais elle fait partir **cinq fois plus** de patients sans être vus (14,6 contre 3,1 par journée) : les verts
    attendent jusqu'à bout de patience ;
  - c'est ce que Sami voulait voir avec les indicateurs max.
- **Les règles du lit ne changent pas le coût au moment** : il compte l'attente avant l'examen, et les patients en
  attente de lit passent surtout en UHCD. Elles déplacent le boarding (le maximum, les 75 ans et plus la nuit) ;
  c'est la mesure de l'étape 6, quand la recherche décidera aussi des lits.

**Les tests** (`tests/pathway.test.js`) vérifient :
- le tirage est le même d'une graine à l'autre ;
- tout patient sort par l'une des sorties ;
- une place n'est jamais prise au-delà de sa capacité, sinon le code lève une erreur ;
- les examens et leur lecture ;
- le boarding qui garde le box, et l'UHCD qui le libère ;
- un patient sans lit encore là à la fin ;
- les départs sans être vu, et les ambulances envoyées ailleurs ;
- les règles du lit ;
- la règle ne voit jamais le vrai niveau ;
- les pics et les max.

## Le plan détaillé, étape 2 (26/10, Sami)

Le parcours détaillé se voit maintenant sur un plan en texte, dans l'onglet « Parcours détaillé » de la page
(`src/pathway-plans.js`, `src/pathway-trace.js`, `src/pathway-walk.js`, `src/pathway-status.js`).

La légende :
- `#` un mur, `.` le sol, `E` l'entrée ;
- `A` l'accueil, `T` le tri, `w` un siège d'attente, `r` un siège pour l'attente des résultats ;
- `b` un box, `S` la SAUV, `I` l'isolement, `U` un lit d'UHCD ;
- `X` un scanner, `L` le labo, `P` la pharmacie ;
- `O` la porte du bloc, `H` les ascenseurs ;
- `D` la salle des médecins, `R` la pause, `B` la base des brancardiers.

Le plan de l'hôpital moyen :

```text
######################################################
#S..S#b.b.b.b.b.b#U.U.U.U.U.U#X..#O..#H..#wwwwwwwwww.#
#....#...........#...........#...#...#...#...........#
#....#...........#...........#...#...#...#wwwwwwwwww.#
#....................................................E
#....#...........#...........#...#...#...#A.T........#
#....#...........#...........#...#...#...#wwwwwwwwww.#
#I...#b.b.b.b.b.b#D...R...B..#L..#P..#...#rrrrrr.....#
######################################################
```

**Le plan fixe les places.** Le nombre de box, de lits de SAUV, d'UHCD, de chambres d'isolement et de scanners est
compté sur le plan :
- les trois plans par défaut ont exactement les capacités de l'étape 1, donc une journée sur le plan de son hôpital
  est la journée de l'étape 1. Les empreintes n'ont pas changé ;
- un plan modifié dans le panneau change les capacités, et la journée suit.

Les staffs, les taux d'arrivée et les lits des services restent ceux de l'hôpital choisi.

**La marche est dessinée, pas comptée** (le choix de Sami). Chaque déplacement du journal devient un chemin, une case
toutes les 6 s :
- les patients vont de l'entrée à l'accueil, au tri, à un siège, au box, au scanner, puis sortent par l'entrée, les
  ascenseurs ou le bloc ;
- les médecins vont au lit de leur patient ;
- les brancardiers sont attribués après coup : le plus proche des libres fait l'aller, le transport et le retour.

Personne n'attend une marche, donc le patient peut être examiné avant que le dessin ne l'ait amené au box : c'est
ce que l'étape 3 corrigera.

Ce qui se marche, sur l'hôpital moyen, couleur puis ordre d'arrivée, en moyenne sur 20 journées :

| | patients | médecins | brancardiers | transports | sans brancardier libre | délai du brancardier |
|---|---|---|---|---|---|---|
| jour ordinaire | 28,9 km | 14,1 km | 9,0 km | 81 | 3,6 | 1,7 min |
| accident | 28,4 km | 13,6 km | 10,1 km | 92 | 4,0 | 1,6 min |
| accident, scanner au fond | 28,0 km | 13,6 km | 11,6 km | 92 | 4,8 | 2,4 min |

Le dernier cas met le scanner à l'autre bout du couloir, dans la salle de la SAUV : les brancardiers marchent 15 %
de plus, et un transport attend son brancardier 50 % plus longtemps. C'est l'usage que Sami veut faire des plans :
raccourcir les trajets, ou au contraire grossir la congestion pour éprouver la recherche.

À l'étape 3, ces minutes compteront : l'examen attendra que le patient et le médecin soient au lit, et un transport
son brancardier.

## La marche comptée et l'interne au clavier, étape 3 (26/10, Sami)

**Les choix de Sami** :
- la marche compte pour tous, avec un interrupteur ;
- une partie dure une vacation de 4 h ;
- l'interne lit les résultats de ses patients ;
- les six tâches dès cette étape.

**Les positions sont dans le modèle.** Chaque déplacement du journal est marché au moment où il a lieu, de là où l'on
est jusqu'à la case où l'on va (`src/pathway-cells.js`, `src/pathway-trace.js`). Le plan dessine exactement ces
marches, et le modèle peut les attendre.

**La marche comptée** (`walk` dans les réglages, la case « Marche comptée » de l'onglet). Elle change trois choses :
- l'examen commence quand le patient et le médecin sont tous deux au box ;
- le médecin marche jusqu'au patient pour lire ses résultats ;
- le scanner passe par un vrai brancardier (`src/pathway-porters.js`) : le plus proche des libres va au patient,
  l'accompagne, puis revient à sa base.

Sans la case, la journée est celle de l'étape 1, empreinte comprise. Ce que la marche coûte, sur l'hôpital moyen,
couleur puis ordre d'arrivée, en moyenne sur 20 journées :

| | coût du retard au moment | passage, médiane | sortis en moins de 4 h |
|---|---|---|---|
| jour ordinaire, sans marche | 4 902 | 2 h 19 | 79 % |
| jour ordinaire, marche comptée | 8 534 | 2 h 37 | 76 % |
| accident, sans marche | 50 401 | 3 h 58 | 55 % |
| accident, marche comptée | 66 820 | 4 h 20 | 49 % |

L'aller-retour des médecins entre leur salle et les box pèse le plus : un box reste pris quelques minutes de plus par
patient.

**L'interne** (`src/pathway-intern.js`, des hypothèses dans `INTERN`, `src/pathway-hypotheses.js`). Il suit
jusqu'à 4 patients non urgents, confiés à la sortie du tri, et fait leurs tâches, chacune avec un délai :
- **reprendre les constantes** toutes les 30 min tant que le patient attend un box : une aggravation qu'elles
  révèlent change la couleur, et la règle des box la voit ;
- **prélever**, puis **porter les tubes au labo** : le délai du labo commence à l'arrivée des tubes ;
- **aller chercher le patient pour le scanner**, qui le suit, puis l'y laisser ;
- **regarder les résultats** au poste des médecins, à la place d'un senior ;
- **chercher un médicament à la pharmacie**, puis **le donner** : les soins commencent alors, plus courts des 10 min
  que le service aurait passées à le chercher.

Les besoins de médicament sont tirés à part, si bien que les patients de la journée restent les mêmes avec ou sans
interne.

**La partie** (`src/pathway-game.js`) se joue un pas de 6 s à la fois, la marche comptée :
- pendant la vacation choisie, l'interne se joue au clavier (Z Q S D, E) ;
- avant et après, un interne robot, qui fait la tâche due en premier et va au plus près ;
- le mode « au hasard » choisit une tâche au hasard et la tient jusqu'au bout : un humain simulé.

Une partie se rejoue depuis ses touches. À la fin, la même journée est comparée avec un interne robot, un interne au
hasard et sans interne.

**Ce que fait l'interne**, sur l'hôpital moyen, couleur puis ordre d'arrivée, en moyenne sur 10 journées :

| | coût du retard au moment | passage, médiane | retard moyen d'une tâche | aggravations repérées |
|---|---|---|---|---|
| jour ordinaire, sans interne | 8 175 | 2 h 44 | — | — |
| jour ordinaire, interne robot | 8 921 | 2 h 42 | 0 min | 0,9 |
| jour ordinaire, interne au hasard | 8 266 | 2 h 42 | 0,1 min | 1,5 |
| accident, sans interne | 67 262 | 4 h 30 | — | — |
| accident, interne robot | 70 024 | 4 h 33 | 0 min | 5,6 |
| accident, interne au hasard | 70 726 | 4 h 27 | 0,1 min | 6,7 |

L'interne robot fait toutes ses tâches à temps et repère des aggravations, surtout pendant l'accident. Mais le coût
du retard avant le box ne baisse pas : il est même un peu plus haut qu'avec le service seul.

Les délais du service (10 min pour prélever, la lecture par un senior) sont des hypothèses. L'interne qui marche
d'un bout à l'autre du plan ne fait pas mieux qu'elles, et les patients qu'il suit gardent leur box pendant qu'il
s'occupe des autres.

C'est la question que les étapes suivantes peuvent creuser :
- les plans, en mettant le labo et la pharmacie près des box ;
- la fatigue, à l'étape 4 ;
- la recherche, qui choisirait l'ordre des tâches, à l'étape 6.

## La fatigue et les pauses, étape 4 (26/10)

**La fatigue des médecins** (`src/pathway-fatigue.js`, des hypothèses dans `FATIGUE`, H43 à H49 de
[hypotheses-a-verifier.md](recherche/hypotheses-a-verifier.md)). Elle compte les heures de chaque médecin depuis le
début de sa garde ou sa dernière pause, et elle pèse plus la nuit. Ses effets :
- elle ralentit les examens et la lecture des résultats : de 10 % après 12 h, de 25 % après 20 h, et de 10 % de plus
  entre 0 h et 6 h ;
- elle fait oublier un résultat de temps en temps : de 1 fois sur 100 à 1 sur 10 en fin de garde. Le résultat oublié
  est relu 30 min plus tard.

**Les pauses** : un repas de 30 min entre 11 h et 15 h et entre 19 h et 22 h, et 2 h de repos entre 1 h et 6 h. Une
pause ôte 30 % de la fatigue, le repos 60 %. Deux médecins restent toujours en poste. Une règle les place :
- **aucune pause** ;
- **à l'heure fixe**, dès l'ouverture de la plage ;
- **au creux de la salle d'attente** : quand 3 patients ou moins attendent, ou en fin de plage.

**Les gardes** :
- de 24 h, de 8 h à 8 h ;
- ou deux équipes de 12 h, avec une relève à 20 h et à 8 h : 15 min pendant lesquelles l'équipe qui arrive ne prend
  pas de patient.

Sans fatigue dans les réglages, la journée est celle des étapes d'avant : les empreintes n'ont pas changé, et la
fatigue a la sienne.

Ce que donnent les règles, sur l'hôpital moyen pendant l'accident, en moyenne sur 10 journées
(`npm run fatigue -- --accident --days 10`) :

| Pauses | coût au moment | gain sur aucune pause, 24 h (IC 95 %) | oublis | sans pause, au plus | ralentissement |
|---|---|---|---|---|---|
| sans fatigue | 56 425 | +5 199 (+1 424 à +8 973) | — | — | — |
| aucune pause, 24 h | 61 624 | — | 2,8 | 24 h | 11,8 % |
| à l'heure fixe, 24 h | 70 208 | −8 585 (−12 684 à −4 486) | 2,0 | 8,5 h | 6,8 % |
| au creux, 24 h | 64 352 | −2 728 (−4 695 à −762) | 2,1 | 17,3 h | 8,2 % |
| aucune pause, 12 h | 60 386 | +1 238 (+109 à +2 366) | 1,4 | 12 h | 6,2 % |
| au creux, 12 h | 63 796 | −2 172 (−3 875 à −469) | 1,5 | 12 h | 5,4 % |

La fatigue coûte, mais une pause coûte plus sur le moment : le médecin en pause manque à la salle d'attente, et sur
le coût du retard, ce manque pèse plus que les gestes ralentis et les résultats oubliés.

Cela vient en partie des hypothèses (H43, H45), et en partie de ce que la mesure ignore : une erreur de soin due à la
fatigue n'a pas de coût dans le modèle. Placer les pauses « au creux » réduit nettement leur coût par rapport à
l'heure fixe.

C'est une décision que la recherche pourra prendre à l'étape 6 : laquelle donner, à qui, et quand.

## La suite

Les étapes communes aux trois dépôts sont dans la [feuille de route](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md) § 6 (Sami, 23/10 au soir) : l'ordonnanceur en commun pour les mesures de nuit, les replays avec un humain pour analyser les écarts, la vitrine. Le journal des versions est dans la page (`web/changelog.html`).

1. **Les mesures de nuit** — faites le 23/10 au soir, au coût du moment (plus haut) : `night.json` à la racine du dépôt, à ajouter à la file de la machine par `mcts-backlog --add-file` (mcts-commun), puis à lancer par `mcts-backlog` ; (l'ordonnanceur en commun) : la recherche contre les règles sur des centaines de
   gardes, au coût du moment.
2. **Les replays** — faits le 23/10 (« Jouer la garde vous-même », plus haut) ; reste à jouer plusieurs gardes de
   chaque manière (seul, aidé, l'assistant seul) et à en tirer l'écart, l'argument de la démonstration.
3. **L'hôpital en plan** — fait le 23/10 au soir (plus haut) ; reste à dessiner l'imagerie, le bloc et l'UHCD, et la salle d'attente qui déborde dans les couloirs.
4. **Choisir le score principal** : le coût au niveau du moment, si Sami le valide ; et **revoir plus tôt**
   (`recheck` à 10-15 min) pour rattraper les erreurs du tri.
5. **Le parcours détaillé** — l'étape 1 est faite le 25/10 (plus haut) ; les cinq autres sont dans la
   [feuille de route du parcours](recherche/feuille-de-route.md) : le plan détaillé, l'interne au clavier, la
   fatigue et les pauses, le replay d'ensemble, la recherche sur le parcours. Avant l'étape 2, le dépôt a été
   solidifié le 26/10 : le lint, les types, les empreintes des modèles et le hook ([outillage.md](outillage.md)).
