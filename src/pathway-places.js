import { minutesOf } from "./pathway-cells.js";
import { overlooks, slowOf } from "./pathway-fatigue.js";
import { drop } from "./pathway-intern.js";
import { doctorTo, intoSlot, outOfDepartment, outOfSlot } from "./pathway-trace.js";

/**
 * The places, the people and the machines of the detailed pathway (pathway.js): the pools a patient takes and gives
 * back, the queues, the moves between places, and the cleaning after one.
 */

/** The places, the people and the machines counted for their use, with their capacities. */
export const POOLS = ["boxes", "sauv", "isolation", "uhcd", "doctors", "ioa", "reception", "scanner", "specialists", "theatre"];

export const now = (day) => day.events.now;
export const lognormal = (median, factor) => median * factor;

/** Takes one of `pool`; never more than there are (the doctors only, when the day's extra ones go while busy). */
export function take(day, pool) {
  if (pool !== "doctors" && day.busy[pool] >= day.capacity[pool]) throw new Error(`plus de place libre : ${pool}`);
  day.busy[pool] += 1;
}
export const give = (day, pool) => (day.busy[pool] -= 1);
export const free = (day, pool) => day.capacity[pool] - day.busy[pool];
export const removeFrom = (queue, id) => {
  const index = queue.indexOf(id);
  if (index >= 0) queue.splice(index, 1);
  return index >= 0;
};
/** Colour, then the order they came in: the fixed order of the scanner, the specialists, the UHCD. */
export const byColour = (day) => (a, b) => day.patients.get(a).colour - day.patients.get(b).colour;

export function exitPatient(day, patient, exit) {
  Object.assign(patient, { exit, exitAt: now(day), step: "out" });
  outOfDepartment(day, patient);
  drop(day, patient.id);
}

/** The place a waiting patient would take now, or null: the SAUV for a red, the isolation room for an isolated one, else a box. */
export function placeFor(day, patient) {
  if (patient.colour === 1 && free(day, "sauv") > 0) return "sauv";
  if (patient.isolate && free(day, "isolation") > 0) return "isolation";
  return free(day, "boxes") > 0 ? "boxes" : null;
}

/** Leaves the patient's place; it is cleaned before the next one. */
export function leavePlace(day, patient) {
  if (!patient.place) return;
  const place = patient.place;
  patient.place = null;
  const slot = outOfSlot(day, place, patient.id);
  const cleaning = patient.isolate && place === "boxes" ? day.settings.cleanIsolated : day.settings.clean;
  day.events.schedule(now(day) + cleaning, { type: "cleaned", place, slot });
}

/** Moves a patient into `place` (a pool), from wherever they were; the cells they walk there. */
export function moveTo(day, patient, place) {
  if (patient.place) leavePlace(day, patient);
  take(day, place);
  patient.place = place;
  return intoSlot(day, place, patient.id);
}

/** The minutes a walk of `steps` cells holds the day up: none unless walking counts (step 3). */
export const walkDelay = (day, steps) => (day.settings.walk ? minutesOf(steps) : 0);

/** A doctor reads a patient's results, once at their side. */
export function startReview(day, id) {
  take(day, "doctors");
  const fetched = doctorTo(day, id);
  const k = day.trace.doctors.indexOf(id);
  const patient = day.patients.get(id);
  if (overlooks(day, k, patient)) patient.overlooked = true;
  day.events.schedule(now(day) + walkDelay(day, fetched) + day.settings.review * slowOf(day, k), { type: "reviewEnd", id });
}
