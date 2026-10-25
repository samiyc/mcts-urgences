# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

An assistant that organises a hospital emergency department in a crisis (queues, boxes, doctors, operating rooms): it proposes, the human decides, and it never gives a medical opinion. The hidden part is each patient's true state behind the triage colour (POMCP family).

One of Sami's `mcts-*` repositories, created 22/10/2026, siblings in `E:\Dev\My projects\`:
`mcts-commun` (the shared library), `mcts-urgences`, `mcts-entrepot`, `mcts-cuisine`, and `lopin` (the card game
where the ISMCTS was built and measured). The plan and the reasons live in lopin's
`docs/ismcts-ailleurs/` (`feuille-de-route.md` first).

The detailed pathway (25/10/2026, `src/pathway*.js`), next to the simple shift and not replacing it: the research
and its roadmap are in `docs/recherche/` (README first).

## Rules

- **Prose docs are in French**, as the owner works; code, comments and identifiers are English.
- **Node 20, ES modules, no build step**: the same modules run under Node (tests, benches) and in the
  browser page. Modules that decide import no `node:*`.
- **What decides is pure and tested** (`npm test`, `node --test`); the page only draws and listens.
- **Randomness is seeded** (`createRng` of `mcts-commun`): a scenario and a search replay from their seed.
- **A simple rule first**, measured on the same scenarios; a search must beat it, paired over the same
  scenarios, with its interval. A quick screen rejects, it never promotes (lopin's lesson).
- **Markdown files stay under 800 lines**, this one under 300.
- **Commit straight to `main`**; push only when Sami asks.
