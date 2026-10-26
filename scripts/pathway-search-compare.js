import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { HOSPITALS } from "../src/hypotheses.js";
import { BED_SEARCHED, playBedSearchDay, playSearchDay, searchRows } from "../src/pathway-search-compare.js";
import { BED_LABELS } from "../src/pathway.js";
import { RULE_LABELS } from "../src/rules.js";

/**
 * `node scripts/pathway-search-compare.js [--days 10] [--budget 50] [--hopital moyen] [--accident] [--marche] [--lits]` (Sami,
 * 26/10/2026, the detailed pathway's step 6): the box rules and the search on the same days, the bed rule « la
 * décision la plus ancienne », the days played side by side in threads (16 at most: the machine's limit is 18). The
 * late cost at the level of the moment, and the search's gain on each rule by pairs. Budgets above 400 are for the
 * night (night.json), not for the day; under the night's scheduler, the threads it gives (`MCTS_THREADS`). The days are
 * played by src/pathway-search-compare.js, which the page's workers share. With `--lits`, the bed rules against the
 * search choosing the beds (the box rule « couleur »).
 */

if (!isMainThread) {
  parentPort.on("message", (job) => parentPort.postMessage({ seed: job.seed, measures: job.beds ? playBedSearchDay(job) : playSearchDay(job) }));
} else {
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const hospital = option("--hopital", "moyen");
  if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
  const days = Number(option("--days", 10));
  const budget = Number(option("--budget", 50));
  const options = { hospital, accident: args.includes("--accident"), walk: args.includes("--marche") };
  const beds = args.includes("--lits");
  // The scheduler (mcts-backlog) says how many threads it gives; else the machine's, two kept free, 16 at most.
  const threads = Math.max(1, Math.min(Number(process.env.MCTS_THREADS) || 16, availableParallelism() - 2, days));
  const t0 = Date.now();
  const results = await new Promise((resolve) => {
    const done = [];
    let next = 1;
    const feed = (worker) => (next <= days ? worker.postMessage({ seed: next++, options, budget, beds }) : worker.terminate());
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
  const fixed = (value) => Math.round(value).toLocaleString("fr-FR");
  const gainOf = (g) => `${fixed(g.mean)} (${fixed(g.low)} à ${fixed(g.high)})`;
  console.log(`${HOSPITALS[hospital].label}${options.accident ? ", avec l'accident" : ", jour ordinaire"}${options.walk ? ", marche comptée" : ""} : ${days} journées, la recherche à ${budget} itérations, ${threads} fils, ${Math.round((Date.now() - t0) / 1000)} s.`);
  const bedName = (name) => (name === "search" ? "la recherche" : BED_LABELS[name]);
  const label = (name) => (beds ? `lit : ${bedName(name)}` : RULE_LABELS[name]);
  for (const row of searchRows(results.map((one) => one.measures), beds ? BED_SEARCHED : undefined)) {
    const against = row.gain ? ` · la recherche contre elle : ${gainOf(row.gain)}` : "";
    const nights = beds ? ` · boarding max ${Math.round(row.boardingMax)} min · 75+ la nuit ${row.elderlyNights.toFixed(1).replace(".", ",")}` : "";
    console.log(`${label(row.name).padEnd(36)} coût au moment ${fixed(row.lateCostNow).padStart(8)} · partis ${row.left.toFixed(1).replace(".", ",")}${nights}${against}`);
  }
}
