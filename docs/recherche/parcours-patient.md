# Le parcours du patient aux urgences

Sami (25/10/2026) : suivre chaque patient en détail, de son arrivée à sa sortie, « comme dans un vrai hôpital ».
Ce fichier décrit le parcours réel, étape par étape, avec les chiffres publiés, puis ce que le simulateur en
reprendra. Les termes sont dans le [glossaire](glossaire.md).

**La source principale** est l'enquête Urgences 2023 de la DREES (le service statistique du ministère de la
Santé). Elle a suivi tous les patients de tous les services d'urgences de France, hors Mayotte, du mardi 13 juin
2023 à 8 h au lendemain 8 h : 55 800 questionnaires, et 95 % des services ont répondu. C'est un jour moyen de
semaine, choisi hors des pics : ni l'hiver et ses épidémies, ni un lundi. Les chiffres ci-dessous sont donc ceux
d'un jour ordinaire ; un jour de crise est pire.
- [DREES, Études et Résultats n° 1373](https://www.drees.solidarites-sante.gouv.fr/sites/default/files/2026-06/ER1373_Urgences_Dur%C3%A9es_%C3%A9tapes.pdf) (juin 2026) : les durées entre les étapes.
- [DREES, Études et Résultats n° 1372](https://www.drees.solidarites-sante.gouv.fr/sites/default/files/2026-06/ER1372_Urgences_Dur%C3%A9e_passage.pdf) (juin 2026) : la durée de passage selon le parcours.
- [DREES, communiqué de mars 2025](https://drees.solidarites-sante.gouv.fr/publications-communique-de-presse/etudes-et-resultats/250319_ER_urgences-la-moitie-des-patients-y-restent-plus-de-trois-heures-en-2023) : la moitié des patients restent plus de 3 heures.

## Vue d'ensemble

```
arrivée ─► inscription ─► tri (IOA) ─► attente ─► prise en charge ─► examens / soins / avis ─► décision ─► sortie
  │                          │            │                                                    │
  │ régulation du 15         │ circuit    │ parti sans                                         ├─ domicile
  │ (vers un autre hôpital)  │ court      │ attendre                                           ├─ UHCD
  │                          │            │                                                    ├─ hospitalisation (attente d'un lit)
  │                          └─ réorienté vers la ville                                        ├─ transfert, bloc
  └─ SMUR : déjà trié dehors, direct en SAUV                                                   └─ décès
```

**La durée de passage** : de l'enregistrement à la sortie, une médiane de **3 h 10** en 2023, contre 2 h 15 en
2013. Un patient sur dix reste plus de **11 h** (ER 1373, graphique 1).

## 1. L'arrivée

- **Par ses propres moyens** pour 71 % des patients ; **par les pompiers, une ambulance ou le SMUR** pour 29 %.
  Le SMUR seul amène 1 % des patients (ER 1373).
- Une ambulance ou un SMUR est **annoncé** par le régulateur du 15, qui choisit l'hôpital. C'est l'`announced`
  du modèle actuel (15 min).
- **La réorientation par le 15** : quand un service est saturé, le régulateur envoie les ambulances ailleurs, si
  c'est possible. Depuis 2025, certaines petites urgences (des « antennes ») ne sont ouvertes qu'une partie du
  temps, ou seulement après un appel au 15 (ER 1373, note 1).
- **Le moment de la journée** : les arrivées montent le matin et culminent l'après-midi et en début de soirée.
  L'attente avant le tri suit, avec deux à trois heures de retard (ER 1373, graphique 2).

**Pour le simulateur** :
- les arrivées varient selon l'heure (hypothèse : un profil par heure plutôt qu'un taux fixe) ;
- un tiers environ des patients arrivent couchés : ils prennent un brancard ;
- une règle de réorientation des ambulances, quand la saturation dépasse un seuil, vers un hôpital voisin qui n'est
  pas simulé : le patient sort du compte, mais le transfert est compté.

## 2. L'inscription

- 80 % des patients sont enregistrés dans les 5 minutes, et 6 % attendent plus de 15 minutes ; la médiane est
  sous 1 minute (ER 1373).
- C'est un agent d'accueil, au guichet. Pour un patient grave, l'inscription se fait après les soins.

**Pour le simulateur** : une étape courte (1 à 5 min), sautée pour les patients de niveau 1. Elle ne fait goulot
que pendant un afflux (l'accident).

## 3. Le tri

- **L'IOA** recueille le motif, évalue la gravité et donne un niveau de l'échelle de tri. En France, c'est la
  **FRENCH** de la SFMU, à 6 niveaux ([communiqué SFMU](https://www.sfmu.org/upload/20_actualites/presse/communique_presse_echelle_tri.pdf)).
  Selon le service, l'IOA peut aussi lancer un antidouleur, un ECG ou une prise de sang.
- **La SFMU recommande que le tri ait lieu moins de 30 minutes après l'enregistrement.** En 2023, la médiane est
  de **8 min** ; un patient sur dix (11 %) attend plus de 30 min. Ils sont 14 % entre 13 h et 15 h, 15 % entre
  19 h et 21 h, et 2 % entre 3 h et 6 h. Pour le SMUR, la médiane est de 4 min, contre 9 min pour les patients
  venus seuls (ER 1373).
- **3,4 % des patients sont réorientés vers la médecine de ville au tri** (ER 1373, encadré 1).
- **Le circuit court** existe dans 58 % des services ; il prend 13,5 % des patients, dont 24 % des cas légers.

**Ce que le tri annonce** : la part de chaque groupe, puis le délai et le devenir de ses patients (ER 1373,
tableau du délai par niveau).

| niveau (DREES) | part des patients | tri → prise en charge (médiane / 3e quartile) | hospitalisés après | passés en SAUV |
|---|---|---|---|---|
| sévère | 11,2 % | 10 min / 30 min | 39,5 % | 28,6 % |
| intermédiaire | 37,8 % | 19 min / 1 h | 23,8 % | 5,3 % |
| léger | 51,1 % | 20 min / 1 h 09 | 7,6 % | 1,6 % |
| ensemble | 100 % | 16 min / 57 min | 16,1 % | 5,5 % |

**Pour le simulateur** :
- le tri existe déjà (la couleur donnée, juste à 80 %, `triageRight`) ;
- il devient une **étape avec une file** : l'IOA est une ressource, et l'attente avant le tri compte ;
- ses parts par niveau peuvent être calées sur ce tableau.

## 4. L'attente, et ceux qui partent

- Entre le tri et le début des soins, la médiane est de **16 min** ; 24 % des patients attendent plus d'une heure,
  et un sur dix plus de **2 h 10**. De l'enregistrement au début des soins, la médiane est sous 30 min, mais un
  patient sur dix attend plus de 2 h 25 (ER 1373).
- **Parti sans attendre** : 3,4 % des patients ; **contre avis médical** : 0,6 % (ER 1373, encadré 1).
- Les départs augmentent avec l'attente : c'est un résultat constant des études, comme à
  [Sydney](https://pmc.ncbi.nlm.nih.gov/articles/PMC1726682) et à
  [San Francisco](https://pmc.ncbi.nlm.nih.gov/articles/PMC2660023). Au Royaume-Uni, un taux sous 5 % était jugé
  souhaitable.

**Pour le simulateur** : un patient léger qui attend peut partir, avec une probabilité qui monte avec son attente
(hypothèse : une loi exponentielle au-delà d'une heure, calée pour ~3 % un jour ordinaire). Un départ est compté
et pèse dans le score : c'est un patient non soigné.

## 5. La prise en charge, les examens et les soins

C'est l'étape la plus longue du parcours, et celle qui s'est le plus allongée en dix ans : **2 h 05** de
médiane entre le début des soins et la sortie, soit 45 min de plus qu'en 2013 (ER 1373).

**Ce que reçoivent les patients** (ER 1372) :
- 19 % une consultation seule ;
- 12 % un soin ou un acte simple, comme un ECG, sans plateau technique ;
- 46 % un soin ou un acte, et au moins un recours au plateau technique ;
- 82 % des patients qui passent par l'UHCD ou sont hospitalisés reçoivent à la fois des soins et le plateau
  technique.

**La durée de passage selon ce qu'on a reçu** (ER 1372, patients rentrés chez eux) :

| parcours | médiane |
|---|---|
| rien, ni soin ni examen (18 %) | 1 h 35 |
| une biologie seule | **3 h 20** |
| des soins et le plateau technique (29 %) | 3 h 55 |
| tous les patients rentrés chez eux (79 %) | 2 h 35 |

**La biologie est l'examen qui allonge le plus le passage.** C'est l'attente du résultat :
- la troponine, l'examen qui écarte un infarctus, a un délai de rendu médian de **81 min** dans 28 centres
  français (l'enquête SFBC/SFMU « Entroprise »), pour un objectif de **60 min** ;
- le temps d'analyse en est la plus petite part ; le reste, c'est le prélèvement, le transport et l'attente au
  laboratoire ;
- un appareil délocalisé aux urgences rend le résultat en ~30 min
  ([SFMU, JTI 2025](https://www.sfmu.org/upload/70_formation/02_eformation/02_congres/jti2025/Gobeaux_tropo_deloc.pdf),
  [Le Quotidien du médecin](https://gynecologie-obstetrique.lequotidiendumedecin.fr/hopital/urgences/un-test-de-troponine-hautement-sensible-pour-desengorger-les-urgences)).

**L'imagerie** : le scanner, la radio et l'échographie sont partagés avec tout l'hôpital. Pour un AVC suspect, la
HAS vise une médiane de **moins de 25 min entre l'arrivée et l'imagerie**, et de moins de 60 min jusqu'au
traitement ([HAS, parcours AVC](https://www.has-sante.fr/jcms/p_3445524/fr/parcours-de-sante-accident-vasculaire-cerebral-de-l-adulte)).

**Les avis spécialisés** : un cardiologue, un chirurgien, un psychiatre appelé en avis. Il faut l'attendre,
surtout la nuit quand il est d'astreinte chez lui (hypothèse : 30 à 90 min ; pas de chiffre national trouvé).

**Les soins** : les perfusions, les antidouleurs, les antibiotiques. Les médicaments viennent de l'armoire du
service ; ceux qu'elle n'a pas viennent de la pharmacie de l'hôpital (hypothèse : 30 à 60 min le jour, plus la
nuit).

**Pour le simulateur**, chaque patient a un **parcours caché**, tiré de la graine :
- les examens dont il a besoin : aucun, une biologie, une imagerie ou les deux, un avis ;
- les soins, avec leur durée ;
- son orientation finale.

Chaque examen est une **demande** à une ressource : le prélèvement par un IDE, le transport, le laboratoire en
parallèle, le scanner, une salle à la fois. Ensuite vient **l'attente du résultat**, puis **la vérification du
résultat** par le médecin. C'est la « rigueur du suivi » de Sami : un résultat non regardé bloque le patient.

## 6. La décision et la sortie

- **79 %** des patients rentrent chez eux, sans UHCD ni hospitalisation (ER 1372).
- **9 %** passent par l'**UHCD** : la moitié y restent plus de **11 h 55**, et 13 % plus de 24 h. Leur durée de
  passage médiane dépasse **17 h 30** (ER 1372).
- **16 %** sont hospitalisés dans un autre service (ER 1373, encadré 2) :
  - sans passage par l'UHCD, leur passage dure **5 h 18** de médiane, dont 4 h 27 entre le début des soins et la
    sortie (ER 1373) ;
  - cette médiane va de 3 h 45 dans les petits services à 6 h 20 dans les grands (ER 1372) ;
  - ceux qui passent par l'UHCD puis sont hospitalisés (4 % des patients) restent plus de **19 h 40**. Parmi eux,
    un quart attendaient à l'UHCD un lit déjà trouvé, et un quart attendaient faute de lit (ER 1372).
- **Le transfert** vers un autre établissement, **le bloc**, **le décès** : des parts plus petites, que l'enquête
  détaille peu.

## 7. Trouver un lit d'aval : le goulot

Sami : « on manque de lits ». C'est **le** goulot mesuré (ER 1373) :
- dans la moitié des cas, le lit est trouvé **en moins de 15 min**, en 2023 comme en 2013 ;
- mais un cas sur dix attend **plus de 6 h 10**, soit 2 h 20 de plus qu'en 2013. La DREES y voit
  notamment la baisse continue du nombre de lits (− 11 % ; les années de cette baisse sont illisibles dans
  notre extraction du PDF) ;
- dans 23 % des cas, il faut **appeler plusieurs services** ; la médiane passe alors à 45 min, et un cas sur dix
  attend plus de 15 h ;
- **les personnes âgées** attendent plus : une médiane de 28 min pour les 75 ans et plus, et plus de 11 h 25 pour
  un sur dix (5 h en 2013) ;
- **le matin est le pire moment** : une décision prise entre 8 h et 12 h attend 55 min de médiane, contre 10 min
  entre 16 h et 20 h. Les services libèrent leurs lits en fin de matinée ;
- **une fois le lit trouvé**, la moitié des patients partent dans les 25 min. Il faut attendre que le lit soit prêt
  (nettoyé) et qu'un brancardier ou un véhicule vienne ;
- dans toute la France, environ 3 300 patients attendaient une hospitalisation aux urgences à 8 h, et 2 800 à 18 h ;
  900 attendaient leur départ à 8 h, et 1 600 à 18 h.

**Ce que coûte une nuit sur un brancard** : l'étude « No Bed Night » (97 services, 1 598 patients de plus de
75 ans hospitalisés après les urgences, décembre 2022). Une nuit passée sur un brancard aux urgences fait passer
la mortalité à l'hôpital de **11,1 % à 15,7 %**, près de 40 % de plus
([AP-HP](https://www.aphp.fr/contenu/etude-no-bed-night-une-nuit-passee-sur-un-brancard-aux-urgences-augmente-de-pres-de-40-le),
JAMA Internal Medicine, novembre 2023). Les grandes études étrangères vont dans le même sens : aux États-Unis, les
périodes d'engorgement sont associées à plus de décès à l'hôpital, sans que la cause soit prouvée
([Sun et al., Annals of Emergency Medicine, en ligne fin 2012](https://scinapse.io/papers/2068227175) : environ 300 décès de plus, sur un an et en Californie).

**Pour le simulateur** :
- les lits d'aval sont des **ressources par service**, comme la médecine, la chirurgie, la cardiologie, la
  réanimation ;
- elles se libèrent surtout en fin de matinée (hypothèse : des sorties tirées autour de 11 h-14 h) ;
- un patient à hospitaliser sans lit **reste dans son box** (le boarding) ou passe en UHCD si elle a de la place ;
- **le box occupé ne reçoit personne d'autre** : c'est ainsi que le manque de lits remonte jusqu'à la salle
  d'attente ;
- le score compte les minutes de boarding, plus lourdes la nuit et pour les patients âgés.

## Ce que le simulateur reprendra, en résumé

| étape | ressource | durée (source) | décision de l'ordonnanceur |
|---|---|---|---|
| inscription | agent d'accueil | 1-5 min (DREES) | — |
| tri | IOA | quelques min, attente ≤ 30 min visée (SFMU) | qui trier d'abord (déjà : la réévaluation) |
| attente | salle d'attente | — | qui entre en box, en SAUV, au circuit court |
| examen médical | médecin + box | `exam` actuel (hypothèse) | quel médecin |
| biologie | IDE (prélèvement), transport, labo | rendu 60-80 min (SFBC/SFMU) | — |
| imagerie | brancardier, scanner | < 25 min pour un AVC (HAS) | qui passe au scanner d'abord |
| avis | spécialiste | 30-90 min (hypothèse) | — |
| soins | IDE, pharmacie | hypothèse | — |
| décision | médecin (vérifier les résultats) | — | — |
| lit d'aval | lits par service, brancardier | médiane 15 min, p90 6 h 10 (DREES) | qui part en premier quand un lit se libère |
| sortie | — | — | — |

Les décisions restent celles d'un ordonnanceur (Sami : « l'ordonnancement global des ressources doit rester du
côté machine »). Les gestes et les transports, eux, sont les tâches d'un interne, qu'on pourra jouer au clavier
([feuille de route](feuille-de-route.md), étape 3).

Ce qui manque encore à la liste de Sami est dans [oublis.md](oublis.md).
