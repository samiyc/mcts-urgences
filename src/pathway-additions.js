import { startDeaths } from "./pathway-deaths.js";
import { scheduleFast, startFast } from "./pathway-fast.js";
import { startFamily } from "./pathway-family.js";
import { startInterpreter } from "./pathway-interpreter.js";

/**
 * The state of the four later additions at the day's start (Sami, 26/10/2026, docs/parcours-ajouts.md): the families,
 * the interpreter, the deaths, the fast track (its opening and closing scheduled). Each null while it is off.
 */
export function startAdditions(settings, events) {
  scheduleFast(settings, events);
  return { family: startFamily(settings), interpreter: startInterpreter(settings), deaths: startDeaths(settings), fast: startFast(settings) };
}

/** The fast track's pools, when it is on: its consultation rooms (the plan's) and its doctors (none until it opens). */
export const fastPools = (settings) => (settings.fastTrack ? { capacity: { fastDoctors: 0 }, busy: { fast: 0, fastDoctors: 0 } } : { capacity: {}, busy: {} });

/** The additions' measures (pathway-measures.js), those on only. */
export function additionMeasures(day, deathMeasures) {
  return {
    ...(day.family ? { family: { ...day.family } } : {}),
    ...(day.interpreter ? { interpreter: { ...day.interpreter } } : {}),
    ...(day.fast ? { fast: { seen: day.fast.seen } } : {}),
    ...(day.deaths ? { deaths: deathMeasures(day) } : {}),
  };
}
