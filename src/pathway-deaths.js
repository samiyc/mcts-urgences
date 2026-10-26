import { MAX_WAIT } from "./hypotheses.js";
import { releaseExamDoctor } from "./pathway-fast.js";
import { exitPatient, leavePlace } from "./pathway-places.js";

/**
 * The deaths in the department (Sami, 26/10/2026, docs/parcours-ajouts.md; DEATHS, H76 to H78; about 0,2 % of the
 * visits, docs/recherche/oublis.md): with `deaths` in the settings, at the exam's end a patient dies when their hidden
 * `deathRoll` (pathway-extras.js) falls under `base[level]`, raised by `perHour` an hour waited past the level's
 * longest wait (crowding goes with more deaths, ressources-rares.md). The doctor then stays `resus` minutes (the
 * resuscitation, then telling the family), and the place `after` minutes more, before the patient leaves (« décès »).
 * Each death weighs `cost` in the measures and in the search's score (Sami's choice: 2 h of a red's lateness).
 */

export const startDeaths = (settings) => (settings.deaths ? { count: 0, at: [], levels: [], waits: [] } : null);

/** The chance the patient dies at the exam's end, after waiting `wait` minutes for it. */
export function deathChance(settings, level, wait) {
  const { base, perHour } = settings.deaths;
  return (base[level] ?? 0) * (1 + (perHour * Math.max(0, wait - MAX_WAIT[level])) / 60);
}

/** Whether the patient dies now, at the exam's end; counted if so. */
export function diesNow(day, patient) {
  if (!day.deaths || patient.deathRoll === undefined) return false;
  const wait = patient.start - patient.arrival;
  if (patient.deathRoll >= deathChance(day.settings, patient.levelAtStart, wait)) return false;
  Object.assign(day.deaths, { count: day.deaths.count + 1, at: [...day.deaths.at, day.events.now], levels: [...day.deaths.levels, patient.levelAtStart], waits: [...day.deaths.waits, wait] });
  return true;
}

/** The deaths after minute `from` (a world of the search counts its own). */
export const deathsSince = (day, from) => (day.deaths ? day.deaths.at.filter((at) => at > from).length : 0);

/** The day's deaths, their levels, the waits before them, and their weight. */
export function deathMeasures(day) {
  const { count, levels, waits } = day.deaths;
  return { count, levels, meanWait: count ? waits.reduce((sum, wait) => sum + wait, 0) / count : 0, cost: count * day.settings.deaths.cost };
}

/** The patient dies at the exam's end: the doctor stays for the resuscitation and the family. */
export function startDeath(day, patient) {
  Object.assign(patient, { step: "death", diedAt: day.events.now });
  day.events.schedule(day.events.now + day.settings.deaths.resus, { type: "deathEnd", id: patient.id });
}

/** The deaths' events (pathway-handlers.js): the doctor free again, then the place, the patient out. */
export const DEATH_HANDLERS = {
  deathEnd(day, patient) {
    releaseExamDoctor(day, patient);
    day.events.schedule(day.events.now + day.settings.deaths.after, { type: "bodyOut", id: patient.id });
  },
  bodyOut(day, patient) {
    leavePlace(day, patient);
    exitPatient(day, patient, "deces");
  },
};
