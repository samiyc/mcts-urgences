# « J'oublie quelque chose ? »

Sami (25/10/2026) termine sa demande par cette question. Voici ce que sa liste ne nomme pas encore, avec, pour
chaque point, s'il vaut la peine de le simuler. Les termes sont dans le [glossaire](glossaire.md).

| ce qui manque | pourquoi ça compte | à simuler ? |
|---|---|---|
| **les transmissions à la relève** | un moment d'oubli et de temps perdu (voir [soignants.md](soignants.md)) | oui, avec la fatigue (étape 4) |
| **le gestionnaire de lits** | c'est lui qui cherche le lit d'aval ; ses appels prennent du temps (23 % des cas demandent plusieurs services) | oui, comme le délai de recherche d'un lit (étape 1) |
| **les accompagnants et les familles** | ils occupent des chaises, posent des questions, prennent du temps aux soignants ; un enfant vient toujours avec un parent | plus tard, comme du temps soignant perdu |
| **les partis sans attendre, ou contre avis** | 3,4 % et 0,6 % des patients ; un départ, c'est un patient non soigné, parfois grave | oui (étape 1) |
| **les décès** | rares, mais ils immobilisent une équipe et un box, et comptent dans le score | un événement rare, plus tard |
| **la pédiatrie** | souvent un circuit et des urgences à part ; d'autres médecins, d'autres délais | non, hors du service simulé |
| **l'interprète** | un patient qui ne parle pas français : un tri et un examen plus longs | plus tard, comme un facteur de durée |
| **le temps du dossier** | le RPU, les prescriptions, les courriers de sortie : une part du temps médical (hypothèse : 20 à 30 %) | oui, en durée des gestes |
| **les erreurs de médicaments** | une erreur, ou un retard, qui aggrave le patient ; elles montent avec la fatigue | avec la fatigue (étape 4) |
| **les examens perdus ou oubliés** | un tube perdu, un résultat jamais regardé (les notes de Sami : « bilan / analyse via le labo + potentiel oubli ») | oui, avec la fatigue (étape 4) |
| **le box à remettre en état** | entre deux patients, le ménage par un ASH ; plus long après un patient contagieux | oui (étape 1) |
| **le circuit court** | dans 58 % des services ; il sort les cas légers de la file des cas lourds | oui, une règle de plus à comparer |
| **l'HET et le Plan blanc** | des niveaux de crise que l'hôpital déclenche : des lits ajoutés, des opérations reportées, des soignants rappelés | oui : un seuil qui change les capacités, pendant l'accident |
| **les épidémies saisonnières** | l'hiver, la grippe et la bronchiolite remplissent les urgences et les lits d'aval pendant des semaines | oui, comme un scénario (plus d'arrivées, plus d'hospitalisations, plus d'isolement) |
| **le moment de la journée** | les arrivées culminent l'après-midi ; les lits se libèrent en fin de matinée ; la nuit, moins de soignants | oui (étape 1 : les arrivées et les sorties de lits selon l'heure) |
| **les personnes âgées** | elles attendent plus longtemps un lit, et une nuit sur un brancard leur coûte le plus (« No Bed Night ») | oui, un âge par patient (étape 1) |
| **la sécurité** | les agressions contre les soignants, un vigile, la police | non |
| **le coût et le codage** | le financement par l'activité (l'ATIH) | non |

## Les épidémies d'hiver, en chiffres

