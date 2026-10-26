import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { HOSPITALS } from "../src/hypotheses.js";
import { ALERT_SEARCHED, SAUV_SEARCHED, playSauvSearchDay, BED_SEARCHED, BREAK_SEARCHED, INTERN_SEARCHED, QUEUE_SEARCHED, playAlertSearchDay, playBedSearchDay, playBreakSearchDay, playInternSearchDay, playQueueSearchDay, playSearchDay, searchRows } from "../src/pathway-search-compare.js";
import { QUEUE_LABELS } from "../src/pathway-queues.js";
import { INTERN_LABELS } from "../src/pathway-intern-decided.js";
import { BED_LABELS } from "../src/pathway.js";
import { RULE_LABELS } from "../src/rules.js";

/**
 * `node scripts/pathway-search-compare.js [--days 10] [--budget 50] [--hopital moyen] [--accident] [--hiver] [--marche] [--lits | --pauses | --interne | --files | --plan | --sauv]` (Sami,
 * 26/10/2026, the detailed pathway's step 6): the box rules and the search on the same days, the bed rule « la
 * décision la plus ancienne », the days played side by side in threads (16 at most: the machine's limit is 18). The
 * late cost at the level of the moment, and the search's gain on each rule by pairs. Budgets above 400 are for the
 * night (night.json), not for the day; under the night's scheduler, the threads it gives (`MCTS_THREADS`). The days are
 * played by src/pathway-search-compare.js, which the page's workers share. With `--lits`, the bed rules against the
 * search choosing the beds (the box rule « couleur »); with `--pauses`, the ways of taking the doctors' breaks against
 * the search deciding them (fatigue on); with `--interne`, the orders of the intern's tasks against the search choosing
 * them (walking counted, the intern decided by events); with `--files`, the scanner's and the theatre's order, fixed or
 * decided, against the search choosing it; with `--plan`, the crisis plan never, at the threshold, or by the search (the
 * cost then counts the doctor-hours called back); with `--sauv`, moving a patient out of the SAUV for a red.
 */

const PLAYS = { beds: playBedSearchDay, breaks: playBreakSearchDay, interns: playInternSearchDay, queues: playQueueSearchDay, alerts: playAlertSearchDay, sauvs: playSauvSearchDay };
const BREAK_NAMES = { none: "aucune pause", quiet: "au creux (la règle)", decided: "au creux, une à une", search: "la recherche" };

if (!isMainThread) {
  parentPort.on("message", (job) => parentPort.postMessage({ seed: job.seed, measures: (PLAYS[job.kind] ?? playSearchDay)(job) }));
} else {
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const hospital = option("--hopital", "moyen");
  if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
  const days = Number(option("--days", 10));
  const budget = Number(option("--budget", 50));
  const options = { hospital, accident: args.includes("--accident"), epidemic: args.includes("--hiver"), walk: args.includes("--marche") };
  const KINDS = { "--lits": "beds", "--pauses": "breaks", "--interne": "interns", "--files": "queues", "--plan": "alerts", "--sauv": "sauvs" };
  const kind = KINDS[Object.keys(KINDS).find((flag) => args.includes(flag))] ?? "boxes";
  const beds = kind === "beds";
  // The scheduler (mcts-backlog) says how many threads it gives; else the machine's, two kept free, 16 at most.
  const threads = Math.max(1, Math.min(Number(process.env.MCTS_THREADS) || 16, availableParallelism() - 2, days));
  const t0 = Date.now();
  const results = await new Promise((resolve) => {
    const done = [];
    let next = 1;
    const feed = (worker) => (next <= days ? worker.postMessage({ seed: next++, options, budget, kind }) : worker.terminate());
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
  console.log(`${HOSPITALS[hospital].label}${options.accident ? ", avec l'accident" : ", jour ordinaire"}${options.epidemic ? ", en pleine épidémie d'hiver" : ""}${options.walk ? ", marche comptée" : ""} : ${days} journées, la recherche à ${budget} itérations, ${threads} fils, ${Math.round((Date.now() - t0) / 1000)} s.`);
  const bedName = (name) => (name === "search" ? "la recherche" : BED_LABELS[name]);
  const queueName = (name) => ({ fixed: "l'ordre fixe", search: "la recherche" })[name] ?? `décidé, ${QUEUE_LABELS[name]}`;
  const internName = (name) => ({ none: "pas d'interne", search: "la recherche" })[name] ?? INTERN_LABELS[name];
  const label = (name) => ({ beds: () => `lit : ${bedName(name)}`, breaks: () => `pauses : ${BREAK_NAMES[name]}`, interns: () => `interne : ${internName(name)}`, queues: () => `scanner et bloc : ${queueName(name)}`, alerts: () => `plan blanc : ${({ never: "jamais", threshold: "au seuil", search: "la recherche" })[name]}`, sauvs: () => `sortie de SAUV : ${({ never: "jamais", longest: "le plus ancien, dès qu'un rouge attend", search: "la recherche" })[name]}`, boxes: () => RULE_LABELS[name] })[kind]();
  const names = { beds: BED_SEARCHED, breaks: BREAK_SEARCHED, interns: INTERN_SEARCHED, queues: QUEUE_SEARCHED, alerts: ALERT_SEARCHED, sauvs: SAUV_SEARCHED, boxes: undefined }[kind];
  const internFigure = (name, read) => (results.reduce((sum, one) => sum + (one.measures[name].intern ? read(one.measures[name].intern) : 0), 0) / results.length).toFixed(2).replace(".", ",");
  const breakFigure = (name, key) => (results.reduce((sum, one) => sum + one.measures[name].fatigue[key], 0) / results.length).toFixed(1).replace(".", ",");
  for (const row of searchRows(results.map((one) => one.measures), names)) {
    const against = row.gain ? ` · la recherche contre elle : ${gainOf(row.gain)}` : "";
    const nights = beds ? ` · boarding max ${Math.round(row.boardingMax)} min · 75+ la nuit ${row.elderlyNights.toFixed(1).replace(".", ",")}` : "";
    const breaks = kind === "breaks" ? ` · repas ${breakFigure(row.name, "meals")} · repos ${breakFigure(row.name, "rests")} · sans pause au plus ${breakFigure(row.name, "longest")} h` : "";
    const tasks = kind === "interns" && row.name !== "none" ? ` · passage méd. ${Math.round(row.stayMedian)} min · tâches en retard ${internFigure(row.name, (i) => i.late)} · retard moyen ${internFigure(row.name, (i) => i.lateness.mean)} min · aggravations vues ${internFigure(row.name, (i) => i.recoloured)}` : "";
    const plan = kind === "alerts" ? ` · retard seul ${Math.round(results.reduce((sum, one) => sum + one.measures[row.name].lateCostOnly, 0) / results.length)} · heures de médecin rappelées ${(results.reduce((sum, one) => sum + one.measures[row.name].alert.hours, 0) / results.length).toFixed(1).replace(".", ",")}` : "";
    console.log(`${label(row.name).padEnd(36)} coût au moment ${fixed(row.lateCostNow).padStart(8)} · partis ${row.left.toFixed(1).replace(".", ",")}${nights}${breaks}${tasks}${plan}${against}`);
  }
}
