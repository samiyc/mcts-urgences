import { cellAt, pathOf, roleOf, seatsOf, startCellOf } from "./pathway-cells.js";
import { STEP } from "./ward-moves.js";

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
 *   "patient" with the patient's `id` (a doctor at their side), or "out" with the `door` taken;
 * - `walks`: each move as a walk on the plan (pathway-cells.js), from where one was to the cell of where one goes,
 *   started when the move happens: what the plan draws, and what the day waits for when walking counts (step 3).
 */

/** The exits by the door they take: a ward through the lifts, the theatre through its door, the others the entrance. */
const DOORS = { hospitalise: "lifts", bloc: "theatre" };

export function startTrace(capacity, pools, layout) {
  return {
    layout,
    walks: [],
    last: new Map(),
    seats: { waiting: seatsOf(layout.seats, layout.points.entrance), results: seatsOf(layout.results.length ? layout.results : layout.seats, layout.points.entrance) },
    slots: Object.fromEntries(pools.map((pool) => [pool, Array.from({ length: capacity[pool] ?? 0 }, () => null)])),
    doctors: [],
    where: new Map(),
    moves: [],
    placeOf: new Map(),
    scanOf: new Map(),
    transports: [],
  };
}

/** The cell of where `to` says one goes (a seat taken as one sits). */
function cellOf(trace, who, to) {
  const { points, places } = trace.layout;
  const pick = {
    reception: () => points.reception,
    triage: () => points.triage,
    waiting: () => trace.seats.waiting.take(who),
    results: () => trace.seats.results.take(who),
    room: () => points.room,
    base: () => points.porters,
    pause: () => points.pause ?? points.room,
    patient: () => trace.where.get(to.id)?.cell ?? points.room,
    out: () => points[to.door] ?? points.entrance,
    cell: () => to.cell,
  };
  return (pick[to.at] ?? (() => places[to.at]?.[to.slot] ?? points.entrance))();
}

/** Where `who` is at minute `t`: along their last walk, or where they start the day. */
export function positionOf(day, who, t = day.events.now) {
  const last = day.trace.last.get(who);
  return last ? cellAt(last, t) : startCellOf(day.trace.layout, who);
}

/**
 * `who` goes to `to`, leaving at minute `at` (now by default): the move kept, and walked on the plan from where they
 * are. Returns the cells walked, for the day to wait for them when walking counts.
 */
export function locate(day, who, to, at = day.events.now) {
  const { trace } = day;
  // A world of the search where walking does not count: where one goes is kept, not the walk (pathway-clone.js).
  if (trace.light) {
    trace.where.set(who, to);
    return 0;
  }
  trace.seats.waiting.leave(who);
  trace.seats.results.leave(who);
  const from = positionOf(day, who, at);
  const cell = cellOf(trace, who, to);
  const walk = { who, role: roleOf(who), t0: at, path: pathOf(trace.layout.walker, from, cell), at: to.at, door: to.door, from: trace.where.get(who)?.at ?? null };
  trace.where.set(who, { ...to, cell });
  trace.moves.push({ t: at, who, to });
  trace.walks.push(walk);
  trace.last.set(who, walk);
  return walk.path.length - 1;
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
  return locate(day, id, { at: pool, slot });
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
export const placeOrSeat = (day, patient) => (patient.place ? { at: patient.place, slot: day.trace.placeOf.get(patient.id) } : { at: "results" });

/** Patient `id` goes into a scanner. */
export function intoScanner(day, id) {
  const slot = takeSlot(day.trace.slots.scanner, id);
  day.trace.scanOf.set(id, slot);
  locate(day, id, { at: "scanner", slot });
}

/** The scan done: the scanner is free, the patient back to their place or seat (by a stretcher-bearer when walking counts). */
export function outOfScanner(day, patient) {
  day.trace.slots.scanner[day.trace.scanOf.get(patient.id)] = null;
  day.trace.scanOf.delete(patient.id);
  if (!day.settings.walk) locate(day, patient.id, placeOrSeat(day, patient));
}

/**
 * Patient `id` walked with the intern from the moment they fetched them: their walk is the intern's cells since then
 * (pathway-intern.js), one a step, and they are where the intern is.
 */
export function followedTo(day, patient) {
  const { intern, trace } = day;
  // An intern decided by events (pathway-intern-decided.js) keeps no cells a step: the patient walks to them.
  if (intern.track.length === 0) {
    locate(day, patient.id, { at: "cell", cell: { ...intern.cell } });
    Object.assign(intern, { following: null, pickedAt: null });
    return;
  }
  const path = intern.track.slice(intern.pickedAt).map((cell) => ({ ...cell }));
  const walk = { who: patient.id, role: "patient", t0: (intern.pickedAt + 1) * STEP, path: path.length ? path : [{ ...intern.cell }], at: "intern", from: trace.where.get(patient.id)?.at ?? null };
  trace.walks.push(walk);
  trace.last.set(patient.id, walk);
  trace.where.set(patient.id, { at: "intern", cell: { ...intern.cell } });
  Object.assign(intern, { following: null, pickedAt: null });
}

/** A patient seated for their results, out of the box. */
export const seated = (day, patient) => locate(day, patient.id, { at: "results" });

/** A patient leaving the department, by the door of their exit; one sent elsewhere by the 15 never came in. */
export function outOfDepartment(day, patient) {
  if (patient.exit !== "reoriente") locate(day, patient.id, { at: "out", door: DOORS[patient.exit] ?? "entrance" });
}

/** A doctor (the first one free, by number) goes to patient `id`'s side, for the exam or the results; the cells walked. */
export function doctorTo(day, id) {
  const { doctors } = day.trace;
  const free = doctors.indexOf(null);
  const k = free < 0 ? doctors.length : free;
  doctors[k] = id;
  return locate(day, `doctor:${k}`, { at: "patient", id });
}

/** The doctor with patient `id` is done, back to the doctors' room. */
export function doctorBack(day, id) {
  const k = day.trace.doctors.indexOf(id);
  day.trace.doctors[k] = null;
  locate(day, `doctor:${k}`, { at: "room" });
}
