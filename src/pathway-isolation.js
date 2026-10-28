import { free, leavePlace, moveTo } from "./pathway-places.js";
import { seated } from "./pathway-trace.js";

/**
 * The isolation room lent (Sami, 26/10/2026, H61): free, and nobody to isolate waiting for it, it takes a light
 * (triaged 4 or 5) and young (under 75) patient, easily moved (`borrows`, pathway-places.js's `placeFor`). A patient to
 * isolate takes it back, waiting or already in a box: the borrower moves to a free box, or else to a chair (as a
 * light patient who walked in waits for the results, pathway-handlers.js). The room is cleaned, then goes to the patient
 * to isolate: by the box rule if they wait, at once if a box holds them (that box cleaned after them). No two patients
 * swap places without a cleaning between (Sami, H62: a place is always cleaned before the next patient). The borrower
 * being examined stays until the exam's end: a few minutes for a light patient.
 */

/** Whether a patient to isolate waits for the isolation room, in the waiting room or in a box. */
export function isolatedWanting(day) {
  if (day.queues.waiting.some((id) => day.patients.get(id).isolate)) return true;
  return day.trace.slots.boxes.some((id) => typeof id === "number" && day.patients.get(id).isolate);
}

/** Whether `patient` may borrow the free isolation room: light, young, and nobody to isolate waiting for it. */
export function borrows(day, patient) {
  const lent = day.settings.isolationLent;
  return Boolean(lent) && !patient.isolate && patient.colour >= lent.fromColour && !patient.elderly && !isolatedWanting(day);
}

/** The counts of the room lent: patients it took in, borrowers moved out, patients to isolate moved in from a box. */
export const startIsolation = (settings) => (settings.isolationLent ? { lent: 0, moved: 0, back: 0 } : null);

/** A patient taking the isolation room, counted when they borrow it. */
export function noteLent(day, patient, place) {
  if (place === "isolation" && !patient.isolate && day.isolation) day.isolation.lent += 1;
}

/** The patient to isolate whom a box holds, or undefined. */
const isolatedInBox = (day) => day.trace.slots.boxes.map((id) => typeof id === "number" && day.patients.get(id)).find((patient) => patient && patient.isolate);

/** The patient to isolate whom a box holds, while the isolation room is free; else undefined. */
const reclaimable = (day) => (free(day, "isolation") > 0 ? isolatedInBox(day) : undefined);

/** The borrower leaves the room: to a free box, or else to a chair. */
function moveOut(day, borrower) {
  if (free(day, "boxes") > 0) moveTo(day, borrower, "boxes");
  else {
    leavePlace(day, borrower);
    seated(day, borrower);
  }
  day.isolation.moved += 1;
}

/** The borrower in the room's place `id` who may leave it now (not in the middle of their exam), or null. */
function movable(day, id) {
  const patient = typeof id === "number" ? day.patients.get(id) : null;
  return patient && !patient.isolate && patient.step !== "exam" ? patient : null;
}

/** The isolation room taken back from its borrowers for a patient to isolate (a fixed order, pathway-serve.js). */
export function reclaimIsolation(day) {
  if (!day.isolation) return;
  for (let isolated = reclaimable(day); isolated; isolated = reclaimable(day)) {
    moveTo(day, isolated, "isolation");
    day.isolation.back += 1;
  }
  for (const id of [...day.trace.slots.isolation]) {
    const borrower = movable(day, id);
    if (!borrower) continue;
    if (isolatedWanting(day)) moveOut(day, borrower);
  }
}
