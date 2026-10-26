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
  pas de patient. Ce qui se dit peut se perdre : un patient dont les résultats sont en cours ou attendent d'être lus
  est oublié 1 fois sur 20 (`handoverLoss`, H56), et ses résultats sont relus 30 min plus tard. Sur les 3 journées
  de l'empreinte, personne n'est touché ; avec une perte d'1 fois sur 2, 16 résultats sont oubliés au lieu de 5.

**L'infirmier d'accueil** (l'IOA) fatigue aussi : son tri prend plus de temps au fil de son poste de 12 h (de 8 h
à 20 h, puis de 20 h à 8 h) et la nuit (`ioaSlowOf`, H53). L'interne ralentit lui aussi, sans pause (H50).

Sans fatigue dans les réglages, la journée est celle des étapes d'avant : les empreintes n'ont pas changé, et la
fatigue a la sienne.

Ce que donnent les règles, sur l'hôpital moyen pendant l'accident, en moyenne sur 10 journées
(`npm run fatigue -- --accident --days 10`, refait le 26/10 avec l'IOA et les pertes à la relève) :

| Pauses | coût au moment | gain sur aucune pause, 24 h (IC 95 %) | oublis | sans pause, au plus | ralentissement |
|---|---|---|---|---|---|
| sans fatigue | 56 425 | +4 846 (+1 317 à +8 374) | — | — | — |
| aucune pause, 24 h | 61 270 | — | 2,8 | 24 h | 11,7 % |
| à l'heure fixe, 24 h | 70 876 | −9 606 (−12 977 à −6 235) | 2,0 | 8,7 h | 6,7 % |
| au creux, 24 h | 64 543 | −3 273 (−5 184 à −1 362) | 2,0 | 17,1 h | 8,0 % |
| aucune pause, 12 h | 60 725 | +545 (−373 à +1 463) | 1,7 | 12 h | 6,2 % |
| au creux, 12 h | 64 166 | −2 895 (−4 647 à −1 144) | 1,7 | 12 h | 5,4 % |

Deux équipes de 12 h sans pause ne font plus sûrement mieux qu'une garde de 24 h : l'intervalle passe par zéro
depuis que l'IOA fatigue et que la relève peut perdre un patient (l'un, l'autre ou les deux). La fatigue coûte, mais une pause coûte plus sur le moment : le médecin en pause manque à la salle d'attente, et sur
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

C'est un tri rapide : la leçon de Lopin dit qu'il peut écarter une idée, pas la promouvoir.

**Les mesures sur 200 journées, à 100 itérations** (26/10 après-midi, les jobs de `night.json`) confirment le gain
partout :

| Situation | la meilleure règle (l'échéance) | la recherche | la recherche contre l'échéance (IC 95 %) |
|---|---|---|---|
| hôpital moyen, jour ordinaire | 3 443 | **2 530** (−27 %) | +913 (+456 à +1 371) |
| hôpital moyen, accident | 37 389 | **23 665** (−37 %) | +13 724 (+11 552 à +15 895) |
| hôpital de proximité, accident | 59 144 | **41 956** (−29 %) | +17 187 (+14 861 à +19 514) |
| grand CHU, accident | 5 595 | **4 148** (−26 %) | +1 447 (+734 à +2 159) |

Aucun intervalle ne passe par zéro. La recherche laisse partir sans être vus à peu près autant de patients que
l'échéance, et nettement moins que la couleur.

**Plus rapide** : 1,6 fois, sans rien changer à ce qu'elle choisit (les empreintes sont les mêmes). Un monde où la
marche ne compte pas ne fait marcher personne, les patients déjà sortis sont partagés au lieu d'être copiés, et les
patients en attente d'un lit sont trouvés sans reconstruire de listes à chaque événement.

**Les lits d'aval** (`pathwaySearchBedRule`, `npm run pathway:search -- --lits`). La recherche choisit qui prend le lit
qu'un service libère. Ses mondes vont jusqu'au lit des patients qui en attendent un. Elle est notée sur le coût du
retard plus l'attente d'un lit, triplée la nuit pour un patient de 75 ans et plus (`BOARDING_COST`, H51).

Elle choisit comme la règle de la décision la plus ancienne. Dans ce modèle, seules 1,8 décisions de lit par jour
laissent un choix, vers midi, et elles ne changent pas le coût du retard. Il n'y a presque rien à y gagner.

**Les pauses des médecins** (`pathwaySearchBreakRule`, `npm run pathway:search -- --pauses`). Avec des pauses
« décidées », un médecin libre dont la plage est ouverte se voit demander toutes les 15 min « maintenant ou plus
tard ? ». La pause est forcée en fin de plage, et deux médecins restent toujours en poste. Les mêmes 200 journées, à
50 itérations, la fatigue comptée :

| Hôpital moyen | aucune pause | au creux (la règle) | la recherche | la recherche contre au creux (IC 95 %) | repas, sans pause au plus |
|---|---|---|---|---|---|
| jour ordinaire | 4 917 | 6 257 | **5 215** | +1 042 (+623 à +1 460) | 9,6 ; 10,3 h (la règle : 9,5 ; 10,3 h) |
| accident | 43 368 | 46 471 | **43 858** | +2 613 (+1 871 à +3 356) | 8,7 ; 12,7 h (la règle : 6,4 ; 16,1 h) |

La recherche donne autant de pauses que la règle, et plus pendant l'accident, pour presque rien. Pendant
l'accident, elle ne coûte pas plus que de ne donner aucune pause : l'écart, −490 (−1 157 à +177), passe par zéro. Elle
place la pause quand le médecin manquera le moins.

**Sur la page.** La recherche est une règle des box de l'onglet Parcours détaillé : elle joue la journée dans un
worker (une demi-minute à 50 itérations), puis l'onglet rejoue exactement la même journée d'après ses choix. Stats la
compare aux règles sur 8 journées, dans des workers.

**Les autres décisions** (26/10 au soir). Chacune a un réglage, éteint par défaut : la journée reste alors celle
d'avant, et les empreintes n'ont pas changé. Chacune a aussi des règles de référence, et la recherche y joue les
autres décisions par leurs règles. Les mesures portent sur les mêmes 200 journées de l'hôpital moyen, à 50 itérations
(`npm run pathway:search -- --interne | --files | --sauv | --plan`, les jobs de `night.json`).

| Décision | jour | les règles | la recherche | la recherche contre la meilleure règle (IC 95 %) |
|---|---|---|---|---|
| l'ordre des tâches de l'interne | ordinaire | la tâche due la première 7 725 ; le plus grave 7 629 ; la plus proche 8 514 | 7 667 | −38 (−352 à +276) |
| l'ordre des tâches de l'interne | accident | la tâche due la première 54 375 ; le plus grave 53 208 ; la plus proche 60 631 | 53 912 | −704 (−1 523 à +115) |
| l'ordre du scanner et du bloc | ordinaire | l'ordre fixe 3 842 | 3 744 | +98 (−48 à +244) |
| l'ordre du scanner et du bloc | accident | l'ordre fixe 37 665 | **36 784** | +881 (+367 à +1 395) |
| la sortie de SAUV | accident | jamais 37 665 ; le plus ancien 36 651 | **35 828** | +823 (+328 à +1 317) |
| la sortie de SAUV, hôpital de proximité | accident | jamais 60 093 ; le plus ancien 59 675 | **58 266** | +1 409 (+788 à +2 031) |
| le Plan blanc | ordinaire | jamais 3 842 ; au seuil 4 120 | 3 701 | +141 (−152 à +434), contre jamais |
| le Plan blanc | accident | jamais 37 665 ; au seuil 38 259 | 36 966 | +699 (−494 à +1 893), contre jamais |

- **L'ordre des tâches de l'interne** (`internDecided`, `pathway-intern-decided.js`) : l'interne libre choisit sa
  tâche suivante, et sa marche compte. La recherche fait aussi bien que les meilleures règles, sans les battre. La
  plus proche d'abord est la pire : elle laisse des tâches en retard (9,2 par journée pendant l'accident).
- **L'ordre du scanner et du bloc** (`queueDecided`, `pathway-queues.js`) : quand l'un se libère et que deux
  patients ou plus l'attendent, qui passe ? L'ordre fixe (la couleur, puis la demande) est la règle de référence.
  La recherche gagne 2,3 % pendant l'accident, et rien de sûr un jour ordinaire.
- **La sortie de SAUV** (`sauvDecided`, `pathway-sauv.js`) : quand la SAUV est pleine, qu'un box est libre et qu'un
  rouge attend ou est annoncé, faut-il passer en box un patient déjà examiné ? La recherche bat la meilleure règle
  dans les deux hôpitaux, de 2 à 2,4 %.
- **Le Plan blanc** (`alert`, `pathway-alert.js`, H54 et H55) : toutes les 15 min, faut-il le déclencher ? Il rappelle
  2 médecins, qui arrivent 1 h plus tard, et les services rendent 4 lits. Chaque heure de médecin rappelé compte 240
  dans le coût. La recherche bat le seuil, mais pas « jamais » : l'écart passe par zéro, les jours ordinaires comme
  pendant l'accident. Le tri rapide sur une seule journée (53 542 contre 70 039 pour « jamais ») promettait
  beaucoup plus : un tri rapide écarte, il ne promeut pas.

Ce que la recherche gagne donc sur le parcours :
- le box d'abord, de 26 à 37 % ;
- les pauses, autant de repas que la règle « au creux » pour moins cher ;
- le scanner et le bloc, et la sortie de SAUV, pendant l'accident : de 2 à 2,4 %.

Les lits, l'ordre des tâches de l'interne et le Plan blanc ne lui donnent rien de sûr dans ce modèle.

## L'épidémie d'hiver (26/10, Sami)

**Une journée au pic d'une épidémie de grippe** (`src/pathway-epidemic.js`, `EPIDEMIC`, H57 à H60 ; les chiffres de
Santé publique France dans [oublis.md](recherche/oublis.md)). Elle s'ajoute à la journée ordinaire, qui reste la même
patient pour patient : chaque partie a sa propre graine, et les deux journées se comparent par paires.
- **10 % de patients en plus**, à pied et en ambulance, aux heures des autres (H57) ;
- **plus souvent jaunes**, pour qu'environ 1 sur 4 soit hospitalisé, UHCD comprise (Santé publique France : 19 à
  21 % des passages pour grippe) ;
