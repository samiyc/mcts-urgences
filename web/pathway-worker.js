import { playSearchDay, searchChoices } from "../src/pathway-search-compare.js";

/**
 * The search on the pathway in a worker (Sami, 26/10/2026, step 6): too slow for the page's own thread. Given
 * `{ job, kind: "choices", seed, options, bed, budget }`, it answers `{ job, choices }`, the search's box choices of the
 * day, from which the page replays it; given `{ job, kind: "compare", seed, options, budget }`, `{ job, measures }`,
 * each rule's and the search's measures of the day (src/pathway-search-compare.js).
 */
self.onmessage = ({ data }) => {
  if (data.kind === "choices") self.postMessage({ job: data.job, choices: searchChoices(data) });
  else self.postMessage({ job: data.job, measures: playSearchDay(data) });
};
