import { createRng } from "mcts-commun/random.js";

/**
 * What the four later additions draw for each patient (Sami, 26/10/2026, docs/parcours-ajouts.md), each from a seed
 * of its own so that one switched on leaves the others' draws as they were, and each only when it is on:
 * - the families (FAMILY): `accompanied`; and a person of 75 or more who is accompanied and bound for the UHCD goes
 *   home instead, now and then (`home`);
 * - the interpreter (INTERPRETER): `allophone`, a patient who does not speak French;
 * - the deaths (DEATHS): `deathRoll`, hidden, against which the death's chance is played at the exam's end.
 * The fast track draws nothing: who goes there is seen at the door.
 */

/** Whether a patient comes with someone, and the UHCD then turned into going home. */
function familyOf(rng, patient, family) {
  const accompanied = rng.next() < (patient.elderly ? family.share.elderly : family.share.other);
  const home = accompanied && patient.elderly && patient.orientation === "uhcd" && rng.next() < family.home;
  return { accompanied, ...(home ? { orientation: "home" } : {}) };
}

/** The draws of one patient, by `rngs` (one a part: `{ family, language, death }`). */
export function extrasOf(rngs, patient, settings) {
  return {
    ...(settings.family ? familyOf(rngs.family, patient, settings.family) : {}),
    ...(settings.interpreter ? { allophone: rngs.language.next() < settings.interpreter.share } : {}),
    ...(settings.deaths ? { deathRoll: rngs.death.next() } : {}),
  };
}

/** Whether any addition drawing for patients is on. */
export const anyExtras = (settings) => Boolean(settings.family || settings.interpreter || settings.deaths);

/** One generator for the three parts, from a seed (the day's, or a world's). */
export const extrasRngs = (seed) => ({
  family: createRng((Math.imul(seed, 0x2c1b3c6d) ^ 0x297a2d39) >>> 0),
  language: createRng((Math.imul(seed, 0x51ed270b) ^ 0x6c8e9cf5) >>> 0),
  death: createRng((Math.imul(seed, 0x1b873593) ^ 0x4cf5ad43) >>> 0),
});

/** The day's patients with their draws (drawPathwayDay), unchanged when no addition is on. */
export function withExtras(seed, patients, settings) {
  if (!anyExtras(settings)) return patients;
  const rngs = extrasRngs(seed);
  return patients.map((patient) => ({ ...patient, ...extrasOf(rngs, patient, settings) }));
}

/** The same draws from one generator, for the patients a world of the search imagines (pathway-search.js). */
export const worldExtras = (rng, patient, settings) => (anyExtras(settings) ? extrasOf({ family: rng, language: rng, death: rng }, patient, settings) : {});

/**
 * A known patient's hidden draws again in a world of the search (pathway-search.js's `redraw`): the death's roll,
 * and going home instead of the UHCD; who came with them and their language are seen, they stay.
 */
export function redrawExtras(rng, patient, settings) {
  const home = settings.family && patient.accompanied && patient.elderly && patient.orientation === "uhcd" && rng.next() < settings.family.home;
  return { ...(settings.deaths ? { deathRoll: rng.next() } : {}), ...(home ? { orientation: "home" } : {}) };
}