- **la moitié à isoler** (gouttelettes, H58) : la chambre d'isolement, ou un box nettoyé en 45 min au lieu de 10 ;
- **15 % de 75 ans et plus** (H59) ;
- **3 lits d'aval sur 4** : les services, pleins de la saison, en rendent moins, au début de la journée comme au fil
  du jour (H60).

La recherche tire aussi les arrivées de l'épidémie dans ses mondes. Sur la page, c'est « La saison » de l'onglet
Parcours détaillé ; dans les scripts, `--hiver` (`npm run pathway -- --hiver`, `npm run pathway:search -- --hiver`).

**Ce qu'elle coûte**, sur 200 journées, par les règles des box (`npm run pathway -- --days 200 [--hiver]`) :

| Hôpital | jour | l'arrivée | la couleur | l'échéance | partis sans être vus (l'échéance) |
|---|---|---|---|---|---|
| moyen | ordinaire | 4 184 | 3 842 | 3 443 | 0,7 |
| moyen | pic de l'épidémie | 10 450 | 9 835 | 9 343 | 2,3 |
| de proximité | ordinaire | 5 167 | 4 651 | 4 793 | 1,1 |
| de proximité | pic de l'épidémie | 12 893 | 11 417 | 11 357 | 2,6 |

10 % de patients en plus font plus que doubler le coût du retard : le service, occupé à 80 % un jour ordinaire, n'a
pas de marge.

**D'où vient ce coût**, sur l'hôpital moyen par l'échéance, les mêmes 200 journées (l'écart sur le jour ordinaire et
son IC 95 %) :

