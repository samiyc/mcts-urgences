import { createRng } from "mcts-commun/random.js";
import { DEFAULTS, LEVELS } from "./hypotheses.js";

/**
 * A shift's patients, drawn from a seed before anything is decided: who arrives when, on foot or by
 * ambulance, their true level (hidden), the colour triage gives them (seen), how long their exam and care
 * will take, and when they would get worse if left waiting. Every rule then plays the same shift, so two
 * rules compare by pairs.
 */

/** A level drawn from shares (level 1 to 5). */
function levelOf(rng, mix) {
  let left = rng.next();
  for (const [i, share] of mix.entries()) {
    left -= share;
    if (left < 0) return LEVELS[i];
  }
  return LEVELS.findLast((_, i) => mix[i] > 0);
}

/** The colour triage gives: the true level with `right`'s chance, else one level off (inside 1 to 5). */
function triage(rng, level, right) {
  if (rng.next() < right) return level;
  const neighbours = [level - 1, level + 1].filter((one) => one >= 1 && one <= 5);
  return neighbours[rng.int(neighbours.length)];
}

/** Arrival times of a Poisson process of `perHour`, over [from, to) minutes. */
export function arrivals(rng, perHour, from, to) {
  const times = [];
  if (perHour <= 0) return times;
  for (let at = from - (60 / perHour) * Math.log(1 - rng.next()); at < to; at -= (60 / perHour) * Math.log(1 - rng.next())) times.push(at);
  return times;
}

/** One patient: what the shift will reveal about them, and what it keeps hidden. */
export function patientOf(rng, { arrival, source, mix }, settings) {
  const level = levelOf(rng, mix);
  return {
    arrival,
    source,
    announcedAt: source === "ambulance" ? Math.max(0, arrival - settings.announced) : arrival,
    level,
    colour: triage(rng, level, settings.triageRight),
    examFactor: Math.exp(settings.spread * rng.normal()),
    stayFactor: Math.exp(settings.spread * rng.normal()),
    worsenDelays: [0, 1, 2].map(() => -settings.worsenAfter * Math.log(1 - rng.next())),
  };
}

/**
 * The shift's patients, by arrival, numbered from 1: `{ id, arrival, source, announcedAt, level (hidden),
 * colour, examFactor, stayFactor, worsenDelays }`. `settings` over DEFAULTS (hypotheses.js).
 */
export function drawShift(seed, overrides = {}) {
  const settings = { ...DEFAULTS, ...overrides };
  const rng = createRng(seed);
  const crisis = settings.crisis;
  const comings = [
    ...arrivals(rng, settings.walkInRate, 0, settings.shift).map((arrival) => ({ arrival, source: "pied", mix: settings.walkInMix })),
    ...arrivals(rng, settings.ambulanceRate, 0, settings.shift).map((arrival) => ({ arrival, source: "ambulance", mix: settings.ambulanceMix })),
    ...(crisis ? Array.from({ length: crisis.size }, () => ({ arrival: crisis.at + crisis.over * rng.next(), source: "ambulance", mix: crisis.mix })) : []),
  ];
  return comings
    .map((coming) => patientOf(rng, coming, settings))
    .sort((a, b) => a.arrival - b.arrival)
    .map((patient, i) => ({ id: i + 1, ...patient }));
}
