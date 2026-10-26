# La feuille de route du parcours détaillé

Sami (25/10/2026, `docs/prompt/glossaire-search.md`) : plus de réalisme, en suivant chaque patient de près, avec
plus de rôles et plus de pièces ; un humain dans le rôle d'un interne ; la fatigue et les pauses ; un replay
d'ensemble ; des indicateurs max.

Ses choix :
- **les recherches d'abord** (ce dossier), **puis l'étape 1 codée** ;
- **le parcours vient à côté de la garde simple**, sans la remplacer : `simulate.js`, `ward.js`, la page, les
  mesures et les replays d'avant restent tels quels et comparables.

Chaque étape se mesure seule, par paires sur les mêmes gardes, avec un intervalle, comme dans Lopin. La règle
simple vient d'abord ; la recherche doit la battre.

**Ce qui guide toutes les étapes** :
- **le temps et la rigueur du suivi** sont critiques, pas les collisions. Personne ne réserve de case comme les
  robots de l'entrepôt ; les gens marchent et se croisent ;
- **l'ordonnancement global reste à la machine** : qui entre en box, en SAUV, au scanner, qui prend le lit,
  quand partir en pause ;
- **l'humain fait des tâches locales et guidées**, comme un interne, avec quelques choix en parallèle ;
- **tout est tiré d'une graine** et se rejoue.

## Étape 1 : le parcours (faite le 25/10, `src/pathway*.js`)

- Le patient passe par toutes les étapes de [parcours-patient.md](parcours-patient.md) :
  - l'arrivée, l'inscription, le tri par l'IOA ;
  - l'attente ;
  - le box ou la SAUV, et l'examen par le médecin ;
  - les examens : la biologie, le scanner, un avis ;
  - la relecture des résultats par le médecin, puis les soins ;
  - la sortie : le domicile, l'UHCD, un lit d'aval, le bloc, un transfert ;
  - ou bien il part sans attendre.
- Chaque patient a un **parcours caché** : les examens dont il a besoin et son orientation, tirés de la graine.
- Les ressources rares de [ressources-rares.md](ressources-rares.md) :
  - les box, la SAUV, l'UHCD, la chambre d'isolement ;
  - le scanner, le bloc, les spécialistes ;
  - les lits d'aval par service, qui se libèrent surtout vers midi.
- **Le boarding** : un patient à hospitaliser sans lit garde son box, ou va en UHCD s'il y a de la place.
- **Les indicateurs** de [indicateurs.md](indicateurs.md), avec les max :
  - le pic de patients en attente, l'attente maximale par niveau ;
  - la durée de passage (médiane, 9e décile, maximum), les patients sortis en moins de 4 h ;
  - les patients partis sans être vus, le boarding ;
  - l'occupation de chaque ressource, la dégradation.
- Les règles de référence sont comparées sur les mêmes gardes (`node scripts/pathway-compare.js`).
- Pas de page, pas de plan, pas de recherche : c'est le moteur des étapes suivantes.

## Étape 2 : le plan détaillé (faite le 26/10, [modele.md](../modele.md), « Le plan détaillé »)

- Un plan par hôpital avec les pièces du parcours :
  - l'accueil et le tri ;
  - la salle d'attente ;
  - les box, la SAUV, l'UHCD, la chambre d'isolement ;
  - le laboratoire (ou le départ du pneumatique), la pharmacie, le scanner ;
  - la porte du bloc et les ascenseurs vers les services ;
  - la salle de pause, la salle des médecins.
- La marche par champs de distance, comme `ward.js` : sans réservations, et les gens se croisent.
- **Les brancardiers** deviennent une ressource sur le plan : un transport prend la marche aller et retour.
- La page dessine le parcours de chaque patient : où il est, ce qu'il attend, depuis combien de temps.

Les choix de Sami (26/10, avant de coder) :
- **la marche est dessinée, pas comptée** : le parcours garde les horaires de l'étape 1 (ses mesures, son empreinte,
  son calage sur la DREES), et le plan anime qui va où. La marche comptera à l'étape 3, quand l'interne marchera ; on
  mesurera alors son coût, avec et sans, sur les mêmes journées, comme le 23/10 pour la garde simple ;
- **les plans** : trois plans en texte proposés par Claude, avec leur légende, autant de places que les capacités de
  chaque hôpital (`pathway-hypotheses.js`), que Sami corrige ensuite ;
