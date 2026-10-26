import { beginBreak, ioaSlowOf, serveBreaks } from "./pathway-fatigue.js";
import { serveTransports } from "./pathway-porters.js";
import { reclaimIsolation } from "./pathway-isolation.js";
import { serveFast } from "./pathway-fast.js";
import { interpreterWait, languageSlowOf } from "./pathway-interpreter.js";
import { decidedQueue, startTheatre } from "./pathway-queues.js";
import { locate } from "./pathway-trace.js";
import { intoScanner } from "./pathway-trace.js";
import { byColour, free, lognormal, moveTo, now, startReview, take } from "./pathway-places.js";

/**
 * Everything of the detailed pathway (pathway.js) that follows a fixed order, done at once: the reception, the
 * triage, the scanner, the specialists, the theatre, the UHCD, the isolation room taken back, the results read. No rule chooses here, but for the
 * scanner and the theatre when their order is decided (pathway-queues.js).
 */

/** Starts the queue's patients in order while `pool` has room, each one's end at `endAt(t)`. */
function startEach(day, { queue, pool, type, endAt, onStart = null }) {
  const t = now(day);
  while (queue.length && free(day, pool) > 0) {
    take(day, pool);
    const id = queue.shift();
    onStart?.(day, id);
    day.events.schedule(endAt(t, id), { type, id });
  }
}

/** The theatre: reds first (NCEPOD: immediate before urgent), then the order of the decisions. */
function serveTheatre(day) {
  const { queues } = day;
  if (decidedQueue(day, "theatre")) return;
  queues.theatre.sort((a, b) => day.patients.get(a).arrivalLevel - day.patients.get(b).arrivalLevel);
  while (queues.theatre.length && free(day, "theatre") > 0) startTheatre(day, day.patients.get(queues.theatre.shift()));
}

/** A patient the UHCD takes for its own watching. */
function intoUhcd(day, patient) {
  const t = now(day);
  moveTo(day, patient, "uhcd");
  Object.assign(patient, { step: "uhcd", uhcdAt: t });
  day.events.schedule(t + lognormal(day.settings.uhcdStay, patient.uhcdFactor), { type: "uhcdEnd", id: patient.id });
}

/** The first patient waiting for a bed who still holds a place outside the UHCD, or undefined. */
function boarderOf(day) {
  for (const ward of Object.values(day.wards)) {
    for (const id of ward.waiting) {
      const patient = day.patients.get(id);
      if (patient.place && patient.place !== "uhcd") return patient;
    }
  }
  return undefined;
}

/** The UHCD: its own patients first, then (if the settings say so) the patients waiting for a bed, from a box. */
function serveUhcd(day) {
  const { queues, settings } = day;
  queues.uhcd.sort(byColour(day));
  while (free(day, "uhcd") > 0) {
    if (queues.uhcd.length) {
      intoUhcd(day, day.patients.get(queues.uhcd.shift()));
      continue;
    }
    const boarder = settings.uhcdForBoarders && boarderOf(day);
    if (!boarder) break;
    moveTo(day, boarder, "uhcd");
    boarder.uhcdAt ??= now(day);
  }
}

/** A doctor goes on a break (pathway-fatigue.js): out of the pool, in the break room, back after its minutes. */
export function startBreak(day, person, slot) {
  take(day, "doctors");
  day.trace.doctors[person.k] = "pause";
  locate(day, `doctor:${person.k}`, { at: "pause" });
  beginBreak(day, person, slot);
  day.events.schedule(now(day) + slot.minutes, { type: "breakEnd", k: person.k });
}

export function serve(day) {
  const { queues, settings } = day;
  startEach(day, { queue: queues.register, pool: "reception", type: "registerEnd", endAt: (t) => t + settings.register });
  // A tired triage nurse takes longer (pathway-fatigue.js), when fatigue counts.
  // A patient who does not speak French: an interpreter waited for, then a longer triage (pathway-interpreter.js).
  const triageOf = (patient) => settings.triage * ioaSlowOf(day) * languageSlowOf(day, patient) + interpreterWait(day, patient);
  startEach(day, { queue: queues.triage, pool: "ioa", type: "triageEnd", endAt: (t, id) => t + triageOf(day.patients.get(id)) });
  serveTransports(day);
  serveBreaks(day, startBreak);
  // The scanner's order: by colour, unless decided one at a time (pathway-queues.js) while two or more wait.
  if (!decidedQueue(day, "scanner")) {
    queues.scanner.sort(byColour(day));
    startEach(day, { queue: queues.scanner, pool: "scanner", type: "scanEnd", endAt: (t) => t + settings.scan, onStart: intoScanner });
  }
  queues.specialists.sort(byColour(day));
  startEach(day, { queue: queues.specialists, pool: "specialists", type: "adviceEnd", endAt: (t) => t + settings.adviceDelay + settings.advice });
  serveTheatre(day);
  serveUhcd(day);
  // The isolation room lent, taken back for a patient to isolate (pathway-isolation.js).
  reclaimIsolation(day);
  // The fast track: its results, then its light patients by arrival (pathway-fast.js).
  serveFast(day);
  while (settings.reviewFirst && queues.review.length && free(day, "doctors") > 0) startReview(day, queues.review.shift());
}
