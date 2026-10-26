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

