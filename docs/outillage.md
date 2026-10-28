# L'outillage du dépôt

Sami (26/10/2026), avant l'étape 2 du parcours détaillé (`docs/recherche/feuille-de-route.md`) : un projet qui reste
lisible et sûr à faire grandir. Tout passe par une commande, `npm run check`, que le hook relance avant chaque commit.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run check` | le lint, les types, puis les tests ; c'est ce que lance le hook |
| `npm run lint` (`lint:fix`) | eslint, avec le budget de complexité de lopin |
| `npm run types` | tsc vérifie le JavaScript d'après ses commentaires JSDoc, sans rien compiler |
| `npm test` (`test:coverage`) | les tests de `node --test`, dont les empreintes et la longueur des `.md` |
| `npm run changelog` | refait `web/changelog.html` à partir de `docs/changelog.json` |
| `npm run compare`, `npm run pathway` | les règles comparées sur la garde simple, puis sur le parcours détaillé |

## Le budget du lint

La config `eslint.config.js` reprend celle de lopin :
- une fonction a au plus 40 lignes, une complexité de 8, une complexité cognitive de 10, 4 paramètres et 20
  instructions ;
- un fichier a au plus 220 lignes ;
- `src/` et `web/` n'importent aucun module `node:*`, parce qu'ils tournent aussi dans le navigateur.

**Quand une règle bloque, on découpe, on ne relève pas la limite.** Le 26/10, la première passe a trouvé 57 erreurs.
Elles ont été corrigées en découpant les fichiers le long de leurs coutures :
- `pathway.js` est passé en six modules ;
- `ward.js` en quatre ;
- `app.js` en six ;
- `player.js` et `ward-panel.js` sont devenus des fonctions qui prennent un contexte, au lieu d'une seule grande
  fermeture chacun.

Dans un fichier découpé, le module principal ré-exporte ce qu'il exportait avant : les imports ne changent pas.

## Les empreintes

`tests/fingerprint.test.js` résume en quatre hachages ce que font les modèles :
- le parcours détaillé : chaque patient et les mesures, sur 3 hôpitaux × 2 situations × 5 journées, sous chaque
  règle ;
- la garde simple, sous chaque règle et avec l'infirmier ;
- le plan, avec les trois rôles ;
- une garde jouée par la recherche, à 50 itérations.

Une refonte ne doit changer **aucune** empreinte : c'est ce qui a protégé le découpage du 26/10. Un changement fait
exprès pour modifier un modèle (une nouvelle hypothèse, une étape de la feuille de route) met à jour son hachage. Son
commit le dit, avec les mesures avant et après. Une empreinte qui change sans qu'on l'ait voulu est un bug.

## Les types

`tsconfig.json` vérifie `src/`, `web/` et `scripts/` sans les compiler (`checkJs`, `noEmit`), en mode non strict pour
commencer. mcts-commun n'est pas vérifié : son lien `file:` est lu comme un module externe.

Les formes que les modules s'échangent sont décrites dans `src/types.js` :
- une règle et ce qu'elle voit ;
- le patient, la journée et la décision du parcours détaillé.

Un module y renvoie avec `@typedef {import("./types.js").Day} Day`. Les étapes 2 à 6 ajoutent leurs champs là, en
même temps que leur code. On pourra passer en mode `strict` plus tard, un fichier à la fois.

## Le hook

`.githooks/pre-commit` lance le lint, les types et les tests, ces derniers en bref. Un échec arrête le commit : on
corrige, on ne contourne pas le hook. `npm install` l'active, par le script `prepare` qui lance
`git config core.hooksPath .githooks`.

## Les fichiers

Trois fichiers règlent la forme :
- `.editorconfig` : UTF-8, des fins de ligne LF, 2 espaces, une ligne vide en fin de fichier ;
- `.gitattributes` : du LF partout, dans le dépôt comme sur le disque ;
- `.gitignore` : celui de lopin, plus `tmp/` et `replays/`.

Deux tests surveillent les tailles :
- `tests/md-budget.test.js` : chaque `.md` reste sous 800 lignes, CLAUDE.md sous 300 ;
- les empreintes, décrites plus haut.

## Le journal des versions

`docs/changelog.json` contient le tableau de ce que gagne la recherche, et une entrée par version, la plus récente
d'abord, avec ses commits. `npm run changelog` en fait `web/changelog.html`. Avant le 26/10, un script hors du dépôt
écrivait ce fichier.

## Les jobs de la file de nuit

Les mesures longues passent par la file commune (`mcts-backlog --add-file night.json --tag AAAA-MM-JJ`). Les
scripts qu'elle lance suivent les recommandations de mcts-commun (`docs/backlog.md`, « Recommandations aux projets »,
27/10) par `scripts/night-results.js` :
- **ils disent où ils en sont** : `progress` de `mcts-commun/trace.js` à chaque journée ou garde (« journée 12/100 »
  dans les vues de la file), et une ligne tous les dixièmes sur la sortie d'erreur ; le tableau final reste seul sur
  la sortie standard ;
- **ils écrivent leurs résultats au fil de l'eau** (`--out tmp/nuit/ID.jsonl`) : les réglages en première ligne, puis
  une ligne par journée ou par garde. Un job arrêté garde ce qu'il a joué, et `--gather FICHIER` en refait le tableau
  (avec un code non nul, puisqu'il en manque) ;
- **un job de plus de 25 min est coupé en tranches de graines** (`--first`, `--days`), d'au plus 20 min chacune. Un
  job `--gather` sans calcul les rassemble une fois finies (`after`) : le même tableau qu'en une fois, vérifié. Il
  refuse des tranches aux réglages différents ou une journée présente deux fois ;
- **les estimations et les limites viennent des durées mesurées** : la pire passée ×1,2, et la limite ×2,5, 20 min au
  moins ;
- **un échec sort avec un code non nul**, un fil de calcul qui tombe compris. Les fils sont ceux que la file donne
  (`MCTS_THREADS`).

Un changement de ces scripts s'essaie sur une file temporaire (`--home` d'un dossier temporaire, la recette de
mcts-commun), jamais sur la vraie.

**Les réglages de mcts-commun du 27/10 au soir** (`src/search-trials.js`, sa recommandation 8), éteints par défaut :
- `--diagnose` (`pathway-search-compare.js`, `search-bench.js`) compte, sous le tableau, ce qu'a vu chaque recherche :
  ses itérations, son temps et les codes de `diagnose` ;
- `--early-stop` (`pathway-search-compare.js`), ou la variante `earlyStop=1` (`search-bench.js`), ajoute la recherche
  arrêtée dès que son coup de tête ne peut plus être rattrapé, jouée sur les mêmes journées. On la compare par paires
  à la recherche entière, avec ce qu'elle épargne ;
- `--attente-convexe` (`pathway-search-compare.js --lits`) ajoute la recherche des lits notée par une attente convexe
  (H79), une ligne de plus sur les mêmes journées ;
- `--mondes N` (`pathway-search-compare.js`, 28/10) ajoute la recherche qui réutilise au plus N mondes par décision
  (« La vitesse de la recherche », plus bas) ;
- `--palier` (`pathway-search-compare.js`, 28/10 au soir ; Sami trouve nos réglages bas face à lopin, `docs/reglages.md`
  de mcts-commun) ajoute quatre lignes, B à E, contre les réglages d'aujourd'hui (A) : B quatre fois le budget, C
  8 coups à la racine, D la profondeur 3 pour deux fois le budget, E tout ensemble (5 coups plus bas, l'élargissement
  progressif à 1). La garde les prend en variantes de `search-bench.js` (`root=8`, `depth=3`, `width=5`,
  `widening=1`). Avec `--diagnose`, chaque ligne dit aussi le rang du coup joué dans la liste courte de la racine.
  Les sept décisions qui gardent tous leurs coups n'ont rien à gagner à C.

Les résultats sont dans [parcours-ajouts.md](parcours-ajouts.md), « Les essais de mcts-commun » et « Le palier de réglages ».

## La vitesse de la recherche

Sami (28/10/2026) : la recherche est-elle accélérable sur les journées réalistes, avec beaucoup d'ajouts allumés ?
Une journée jouée par une règle prend 25 ms. La même journée jouée par la recherche prend des secondes, presque
toutes passées à jouer ses mondes. Le profil (`node --cpu-prof`) a montré trois dépenses qui ne servaient à rien :
- **la comptabilité des mondes** : chaque événement d'un monde ajoutait l'occupation des pools et les minutes en box,
  et recomptait les pics en parcourant tous les patients. Seule la vraie journée en fait ses mesures. Un monde est
  marqué `world` (`pathway-clone.js`), et `account` et `keepPeaks` n'y comptent plus rien ;
- **les patients que le service ne connaît pas encore** : `drawWorld` les copiait puis les effaçait. `cloneDay` ne
  les copie plus ;
- **les chemins à pied** : chaque déplacement refaisait son chemin case par case. Le chemin entre deux cases du plan
  est toujours le même : `pathOf` le calcule une fois, puis le partage, gelé.

S'y ajoutent deux contrôles faits à chaque événement, qui sortent plus tôt : aucun box libre, ou la chambre
d'isolement occupée.

Les gains se mesurent sur une journée cherchée pendant l'accident en hiver, avec les quatre ajouts. Le temps est le
temps CPU, avec l'ancienne et la nouvelle version jouées en alternance, trois graines à 20 itérations :

| Hôpital | avant | après | gain |
|---|---|---|---|
| moyen | 8,8 s | 5,5 s | −38 % |
| moyen, avec la marche | 12,0 s | 6,7 s | −44 % |
| CHU | 26,4 s | 15,4 s | −42 % |
| proximité | 2,9 s | 2,3 s | −21 % |

**Les résultats ne changent pas.** Les empreintes tiennent, et les huit recherches (box, lits, pauses, interne,
files, plan, HET, SAUV) donnent les mêmes mesures, champ par champ, sur 64 journées.

**Un monde tiré une seule fois** (`src/pathway-worlds.js`, le même jour). Au budget de la nuit, tirer les mondes
prend 36 % du temps : 18 % pour les arrivées inconnues, 13 % pour la copie de la journée, 4 % pour les patients
connus tirés à nouveau. Les tirages au hasard eux-mêmes n'en font qu'environ 7 % ; le reste construit et copie des
objets. Or, sur des mondes communs (`iterateCommon` de mcts-commun), la k-ième visite de chaque coup de la racine
joue le k-ième monde : le même monde était tiré une fois par coup. Il l'est maintenant une fois, puis copié ; l'état
du flux avant le tirage le reconnaît. Les mêmes mondes, donc les mêmes résultats (les empreintes, et les huit
recherches sur 64 journées). C'est 15 % de temps en moins à l'hôpital moyen et 18 % au CHU, à 60 itérations, en plus
des gains du tableau.

**Depuis le soir du 28/10, c'est la bibliothèque qui le fait** : `problem.copy(world)` de mcts-commun (2f5554f),
proposé par ce projet, garde le k-ième monde tiré et en donne une copie à chaque visite. La recherche lui passe
`copyWorld` (`pathway-worlds.js`) ; `sampleOnce` ne sert plus qu'à l'essai `--mondes`. Les huit recherches sur 64
journées donnent les mêmes mesures, champ par champ, qu'avec `sampleOnce` et qu'avec la lib d'avant (5fb458b), et
les empreintes tiennent, sous Node 24. Le temps ne bouge pas : 48 journées à 60 itérations (hôpital moyen, accident
en hiver, quatre ajouts), jouées en alternance, donnent 6,0 s avec la lib d'avant, 6,4 s avec `sampleOnce` et 6,3 s
avec `copy`, dans le bruit d'une machine chargée. Les gains de la lib (A*, réservations, `events.clone` sans tri)
ne touchent presque pas le parcours, qui n'utilise ni A* ni les réservations.

Construire les patients d'un monde sur place, sans les recopier (`Object.assign` au lieu de `{ ...a, ...b }`), garde
les mêmes tirages, mais va **plus lentement** : l'objet perd la forme fixe que V8 optimise. L'idée est abandonnée.

**Alléger vraiment les tirages ne vaut pas de casser les empreintes** (Sami, 28/10 : « on décidera en fonction des
résultats », puis « ok pour ne pas casser l'empreinte »). `--mondes N` (`pathway-search-compare.js`, éteint par
défaut) ajoute la recherche qui tire au plus N mondes par décision, puis les rejoue à tour de rôle. La mesure porte
sur 100 journées de l'hôpital moyen pendant l'accident en hiver, avec les quatre ajouts (jobs
`mondes-*-2026-10-28-mondes`). Le coût est le retard au moment, et le temps est compté dans le même job que la
recherche entière, donc à charge égale :

| Recherche | coût | par recherche | contre l'entière à 100 (IC 95 %) |
|---|---|---|---|
| entière, 100 itérations | **58 074** | 240 ms | – |
| 8 mondes, 100 itérations | 59 817 | 216 ms (−10 %) | +1 743 (−86 à +3 572) |
| 16 mondes, 100 itérations | 61 308 | 222 ms (−9 %) | +3 234 (+1 012 à +5 456) |
| 32 mondes, 100 itérations | 58 635 | 202 ms (−6 %) | +561 (−626 à +1 748) |
| entière, 70 itérations | 61 274 | 176 ms | +3 201 (+1 189 à +5 212) |
| entière, 50 itérations | 61 099 | 137 ms | +3 025 (+922 à +5 127) |

- **Le temps gagné est faible**, 6 à 10 %. Les 47 % d'un premier essai sur 4 journées venaient surtout de l'ordre :
  la ligne jouée en second trouve le code déjà chaud. Depuis que chaque monde commun n'est tiré qu'une fois, il ne
  reste presque rien à gagner sur les tirages. Le temps part à jouer les mondes.
- **À temps égal, réutiliser des mondes ne fait pas mieux que de faire moins d'itérations.** 8 mondes coûtent environ
  1 700 de plus pour 10 % de temps, et 70 itérations 3 200 de plus pour 27 %.
- **32 mondes ne changent presque rien** : à 100 itérations, une recherche voit rarement plus de 32 mondes distincts
  par coup. Elle perd de la qualité vers 16 mondes et en dessous.

L'essai reste dans le code, éteint, et les empreintes ne bougent pas.

## Pour les autres projets mcts-*

Ce qui se reprend tel quel dans mcts-commun, mcts-cuisine et mcts-entrepot, chacun dans sa propre session :
- les fichiers `.editorconfig`, `.gitattributes`, `.githooks/pre-commit` et `tests/md-budget.test.js`, avec la
  limite de leur CLAUDE.md ;
- la config `eslint.config.js` et ses quatre devDependencies, aux versions de lopin ;
- `tsconfig.json`, avec `preserveSymlinks` pour les projets liés à mcts-commun ;
- les scripts `lint`, `types`, `check`, `prepare` et `changelog` ;
- l'ordre de travail :
  1. le filet d'empreintes, pris avant de toucher au code ;
  2. l'outillage, commité avec le lint encore en échec ;
  3. le code mis sous le budget, sans changer d'empreinte ;
  4. les types ;
  5. le hook.

Ce qui s'adapte à chaque projet :
- **les zones sans `node:*`** : mcts-commun garde `node/` et `bin/` pour Node, mais son `src/` doit en rester libre
  (sa CLAUDE.md le demande déjà) ;
- **ce que couvrent les empreintes** : les services de la cuisine, les chargements de l'entrepôt, et pour
  mcts-commun la recherche et l'ordonnanceur ;
- **le changelog** : le script du scratchpad écrit encore ceux de la cuisine et de l'entrepôt, à rapatrier de la même
  façon.
