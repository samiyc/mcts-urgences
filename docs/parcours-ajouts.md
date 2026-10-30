# Le parcours détaillé, la suite (26/10/2026 au soir)

La suite de [parcours.md](parcours.md) : ce que Sami a demandé une fois les six étapes de la feuille de route faites.
Chaque ajout est un réglage, éteint par défaut : la journée reste celle d'avant, et les empreintes ne changent pas.
Les valeurs estimées sont dans [hypotheses-a-verifier.md](recherche/hypotheses-a-verifier.md) (H61 à H79), les sources
dans [oublis.md](recherche/oublis.md).

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

**La recherche des box sur le modèle actuel**, la chambre prêtée et chaque place nettoyée (200 journées,
100 itérations, les jobs de `night.json` refaits la nuit du 26 au 27/10 ; la dernière colonne : les mesures d'avant le
prêt, dans [parcours.md](parcours.md)) :

| Situation | l'échéance | la recherche | la recherche contre l'échéance (IC 95 %) | avant le prêt |
|---|---|---|---|---|
| hôpital moyen, jour ordinaire | 2 760 | **2 184** (−21 %) | +576 (+207 à +946) | +913 (−27 %) |
| hôpital moyen, accident | 31 714 | **20 045** (−37 %) | +11 668 (+9 625 à +13 712) | +13 724 (−37 %) |
| hôpital de proximité, accident | 49 536 | **36 530** (−26 %) | +13 006 (+10 742 à +15 269) | +17 187 (−29 %) |
| grand CHU, accident | 3 988 | **3 428** (−14 %) | +560 (+252 à +869) | +1 447 (−26 %) |
| hôpital moyen, pic de l'épidémie | 7 811 | **5 814** (−26 %) | +1 997 (+1 246 à +2 748) | +3 104 (−33 %) |

- **Le gain tient partout**, et aucun intervalle ne passe par zéro. La recherche laisse partir sans être vus un peu
  moins de patients que l'échéance (6,4 contre 6,9 pendant l'accident).
- **Il baisse là où la chambre servait de box en plus** : un jour ordinaire, au CHU, en hiver. Prêtée, elle donne aux
  règles une partie de ce que la recherche trouvait seule. Pendant l'accident à l'hôpital moyen, il reste de 37 %.
- **Le nettoyage ne change presque rien** : mesurée avec l'échange sans nettoyage (les jobs `parcours-pret-*`), la
  recherche faisait 2 189 un jour ordinaire et 20 114 pendant l'accident.

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

**Les mesures**, sur les mêmes 200 journées de l'hôpital moyen, à 50 itérations (les jobs `parcours-het-*`). Un
premier coût ne comptait que le retard et les lits obtenus ; la recherche, notée aussi sur l'attente d'un lit, y perdait
pendant l'accident (−439, de −486 à −393). Sami : le HET étant fait pour les lits, la mesure compte aussi l'attente d'un
lit, comme la note (`boardingCostOf`, `BOARDING_COST`). Le coût est donc le retard, l'attente d'un lit et les lits
obtenus :

| Journée | jamais | au seuil | la recherche | la recherche contre jamais (IC 95 %) | contre le seuil | lits obtenus (seuil ; recherche) |
|---|---|---|---|---|---|---|
| ordinaire | 9 480 | 8 669 | **7 985** | +1 495 (+960 à +2 030) | +684 (+472 à +896) | 0,9 ; 1,8 |
| accident | 44 147 | 42 961 | **42 347** | +1 800 (+1 360 à +2 241) | +614 (+376 à +852) | 1,7 ; 3,9 |
| pic de l'épidémie | 25 834 | 21 370 | **19 691** | +6 142 (+4 825 à +7 459) | +1 679 (+1 282 à +2 076) | 2,5 ; 3,7 |

- **Le HET sert** : même au seuil, qui déclenche tard (vers 1 h du matin), il fait mieux que de ne jamais le
  déclencher. Il sert surtout au pic de l'épidémie : l'attente d'un lit y passe de 17 475 à 12 055 avec la recherche.
- **La recherche déclenche plus tôt et plus souvent que le seuil** : deux fois plus de lits obtenus. Elle bat le seuil
  dans les trois situations. Le retard aux urgences change peu ; ce sont les lits qui comptent, comme le veut le HET.
- L'attente d'un lit la plus longue baisse de 1 121 à 1 004 min pendant l'accident, de 1 419 à 1 227 au pic de
  l'épidémie.

**Aux deux autres hôpitaux, pendant l'accident** (les mêmes 200 journées, 50 itérations, la nuit du 26 au 27/10) :

| Hôpital | jamais | au seuil | la recherche | contre jamais (IC 95 %) | contre le seuil | lits obtenus (seuil ; recherche) | attente d'un lit (jamais ; recherche) |
|---|---|---|---|---|---|---|---|
| de proximité | 60 339 | 57 709 | **56 701** | +3 637 (+2 505 à +4 769) | +1 008 (+588 à +1 428) | 1,5 ; 3,1 | 8 843 ; 6 322 |
| grand CHU | 18 130 | 17 018 | **15 963** | +2 167 (+1 619 à +2 715) | +1 055 (+786 à +1 324) | 1,8 ; 3,8 | 12 825 ; 10 205 |

