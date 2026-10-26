# Le parcours détaillé (25 et 26/10/2026)

Le second modèle des urgences, à côté de la garde simple de [modele.md](modele.md), qui reste telle quelle : une
journée de 24 h, chaque patient suivi de l'arrivée à la sortie, sur un plan en texte (`src/pathway*.js`). Ses six
étapes, leurs choix et leurs chiffres, dans l'ordre où elles ont été faites ; les recherches et la feuille de route
sont dans [recherche/](recherche/README.md), les valeurs estimées dans
[recherche/hypotheses-a-verifier.md](recherche/hypotheses-a-verifier.md).

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

## Le replay d'ensemble, étape 5 (26/10)

**La frise de toute la journée** (`src/pathway-timeline.js`, `web/timeline-draw.js`). Le modèle relève l'état
du service toutes les 10 min, sans rien changer à ce qui se passe. Une fois la journée finie, la frise montre :
- les patients présents, ceux qui attendent un box et ceux qui attendent un lit ;
- une bande par ressource (box, SAUV, UHCD, scanner, médecins), pleine quand elle est saturée ;
- les moments qui comptent : les aggravations, les départs sans être vus, les ambulances réorientées, les résultats
  oubliés, les pauses des médecins, et l'accident en ocre.

Un clic sur une heure y amène le plan de l'onglet.

**Deux façons de jouer la même journée.** La même journée, jouée autrement, se dessine en tirets par-dessus, au choix
dans le panneau :
- une autre règle des box ou des lits ;
- avec ou sans la marche ;
- avec ou sans la fatigue ;
- avec ou sans interne.

On y voit où un retard, une pause ou l'accident font monter les courbes. À la fin d'une vacation d'interne au
clavier, la frise de la journée jouée est dessinée contre celle de l'interne robot.

## La recherche sur le parcours, étape 6 (26/10)

**La recherche** (`src/pathway-search.js`) est l'ISMCTS de mcts-commun, comme celle de la garde simple. Elle choisit
qui prend une place et un médecin libres, sur une journée du parcours détaillé. Chaque itération copie la journée
(`src/pathway-clone.js`) et retire au sort ce que le service ne sait pas :
- le vrai niveau des patients pas encore vus, d'après la couleur du bracelet, avec le modèle d'erreur du tri de la
  garde simple (`levelOdds`) ;
- avec ce niveau, leur parcours caché : les examens qu'il leur faudra et leur sortie. L'isolement et l'âge restent
  tels quels, car ils se voient à l'accueil ;
- les arrivées pas encore annoncées, d'après les taux par heure.

L'arbre a 2 choix de profondeur, puis la règle de la couleur joue la suite. Les lits sont donnés par la règle de la
décision la plus ancienne. Chaque monde est noté au coût du retard au niveau du moment, sur les patients qui
attendent ou arrivent dans les 2 h. Les choix de la racine sont jugés sur des mondes communs.

La recherche ne joue pas une journée avec un interne, parce qu'un monde devrait jouer ses tâches aussi.

**Un premier tri, à 50 itérations par choix** (`npm run pathway:search -- --days 16 --budget 50 [--accident]`,
16 journées jouées côte à côte) :

| Hôpital moyen | l'arrivée | la couleur | l'échéance | la recherche | la recherche contre l'échéance (IC 95 %) |
|---|---|---|---|---|---|
| avec l'accident | 51 309 | 54 735 | 50 920 | **32 443** | +18 476 (+9 066 à +27 886) |
| jour ordinaire | 7 640 | 5 904 | 4 735 | **4 206** | +529 (−205 à +1 263) |

Pendant l'accident, la recherche fait 36 % de moins que la meilleure règle, et l'intervalle ne passe pas par zéro.
Un jour ordinaire, elle fait un peu mieux, mais l'intervalle contient zéro.

C'est un tri rapide : la leçon de Lopin dit qu'il peut écarter une idée, pas la promouvoir. Deux mesures de nuit
sont prêtes dans `night.json` : `parcours-moyen-accident` et `parcours-moyen`, 200 journées à 100 itérations,
8 fils chacune.

**Sur la page.** La recherche est une règle des box de l'onglet Parcours détaillé : elle joue la journée dans un
worker (une demi-minute à 50 itérations), puis l'onglet rejoue exactement la même journée d'après ses choix. Stats la
compare aux règles sur 8 journées, dans des workers.

**Ce qui reste à décider par la recherche** ([ressources-rares.md](recherche/ressources-rares.md)) :
- le lit d'aval, le scanner, le bloc et la sortie de SAUV ;
- le déclenchement de l'HET ou du Plan blanc ;
- les pauses des médecins, que l'étape 4 a montrées coûteuses ;
- l'ordre des tâches de l'interne.
