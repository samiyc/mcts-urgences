import { paired } from "mcts-commun/measure.js";

/**
 * The rules compared with the search among them, the shifts played side by side in workers (web/shift-worker.js):
 * every core but two, one shift a worker at a time (Sami, 23/10/2026).
 */
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const urgentInTime = (measures) => {
  const urgent = [1, 2].map((level) => measures.byLevel[level]);
  const seen = urgent.reduce((sum, group) => sum + group.count, 0);
  return seen ? urgent.reduce((sum, group) => sum + group.inTime * group.count, 0) / seen : 1;
};

let workers = [];
export function stopWorkers() {
  for (const worker of workers) worker.terminate();
  workers = [];
}

/** One worker: it plays the next job each time it answers, until none is left. */
function startWorker(pool, onDone) {
  const worker = new Worker(new URL("./shift-worker.js", import.meta.url), { type: "module" });
  const feed = () => {
    if (pool.next >= pool.jobs.length) return;
    const job = pool.next++;
    worker.postMessage({ job, seed: pool.jobs[job].seed, settings: pool.settings, rule: pool.jobs[job].rule, nurse: pool.nurse });
  };
  worker.onmessage = ({ data }) => {
    if (!pool.current()) return;
    pool.results[data.job] = data.measures;
    pool.done += 1;
    pool.progress(`Comparaison : ${pool.done} gardes jouées sur ${pool.jobs.length} (${pool.size} en parallèle)`);
    if (pool.done === pool.jobs.length) onDone();
    else feed();
  };
  workers.push(worker);
  feed();
}

/**
 * Plays every `jobs` entry (`{ seed, rule }`) in the workers, `progress` told the count as they finish; the
 * measures in the jobs' order. While `current()` turns false (a newer run), the answers are dropped.
 */
function playInWorkers(jobs, { settings, nurse, current, progress }) {
  stopWorkers();
  const size = Math.max(1, Math.min(jobs.length, (navigator.hardwareConcurrency || 4) - 2));
  const pool = { jobs, settings, nurse, current, progress, size, results: new Array(jobs.length), next: 0, done: 0 };
  return new Promise((resolve) => {
    const onDone = () => {
      stopWorkers();
      resolve(pool.results);
    };
    for (let i = 0; i < size; i += 1) startWorker(pool, onDone);
  });
}

const summaryOf = (measures, baseline) => ({
  lateCost: mean(measures.map((one) => one.lateCost)),
  lateCostNow: mean(measures.map((one) => one.lateCostNow)),
  worsened: mean(measures.map((one) => one.worsened)),
  meanWait: mean(measures.map((one) => one.meanWait)),
  urgentInTime: mean(measures.map(urgentInTime)),
  gain: paired(baseline, measures.map((one) => one.lateCost)),
});

/**
 * The four rules, the search among them, on `count` shifts from `seed` with the same nurse: each rule's means and
 * its gain on the arrival order; null if a newer run started meanwhile (`current()` false).
 */
export async function compareWithSearch({ count, seed, settings, nurse, current, progress }) {
  const runs = { arrival: [], colour: [], deadline: [], search: [] };
  const jobs = Object.keys(runs).flatMap((rule) => Array.from({ length: count }, (_, i) => ({ rule, seed: seed + i })));
  // The search's shifts first: they are the long ones.
  jobs.sort((a, b) => Number(b.rule === "search") - Number(a.rule === "search"));
  progress("Comparaison : les gardes partent dans les workers…");
  const results = await playInWorkers(jobs, { settings, nurse, current, progress });
  if (!current()) return null;
  jobs.forEach((job, i) => runs[job.rule].push({ seed: job.seed, measures: results[i] }));
  for (const name of Object.keys(runs)) runs[name] = runs[name].sort((a, b) => a.seed - b.seed).map((one) => one.measures);
  const baseline = runs.arrival.map((one) => one.lateCost);
  const compared = Object.fromEntries(Object.entries(runs).map(([name, measures]) => [name, summaryOf(measures, baseline)]));
  return { ...compared, count };
}