| Ce qu'on ajoute | coût au moment | sur le jour ordinaire |
|---|---|---|
| les patients en plus seuls (isolés comme les autres, 3 %, et tous les lits) | 8 434 | +4 991 (+3 534 à +6 447) |
| la moitié d'entre eux isolés | 7 493 | +4 050 (+2 857 à +5 243) |
| et 3 lits sur 4 : l'épidémie entière | 9 343 | +5 899 (+4 071 à +7 728) |
| les lits seuls, sans patients en plus | 4 133 | +690 (−54 à +1 434) |

Les patients en plus font presque tout. Isoler la moitié d'entre eux coûte **moins** que de ne pas les isoler : la
chambre d'isolement ne prend que des patients à isoler, et un jour ordinaire, elle reste presque toujours vide ; avec
l'épidémie, elle sert, comme un box de plus. Est-ce ainsi dans un vrai service, ou y met-on un patient ordinaire quand
elle est libre ? Sami a répondu le soir même (H61) : on la prête, et le modèle le fait depuis (« La chambre
d'isolement prêtée », plus bas). Les lits manquants coûtent peu sur une journée : leur effet s'accumule sur des
semaines, que le simulateur ne joue pas. Les chiffres de cette section datent d'avant le prêt.

**La recherche au pic de l'épidémie** (les mêmes 200 journées de l'hôpital moyen, les jobs `parcours-hiver-*` de
`night.json`) :
- **le box**, à 100 itérations : **6 239** contre 9 343 pour l'échéance, soit −33 %, +3 104 (+2 031 à +4 176). Le gain
  est du même ordre que les autres jours, et la recherche laisse partir autant de patients sans être vus que
  l'échéance (2,2 contre 2,3) ;