La même chose qu'à l'hôpital moyen : la recherche bat le seuil dans les cinq mesures, avec deux fois plus de lits
obtenus. Au CHU, le retard ne bouge pas (5 304 sans HET, 5 301 avec la recherche) : tout le gain vient des lits.
L'attente d'un lit la plus longue baisse de 1 200 à 993 min à l'hôpital de proximité, de 750 à 657 min au CHU.

## Les quatre ajouts (26/10 au soir, Sami)

Les quatre derniers points « plus tard » de la feuille de route. Chacun se règle dans l'onglet Parcours détaillé (« oui »
ou « non ») et dans les scripts (`--familles`, `--interpretes`, `--circuit-court`, `--deces`). Ce que chacun tire
pour un patient vient de sa propre graine (`src/pathway-extras.js`) : en allumer un ne change pas les tirages des
autres.

**Les familles** (`src/pathway-family.js`, `FAMILY`, H67 à H69). Les personnes âgées arrivent plus souvent accompagnées
(DREES, 2013), sans pourcentage publié. Dans le modèle :
- **qui** : 70 % des 75 ans et plus, 35 % des autres ;
- **des chaises** : l'accompagnant s'assoit en salle d'attente, de l'arrivée du patient à sa sortie (🧍 sur le plan) ;
  la salle pleine, les patients attendent debout, comptés, sans effet sur les soins ;
- **du temps médecin** : informer la famille ajoute 5 min à la lecture des résultats ;
- **le retour à domicile** : une personne de 75 ans et plus accompagnée, orientée vers l'UHCD, rentre chez elle une
  fois sur trois ;
- **la traduction** : voir l'interprète.

**L'interprète** (`src/pathway-interpreter.js`, `INTERPRETER`, H70 à H72). À Arras, 278 consultations sur 21 909
concernaient un patient allophone (1,3 %), et le traducteur informel était le moyen le plus utilisé. Dans le modèle :
- **avec un accompagnant** (les familles allumées), il traduit : le tri et l'examen sont 1,2 fois plus longs ;
- **sinon, un interprète par téléphone** : 5 min d'attente au tri et à l'examen, l'infirmier ou le médecin en ligne
  avec lui, puis des gestes 1,5 fois plus longs. Un premier essai à 10 min coûtait cher, l'IOA étant seul au tri.

**Le circuit court** (`src/pathway-fast.js`, `FAST_TRACK`, H73 à H75). Il existe dans 58 % des services et prend
13,5 % des patients ([parcours-patient.md](recherche/parcours-patient.md)). Dans le modèle :
- **qui le tient** : un médecin **pris à l'équipe** (le choix de Sami), deux au CHU, de 10 h à 22 h ;
- **où** : une salle de consultation, « C » sur les plans (deux au CHU), posée sur le sol près du tri : les marches ne
  changent pas ;
- **qui y va** : les patients venus à pied et triés 4 ou 5, pas à isoler, dans l'ordre d'arrivée. La règle des box peut
  toujours en prendre un en box ;
- **la suite** : comme tout patient léger venu à pied, ils attendent leurs résultats assis, et le médecin du circuit
  court les lit en premier. À 22 h, il finit son patient puis revient à l'équipe.

Il voit 16 patients par jour à l'hôpital moyen, 13 % des patients, comme la DREES.

**Les décès** (`src/pathway-deaths.js`, `DEATHS`, H76 à H78). Environ 0,2 % des passages aux urgences finissent par un
décès (une étude multicentrique de 1997, de 0,06 à 0,8 % selon les services). Une étude anglaise sur 5 millions de
patients lie une attente de plus de 5 h à plus de décès à 30 jours. Dans le modèle :
- **le tirage** : à la fin de l'examen, un patient meurt avec 4 % de chances s'il est de niveau 1, 0,2 % s'il est de
  niveau 2. La chance monte de 10 % par heure d'attente au-delà de l'attente maximale de son niveau ;
