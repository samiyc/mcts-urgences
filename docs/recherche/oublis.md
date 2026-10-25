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
