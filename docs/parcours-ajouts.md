# Le parcours détaillé, la suite (26/10/2026 au soir)

La suite de [parcours.md](parcours.md) : ce que Sami a demandé une fois les six étapes de la feuille de route faites.
Chaque ajout est un réglage, éteint par défaut : la journée reste celle d'avant, et les empreintes ne changent pas.
Les valeurs estimées sont dans [hypotheses-a-verifier.md](recherche/hypotheses-a-verifier.md) (H61 à H78), les sources
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

