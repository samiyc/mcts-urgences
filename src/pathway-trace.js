/**
 * Where everyone is during a day of the detailed pathway (Sami, 26/10/2026, the roadmap's step 2), kept beside the
 * day's state so that the plan can draw it (pathway-walk.js): it changes nothing of what happens nor when.
 *
 * `day.trace`:
 * - `slots`: for each place pool (pathway-plans.js's PLACES), who holds each place, by its number on the plan (null
 *   free, "cleaning" while it is cleaned);
 * - `doctors`: the patient each doctor is with, by the doctor's number (null in the doctors' room);
 * - `where`: where each one is now; `moves`: every move, `{ t, who, to }`. `who` is a patient's id, or `doctor:k`;
 *   `to` is `{ at }`, `at` one of "reception", "triage", "waiting", "results", "room", a place pool with its `slot`,
 *   "patient" with the patient's `id` (a doctor at their side), or "out" with the `door` taken.
 */

/** The exits by the door they take: a ward through the lifts, the theatre through its door, the others the entrance. */
const DOORS = { hospitalise: "lifts", bloc: "theatre" };

export function startTrace(capacity, pools) {
  return {
    slots: Object.fromEntries(pools.map((pool) => [pool, Array.from({ length: capacity[pool] ?? 0 }, () => null)])),
    doctors: [],
    where: new Map(),
    moves: [],
    placeOf: new Map(),
    scanOf: new Map(),
  };
}

export function locate(day, who, to) {
  day.trace.where.set(who, to);
  day.trace.moves.push({ t: day.events.now, who, to });
}

/** The first free place of `pool` for `id`; its number. */
function takeSlot(slots, id) {
  const slot = slots.indexOf(null);
  if (slot < 0) throw new Error("plus de place libre sur le plan");
  slots[slot] = id;
  return slot;
}

/** Patient `id` takes a place of `pool` (moveTo of pathway-places.js), and is there. */
export function intoSlot(day, pool, id) {
  const slot = takeSlot(day.trace.slots[pool], id);
  day.trace.placeOf.set(id, slot);
  locate(day, id, { at: pool, slot });
}

/** Patient `id` leaves their place of `pool`: it is cleaned now; its number, for the event that frees it. */
export function outOfSlot(day, pool, id) {
  const slot = day.trace.placeOf.get(id);
  day.trace.placeOf.delete(id);
  day.trace.slots[pool][slot] = "cleaning";
  return slot;
}

export const cleanedSlot = (day, pool, slot) => (day.trace.slots[pool][slot] = null);

/** Where a patient sits between two things: their place, or the seats for the results once out of it. */
const placeOrSeat = (day, patient) => (patient.place ? { at: patient.place, slot: day.trace.placeOf.get(patient.id) } : { at: "results" });

/** Patient `id` goes into a scanner. */
export function intoScanner(day, id) {
  const slot = takeSlot(day.trace.slots.scanner, id);
  day.trace.scanOf.set(id, slot);
  locate(day, id, { at: "scanner", slot });
}

/** The scan done: the scanner is free, the patient back to their place or seat. */
export function outOfScanner(day, patient) {
  day.trace.slots.scanner[day.trace.scanOf.get(patient.id)] = null;
  day.trace.scanOf.delete(patient.id);
  locate(day, patient.id, placeOrSeat(day, patient));
}

/** A patient seated for their results, out of the box. */
export const seated = (day, patient) => locate(day, patient.id, { at: "results" });

/** A patient leaving the department, by the door of their exit; one sent elsewhere by the 15 never came in. */
export function outOfDepartment(day, patient) {
  if (patient.exit !== "reoriente") locate(day, patient.id, { at: "out", door: DOORS[patient.exit] ?? "entrance" });
}

/** A doctor (the first one free, by number) goes to patient `id`'s side, for the exam or the results. */
export function doctorTo(day, id) {
  const { doctors } = day.trace;
  const free = doctors.indexOf(null);
  const k = free < 0 ? doctors.length : free;
  doctors[k] = id;
  locate(day, `doctor:${k}`, { at: "patient", id });
}

/** The doctor with patient `id` is done, back to the doctors' room. */
export function doctorBack(day, id) {
  const k = day.trace.doctors.indexOf(id);
  day.trace.doctors[k] = null;
  locate(day, `doctor:${k}`, { at: "room" });
}
