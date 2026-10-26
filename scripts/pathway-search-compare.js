import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { paired } from "mcts-commun/measure.js";
import { HOSPITALS } from "../src/hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { pathwaySearchRule } from "../src/pathway-search.js";
import { RULE_LABELS, RULES } from "../src/rules.js";

/**
 * `node scripts/pathway-search-compare.js [--days 10] [--budget 50] [--hopital moyen] [--accident] [--marche]` (Sami,
 * 26/10/2026, the detailed pathway's step 6): the box rules and the search on the same days, the bed rule « la
 * décision la plus ancienne », the days played side by side in threads (16 at most: the machine's limit is 18). The
 * late cost at the level of the moment, and the search's gain on each rule by pairs. Budgets above 400 are for the
 * night (night.json), not for the day; under the night's scheduler, the threads it gives (`MCTS_THREADS`).
 */
const NAMES = ["arrival", "colour", "deadline", "search"];

/** One day in a thread: each rule's measures. */
function playDay({ seed, options, budget }) {
  const drawn = drawPathwayDay(seed, options);
  const boxOf = (name) => (name === "search" ? pathwaySearchRule({ budget }) : RULES[name]);
  return Object.fromEntries(NAMES.map((name) => [name, pathwayMeasures(runPathway(startPathway(drawn), { box: boxOf(name), bed: BED_RULES.oldest }))]));
}

if (!isMainThread) {
  parentPort.on("message", (job) => parentPort.postMessage({ seed: job.seed, measures: playDay(job) }));
} else {
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const hospital = option("--hopital", "moyen");
  if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
  const days = Number(option("--days", 10));
  const budget = Number(option("--budget", 50));
  const options = { hospital, accident: args.includes("--accident"), walk: args.includes("--marche") };
  // The scheduler (mcts-backlog) says how many threads it gives; else the machine's, two kept free, 16 at most.
  const threads = Math.max(1, Math.min(Number(process.env.MCTS_THREADS) || 16, availableParallelism() - 2, days));
  const t0 = Date.now();
  const results = await new Promise((resolve) => {
    const done = [];
    let next = 1;
    const feed = (worker) => (next <= days ? worker.postMessage({ seed: next++, options, budget }) : worker.terminate());
    for (let i = 0; i < threads; i += 1) {
      const worker = new Worker(new URL(import.meta.url));
      worker.on("message", (result) => {
        done.push(result);
        if (done.length === days) resolve(done.sort((a, b) => a.seed - b.seed));
        feed(worker);
      });
      feed(worker);
    }
  });
  const costs = (name) => results.map((one) => one.measures[name].lateCostNow);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const fixed = (value) => Math.round(value).toLocaleString("fr-FR");
  const gainOf = (name) => ((g) => `${fixed(g.mean)} (${fixed(g.low)} à ${fixed(g.high)})`)(paired(costs(name), costs("search")));
  console.log(`${HOSPITALS[hospital].label}${options.accident ? ", avec l'accident" : ", jour ordinaire"}${options.walk ? ", marche comptée" : ""} : ${days} journées, la recherche à ${budget} itérations, ${threads} fils, ${Math.round((Date.now() - t0) / 1000)} s.`);
  for (const name of NAMES) {
    const left = mean(results.map((one) => one.measures[name].exits.parti)).toFixed(1).replace(".", ",");
    const against = name === "search" ? "" : ` · la recherche contre elle : ${gainOf(name)}`;
    console.log(`${(RULE_LABELS[name] ?? name).padEnd(26)} coût au moment ${fixed(mean(costs(name))).padStart(8)} · partis ${left}${against}`);
  }
}
