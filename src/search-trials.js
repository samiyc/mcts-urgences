import { diagnose, search } from "mcts-commun/mcts.js";

/**
 * The trials mcts-commun asked of each project (27/10/2026, its docs/recherche.md § 5 and docs/backlog.md's
 * recommendation 8), off by default: `earlyStop`, the search stopped once the root's leader cannot be caught, and a
 * tally of what each search saw, `diagnose`'s codes with its iterations and time. Neither changes a move the search
 * makes without them: every fingerprint holds.
 */
export const CODES = Object.freeze(["fewIterations", "flatScore", "closeCall", "shallow"]);

/**
 * An empty tally: the searches run, their iterations and ms, how many gave each code, none (`clear`), or had one root
 * move; `ranks`, how often the move played was the shortlist's first, second... at the root (mcts-commun's `rank`).
 */
export const newTally = () => ({ searches: 0, iterations: 0, ms: 0, codes: Object.fromEntries([...CODES, "clear", "oneMove"].map((code) => [code, 0])), ranks: {} });

/**
 * The step up of the settings to measure against today's, A (Sami, 28/10/2026: « les valeurs sont très basses en
 * comparaison de lopin » ; mcts-commun's docs/reglages.md): B four times the budget, C 8 moves at the root, D one
 * level deeper for twice the budget, E all of it (5 moves below the root, progressive widening 1). Off by default.
 */
export const TIERS = Object.freeze({
  B: (budget) => ({ budget: 4 * budget }),
  C: (budget) => ({ budget, root: 8 }),
  D: (budget) => ({ budget: 2 * budget, depth: 3 }),
  E: (budget) => ({ budget: 4 * budget, root: 8, width: 5, depth: 3, widening: 1 }),
});

/** Counts a search's result in `tally`: its iterations, its time, and diagnose's codes asked at `depth`. */
export function countSearch(tally, result, depth) {
  const hints = diagnose(result, { depth });
  tally.searches += 1;
  tally.iterations += result.iterations;
  tally.ms += result.ms;
  if (result.stats.length < 2) tally.codes.oneMove += 1;
  else if (hints.length === 0) tally.codes.clear += 1;
  for (const hint of hints) tally.codes[hint.code] += 1;
  if (result.rank) tally.ranks[result.rank.played] = (tally.ranks[result.rank.played] ?? 0) + 1;
}

/** `search` on common worlds, as every search of the department runs, with the trials' settings when given. */
export function searchTried(state, problem, { budget, rng, depth, explore, earlyStop = false, widening = 0, tally = null }) {
  const found = search(state, problem, { budget, rng, depth, explore, common: true, earlyStop, widening });
  if (tally) countSearch(tally, found, depth);
  return found;
}

/** Tallies summed: a run's days, or a job's slices. */
export function addTallies(tallies) {
  const sum = newTally();
  for (const one of tallies) {
    sum.searches += one.searches;
    sum.iterations += one.iterations;
    sum.ms += one.ms;
    for (const code of Object.keys(sum.codes)) sum.codes[code] += one.codes[code] ?? 0;
    for (const [rank, count] of Object.entries(one.ranks ?? {})) sum.ranks[rank] = (sum.ranks[rank] ?? 0) + count;
  }
  return sum;
}
