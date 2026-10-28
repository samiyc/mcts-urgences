# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

An assistant that organises a hospital emergency department in a crisis (queues, boxes, doctors, operating rooms): it proposes, the human decides, and it never gives a medical opinion. The hidden part is each patient's true state behind the triage colour (POMCP family).

One of Sami's `mcts-*` repositories, created 22/10/2026, siblings in `E:\Dev\My projects\`:
`mcts-commun` (the shared library), `mcts-urgences`, `mcts-entrepot`, `mcts-cuisine`, and `lopin` (the card game
where the ISMCTS was built and measured). The plan and the reasons live in lopin's
`docs/ismcts-ailleurs/` (`feuille-de-route.md` first).

The detailed pathway (25/10/2026, `src/pathway*.js`), next to the simple shift and not replacing it: its steps and
figures in `docs/parcours.md`, what came after the roadmap in `docs/parcours-ajouts.md`, the research and its roadmap
in `docs/recherche/` (README first), the estimated values to check with professionals in
`docs/recherche/hypotheses-a-verifier.md`.

## Rules

- **Prose docs are in French**, as the owner works; code, comments and identifiers are English.
- **Node 24 (24.22.1 LTS on the machine since 28/10/2026, was 20.10), ES modules, no build step**: the same modules
  run under Node (tests, benches) and in the browser page. Modules that decide import no `node:*`.
- **What decides is pure and tested** (`npm test`, `node --test`); the page only draws and listens.
- **Randomness is seeded** (`createRng` of `mcts-commun`): a scenario and a search replay from their seed.
- **A simple rule first**, measured on the same scenarios; a search must beat it, paired over the same
  scenarios, with its interval. A quick screen rejects, it never promotes (lopin's lesson).
- **Markdown files stay under 800 lines**, this one under 300.
- **`npm run check` passes before every commit** (the pre-commit hook runs it, 4 test files at once at most, Sami 28/10; `TEST_CONCURRENCY=2` while measures
  run): lint, types, tests. Never skip the
  hook. The tooling and its reasons: `docs/outillage.md`.
- **The lint budget is lopin's** (`eslint.config.js`: 40 lines a function, 220 a file, complexity 8): a module that
  outgrows it is split along its seams, the limit is never raised.
- **The fingerprints** (`tests/fingerprint.test.js`) hold what the models do: a refactor changes none; a change
  meant to alter a model updates its hash and says so in the commit, with the measures before and after.
- **Types come from JSDoc** (`npm run types`); the shapes the modules hand each other are in `src/types.js`.
- **The changelog** is data, `docs/changelog.json`: a new version is a new first entry, then `npm run changelog`.
- **Commit straight to `main`**; push only when Sami asks.