- **le Plan blanc**, à 50 itérations : 9 103 contre 9 835 pour « jamais » (+733, de −42 à +1 507) et 10 058 au seuil.
  C'est le jour où il sert le plus, mais l'intervalle touche encore zéro : rien de sûr.

## La chambre d'isolement prêtée (26/10 au soir, Sami)

Sami, sur H61 : la chambre d'isolement se prête à des patients **aux symptômes légers et plutôt jeunes**, que l'on
peut déplacer facilement. Le besoin d'isoler est rare, mais souvent pressant : un patient instable ou violent
déstabilise le reste du service. On sort alors le patient en cours pour mettre le patient à isoler à sa place.
L'idéal est d'échanger leurs places si le patient à isoler occupait déjà un box ; sinon, le patient sorti repasse par
la file, où la règle (ou la recherche) donne les box à ceux qui en ont le plus besoin.

Le modèle le fait (`src/pathway-isolation.js`, `isolationLent`) :
- **le prêt** : libre, et sans patient à isoler qui l'attende, la chambre prend un patient trié 4 ou 5 de moins de
  75 ans, de préférence à un box ;
- **un patient à isoler la veut**, qu'il attende ou soit déjà en box : celui qui occupe la chambre part dans un box
  libre, ou sinon sur un fauteuil, comme un patient léger venu à pied qui attend ses résultats ;
- **la chambre est nettoyée**, puis elle revient au patient à isoler : par la règle des box s'il attend, aussitôt s'il
  est en box, et ce box est nettoyé après lui (45 min).

Un patient en plein examen le finit avant de sortir, quelques minutes pour un patient léger (H62). Un premier modèle
échangeait les places sans nettoyage ; Sami : « s'il y a changement de lit, j'imagine qu'il y a toujours une phase de
nettoyage ? ». C'est ce que demande la SFHH : un bionettoyage selon la procédure habituelle avant tout nouveau patient,
sans durée nationale publiée. L'échange a donc été retiré, et chaque place est nettoyée.

Sur l'hôpital moyen, la chambre est prêtée 17 fois par jour en moyenne, et reprise moins d'une fois par jour, pour
3,6 patients à isoler (les chiffres qui suivent : avec les deux nettoyages). **Ce que gagne le prêt**, par l'échéance sur les mêmes 200 journées (la chambre jamais prêtée
contre prêtée, IC 95 %) :

| Situation | jamais prêtée | prêtée | le gain |
|---|---|---|---|
| hôpital moyen, jour ordinaire | 3 443 | 2 760 | +683 (+321 à +1 045) |
| hôpital moyen, accident | 37 389 | 31 714 | +5 675 (+4 600 à +6 750) |
| hôpital moyen, pic de l'épidémie | 9 343 | 7 811 | +1 532 (+825 à +2 238) |
| hôpital de proximité, accident | 59 144 | 49 536 | +9 608 (+7 687 à +11 528) |
| grand CHU, accident | 5 595 | 3 988 | +1 607 (+813 à +2 400) |

