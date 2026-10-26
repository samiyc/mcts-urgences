# Les valeurs estimées, à faire vérifier

Sami (26/10/2026) : garder la trace de chaque valeur qu'on n'a pas trouvée dans une source publiée, pour la vérifier
plus tard auprès de professionnels du milieu.

Chaque ligne donne :
- un numéro, pour s'y référer dans les échanges ;
- la valeur prise et l'endroit du code où elle se trouve ;
- la question à poser ;
- le métier le mieux placé pour y répondre.

Une valeur vérifiée passe de « à vérifier » à « confirmée » ou « corrigée », avec la date, la personne et sa
réponse. Si elle change dans le code, l'empreinte qu'elle touche (`tests/fingerprint.test.js`) change aussi, et son
commit le dit.

Les valeurs qui ont une source sont citées dans [parcours-patient.md](parcours-patient.md) et
[ressources-rares.md](ressources-rares.md) :
- la DREES (l'enquête Urgences 2023) pour l'inscription, le passage, l'UHCD et les lits d'aval ;
- la SFBC et la SFMU pour le délai de la troponine.

Elles ne sont pas reprises ici.

Les codes de métier :

| Code | Métier |
|---|---|
| **IOA** | infirmier d'accueil et d'orientation |
| **URG** | médecin urgentiste |
| **CDS** | cadre de santé des urgences |
| **BIO** | biologiste |
| **LOG** | brancardage et logistique |
| **GL** | gestionnaire de lits |
| **INT** | interne |

## La garde simple (`src/hypotheses.js`)

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H1 | Délais du tri : immédiat, 10, 60, 120, 240 min | `MAX_WAIT` | Les délais de la FRENCH ou de la CIMU utilisés en pratique dans le service ? | IOA, URG | à vérifier |
| H2 | Poids d'une minute de retard : 16, 8, 4, 2, 1 | `LATE_WEIGHT` | Comment comparer une minute de retard d'un rouge et d'un vert ? Un ordre de grandeur suffit. | URG | à vérifier |
| H3 | 6 arrivées à pied et 1,5 ambulance par heure, pour 12 box et 4 médecins | `DEFAULTS`, `HOSPITALS` | Combien de passages par jour, de box, de médecins de jour et de nuit dans un service de cette taille ? | CDS | à vérifier |
| H4 | Gravités à l'arrivée : à pied 2/10/35/40/13 %, en ambulance 15/35/40/10/0 % | `walkInMix`, `ambulanceMix` | La répartition des niveaux de tri, à pied et en ambulance ? | IOA | à vérifier |
| H5 | Ambulance annoncée 15 min avant | `announced` | Combien de temps avant son arrivée le service est-il prévenu ? | URG | à vérifier |
| H6 | Le tri juste 8 fois sur 10, sinon un niveau à côté | `triageRight` | À quelle fréquence un patient est-il retrié ? | IOA | à vérifier |
| H7 | Examen médical : 60, 40, 25, 15, 10 min selon le niveau | `exam` | Combien de temps un médecin passe-t-il avec un patient, par niveau ? | URG | à vérifier |
| H8 | Dispersion des durées (facteur log-normal 0,4) | `spread` | Les durées varient-elles du simple au double, ou plus ? | URG | à vérifier |
| H9 | Aggravation en attente : en moyenne 90 min après le délai du niveau | `worsenAfter` | Au bout de combien de temps un patient qui attend trop risque-t-il de s'aggraver ? | URG | à vérifier |
| H10 | Réévaluation : 5 min, au plus tôt 30 min après la précédente | `reassess`, `recheck` | À quelle fréquence l'IOA revoit-il la salle d'attente, et combien de temps cela prend-il ? | IOA | à vérifier |
| H11 | L'accident : 10 victimes en 30 min, 25/35/30/10 % | `ACCIDENT` | Un afflux typique pour un service de cette taille ? | URG, CDS | à vérifier |

## Le parcours détaillé (`src/pathway-hypotheses.js`)

### Les arrivées et les effectifs

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H12 | Les arrivées heure par heure (la forme vient de la DREES, pas les chiffres) | `hourly` | Le nombre d'arrivées heure par heure d'un jour ordinaire ? | CDS | à vérifier |
| H13 | Un médecin de plus de 10 h à 22 h | `dayDoctors` | Combien de médecins à chaque heure, et à quelles heures changent les équipes ? | CDS | à vérifier |
| H14 | 2 SAUV, 1 isolement, 6 UHCD, 1 scanner, 1 bloc et 2 spécialistes pour 12 box | `capacity` | Combien de chacun dans un service de cette taille ? | CDS | à vérifier |
| H15 | Brancardiers : 1, 2 et 3 selon l'hôpital | `PORTERS` | Combien de brancardiers pour les urgences, de jour et de nuit, et sont-ils partagés avec l'hôpital ? | LOG, CDS | à vérifier |

### Les durées

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H16 | Tri 5 min, lecture des résultats 5 min | `triage`, `review` | Combien dure un tri ? Et une relecture de résultats par un senior ? | IOA, URG | à vérifier |
| H17 | Prélèvement et envoi des tubes : 10 min | `sample` | Du prélèvement à l'arrivée des tubes au labo : pneumatique, coursier ? | BIO, IOA | à vérifier |
| H18 | Scanner, transport compris : 20 min | `scan` | Combien de temps un patient est-il absent du box pour un scanner ? | URG, LOG | à vérifier |
| H19 | Avis spécialisé : 45 min pour venir, 20 min d'avis | `adviceDelay`, `advice` | Combien de temps faut-il pour avoir un avis, de jour et la nuit ? | URG | à vérifier |
| H20 | Bionettoyage d'un box : 10 min, 45 min après un patient isolé | `clean`, `cleanIsolated` | Combien de temps pour remettre un box en état, et après un patient contagieux ? | CDS | à vérifier |
| H21 | Bloc 120 min, transfert attendu 120 min | `theatre`, `transferDelay` | Combien de temps prend une opération urgente, et un transfert vers un autre hôpital ? | URG | à vérifier |
| H22 | Soins après les résultats : 60, 45, 30, 10, 5 min | `care` | Combien de temps dure la prise en charge entre la lecture des résultats et la sortie ? | URG | à vérifier |

### Les pratiques et les parcours

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H23 | Un patient venu à pied, niveau 3 à 5, attend ses résultats assis hors du box | `seated` | Est-ce la pratique ? | IOA, CDS | à vérifier |
| H24 | Un médecin libre lit les résultats revenus avant de prendre un nouveau patient | `reviewFirst` | Quelle est la priorité réelle d'un médecin libre ? | URG | à vérifier |
| H25 | Un patient qui attend un lit passe en UHCD si une place y est libre | `uhcdForBoarders` | Est-ce la pratique ? | GL, URG | à vérifier |
| H26 | Besoins par niveau : biologie 95 à 5 %, scanner 70 à 0 %, avis 50 à 0 % | `needs` | La part des patients qui ont une biologie, une imagerie ou un avis, par niveau de tri ? | URG | à vérifier |
| H27 | Orientation par niveau (domicile, UHCD, service, bloc, transfert), calée sur les totaux DREES | `orientation` | La sortie de chaque niveau de tri ? | URG | à vérifier |
| H28 | Le service d'hospitalisation par niveau | `wardOf` | Vers quels services partent les patients hospitalisés ? | GL | à vérifier |
| H29 | Lits d'aval libres le matin et libérés par jour, par service | `wards` | Combien de lits chaque service rend-il aux urgences, et à quelle heure ? | GL | à vérifier |
| H30 | Libération des lits autour de 12 h 30, à plus ou moins 1 h 30 | `bedHour`, `bedSpread` | À quelle heure les lits se libèrent-ils ? | GL | à vérifier |
| H31 | 3 % de patients à isoler | `isolate` | La part de patients contagieux ou agités qui demandent une chambre à part ? | CDS | à vérifier |
| H32 | Patients de 75 ans et plus : 30 à 5 % selon le niveau | `elderly` | La part des 75 ans et plus par niveau de tri ? | CDS | à vérifier |
| H33 | Patience avant de partir sans être vu : 2 h sûres, puis 10 h, 6 h ou 5 h en moyenne | `patience`, `patienceFloor` | Au bout de combien de temps les patients partent-ils sans être vus ? | IOA | à vérifier |
| H34 | Le 15 détourne les ambulances non rouges au-delà de 20 patients en attente | `divertAt` | À partir de quand la régulation oriente-t-elle ailleurs ? | URG | à vérifier |

### Les plans et la marche

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H35 | Une case vaut 2 m, et se marche en 6 s | `CELL_METRES`, `STEP` | Les distances d'un vrai service : box, labo, scanner, pharmacie, ascenseurs ? | CDS, LOG | à vérifier |
| H36 | Les trois plans (`src/pathway-plans.js`) | `PATHWAY_PLANS` | Un plan du service réel, même grossier ? | CDS | à vérifier |

### L'interne

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H37 | 4 patients suivis au plus | `INTERN.patients` | Combien de patients un interne suit-il en même temps ? | INT, URG | à vérifier |
| H38 | Délais des tâches : constantes 30 min, prélèvement 15, tubes 10, scanner 15 et 10, résultats 15, pharmacie 15, médicament 10 | `INTERN.due` | Dans quels délais chacune de ces tâches doit-elle être faite ? | INT, IOA | à vérifier |
| H39 | Durée des tâches : constantes 2 min, prélèvement 3, résultats 5, pharmacie et médicament 1 | `INTERN.take` | Combien de temps prend chaque geste ? | INT, IOA | à vérifier |
| H40 | 10 min des soins passées à chercher un médicament | `INTERN.medInCare` | Combien de temps le service passe-t-il à chercher un médicament ? | IOA, CDS | à vérifier |
| H41 | Un médicament nécessaire : 90 à 10 % selon le niveau | `INTERN.needsMed` | La part des patients qui reçoivent un traitement aux urgences, par niveau ? | URG | à vérifier |
| H42 | L'interne lit les résultats à la place d'un senior | `result`, `src/pathway-intern.js` | Un interne peut-il lire seul, et dans quels cas un senior relit-il ? | URG, INT | à vérifier |

## La fatigue et les pauses (étape 4, `FATIGUE`, `src/pathway-hypotheses.js`)

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H43 | Les gestes ralentis de 10 % après 12 h de garde, 25 % après 20 h ; la nuit, 10 % de plus (la forme suit Landrigan 2004, pas les chiffres) | `FATIGUE.slow` | Comment le rythme change-t-il au fil d'une garde de 24 h ? | URG, INT | à vérifier |
| H44 | Une pause de 30 min pour manger, à placer entre 11 h et 15 h, puis entre 19 h et 22 h ; 2 h de repos la nuit | `FATIGUE.breaks` | Les pauses réelles d'un urgentiste et d'un interne de garde ? | URG, CDS | à vérifier |
| H45 | Une pause remet la fatigue de 30 % à zéro, le repos de nuit de 60 % | `FATIGUE.rest` | Une pause courte rend-elle vraiment le rythme ? | URG | à vérifier |
| H46 | Au moins 2 médecins présents, jamais tous en pause | `FATIGUE.minDoctors` | Combien de médecins doivent rester en poste pendant une pause ? | CDS | à vérifier |
| H47 | Un résultat oublié 1 fois sur 100, plus 0,4 point par heure de fatigue ; relu 30 min plus tard | `FATIGUE.oversight`, `oversightDelay` | Les résultats lus en retard sont-ils plus fréquents en fin de garde, et de combien ? | URG, BIO | à vérifier |
| H48 | Une relève de 15 min, sans prendre de patient | `FATIGUE.handover` | Combien dure une relève entre deux équipes, et que fait le service pendant ce temps ? | CDS, URG | à vérifier |
| H56 | À la relève, 1 patient sur 20 dont les résultats sont en cours est oublié (relu 30 min plus tard) | `FATIGUE.handoverLoss` | Combien d'informations se perdent à une relève, et sur quels patients ? | CDS, URG | à vérifier |
| H54 | Le Plan blanc rappelle 2 médecins (pour 12 box), qui arrivent en 1 h, et les services rendent 4 lits en reportant des admissions | `ALERT` | Que change concrètement un Plan blanc aux urgences, et en combien de temps ? | CDS, URG, GL | à vérifier |
| H55 | Une heure de médecin rappelé pèse comme 15 min de retard d'un rouge (240) | `ALERT.doctorHour` | Comment juger le coût d'un rappel de personnel contre l'attente des patients ? | CDS | à vérifier |
| H53 | L'infirmier d'accueil (IOA) travaille en postes de 12 h (8 h et 20 h) et ralentit au tri comme un médecin | `ioaSlowOf`, `src/pathway-fatigue.js` | Les postes de l'IOA, et comment son tri ralentit en fin de poste ? | IOA, CDS | à vérifier |
| H52 | Une minute de retard d'une tâche de l'interne coûte comme une minute de retard d'un jaune | `INTERN_LATE` | Que coûte un prélèvement ou un résultat regardé en retard, comparé à l'attente d'un patient ? | URG, INT | à vérifier |
| H51 | Une minute d'attente d'un lit coûte comme une minute de retard d'un vert, le triple pour un patient de 75 ans et plus la nuit | `BOARDING_COST` | Comment comparer une heure sur un brancard et une heure de retard au box ? | URG, GL | à vérifier |
| H50 | L'interne de garde ralentit comme un médecin (même courbe), sans pause | `internSlowOf`, `src/pathway-fatigue.js` | Un interne de garde a-t-il des pauses, et ralentit-il comme les seniors ? | INT, URG | à vérifier |
| H49 | « Au creux » : 3 patients en attente ou moins | `FATIGUE.quietWaiting` | Quand une équipe estime-t-elle pouvoir lâcher un médecin pour sa pause ? | CDS | à vérifier |

## L'épidémie d'hiver (`EPIDEMIC`, `src/pathway-hypotheses.js`)

Les chiffres de Santé publique France sont cités dans [oublis.md](oublis.md), « Les épidémies d'hiver, en chiffres ».
Ce qui suit n'y est pas.

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H57 | Au pic d'une épidémie, 10 % de patients en plus, à pied et en ambulance, aux mêmes heures que les autres | `EPIDEMIC.share` | De combien les passages augmentent-ils au pic d'une épidémie d'hiver, chez l'adulte ? | CDS, URG | à vérifier |
| H58 | La moitié des patients de l'épidémie à isoler (précautions gouttelettes) : la chambre d'isolement, ou un box nettoyé 45 min après | `EPIDEMIC.isolate` | Qui isole-t-on vraiment en période d'épidémie, et comment, quand la chambre est prise ? | IOA, CDS | à vérifier |
| H59 | 15 % de ces patients ont 75 ans ou plus (déduit des 24 % de plus de 65 ans) ; leurs niveaux, surtout jaunes, pour qu'1 sur 4 soit hospitalisé | `EPIDEMIC.elderly`, `walkInMix`, `ambulanceMix` | La gravité et l'âge des patients qui viennent pour une grippe ? | URG | à vérifier |
| H60 | Les services, pleins de la saison, ne rendent que 3 lits sur 4 : au début de la journée et au fil du jour | `EPIDEMIC.beds` | Combien de lits d'aval manquent en plein hiver, par rapport au reste de l'année ? | GL, CDS | à vérifier |
| H61 | La chambre d'isolement se prête, libre, à un patient trié 4 ou 5 de moins de 75 ans ; un patient à isoler la reprend | `isolationLent`, `src/pathway-isolation.js` | Met-on un patient ordinaire dans la chambre d'isolement quand elle est libre ? | IOA, CDS | corrigée le 26/10 par Sami : oui, des patients légers et plutôt jeunes, faciles à déplacer ; le patient sorti passe dans un box libre ou repasse par la file |
| H62 | Un patient en plein examen le finit avant de sortir de la chambre ; la chambre et le box quittés sont nettoyés (10 et 45 min) avant le patient suivant | `reclaimIsolation`, `src/pathway-isolation.js` | En combien de temps libère-t-on la chambre ? | IOA, CDS | corrigée le 26/10 par Sami : il y a toujours un nettoyage entre deux patients (la SFHH : un bionettoyage avant tout nouveau patient) ; le temps de sortie reste à vérifier |

## L'hôpital en tension (`HET`, `src/pathway-hypotheses.js`)

Ce qui est sourcé ([oublis.md](oublis.md), « Plan blanc et HET, plus en détail ») : le HET vise un manque de lits
prévisible, engage tous les services et précède le Plan blanc ; ses seuils et ses mesures sont propres à chaque
établissement. Les chiffres qui suivent ne le sont pas.

| N° | Valeur prise | Dans le code | La question | Qui | Statut |
|---|---|---|---|---|---|
| H63 | Une fois le HET déclenché, les services s'organisent en 1 h, puis rendent 2 lits (médecine, chirurgie) en reportant des admissions programmées | `HET.delay`, `HET.beds` | En combien de temps un HET libère-t-il des lits, et combien ? | GL, CDS | à vérifier |
| H64 | Ensuite, un lit de médecine de plus toutes les 4 h jusqu'à la fin de la journée (des sorties avancées, des transferts en soins de suite) | `HET.every`, `HET.flowWard` | Que gagne-t-on de lits, au fil des heures, avec des sorties anticipées ? | GL | à vérifier |
| H65 | Un lit obtenu par le HET pèse comme 7 min 30 de retard d'un rouge (120) | `HET.bedCost` | Que coûte une admission programmée reportée, comparée à l'attente d'un patient ? | CDS, GL | à vérifier |
| H66 | Le seuil de déclenchement : 3 patients qui attendent un lit (pour 12 box) | `HET.boarders`, `HET_RULES.threshold` | Sur quels indicateurs et quels seuils le HET se déclenche-t-il, et à quelle heure ? | CDS, URG | à vérifier |
