# Les ressources rares, ce qui fait goulot

Sami (25/10/2026) : « La thématique "on manque de lits" est assez récurrente, mais je suis sûr qu'il y a d'autres
éléments en quantité limitée qui créent des goulots d'étranglement. » Pour chaque ressource, ce fichier dit
pourquoi elle manque, ce que le service fait alors, et comment la simuler. Les termes sont dans le
[glossaire](glossaire.md), et le parcours dans [parcours-patient.md](parcours-patient.md).

Une ressource fait goulot quand **elle est rare, longue à libérer et sans substitut**. Un box se libère en une
heure ou deux ; un lit de réanimation en plusieurs jours ; un neurochirurgien ne se remplace par personne.

## Le tableau

| ressource | combien (hypothèse pour un hôpital moyen, sauf source) | libérée en | si elle manque | à simuler |
|---|---|---|---|---|
| **lits d'aval** | par service, quelques-uns libres par jour (le BJML) | des jours, surtout en fin de matinée | boarding, UHCD, transfert | oui, étape 1 |
| **box** | 12 (modèle actuel) | 1-3 h, plus si boarding | la salle d'attente déborde | déjà |
| **SAUV** | 2 places | 30 min à quelques heures | un grave reste en box, ou un autre sort de SAUV | oui, étape 1 |
| **UHCD** | 4-8 lits | 12 h de médiane (DREES) | boarding en box | oui, étape 1 |
| **scanner** | 1, partagé avec l'hôpital | 10-20 min l'examen | file d'attente ; un AVC passe devant | oui, étape 1 |
| **laboratoire** | en parallèle, pas une file | rendu 60-80 min | — (délai, pas file) | oui, étape 1 |
| **bloc opératoire** | 1-2 salles de garde la nuit | 1-4 h une opération | le patient attend en box ou en SAUV | oui, étape 1 (simple) |
| **chambres d'isolement** | 1-2 | heures | un agité ou un contagieux bloque un box, ou attend | oui, étape 1 |
| **réanimation** | lits pleins à ~90 % (hypothèse) | des jours | transfert vers un autre hôpital | comme lit d'aval |
| **couveuses / réa néonatale** | pas aux urgences adultes | des semaines | transfert de la mère ou du bébé, parfois à 2 h de route | non (hors du service) |
| **brancardiers** | 1-2 | 10-20 min un transport | examens et départs en retard | étape 2 (sur le plan) |
| **spécialiste d'astreinte** | 1 par spécialité, chez lui la nuit | 30-90 min pour venir | avis en retard | oui, comme un délai |
| **anesthésiste** | 1 la nuit, aussi pour le bloc et la réa | — | le bloc attend | avec le bloc |
| **SMUR** | 1-2 équipes | 1-3 h une sortie | les transferts attendent | plus tard |
| **psychiatre** | astreinte | — | un patient agité reste des heures | avec l'isolement |
| **poches de sang, respirateurs** | stock | — | rarement le goulot dans un hôpital ordinaire | non |

## Les lits d'aval

- C'est le goulot mesuré (voir « Trouver un lit d'aval » dans [parcours-patient.md](parcours-patient.md)) : une
  médiane de 15 min, mais plus de 6 h 10 pour un patient sur dix.
