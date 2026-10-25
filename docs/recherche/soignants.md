# Les soignants : les équipes, la fatigue, les pauses

Sami (25/10/2026) : « J'aimerais suivre l'état de fatigue des médecins et des infirmiers, prévoir des pauses pour
manger, dormir. » Ses notes : « médecin qui mange / dort peu », « 24 h de garde d'affilée ou plus ⇒ fatigue /
erreurs ». Les termes sont dans le [glossaire](glossaire.md).

## Qui fait quoi

| rôle | ce qu'il fait dans le parcours | dans le modèle actuel |
|---|---|---|
| agent d'accueil | l'inscription | — |
| IOA | le tri, les premiers soins, la réévaluation en salle d'attente | l'infirmier de tri (`nurses`) |
| IDE | les prélèvements, les perfusions, les médicaments, la surveillance | — |
| AS | l'installation, la surveillance simple | — |
| brancardier | les transports : scanner, bloc, service | — |
| ASH | la remise en état d'un box | — |
| interne | il examine, prescrit, suit ses patients, regarde les résultats, sous un senior | — (le futur joueur) |
| senior | il examine, décide, valide ; trauma leader en SAUV | les médecins (`doctors`) |
| spécialiste d'astreinte | un avis ou une opération | — |

Les notes de Sami (d'après DOCFX) décrivent une salle de déchocage : 2 médecins, 2 à 3 infirmiers, 1 interne,
1 chirurgien, et un trauma leader qui supervise. Un patient grave en SAUV occupe donc **plusieurs soignants à la
fois**, pas un seul médecin comme dans le modèle actuel.

## Les gardes

- Aux urgences, les gardes durent souvent **12 h ou 24 h** ; Sami a noté des gardes de 24 h d'affilée ou plus.
- **Le repos de sécurité** : depuis 2002, 11 heures de repos sont obligatoires après une garde de nuit, pour qu'un
  interne ne travaille pas plus de 24 heures d'affilée (code de la santé publique, article R. 6153-2 pour les
  internes). Leur temps de travail est fixé à 48 heures par semaine
  ([Le Quotidien du médecin](https://cancerologie.lequotidiendumedecin.fr/internes/etudes-medicales/du-chemin-parcourir-pour-faire-respecter-le-repos-de-securite)).
- Il n'est pas toujours respecté : une enquête de l'ISNI, le syndicat des internes, trouvait 21 % de répondants
  dont le repos de sécurité ne l'était pas
  ([Le Quotidien du médecin](https://cardiologie.lequotidiendumedecin.fr/hopital/respect-du-repos-de-securite-les-etudiants-et-les-jeunes-generalistes-ne-veulent-pas-etre-oublies)).
- Les règles des urgentistes titulaires (praticiens hospitaliers) n'ont pas été vérifiées ici.

## La fatigue et les erreurs

**L'étude de référence** : [Landrigan et al., NEJM 2004](https://stacks.cdc.gov/view/cdc/197042), en
réanimation. Des internes ont alterné deux plannings, chacun comparé à l'autre :
- un **planning classique**, avec des gardes de 24 h et plus, et environ 80 h par semaine ;
- un **planning sans garde de plus de 16 h**, et environ 63 h par semaine.

Les résultats :
- avec le planning classique, les internes ont fait **35,9 % d'erreurs graves en plus** : 136 contre 100 pour
  1 000 jours-patients ;
- et **5,6 fois plus d'erreurs de diagnostic graves** ;
- les erreurs qui n'ont pas été rattrapées avant d'atteindre le patient étaient en hausse de 56,6 %.

Les limites ([critique en *Critical Care*](https://ccforum.biomedcentral.com/articles/10.1186/cc3052)) :
- un seul centre, sans aveugle ;
- vingt internes volontaires.

L'effet est net, mais son ampleur ne se transpose pas telle quelle.

**Ce qu'on en tire pour le modèle (hypothèses)** :
- **la fatigue monte avec les heures travaillées** depuis le dernier repos, plus vite la nuit (entre 2 h et 6 h) ;
- **elle ralentit les gestes** : un examen, un prélèvement durent un peu plus longtemps (hypothèse : + 10 à 20 %
  après 16 h) ;
- **elle fait oublier** : la probabilité d'un oubli monte. Un résultat de labo non regardé, une réévaluation
  sautée, un médicament en retard. Le modèle peut s'appuyer sur l'ordre de grandeur de Landrigan : + 36 %
  d'erreurs entre un planning de 24 h et un planning de 16 h ;
- **une pause fait redescendre** la fatigue : un repas de 30 min, un peu ; un sommeil de garde de 2-3 h, beaucoup.

## Les pauses

- **Manger** : une pause repas de 20 à 30 min, que les soignants sautent souvent quand le service est plein
  (hypothèse, d'après les notes de Sami et DOCFX).
- **Dormir** : la nuit, en garde de 24 h, un médecin peut dormir quelques heures si le service le permet, et il
  est rappelé au besoin.
- **Pour le simulateur** :
  - une pause est une **tâche planifiée par l'ordonnanceur**, comme une ressource à placer. Il choisit quand chaque
    soignant part, pour ne pas laisser le service sans médecin ;
  - la pause a un coût, des minutes sans ce soignant, et un gain : la fatigue redescend, donc moins d'oublis
    ensuite ;
  - **la recherche peut apprendre à placer les pauses** : reporter une pause pendant l'accident, mais pas trop
    longtemps.

## Les transmissions à la relève

- À la fin d'une garde, l'équipe qui part transmet ses patients à celle qui arrive : qui est là, en attente de
  quoi, ce qui a été fait. C'est un moment de risque (des oublis, des résultats perdus) et de temps (hypothèse :
  15 à 30 min par équipe).
- **Pour le simulateur** : une garde longue simulée en deux équipes, avec une transmission. Les tâches en cours
  passent à l'équipe suivante ; une petite part peut être « perdue » (un résultat qu'il faudra redemander), d'autant
  plus que l'équipe sortante est fatiguée.

## Ce que le joueur humain fera (l'interne)

Sami : « que les humains aient des tâches de transport / analyse, focus sur quelques éléments / patients, plutôt
guidé… comme un interne. Quelques tâches en parallèle pour créer un peu de choix. »
- le joueur suit **quelques patients** (3 à 5), que l'ordonnanceur lui confie ;
- ses tâches sont **locales et guidées** :
  - prélever ;
  - porter les tubes au labo ;
  - accompagner un patient au scanner ;
  - aller chercher un médicament à la pharmacie ;
  - reprendre les constantes ;
  - **regarder un résultat** et le signaler ;
- **plusieurs tâches à la fois** : il choisit l'ordre, et c'est là qu'est la prise de décision ;
- l'ordonnanceur, lui, décide qui entre en box, qui va au scanner, qui prend le lit ;
- **sa fatigue compte aussi** : un interne qui ne fait pas de pause ralentit ;
- **le mode aléatoire** joue l'interne au hasard parmi ses tâches : c'est le « humain simulé » de Sami, pour
  mesurer ce qu'un joueur moyen coûte ou apporte.

C'est l'étape 3 de la [feuille de route](feuille-de-route.md).