D'après Santé publique France, pour la grippe :
- **la durée** : l'épidémie de 2024-2025 a duré 13 semaines dans les Hauts-de-France, contre 10 en moyenne de 2014 à
  2024 ([bilan régional](https://www.santepubliquefrance.fr/regions-et-territoires/hauts-de-france/bulletin-regional/maladies-hivernales-dans-les-hauts-de-france-bilan-de-la-saison-2024-2025)) ;
  trois mois au niveau national, de début décembre à fin février
  ([Vidal](https://www.vidal.fr/actualites/34072-grippe-une-saison-particulierement-rude-confirme-un-bilan-final.html)) ;
- **les hospitalisations** : 19,4 % des passages pour grippe dans les Hauts-de-France ; en 2025-2026, 21 % au niveau
  national, 57 % chez les 65 ans et plus, qui font 66 % des hospitalisés
  ([Caducée, bilan 2025-2026](https://www.caducee.net/actualite-medicale/16862/saison-respiratoire-2025-2026-une-saison-moins-massive-en-ville-mais-toujours-lourde-pour-l-hopital.html)) ;
- **l'âge** : les 65 ans et plus font 24,2 % des passages pour grippe en Auvergne-Rhône-Alpes (2024-2025).

La bronchiolite remplit surtout les urgences pédiatriques, que le simulateur ne fait pas. Ce qui manque : la hausse
des passages de tous motifs au pic, chez l'adulte (H57).

## Les quatre ajouts, en chiffres

- **Les décès** : la mortalité moyenne aux urgences est d'environ 0,2 % des passages, de 0,06 à 0,8 % selon les services
  (l'étude multicentrique dirigée par E. Roupie en 1997, citée par une
  [thèse de Lille, 2015](https://pepite-depot.univ-lille.fr/LIBRE/Th_Medecine/2015/2015LIL2M398.pdf)). En Angleterre,
  sur plus de 5 millions de patients, une attente de plus de 5 h avant la décision d'hospitaliser est liée à plus de
  décès à 30 jours
  ([Le Quotidien du médecin](https://infectiologie.lequotidiendumedecin.fr/hopital/urgences/aux-urgences-lattente-peut-tuer-selon-une-etude-britannique)).
- **L'interprète** : aux urgences adultes d'Arras, 278 consultations de patients allophones sur 21 909, et le traducteur
  informel était le moyen de traduction le plus utilisé
  ([thèse de Lille, 2025](https://pepite-depot.univ-lille.fr/LIBRE/Th_Medecine/2025/2025ULILM216.pdf)). Aucun délai
  d'interprète par téléphone n'est publié.
- **Le circuit court** : dans 58 % des services, il prend 13,5 % des patients
  ([parcours-patient.md](parcours-patient.md)).
- **Les accompagnants** : les personnes âgées arrivent plus souvent accompagnées (DREES, l'enquête de 2013), sans
  pourcentage.
- **Le nettoyage entre deux patients** (H62) : la SFHH demande un bionettoyage selon la procédure habituelle, y compris
  sous précautions gouttelettes ([recommandations 2013](https://cdn2.splf.fr/wp-content/uploads/2013/12/Recommandation_SFHH_2013.pdf)) ;
  aucune durée nationale n'est publiée.

## Plan blanc et HET, plus en détail

- **L'HET** est un dispositif gradué, né d'une circulaire de 2006 : une veille, des seuils, une cellule de crise
  présidée par le directeur. Son but est d'éviter le Plan blanc
  ([ARS Nouvelle-Aquitaine](https://www.nouvelle-aquitaine.ars.sante.fr/signaler-une-tension-hospitaliere),
  [SFMU, Urgences 2014](https://www.sfmu.org/upload/70_formation/02_eformation/02_congres/Urgences/urgences2014/donnees/pdf/090.pdf)).
- **Le Plan blanc** est obligatoire dans tout établissement et déclenché par le directeur : une cellule de crise, un
  tri organisé, des lits ajoutés, les opérations programmées reportées.
- Les seuils nationaux de 2026 n'ont pas été trouvés ; chaque établissement fixe les siens, et une thèse en a suivi
  32 indicateurs sur un an
  ([thèse, Lille 2016](https://pepite-depot.univ-lille.fr/LIBRE/Th_Medecine/2016/2016LIL2M232.pdf)).
- **Pour le simulateur** : pendant l'accident, l'ordonnanceur peut **déclencher** un niveau de crise. Il gagne des
  lits et des soignants rappelés après un délai, mais à un coût : des opérations reportées, un compteur à part.
  Quand déclencher est une décision de machine, et la recherche peut s'y essayer.
