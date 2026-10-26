/**
 * The search on the pathway played in workers (web/pathway-worker.js; Sami, 26/10/2026, step 6): a day's choices for
 * the tab « Parcours détaillé », or days compared side by side for the Stats tab (every core but two).
 */
const newWorker = () => new Worker(new URL("./pathway-worker.js", import.meta.url), { type: "module" });

/** The search's box choices of the day `job` describes (`{ seed, options, bed, budget }`). */
export function searchChoicesInWorker(job) {
  return new Promise((resolve, reject) => {
    const worker = newWorker();
    worker.onmessage = ({ data }) => {
      worker.terminate();
      resolve(data.choices);
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
    worker.postMessage({ ...job, kind: "choices", job: 0 });
  });
}

/** Days 1 to `days` compared (each rule and the search), side by side; `progress(done, days)` as they finish. */
export function compareSearchInWorkers({ days, options, budget, progress, kind = "compare" }) {
  const size = Math.max(1, Math.min(days, (navigator.hardwareConcurrency || 4) - 2));
  const results = new Array(days);
  let next = 0;
  let done = 0;
  return new Promise((resolve) => {
    const feed = (worker) => {
      if (next >= days) return worker.terminate();
      worker.postMessage({ kind, job: next, seed: next + 1, options, budget });
      next += 1;
    };
    for (let i = 0; i < size; i += 1) {
      const worker = newWorker();
      worker.onmessage = ({ data }) => {
        results[data.job] = data.measures;
        done += 1;
        progress(done, days, size);
        if (done === days) resolve(results);
        feed(worker);
      };
      feed(worker);
    }
  });
}
