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
