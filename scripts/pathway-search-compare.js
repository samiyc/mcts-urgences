import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { HOSPITALS } from "../src/hypotheses.js";
import { playHetSearchDay, playSauvSearchDay, playAlertSearchDay, playBedSearchDay, playBreakSearchDay, playInternSearchDay, playQueueSearchDay, playSearchDay } from "../src/pathway-search-compare.js";
import { addResult, gatherResults, optionOf, progressReporter, startResults } from "./night-results.js";
import { printSearchTable } from "./pathway-search-table.js";

/**
 * `node scripts/pathway-search-compare.js [--days 10] [--first 1] [--budget 50] [--hopital moyen] [--accident] [--hiver] [--familles] [--interpretes] [--circuit-court] [--deces] [--marche] [--lits | --pauses | --interne | --files | --plan | --het | --sauv] [--out FICHIER]` (Sami,
 * 26/10/2026, the detailed pathway's step 6): the box rules and the search on the same days, the bed rule « la
 * décision la plus ancienne », the days played side by side in threads (16 at most: the machine's limit is 18). The
 * late cost at the level of the moment, and the search's gain on each rule by pairs. Budgets above 400 are for the
 * night (night.json), not for the day; under the night's scheduler, the threads it gives (`MCTS_THREADS`). The days are
 * played by src/pathway-search-compare.js, which the page's workers share. With `--lits`, the bed rules against the
 * search choosing the beds (the box rule « couleur »); with `--pauses`, the ways of taking the doctors' breaks against
 * the search deciding them (fatigue on); with `--interne`, the orders of the intern's tasks against the search choosing
 * them (walking counted, the intern decided by events); with `--files`, the scanner's and the theatre's order, fixed or
 * decided, against the search choosing it; with `--plan`, the crisis plan never, at the threshold, or by the search (the
 * cost then counts the doctor-hours called back); with `--het`, the HET likewise (the cost then counts the beds it
 * gives); with `--sauv`, moving a patient out of the SAUV for a red.
 *
 * For the night's queue (27/10/2026, scripts/night-results.js): `--out` writes each day's results as it ends, so a
 * job stopped keeps what it played; `--first` and `--days` cut a job in slices of seeds, and
 * `--gather FICHIER,FICHIER` prints the table of the slices' files, failing when a slice stopped before its end.
 */

const PLAYS = { beds: playBedSearchDay, breaks: playBreakSearchDay, interns: playInternSearchDay, queues: playQueueSearchDay, alerts: playAlertSearchDay, hets: playHetSearchDay, sauvs: playSauvSearchDay };
// The later additions (docs/parcours-ajouts.md), each by its flag.
const ADDITION_FLAGS = { "--familles": "family", "--interpretes": "interpreter", "--circuit-court": "fastTrack", "--deces": "deaths" };
const KINDS = { "--lits": "beds", "--pauses": "breaks", "--interne": "interns", "--files": "queues", "--plan": "alerts", "--het": "hets", "--sauv": "sauvs" };

/** The run's settings, read from the command line: what its results file keeps as its header. */
function settingsOf(args) {
  const hospital = optionOf(args, "--hopital", "moyen");
  if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
  const additions = Object.entries(ADDITION_FLAGS).filter(([flag]) => args.includes(flag));
  const options = { hospital, accident: args.includes("--accident"), epidemic: args.includes("--hiver"), walk: args.includes("--marche"), ...Object.fromEntries(additions.map(([, name]) => [name, true])) };
  const kind = KINDS[Object.keys(KINDS).find((flag) => args.includes(flag))] ?? "boxes";
  const numbers = { budget: Number(optionOf(args, "--budget", 50)), first: Number(optionOf(args, "--first", 1)), days: Number(optionOf(args, "--days", 10)) };
  return { hospital, options, additions: additions.map(([flag]) => flag.slice(2)), kind, ...numbers };
}

/** Plays the days in `threads` workers, each day's results written to `out` as it ends; rejects if a worker fails. */
function playDays({ first, days, options, budget, kind }, threads, out) {
  const report = progressReporter("journée", days);
  return new Promise((resolve, reject) => {
    const done = [];
    const workers = [];
    let next = first;
    const feed = (worker) => (next < first + days ? worker.postMessage({ seed: next++, options, budget, kind }) : worker.terminate());
    const fail = (error) => {
      for (const worker of workers) worker.terminate();
      reject(error);
    };
    for (let i = 0; i < threads; i += 1) {
      const worker = new Worker(new URL(import.meta.url));
      workers.push(worker);
      worker.on("error", fail);
      worker.on("message", (result) => {
        done.push(result);
        addResult(out, result);
        report(done.length);
        if (done.length === days) resolve(done);
        feed(worker);
      });
      feed(worker);
    }
  });
}

/** Plays the run the command line asks for, or gathers its slices, and prints the table. */
async function main(args) {
  const gather = optionOf(args, "--gather", null);
  if (gather) {
    const files = gather.split(",");
    const { header, units, expected } = gatherResults(files);
    printSearchTable(units, header, files.length > 1 ? `${files.length} tranches rassemblées` : "relu de son fichier");
    if (units.length < expected) throw new Error(`${units.length} journées sur ${expected} : une tranche s'est arrêtée avant sa fin`);
    return;
  }
  const settings = settingsOf(args);
  // The scheduler (mcts-backlog) says how many threads it gives; else the machine's, two kept free, 16 at most.
  const threads = Math.max(1, Math.min(Number(process.env.MCTS_THREADS) || 16, availableParallelism() - 2, settings.days));
  const out = optionOf(args, "--out", null);
  const t0 = Date.now();
  startResults(out, settings);
  const results = (await playDays(settings, threads, out)).sort((a, b) => a.seed - b.seed);
  printSearchTable(results, settings, `${threads} fils, ${Math.round((Date.now() - t0) / 1000)} s`);
}

if (!isMainThread) {
  parentPort.on("message", (job) => parentPort.postMessage({ seed: job.seed, measures: (PLAYS[job.kind] ?? playSearchDay)(job) }));
} else {
  // A failure exits non-zero, the queue's sign that the job failed (the workers stopped with it).
  await main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
