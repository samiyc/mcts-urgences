# Les indicateurs : ce que mesurent les vrais services, ce que le simulateur comptera

Sami (25/10/2026) : « compléter les indicateurs max pour les comparatifs de stratégie de l'ordonnanceur : le nombre
de patients en attente max, le temps d'attente maximum, la dégradation de l'état des patients, etc. » Les termes
sont dans le [glossaire](glossaire.md).

## Ce que mesurent les services et les autorités

**En France, le RPU** (le résumé de passage) alimente les indicateurs.
- Il part chaque jour vers l'ARS et Santé publique France (le réseau OSCOUR), et vers l'ATIH (le financement) :
  voir les notes de Sami, `docs/notes/init.md`.
- Les observatoires régionaux (ORU) et leur fédération (FEDORU) en tirent les indicateurs de tension.
- Un guide de la FEDORU retient **six indicateurs** de suivi permanent
  ([guide FEDORU des tensions hospitalières, 2019](https://chu-rouen.fr/wp-content/uploads/sites/66/2024/07/09-Guide-avril2019_tensions-hospitalieres_FEDORU_Mission-SSE-ESR.pdf)) :
  - les passages du jour ;
  - les patients présents ;
  - les patients de plus de 75 ans ;
  - la durée moyenne de passage ;
  - les hospitalisations après les urgences ;
  - les lits disponibles par service.

  Le guide recommande d'y ajouter le BJML.

**L'enquête Urgences 2023 de la DREES** mesure les durées entre les étapes (voir
[parcours-patient.md](parcours-patient.md)). Les médianes ne suffisent pas, elle donne aussi **le 9e décile** :
la durée que dépasse un patient sur dix. C'est là que se voit la saturation, plus que dans la médiane :
- le lit trouvé en 15 min de médiane, mais en plus de 6 h 10 pour un patient sur dix ;
- la durée de passage de 3 h 10 en médiane, mais de plus de 11 h pour un patient sur dix.

**Au Royaume-Uni, le standard des 4 heures** : 95 % des patients sortis des urgences (rentrés, hospitalisés ou
transférés) moins de 4 h après leur arrivée. Ce standard n'est plus tenu ; l'objectif intermédiaire était de 78 %
en mars 2025. Les **attentes de plus de 12 h** sont comptées à part
([presse britannique, 2024](https://www.expressandstar.com/uk-news/nhs-meets-four-hour-ae-target-for-first-time-as-overall-wait-list-unchanged-5765580)).
Ces chiffres datent de 2024-2025 et n'ont pas été vérifiés pour 2026.

**Les patients partis sans être vus** : un taux sous 5 % était jugé souhaitable au Royaume-Uni (voir
[parcours-patient.md](parcours-patient.md), § 4).

**Les patients qui reviennent sous 72 h** : un indicateur classique de qualité, pour un patient renvoyé chez lui
trop tôt. Le simulateur ne le comptera pas, car il ne suit qu'une garde.

## Ce que le simulateur compte aujourd'hui (`measuresOf`, `src/simulate.js`)

- `lateCost` : les minutes de retard au-delà de l'attente permise par le niveau, pondérées par le niveau ;
- `lateCostNow` : la même chose au niveau du moment, aggravations comprises ;
- `late`, `worsened` : les patients en retard, et ceux qui se sont aggravés ;
- `meanWait` et `byLevel` : l'attente moyenne et la part vue à temps, par niveau ;
- `peakWaiting` : le pic de la salle d'attente ;
- `boxUse`, `doctorUse` : l'occupation des box et des médecins ;
- `looks`, `recoloured` : les réévaluations, et les bracelets changés.

## Ce que le parcours détaillé comptera en plus (étape 1)

| indicateur | défini comme | d'après |
|---|---|---|
| **pic de patients en attente** | le plus grand nombre de patients attendant au même moment, quelle que soit l'étape (tri, box, examen, lit) | Sami ; FEDORU (patients présents) |
| **pic de présents** | le plus grand nombre de patients dans le service | FEDORU |
| **attente maximale, par niveau** | la plus longue attente avant la prise en charge médicale | Sami |
| **délai avant le tri** : médiane, part > 30 min | de l'arrivée au tri | SFMU, DREES |
| **durée de passage** : médiane, 9e décile, maximum | de l'arrivée à la sortie | DREES |
| **sortis en moins de 4 h** | part des patients | NHS |
| **plus de 12 h** | nombre de patients | NHS |
| **partis sans être vus** | nombre et part | DREES, NHS |
| **réorientés** | ambulances envoyées ailleurs | régulation |
| **boarding** : minutes, maximum, minutes de nuit | de la décision d'hospitaliser au départ dans le lit | DREES, « No Bed Night » |
| **délai de rendu des examens** : médiane | de la demande au résultat regardé | SFBC/SFMU |
| **occupation de chaque ressource rare** | box, SAUV, UHCD, scanner, bloc, isolement, lits d'aval | [ressources-rares.md](ressources-rares.md) |
| **ressource la plus saturée** | celle dont l'occupation est la plus haute, et le temps passé pleine | — |
| **dégradation** | les aggravations pendant l'attente, et les patients sortis plus graves qu'à l'arrivée | Sami ; modèle actuel |
| **patients encore critiques en attente** | le pic de niveaux 1-2 qui attendent | Sami |

**Les max, et pas seulement les moyennes.** Deux stratégies peuvent avoir la même moyenne, mais l'une laisse un
patient 9 h dans le couloir. Le 9e décile et le maximum le montrent. Comme dans Lopin, chaque comparaison se fait
**par paires sur les mêmes gardes** (`paired` de mcts-commun), avec son intervalle.

## Pour plus tard

- **Le replay d'ensemble** (étape 5 de la [feuille de route](feuille-de-route.md)) dessinera ces indicateurs au fil
  de la garde, pour voir où un retard, une absence ou un accident a fait monter les courbes :
  - les présents ;
  - les patients en attente ;
  - les ressources pleines ;
  - les aggravations.
- **La fatigue** (étape 4) ajoutera ses propres indicateurs :
  - les heures sans pause ;
  - les oublis ;
  - les résultats regardés en retard.