La chambre vide d'un jour ordinaire était une place perdue : la prêter vaut un box de plus, et plus encore quand le
service déborde. Les empreintes du parcours ont changé (le parcours, la marche, l'interne, la fatigue, la recherche,
l'épidémie) ; les mesures des sections d'avant datent du modèle sans prêt.

**La recherche des box, avec la chambre prêtée** (200 journées, 100 itérations, les jobs `parcours-pret-*`, mesurée
avec l'échange sans nettoyage, qui changeait à peine le coût) : un jour
ordinaire, **2 189** contre 2 757 pour l'échéance (−21 %, +568, de +193 à +943) ; pendant l'accident, **20 114** contre
31 648 (−36 %, +11 534, de +9 513 à +13 555). Le gain de la recherche tient avec le prêt.

## L'hôpital en tension, le HET (26/10 au soir, Sami)

**Le niveau avant le Plan blanc** (`src/pathway-het.js`, `HET`, H63 à H66). D'après l'ARS Nouvelle-Aquitaine, le HET
répond à un manque de lits pour les hospitalisations, prévisible plus que soudain ; il engage tous les services, pas
seulement les urgences, et vise à éviter le Plan blanc ([oublis.md](recherche/oublis.md)). Dans le modèle :
- **la décision** : toutes les 15 min tant qu'il n'est pas déclenché, faut-il le déclencher ? Les règles : jamais, ou
  au seuil (3 patients qui attendent un lit, pour 12 box, H66) ; et la recherche, sur 4 h ;
- **ce qu'il fait** : les services s'organisent en 1 h, rendent 2 lits en reportant des admissions programmées (H63),
  puis un lit de médecine toutes les 4 h jusqu'à la fin de la journée, par des sorties avancées (H64). Il ne rappelle
  aucun médecin : cela reste le Plan blanc ;
- **ce qu'il coûte** : chaque lit obtenu pèse 120, 7 min 30 de retard d'un rouge (H65).

Sur la page, « L'hôpital en tension (HET) » de l'onglet Parcours détaillé, et un trait orange foncé sur la frise ; dans
les scripts, `npm run pathway:search -- --het`.

**Les mesures**, sur les mêmes 200 journées de l'hôpital moyen, à 50 itérations (le coût : le retard plus les lits
obtenus à leur poids ; les jobs `parcours-het-*`) :

| Journée | jamais | au seuil | la recherche | la recherche contre jamais (IC 95 %) | lits obtenus (seuil ; recherche) | attente d'un lit la plus longue (jamais ; recherche) |
|---|---|---|---|---|---|---|
| ordinaire | 3 051 | 3 062 | 3 099 | −48 (−301 à +205) | 0,9 ; 1,8 | 746 ; 627 min |
| accident | 32 657 | 32 848 | 33 096 | **−439** (−486 à −393) | 1,7 ; 3,9 | 1 121 ; 1 004 min |
| pic de l'épidémie | 8 288 | 7 836 | 7 581 | +706 (−191 à +1 603) | 2,6 ; 3,7 | 1 419 ; 1 227 min |

- **Le seuil** déclenche tard, vers 1 h du matin en moyenne : les patients qui attendent un lit s'accumulent le soir.
  Il ne sert qu'au pic de l'épidémie.
- **La recherche** ne gagne rien de sûr. Pendant l'accident, elle coûte même plus que de ne jamais déclencher. Au pic
  de l'épidémie, elle bat le seuil (+254, de +17 à +492), sans battre « jamais » de façon sûre.
- **Pourquoi** : sa note compte aussi l'attente d'un lit des patients qui en attendent un, que la mesure ne compte pas.
  Elle déclenche donc plus souvent, et raccourcit l'attente d'un lit la plus longue (de 1 121 à 1 004 min pendant
  l'accident). Mais les lits obtenus coûtent plus que le retard qu'ils évitent. Le but du HET étant les lits, la mesure
  devrait sans doute compter l'attente d'un lit, comme la note : c'est à décider.