- **un onglet** « Parcours détaillé » de la page, passée en onglets comme celle de lopin (Garde simple, Service en
  plan, Parcours détaillé, Replays, Stats), au lieu de la page à part `web/parcours.html` d'abord prévue ;
- **le plan en texte se modifie dans le panneau de gauche** : il fixe les places (box, SAUV, isolement, UHCD,
  scanners), et les trajets se mesurent par rôle ;
- **les brancardiers** : 1 à l'hôpital de proximité, 2 au moyen, 3 au CHU (hypothèse, sans source). Ils sont
  dessinés à l'étape 2 et ne font attendre qu'à partir de l'étape 3, quand la marche compte.

## Étape 3 : l'interne au clavier (faite le 26/10, [modele.md](../modele.md), « La marche comptée et l'interne au clavier »)

Les choix de Sami (26/10) :
- la marche compte pour tous, avec un interrupteur qui garde l'étape 1 identique ;
- une partie est une vacation de 4 h, un interne robot avant et après ;
- l'interne lit les résultats de ses patients à la place d'un senior ;
- les six tâches dès cette étape.

- Le joueur suit **3 à 5 patients**, que l'ordonnanceur lui confie.
- Ses tâches sont **guidées et locales** :
  - prélever ;
  - porter les tubes au labo ;
  - accompagner au scanner ;
  - aller chercher un médicament à la pharmacie ;
  - reprendre les constantes ;
  - **regarder un résultat**.
- Chaque tâche s'affiche avec son délai. Il en a plusieurs à la fois et choisit l'ordre : c'est la prise de
  décision.
- **Le mode aléatoire** joue l'interne au hasard parmi ses tâches : un humain simulé, pour mesurer ce qu'un joueur
  moyen coûte ou apporte, sur des centaines de gardes.
- À la fin, la garde contre la même avec un interne robot, comme pour le médecin au clavier (« Le service en
  plan » dans [modele.md](../modele.md)).

## Étape 4 : la fatigue et les pauses (faite le 26/10, [modele.md](../modele.md), « La fatigue et les pauses »)

Faite pour les médecins : l'interne et les infirmiers n'ont pas encore de fatigue. Les résultats lus en retard
passent par les oublis.

D'après [soignants.md](soignants.md) :
- **la fatigue monte** avec les heures et la nuit ;
- **elle ralentit les gestes et fait oublier** :
  - un résultat regardé en retard ;
  - une réévaluation sautée ;
  - un médicament en retard ;
- **les pauses** (manger, dormir) la font redescendre. Elles sont placées par l'ordonnanceur, qui ne doit pas
  laisser le service sans médecin ;
- **les transmissions** à la relève, pour une garde de 24 h en deux équipes ;
- les indicateurs : les heures sans pause, les oublis, les résultats regardés en retard.

## Étape 5 : le replay d'ensemble

- Une fois la garde finie, **une frise de toute la garde** :
  - les présents et les patients en attente ;
  - les ressources pleines ;
  - les aggravations et le boarding ;
  - les départs sans être vu.
- On voit où un retard, une absence, l'accident ou une ressource manquante ont fait monter les courbes.
- Elle se lit sur le replay d'une partie humaine comme sur une garde de robots, et deux stratégies peuvent
  s'afficher l'une contre l'autre sur la même garde.

## Étape 6 : la recherche sur le parcours

- Les décisions de machine du parcours ([ressources-rares.md](ressources-rares.md), dernière section) :
  - le box ;
  - le lit d'aval libéré ;
  - le scanner ;
  - le bloc ;
  - la sortie de SAUV ;
  - le déclenchement de l'HET ou du Plan blanc ;
  - les pauses.
- La recherche de `src/search.js` adaptée, contre les règles, au coût du moment et aux nouveaux indicateurs.

## Ce qui viendra plus tard, ou pas

D'après [oublis.md](oublis.md) :
- **plus tard** :
  - les épidémies d'hiver, en scénario ;
  - l'HET et le Plan blanc ;
  - les accompagnants ;
  - le circuit court, en règle de plus ;
  - les décès ;
  - l'interprète ;
- **pas ici** :
  - la pédiatrie ;
  - les couveuses et la réanimation néonatale : un autre service, peut-être un autre projet ;
  - la sécurité, le codage et le financement.
