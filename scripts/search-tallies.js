import { CODES, addTallies } from "../src/search-trials.js";

/**
 * What the searches saw, under a comparison's table (mcts-commun's trials of 27/10/2026, src/search-trials.js): for
 * each searched row, its searches, their iterations and time, and how often `diagnose` gave each code; with the
 * reference row (the search, or search-bench's first variant), the iterations and the time each other row spared over
 * the same days.
 */

const whole = (value) => Math.round(value).toLocaleString("fr-FR");
const share = (count, of) => `${Math.round((100 * count) / Math.max(of, 1))} %`;

/** A row's line: its searches, then each code's share of them (a search may give several codes). */
function lineOf(label, tally) {
  const { searches, iterations, ms, codes } = tally;
  const each = `${whole(iterations / Math.max(searches, 1))} itérations et ${(ms / Math.max(searches, 1)).toFixed(1).replace(".", ",")} ms chacune`;
  const shares = [...CODES, "clear", "oneMove"].map((code) => `${{ clear: "aucun", oneMove: "un seul coup" }[code] ?? code} ${share(codes[code], searches)}`);
  return `${label} : ${whole(searches)} recherches, ${each} · ${shares.join(" · ")}`;
}

/** Prints the tallies of the days (`[{ search, early? }]`), each row named by `labelOf`, the others against `against`. */
export function printTallies(days, labelOf, against = "search") {
  const names = Object.keys(days[0]);
  const sums = Object.fromEntries(names.map((name) => [name, addTallies(days.map((day) => day[name]))]));
  console.log("Ce qu'ont vu les recherches (diagnose) :");
  for (const name of names) console.log(lineOf(labelOf(name), sums[name]));
  const reference = sums[against];
  for (const name of names.filter((one) => one !== against)) {
    const spared = (key) => share(reference[key] - sums[name][key], reference[key]);
    console.log(`${labelOf(name)} épargne ${spared("iterations")} des itérations et ${spared("ms")} du temps de recherche de ${labelOf(against)}, sur les mêmes journées`);
  }
}