- **Le BJML** est l'outil de l'hôpital : le nombre de lits à garder pour les urgences chaque jour, estimé semaine
  par semaine sur les années passées, avec un objectif de lits libres à 8 h. Une circulaire de la DGOS l'a étendu à
  tous les établissements en novembre 2019
  ([circulaire DGOS/R2/2019/235](https://affairesjuridiques.aphp.fr/textes/circulaire-n-dgos-r2-2019-235-du-07-novembre-2019-relative-a-lanticipation-des-tensions-liees-aux-hospitalisations-non-programmees-et-au-deploiement-du-besoin-journalier-minimal-en-lits/),
  [rapport du Sénat](https://www.senat.fr/rap/r21-587-1/r21-587-130.html)).
- D'après un rapport du syndicat SUdF cité par le Sénat, un quart seulement des établissements le connaissaient,
  et à peine 40 % de ceux-là s'en servaient. L'année du rapport n'est pas sûre.
- **Pour le simulateur** : une capacité par service, des sorties tirées dans la journée, surtout autour de midi.
  Un lit libéré va au patient que choisit l'ordonnanceur : le plus ancien, le plus grave, le plus âgé ? C'est
  une vraie décision, et la recherche peut s'y essayer.

## La SAUV

- Les patients orientés directement en SAUV sont hospitalisés une fois sur deux ; 28,6 % des patients triés
  « sévères » passent par la SAUV (DREES, ER 1373).
- Les notes de Sami (d'après DOCFX) décrivent l'équipe d'un déchocage : 2 médecins, 2 à 3 infirmiers, un interne,
  un chirurgien et un trauma leader. Le patient doit rester **30 min au plus** avant de partir au bloc ou ailleurs.
- **Pour le simulateur** : 2 places. Un patient de niveau 1 y entre, et il immobilise un médecin et un IDE pendant
  sa prise en charge. Quand la SAUV est pleine, un niveau 1 de plus prend un box, avec plus de risque.

## Le bloc opératoire

- La classification **NCEPOD** dit dans quel délai opérer, à partir de la décision
  ([NCEPOD](https://ncepod.org.uk/classification.html)) :
  - **immédiate** (sauver une vie, un membre, un organe) : en quelques minutes, la réanimation pendant
    l'opération ;
  - **urgente** (une aggravation qui menace) : en quelques heures ;
  - **accélérée** : en quelques jours ;
  - **programmée** : quand cela convient.
- La nuit, l'hôpital garde une ou deux salles et une équipe d'astreinte. Pendant l'accident, les victimes se
  disputent la même salle.
- **Pour le simulateur** : une ou deux salles, une file par urgence NCEPOD (immédiate, puis urgente). Le patient
  attend en SAUV ou en box, puis il sort du service vers le bloc ; son lit d'aval (réanimation ou chirurgie) est
  compté après. Les opérations « accélérées » ne concernent pas la garde.

## Les chambres d'isolement

- **Les patients agités ou dangereux** : la HAS recommande l'isolement en dernier recours, dans un espace dédié et
  sécurisé, avec une surveillance renforcée ; 12 h au plus pour l'isolement, 6 h pour la contention, chaque mesure
  tracée dans un registre
  ([HAS, isolement et contention en psychiatrie générale, 2017](https://www.has-sante.fr/jcms/c_2055362/fr/place-de-la-contention-et-de-la-chambre-d-isolement-en-psychiatrie)).
  Ces recommandations sont écrites pour la psychiatrie, pas spécialement pour les urgences.
- **Les patients contagieux** (grippe, tuberculose, rougeole, une épidémie) : une chambre seule, ou un box
  « grillé » qu'il faut désinfecter après.
- Les notes de Sami : « patients violents / alcoolisés », « immobilisation physique / chimique », « maladies
  contagieuses ».
- **Pour le simulateur** :
  - une petite part des patients est **à isoler** (hypothèse : 2 à 4 %) ;
  - s'il y a une chambre libre, ils y vont ; sinon ils prennent un box, qui est **désinfecté** ensuite, ce qui le
    rend indisponible un temps ;
  - un patient agité demande en plus **deux soignants** au moment de son installation ;
  - il attend l'avis du psychiatre d'astreinte.

## Le scanner et le laboratoire

- **Le scanner** : une seule machine, que les urgences partagent avec l'hôpital. La HAS vise moins de 25 min
  entre l'arrivée et l'imagerie pour un AVC. Un patient couché demande un brancardier pour y aller et revenir.
- **Le laboratoire** : ce n'est pas une file. Il traite les tubes en parallèle, et son **délai de rendu** compte
  (81 min de médiane pour la troponine, pour un objectif de 60). Ce qui fait goulot, c'est le chemin : prélever,
  transporter (à la main ou par pneumatique), attendre, puis **regarder le résultat**.
- **Pour le simulateur** : le scanner est une ressource à une place, avec des priorités ; le laboratoire est un
  délai tiré. Un « oubli » peut retarder la vérification (étape 4 de la [feuille de route](feuille-de-route.md),
  la fatigue).

## Les couveuses et la réanimation néonatale

- Ce n'est pas une ressource des urgences adultes. Un nouveau-né prématuré naît à la maternité et va en
  néonatologie ; aux urgences, c'est rare (un accouchement inopiné, un bébé amené malade).
- **Mais c'est un vrai goulot de l'hôpital.** En octobre 2023, la Société française de néonatologie alertait :
  près de la moitié des unités pour nourrissons malades ou très vulnérables étaient occupées à plus de 95 %, et les
  autres entre 91 et 94 %
  ([question écrite à l'Assemblée nationale](https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE14254)).
- Faute de place, on transfère la mère avant la naissance, ou le bébé après, parfois à plus de deux heures de
  route.
- **Pour le simulateur** : hors du service des urgences. Ce serait un autre projet (une maternité), ou un
  événement rare du modèle : un transfert à organiser, qui prend le SMUR.

## Les spécialistes et les soignants rares

- Un neurochirurgien, un cardiologue interventionnel pour une coronarographie la nuit, un chirurgien pédiatrique :
  il n'y en a souvent qu'un, d'astreinte, parfois pour plusieurs hôpitaux.
- **Pour le simulateur** : un **délai d'avis** (le temps qu'il arrive), puis **une seule personne** pour tous les
  avis de sa spécialité. Deux avis à la fois, c'est un goulot. Quand il opère, il ne donne plus d'avis.

## Ce que l'ordonnanceur décide avec ces ressources

Chaque ressource rare, quand elle se libère, pose la même question : **à qui la donner ?**
- le lit d'aval : au patient qui attend depuis le plus longtemps, au plus fragile, ou à celui qui libère le box le
  plus utile ;
- la SAUV : faut-il sortir un patient stabilisé pour accueillir le nouveau ?
- le scanner : l'AVC d'abord, puis l'ordre des autres ;
- le bloc : l'urgence immédiate d'abord, mais entre deux urgentes ?
- la chambre d'isolement : l'agité ou le contagieux ?

Ce sont des décisions de **machine** (Sami : l'ordonnancement global reste côté machine), mesurables par paires
sur les mêmes gardes, comme les choix de box aujourd'hui.