- **ce que cela immobilise** : le médecin reste 45 min (la réanimation, puis l'annonce à la famille), et la place 90 min
  de plus ;
- **le poids** : chaque décès pèse **1 920** dans le coût des mesures et dans la note de la recherche, 2 h de retard
  d'un rouge (le choix de Sami).

**Ce que chacun coûte**, à l'hôpital moyen par l'échéance, sur les mêmes 200 journées (`npm run pathway:additions`,
l'écart sur la journée sans ajout et son IC 95 %) :

| Ajout | jour ordinaire (2 760 sans) | accident (31 714 sans) | pic de l'épidémie (7 811 sans) |
|---|---|---|---|
| les familles | +311 (+34 à +587) | +2 856 (+2 116 à +3 596) | +525 (−74 à +1 124) |
| l'interprète, seul | +273 (+118 à +427) | +1 739 (+1 104 à +2 375) | +822 (+329 à +1 316) |
| l'interprète, avec les familles | +534 (+180 à +889) | +4 188 (+3 216 à +5 160) | +1 469 (+650 à +2 288) |
| le circuit court | **+1 620** (+901 à +2 339) | **+12 867** (+10 653 à +15 081) | **+3 591** (+2 214 à +4 968) |
| les décès | +868 (+592 à +1 144) | +2 813 (+1 895 à +3 731) | +858 (+583 à +1 133) |

- **Les familles** coûtent surtout du temps médecin : 157 min par jour à les informer. Pendant l'accident, 11,5 patients
  restent debout.
- **L'interprète** : 1,5 patient par jour, mais chaque appel retient l'IOA ou le médecin. Avec les familles, un
  accompagnant traduit pour plus d'un tiers d'entre eux.
- **Le circuit court, à effectif égal, coûte cher** : l'équipe perd un médecin pendant 12 h, et celui du circuit court,
  qui ne voit que des patients légers au poids faible, est souvent libre. Il ne fait pas baisser les départs sans être
  vu de façon nette. C'est ce que mesure le coût du retard, qui pèse les patients par leur gravité. Un circuit court
  avec un soignant en plus serait une autre mesure.
- **Les décès** : 0,37 par jour un jour ordinaire, 0,98 pendant l'accident. Le coût monte de leur poids (868 pour
  0,37 décès à 1 920 l'unité, plus le temps qu'ils immobilisent).

**Aux deux autres hôpitaux** (les mêmes 200 journées, la nuit du 26 au 27/10 ; entre parenthèses, le coût sans ajout) :

| Ajout | proximité, ordinaire (3 181) | proximité, accident (49 536) | CHU, ordinaire (1 150) | CHU, accident (3 988) |
|---|---|---|---|---|
| les familles | +37 (−110 à +185) | −149 (−1 262 à +964) | +90 (+61 à +118) | +880 (+442 à +1 319) |
| l'interprète, seul | +54 (−59 à +166) | +750 (+222 à +1 279) | +122 (+96 à +149) | +513 (+227 à +800) |
| l'interprète, avec les familles | +55 (−99 à +209) | +461 (−723 à +1 644) | +166 (+127 à +204) | +1 226 (+645 à +1 807) |
| le circuit court | **+2 481** (+1 656 à +3 305) | **+18 297** (+15 805 à +20 789) | **+461** (+381 à +541) | **+3 566** (+2 329 à +4 803) |
| les décès | +240 (+36 à +444) | +2 491 (+1 780 à +3 203) | +1 003 (+811 à +1 195) | +1 710 (+1 391 à +2 029) |

- **Le circuit court coûte le plus partout**, et surtout au petit hôpital, qui prend un médecin à une petite équipe :
  +37 % pendant l'accident. Il y voit 12 à 16 patients par jour, 34 à 37 au CHU.
- **Les familles ne coûtent rien de sûr à l'hôpital de proximité**, où les intervalles passent par zéro ; au CHU,
  elles prennent 315 à 330 min d'information par jour. Pendant l'accident, 13,7 patients restent debout à l'hôpital de
  proximité, 2,9 au CHU.
- **Les décès** : 0,20 par jour à l'hôpital de proximité un jour ordinaire, 1,05 pendant l'accident ; 0,52 et 0,80 au
  CHU. Au CHU un jour ordinaire, le coût vient presque tout de leur poids (0,52 × 1 920 ≈ 998 sur +1 003) : le retard
  seul passe de 1 150 à 1 155.

**La recherche des box avec les ajouts** (l'hôpital moyen, 200 journées, 100 itérations ; les jobs
`parcours-deces-*`, `parcours-circuit-court-*`, `parcours-familles-*` et `parcours-tout-*`). La dernière colonne
dit ce que les ajouts coûtent à cette règle et à la recherche, sur leur journée sans ajout :

| Ajouts | jour | la meilleure règle | la recherche | la recherche contre la règle (IC 95 %) | ce qu'ils coûtent : à la règle ; à la recherche |
|---|---|---|---|---|---|
| les décès | ordinaire | l'échéance 3 628 | **2 755** | +873 (+399 à +1 346) | +868 ; +571 |
| les décès | accident | la couleur 34 465 | **22 463** | +12 002 (+10 014 à +13 990) | +1 820 ; +2 418 |
| les décès | pic de l'épidémie | l'échéance 8 669 | **6 308** | +2 361 (+1 496 à +3 227) | +858 ; +494 |
| le circuit court | ordinaire | l'échéance 4 380 | **3 388** | +992 (+395 à +1 589) | +1 620 ; +1 204 |
| le circuit court | accident | la couleur 42 582 | **28 021** | +14 560 (+12 351 à +16 769) | +9 937 ; +7 976 |
| les familles et l'interprète | ordinaire | l'échéance 3 294 | **2 475** | +820 (+379 à +1 260) | +534 ; +291 |
| les familles et l'interprète | accident | la couleur 35 764 | **22 729** | +13 035 (+11 054 à +15 017) | +3 119 ; +2 684 |
| tout | pic de l'épidémie | l'échéance 14 822 | **11 053** | +3 769 (+2 595 à +4 943) | +7 011 ; +5 239 |

Ce qu'on en retient :
- **la recherche garde son gain avec chaque ajout**, de 23 à 36 % sous la meilleure règle, et aucun intervalle ne
  passe par zéro. Le poids des décès est dans sa note ;
- **chaque ajout lui coûte moins qu'à la règle**, de la moitié aux quatre cinquièmes, sauf les décès pendant l'accident
  (+2 418 contre +1 820 pour la couleur) ;
- **le circuit court reste cher, même pour elle** : 28 021 pendant l'accident, contre 20 045 sans lui. Un médecin pris à
  l'équipe coûte plus que ce que le circuit court rend ;
- **tout allumé en hiver**, l'ordre d'arrivée s'effondre (18 728), et la couleur rejoint l'échéance (14 942).


## Les essais de mcts-commun (27/10 au soir)

mcts-commun a ajouté deux réglages de la recherche, éteints par défaut (a9a4c99, 4abc577 ; son `docs/recherche.md`) :
- **`diagnose`** dit ce qu'a vu une recherche ;
- **l'arrêt anticipé** (`earlyStop`) arrête la recherche dès que son coup de tête ne peut plus être rattrapé.

Sa session a demandé à chaque projet de les essayer. Ici, toutes les recherches y passent (`src/search-trials.js`) :
la garde et les huit décisions du parcours. Les options sont `--diagnose` et `--early-stop`
([outillage.md](outillage.md)). Les empreintes n'ont pas bougé.

**L'arrêt anticipé ne change aucun choix**, et la journée reste la même patient pour patient. L'écart par paires vaut
0 (0 à 0) partout, sur 200 journées ou gardes. Chaque décision tire son propre aléa, si bien que s'arrêter plus tôt
ne décale rien ensuite. Ce qu'il épargne dépend de la décision :
- **presque rien là où les coups se suivent de près** : de 0 à 7 % des itérations sur la garde, les box, la SAUV,
  les files, les pauses, l'interne et les lits. Les deux premiers coups restent trop proches pour que le premier ne
  puisse plus être rattrapé ;
- **beaucoup sur les choix à deux coups, souvent tranchés** : 32 % sur le Plan blanc, 16 % sur le HET. Ce sont les
  seules décisions où `diagnose` ne signale souvent rien (63 % et 14 % des recherches).

Le temps mesuré favorise la ligne jouée en second, où le code est déjà chaud : il faut juger l'épargne sur les
itérations. Une recherche arrêtée tôt reçoit souvent `fewIterations` (79 % sur le Plan blanc), alors que son choix
était acquis. Il reste éteint par défaut : c'est à Sami de trancher.

**Ce que dit `diagnose`**, en part des recherches (une recherche peut donner plusieurs codes), à l'hôpital moyen
pendant l'accident, sauf la mention « ordinaire » ; 200 gardes ou journées chacune. Les coups à égalité et « rien »
sont recomptés le 28/10 avec le `closeCall` corrigé de mcts-commun (a2c66bd), les mêmes recherches ; entre
parenthèses, le compte du 27/10, avant le correctif :

| Décision (itérations) | recherches | peu d'itérations | score plat | coups à égalité | arbre court | rien | épargne de l'arrêt |
|---|---|---|---|---|---|---|---|
| la garde, ordinaire (100) | 9 015 | 0 % | 5 % | 78 % (94 %) | 0 % | 17 % (2 %) | 7 % |
| la garde (100) | 13 235 | 0 % | 4 % | 81 % (95 %) | 0 % | 14 % (0 %) | 2 % |
| le box du parcours, ordinaire (100) | 5 338 | 0 % | 4 % | 70 % (96 %) | 0 % | 26 % (0 %) | 5 % |
| le box du parcours (100) | 15 315 | 0 % | 1 % | 78 % (99 %) | 0 % | 21 % (0 %) | 2 % |
| la sortie de SAUV (50) | 667 | 48 % | 5 % | 49 % (95 %) | 0 % | 28 % (0 %) | 2 % |
| le lit d'aval (50) | 444 | 61 % | **94 %** | 4 % (6 %) | 38 % | 0 % | 0 % |
| les pauses (50) | 3 679 | 0 % | 17 % | 52 % (83 %) | 0 % | 31 % (0 %) | 3 % |
| le scanner et le bloc (50) | 1 520 | 31 % | 37 % | 42 % (62 %) | 0 % | 12 % (0 %) | 1 % |
| l'interne (50) | 42 698 | 42 % | **52 %** | 42 % (48 %) | 0 % | 3 % (0 %) | 0 % |
| le Plan blanc (50) | 5 458 | 0 % | 1 % | 19 % (37 %) | 0 % | 80 % (63 %) | **32 %** |
| le HET (50) | 9 309 | 0 % | 2 % | 10 % (84 %) | 0 % | 89 % (14 %) | **16 %** |

Les codes de mcts-commun sont `fewIterations`, `flatScore`, `closeCall` et `shallow` ; « rien », aucun code. Les
jobs sont `essai-*-essais-commun-2026-10-27` de la file, puis `diagnose-*-2026-10-28-diagnose` pour le recompte.
Ce qu'on en retient :
- **les coups à égalité départagent maintenant les décisions.** Avant le correctif, ils sortaient presque partout :
  le critère bornait l'écart type par p(1 − p), le plus haut à ½, là où notre score est centré par construction, et
  ignorait les mondes communs. Il juge désormais l'écart apparié du coup joué sur le suivant. Il tombe là où le
  choix est net : 10 % sur le HET, 19 % sur le Plan blanc, et « rien » y monte à 89 et 80 %. Il reste haut sur la
  garde et les box (70 à 81 %), où il dit vrai : sur les box d'une journée d'accident, 8 graines ne font le même
  choix qu'à 65 à 75 % (50 itérations), et 79 à 85 % (400). Les deux premiers coups y valent presque autant, et le
  choix entre eux compte peu ;
- **le score des lits est plat** : 94 % des recherches voient la même valeur pour chaque patient. Le choix compte
  pourtant : selon la règle, le boarding le plus long passe de 1 121 à 1 191 min. Qui que prenne le lit, le retard
  dans l'horizon est le même, et l'attente d'un lit passe d'un patient à l'autre au même poids, sauf un patient de
  75 ans et plus la nuit. Ce serait le score à revoir, si les lits valaient une recherche ;
- **le score de l'interne est plat une fois sur deux** (52 %) : la tâche qu'il fait d'abord change peu le retard dans
  l'horizon. C'est cohérent avec la mesure, où la recherche ne bat sûrement aucune règle (49 434, contre 49 170 pour
  la tâche due la première) ;
- **peu d'itérations** : à 50 itérations, une racine de 4 patients et l'attente donne 10 visites par coup, sous les 20
  de mcts-commun. À 100 itérations, le code disparaît sur la garde et les box ;
- **l'arbre court** n'apparaît que sur les lits, où il y a peu de décisions dans l'horizon. `widening` n'a donc pas sa
  place ici.

**DyRo-MCTS** (2025, [arXiv 2509.21902](https://arxiv.org/abs/2509.21902)). Pour un atelier où des tâches arrivent en
cours de route, la note d'un coup mêle le retard et une robustesse : le temps mort des machines, compté surtout tout
de suite (α = 0,6). La robustesse compense des mondes qui ne tirent jamais les arrivées futures. Elle gagne environ
3 % sur une MCTS ordinaire. Nos mondes tirent les arrivées (les taux de l'hôpital, l'épidémie) : le biais qu'elle
corrige est en grande partie absent. Son idée servirait à deux endroits, sans rien coder pour l'instant :
- **départager les coups à égalité** : préférer celui qui garde une place (un box, la SAUV) pour un rouge pas encore
  annoncé, puisqu'une crise que personne n'annonce n'est jamais tirée ;
- **les décisions dont l'effet dépasse l'horizon**, le Plan blanc et le HET.

**Le pour et le contre** (Sami, 27/10 au soir : « le pour et le contre des features earlyStop et diagnose »).

`earlyStop` change la façon dont la recherche travaille : il arrête le dépouillement des visites dès que le coup de
tête ne peut plus être rattrapé.
- **Pour** : le choix est garanti le même (vérifié sur 200 journées par décision) ; il va plus vite quand le choix est
  net (32 % sur le Plan blanc, 16 % sur le HET) ; éteint, il ne coûte rien.
- **Contre** : il ne fait rien là où c'est serré, c'est-à-dire presque partout ici (0 à 7 %) ; il gagne du temps, pas
  de la qualité, et ce temps ne sert que si on le redonne aux décisions serrées. Rien n'est limité par le temps ici :
  il compte plus pour un bot à 50 ms par tour (CodinGame).
- **Ici** : éteint par défaut. Il peut s'allumer sans risque pour le Plan blanc et le HET, sans que rien presse.

`diagnose` ne change rien : c'est un rapport après chaque recherche.
- **Pour** : aucun effet sur les résultats ; il trouve ce qu'on ne voyait pas (la note des lits plate, celle de
  l'interne une fois sur deux) ; il dit aussi ce qui ne sert à rien (`shallow` presque absent, donc pas de `widening`).
- **Contre** : `closeCall` sortait presque toujours (corrigé par mcts-commun le soir même, a2c66bd : il juge
  maintenant l'écart apparié du coup joué sur le suivant ; recompté le 28/10, de 4 à 81 % selon la décision) ; un code est une piste, pas une preuve, que seule une
  mesure par paires tranche ; il compte, donc il ralentit un peu.
- **Ici** : une option de mesure, allumée dans les comparaisons, jamais par défaut.

**La note des lits** (Sami, 27/10 au soir : chiffrer ce que `flatScore` montre sur les lits). Pourquoi elle est
plate, et ce qu'y change une note revue.

Sur 200 journées d'accident à l'hôpital moyen, les trois règles des lits donnent :

| Règle | retard des box | attente totale d'un lit | la plus longue | au-delà de 12 h | 75+ une nuit sur un brancard |
|---|---|---|---|---|---|
| la décision la plus ancienne | 32 645 | 4 441 min | **1 121 min** | 2,37 | 3,13 |
| celui qui tient un box | 32 645 | 4 434 min | 1 191 min | **2,25** | 3,10 |
| les 75 ans et plus d'abord | 32 645 | 4 439 min | 1 167 min | 2,29 | **3,04** |

- **Le choix ne change ni le retard des box ni l'attente totale.** Les services libèrent leurs lits aux mêmes heures
  quelle que soit la règle : l'attente totale est la même à la minute près sur 158 à 200 journées. Seul l'ordre change,
  donc qui attend le plus. Une note qui additionne les minutes ne peut rien voir : c'est le `flatScore` à 94 %.
- **La note revue** (`--attente-convexe`, H79, éteinte par défaut) fait peser une minute d'autant plus que le patient
  attend depuis longtemps. La recherche rejoint alors la décision la plus ancienne, sans faire mieux :

| Situation (200 journées) | la plus ancienne | la recherche, à la minute | la recherche, attente convexe |
|---|---|---|---|
| hôpital moyen, accident (50 itérations) | **1 121 min** | 1 133 | 1 125 |
| hôpital moyen, accident (200 itérations) | **1 121** | 1 133 | 1 125 |
| hôpital moyen, ordinaire | **746** | 746 | 746 |
| hôpital de proximité, accident | **1 200** | 1 209 | 1 205 |
| CHU, accident | **750** | 751 | 750 |

  Le retard ne bouge nulle part (au plus 29 points sur 51 496 à l'hôpital de proximité, dans le bruit).
- **Ce qu'on en retient : les lits ne demandent pas de recherche.** Une note convexe est la plus basse quand le patient
  qui attend depuis le plus longtemps passe d'abord, ce que fait déjà la règle. La recherche ne voit qu'un lit à la
  fois dans son horizon, et n'a rien d'autre à trouver. Le vrai choix est une question de valeurs, à poser aux
  professionnels plutôt qu'à la recherche : la plus courte attente maximale (la plus ancienne), ou une nuit sur un
  brancard de moins pour les 75 ans et plus (0,09 par jour, pour 46 min d'attente maximale en plus).
- **`diagnose` avait raison** : un score plat sur une décision qui compte disait qu'il n'y avait rien à départager
  dans l'horizon. Les jobs sont `lits-convexe-*-2026-10-27-soir-lits` de la file. Avec le `closeCall` corrigé de
  mcts-commun (a2c66bd), il ne sort plus que dans 2 à 7 % des recherches des lits (4 % au recompte du 28/10).

## Le palier de réglages (28/10 au soir, Sami)

Sami trouve nos réglages bas face à lopin. mcts-commun a proposé à chaque projet un palier à mesurer
(son `docs/reglages.md`) : A, les réglages d'aujourd'hui (100 itérations, 50 pour le HET ; 4 coups à la racine ;
profondeur 2) ; B, quatre fois le budget ; C, 8 coups à la racine ; D, la profondeur 3 pour deux fois le budget ; E,
tout ensemble (budget ×4, 8 coups à la racine, 5 plus bas, profondeur 3, `widening` 1). Les cinq jouent par paires
les mêmes journées ou gardes, à l'hôpital moyen, avec `diagnose` et le rang du coup joué (`--palier`,
[outillage.md](outillage.md)).

L'écart sur A, en coût au moment (négatif : moins cher que A ; IC 95 %) :

| Décision (journées) | A | B, budget ×4 | C, 8 à la racine | D, profondeur 3 | E, tout |
|---|---|---|---|---|---|
| la garde, ordinaire (200) | 1 255 | −83 (−157 à −8) | +35 (−104 à +174) | **−112** (−208 à −17) | −5 (−95 à +85) |
| la garde, accident (100) | 42 298 | −2 034 (−3 836 à −233) | **−6 621** (−9 470 à −3 773) | −1 259 (−2 961 à +444) | **−7 895** (−10 846 à −4 944) |
| le box, ordinaire (200) | 2 184 | −41 (−225 à +143) | −34 (−151 à +82) | 0 (−95 à +94) | −81 (−283 à +121) |
| le box, accident (100) | 21 074 | −625 (−1 513 à +263) | **−1 103** (−2 114 à −92) | −753 (−1 611 à +106) | **−2 686** (−4 015 à −1 357) |
| le HET, accident (200) | 42 347 | +20 (−41 à +81) | 0 (0 à 0) | +70 (+14 à +125) | +53 (−10 à +115) |

B et E prennent quatre fois le temps de A, D deux fois, C le même (de 0 à 9 % de moins : les coups de plus reçoivent
peu de visites). Une recherche du box prend 186 à 219 ms avec A, 731 à 848 ms avec B ou E ; une recherche de la garde,
13 à 19 ms avec A.

Ce qu'on en retient :
- **Pendant l'accident, la liste courte de 4 coups écarte souvent le bon.** Avec 8 coups, la recherche joue un des
  coups 5 à 8 dans 39 % des recherches de la garde et 31 % de celles du box. C gagne 16 % sur la garde et 5 % sur le
  box, pour le même temps. Les jours ordinaires, les rangs 5 à 8 ne sont joués que dans 6 à 8 % des recherches, et C
  ne change rien de sûr ;
- **plus d'itérations aident peu** : B gagne 3 à 7 %, sûr sur la garde seulement, pour quatre fois le temps. Ses
  coups à égalité baissent (de 78 à 64 % sur la garde, de 79 à 60 % sur le box pendant l'accident), mais le rang joué
  ne bouge pas : la recherche départage mieux les mêmes 4 coups ;
- **la profondeur 3 ne gagne sûrement que sur la garde d'un jour ordinaire** (−9 %). Sur le HET, elle obtient plus de
  lits (4,7 par jour, contre 3,9), mais coûte 70 de plus : des lits demandés pour rien ;
- **E est le meilleur pendant l'accident** : −19 % sur la garde, −13 % sur le box, pour quatre fois le temps. Sur la
  garde, C en donne déjà l'essentiel (6 621 sur 7 895). Sur le box, E gagne plus que B et C ensemble : avec C seul,
  `fewIterations` sort dans 69 % des recherches (100 itérations pour 8 coups), et les 8 coups demandent des visites ;
- **le HET ne gagne rien** : deux coups, un choix net (des coups à égalité dans 10 % des recherches). Il reste à A.

Rien ne change par défaut : les empreintes restent les mêmes, en attendant la décision de Sami. La mesure suivante
serait 8 coups à la racine pour deux fois le budget, pendant l'accident et aux deux autres hôpitaux : voir si elle
rejoint E pour la moitié du temps. Les jobs sont `palier-*-2026-10-28-palier` de la file.

**C par défaut (30/10, Sami : « racine changement d'empreinte ok »).** La recherche de la garde et celle du box
gardent 8 coups à la racine, 4 plus bas (`root: 8` dans `SEARCH_SETTINGS` et `PATHWAY_SEARCH`). Les autres
décisions gardent déjà tous leurs coups. Quatre empreintes changent : `search`, `pathwaySearch`, `epidemic` et
`additions`. Les mesures d'avant le 30/10 sont faites avec 4 coups. La mesure de C2 (C avec le budget ×2) et de E
contre C, pendant l'accident et aux deux autres hôpitaux, est dans la file : `--palier` donne maintenant les lignes
A (4 coups), C2 et E.

## Les plans à deux couloirs (29/10, Sami)

Sami a redessiné l'hôpital de proximité : deux couloirs au lieu d'un, les salles entre les deux, un accueil en U qui
les relie et un passage à l'arrière. Le plan est plus proche d'un carré (20 × 14 cases au lieu de 36 × 9) : il remplit
mieux la largeur de la page, et les cases s'y voient mieux. Il a une case de résultats de moins (3 `r`).

Sami a dessiné aussi les deux autres, sur le même modèle :
- **l'hôpital moyen** (20 × 16 au lieu de 54 × 9, [parcours.md](parcours.md), étape 2) : deux couloirs, reliés par
  l'accueil et par deux passages à l'arrière ; les 12 box en trois salles de 4, les 6 lits d'UHCD au fond ; 5 `r`
  au lieu de 6 ;
- **le CHU** (28 × 20 au lieu de 70 × 10) : trois couloirs. L'accueil et deux passages relient les deux premiers ; un
  passage, la salle de 12 box (deux portes) et le côté de l'accueil relient les deux derniers. L'UHCD est en deux
  salles de 6, les box en une salle de 12 et trois de 4, la SAUV au fond à gauche, la salle d'attente le long de la
  façade, l'entrée en retrait d'une case ; 16 `r` au lieu de 10. Le coin en haut, autour des ascenseurs, est dehors (des espaces, que la page ne
  dessine pas).

Mes premiers plans de ces deux hôpitaux (31 × 15 et 37 × 20, b114dd0) ont servi quelques heures : ceux de Sami font
mieux sur toutes les mesures. Les passages à l'arrière évitent que toutes les marches passent par l'accueil. Les plans
ont les mêmes places qu'avant, et autant de sièges `w` (`src/pathway-plans.js`). Le CHU :

```text
#################   ########
#U.U.U.U#X.X#O..#   #wwwwww#
#U.....U#...#...##H##wwwwww#
####.######.##.##......wwww#
#..........................#
##.#.#######.######rrrrr..##
#..#.#D.R.B#.#L..P#####A..E.
#II#.#.....#.#....#####T..#.
####.##.####.##.###rrrrr..##
#..........................#
####.##.##.#####.####rrr...#
#U.U.U#.#b.b.b.b.b.b###C.ww#
#U.U.U#.#b.b.b.b.b.b###C.ww#
#######.##.#####.####rrr.ww#
#........................ww#
###.####.####.####.##wwwwww#
#S..S#b..b#b..b#b..b#wwwwww#
#....#....#....#....#wwwwww#
#S..S#b..b#b..b#b..b#wwwwww#
############################
```

**Sans la marche, rien ne change** : une journée sur le plan reste la même, et les empreintes de la journée et des
recherches n'ont pas bougé. Seules `walked` et `intern`, qui comptent la marche, changent.

**Ce qui se marche**, sur 20 journées, couleur puis ordre d'arrivée, de l'ancien plan au nouveau (le modèle
d'aujourd'hui pour les deux) :

| Hôpital | patients | médecins | brancardiers | sans brancardier libre | délai du brancardier |
|---|---|---|---|---|---|
| proximité, ordinaire | 11,4 → 7,8 km | 5,8 → 4,8 km | 3,1 → 3,4 km | 5,2 → 5,5 | 1,1 → 1,3 min |
| proximité, accident | 10,9 → 7,7 km | 5,3 → 4,4 km | 3,6 → 4,1 km | 7,2 → 7,6 | 1,1 → 1,3 min |
| moyen, ordinaire | 29,6 → 13,9 km | 14,7 → 11,9 km | 9,1 → 6,6 km | 3,3 → 2,5 | 1,7 → 1,4 min |
| moyen, accident | 29,5 → 14,0 km | 14,5 → 11,6 km | 10,2 → 7,6 km | 4,7 → 3,5 | 1,7 → 1,4 min |
| CHU, ordinaire | 74,0 → 35,1 km | 42,7 → 25,8 km | 22,9 → 18,9 km | 8,5 → 6,3 | 2,2 → 1,9 min |
| CHU, accident | 76,3 → 37,3 km | 43,5 → 27,4 km | 25,0 → 20,8 km | 11,9 → 9,3 | 2,2 → 1,9 min |

**Ce que coûte la marche comptée**, en coût du retard au moment, sur les mêmes journées :

| Hôpital | sans marche | marche, ancien plan | marche, nouveau plan | passage médian | sortis en moins de 4 h |
|---|---|---|---|---|---|
| proximité, ordinaire | 4 257 | 4 490 | 4 100 | 2 h 36 → 2 h 30 | 74 → 75 % |
| proximité, accident | 56 507 | 60 487 | 62 015 | 4 h 44 → 4 h 47 | 44 → 42 % |
| moyen, ordinaire | 4 444 | 7 929 | **5 359** | 2 h 36 → 2 h 24 | 76 → 79 % |
| moyen, accident | 44 992 | 61 106 | **52 540** | 4 h 19 → 4 h 03 | 48 → 52 % |
| CHU, ordinaire | 1 038 | 6 432 | **2 418** | 2 h 23 → 2 h 14 | 81 → 83 % |
| CHU, accident | 3 344 | 17 127 | **7 806** | 2 h 49 → 2 h 30 | 74 → 78 % |

Ce qu'on en retient :
- **les patients marchent de 29 à 53 % de moins.** L'entrée donne sur le milieu du plan : un box est à 15 pas de
  l'entrée en moyenne à l'hôpital moyen, au lieu de 45, et à 22 au CHU, au lieu de 52 ;
- **la marche coûte moins à l'hôpital moyen et au CHU** : ce qu'elle ajoute au retard baisse de 74 % (un jour
  ordinaire) et de 53 % (l'accident) à l'hôpital moyen, de 74 et 68 % au CHU ;
- **les brancardiers marchent 25 % de moins à l'hôpital moyen, 17 % de moins au CHU**, et un transport y attend le
  sien moins longtemps (0,3 min de moins). À l'hôpital de proximité, ils marchent de 10 à 14 % de plus, et un
  transport attend 0,2 min de plus : leur base y est dans la salle des médecins, plus loin du scanner qu'avant ;
- **à l'hôpital de proximité, rien de sûr** : la marche y comptait déjà peu. Pendant l'accident, le nouveau plan
  coûte 1 528 de plus (3 %), le seul cas où il fait moins bien. Ces moyennes viennent de 20 journées, sans intervalle :
  une mesure par paires le confirmerait, s'il le faut.

Les autres mesures avec la marche comptée faites avant le 29/10 (l'interne, la fatigue `--marche`) l'ont été sur les
anciens plans.
