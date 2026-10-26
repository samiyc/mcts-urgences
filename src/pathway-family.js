import { locate } from "./pathway-trace.js";

/**
 * The families and the people who come with a patient (Sami, 26/10/2026, docs/parcours-ajouts.md; FAMILY, H67 to
 * H69): with `family` in the settings, an accompanied patient (pathway-extras.js) brings someone who:
 * - sits in the waiting room, from the patient's arrival to their exit (`family:<id>` on the plan); the room full,
 *   patients wait standing, counted, with no effect on the care;
 * - takes the doctor a few minutes to be told, at the results' reading (`informMinutes`, pathway-places.js);
 * - translates for a patient who does not speak French (pathway-interpreter.js);
 * - takes home a person of 75 or more now and then, instead of the UHCD (drawn with the day).
 */

export const startFamily = (settings) => (settings.family ? { accompanied: 0, standing: 0, informed: 0 } : null);

const companionOf = (patient) => `family:${patient.id}`;

/** The patient arrives: their companion sits in the waiting room. */
export function familyArrives(day, patient) {
  if (!day.family || !patient.accompanied) return;
  day.family.accompanied += 1;
  locate(day, companionOf(patient), { at: "waiting" });
}

/** The patient leaves the department: their companion with them. */
export function familyLeaves(day, patient) {
  if (!day.family || !patient.accompanied) return;
  locate(day, companionOf(patient), { at: "out", door: "entrance" });
  if (!day.trace.light) day.trace.seats.waiting.leave(companionOf(patient));
}

/** A patient sits in the waiting room: standing if every seat is taken (by patients and companions). */
export function noteStanding(day) {
  if (day.family && !day.trace.light && day.trace.seats.waiting.free() <= 0) day.family.standing += 1;
}

/** The minutes telling a patient's family takes the doctor reading the results, counted. */
export function informMinutes(day, patient) {
  if (!day.family || !patient.accompanied) return 0;
  day.family.informed += day.settings.family.inform;
  return day.settings.family.inform;
}
