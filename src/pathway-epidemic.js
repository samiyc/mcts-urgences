import { createRng } from "mcts-commun/random.js";
import { arrivalsByHour, pathwayOf } from "./pathway-scenario.js";
import { patientOf } from "./scenario.js";

/**
 * A day at the peak of a winter epidemic (Sami, 26/10/2026, docs/recherche/oublis.md: flu and the other winter
 * viruses fill the department and the downstream beds for weeks; `EPIDEMIC` of pathway-hypotheses.js, H57 to H60).
 * The ordinary day stays as it is, and the epidemic adds to it, each part drawn from its own seed so that both days
 * share their patients and can be compared:
 * - its patients (`epidemic: true`) come on top of the others by the hour of the day, more often yellow, often to
 *   isolate (droplets), older;
 * - the wards, full of the season's patients, give the department fewer beds: fewer free when the day starts, and
 *   each bed they free kept with the chance `beds`.
 */

/** The epidemic's patients coming between `from` and `to` (the ambulances from `ambulanceFrom`), by the hour of the day. */
export function epidemicComings(rng, settings, window) {
  const { epidemic } = settings;
  const { from, to } = window;
  return [
    ...arrivalsByHour(rng, settings, settings.walkInRate * epidemic.share, { from, to }).map((arrival) => ({ arrival, source: "pied", mix: epidemic.walkInMix })),
    ...arrivalsByHour(rng, settings, settings.ambulanceRate * epidemic.share, { from: window.ambulanceFrom ?? from, to }).map((arrival) => ({ arrival, source: "ambulance", mix: epidemic.ambulanceMix })),
  ];
}

/** An epidemic patient: drawn as the others, with the epidemic's isolation and age. */
export function epidemicPatient(rng, coming, settings) {
  const drawn = patientOf(rng, coming, settings);
  const { isolate, elderly } = settings.epidemic;
  return { ...drawn, ...pathwayOf(rng, drawn, settings), isolate: rng.next() < isolate, elderly: rng.next() < elderly, epidemic: true };
}

/** The day's own seed for the epidemic, apart from the ordinary day's. */
const epidemicRng = (seed) => createRng((Math.imul(seed, 0x9e3779b1) ^ 0x85ebca6b) >>> 0);

/** The epidemic's patients of the whole day, unnumbered. */
export function epidemicPatients(seed, settings) {
  const rng = epidemicRng(seed);
  return epidemicComings(rng, settings, { from: 0, to: settings.shift }).map((coming) => epidemicPatient(rng, coming, settings));
}

/**
 * The beds the wards still give during the epidemic, from a seed of its own: each bed free at the start and each bed
 * freed over the day kept with the chance `beds`. `{ wards, beds }`: the settings' wards, the times of `bedsFreed`.
 */
export function epidemicBeds(seed, settings, beds) {
  const rng = createRng((Math.imul(seed, 0x27d4eb2f) ^ 0x165667b1) >>> 0);
  const keep = () => rng.next() < settings.epidemic.beds;
  const wards = Object.fromEntries(Object.entries(settings.wards).map(([name, ward]) => [name, { ...ward, free: Array.from({ length: ward.free }).filter(keep).length }]));
  return { wards, beds: Object.fromEntries(Object.entries(beds).map(([ward, times]) => [ward, times.filter(keep)])) };
}
