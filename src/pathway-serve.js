import { beginBreak, serveBreaks } from "./pathway-fatigue.js";
import { serveTransports } from "./pathway-porters.js";
import { locate } from "./pathway-trace.js";
import { intoScanner } from "./pathway-trace.js";
import { byColour, exitPatient, free, leavePlace, lognormal, moveTo, now, startReview, take } from "./pathway-places.js";

/**
 * Everything of the detailed pathway (pathway.js) that follows a fixed order, done at once: the reception, the
 * triage, the scanner, the specialists, the theatre, the UHCD, the results read. No rule chooses here.
 */

/** Starts the queue's patients in order while `pool` has room, each one's end at `endAt(t)`. */
function startEach(day, { queue, pool, type, endAt, onStart = null }) {
  const t = now(day);
  while (queue.length && free(day, pool) > 0) {
    take(day, pool);
    const id = queue.shift();
    onStart?.(day, id);
    day.events.schedule(endAt(t), { type, id });
  }
}

/** The theatre: reds first (NCEPOD: immediate before urgent), then the order of the decisions. */
function serveTheatre(day) {
  const { queues, settings } = day;
  queues.theatre.sort((a, b) => day.patients.get(a).arrivalLevel - day.patients.get(b).arrivalLevel);
  while (queues.theatre.length && free(day, "theatre") > 0) {
    const patient = day.patients.get(queues.theatre.shift());
    take(day, "theatre");
    day.events.schedule(now(day) + lognormal(settings.theatre, patient.theatreFactor), { type: "theatreEnd" });
    leavePlace(day, patient);
    exitPatient(day, patient, "bloc");
  }
}

/** A patient the UHCD takes for its own watching. */
function intoUhcd(day, patient) {
  const t = now(day);
  moveTo(day, patient, "uhcd");
  Object.assign(patient, { step: "uhcd", uhcdAt: t });
  day.events.schedule(t + lognormal(day.settings.uhcdStay, patient.uhcdFactor), { type: "uhcdEnd", id: patient.id });
}

/** The first patient waiting for a bed who still holds a place outside the UHCD, or undefined. */
const boarderOf = (day) =>
  Object.values(day.wards)
    .flatMap((ward) => ward.waiting)
    .map((id) => day.patients.get(id))
    .find((patient) => patient.place && patient.place !== "uhcd");

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
function startBreak(day, person, slot) {
  take(day, "doctors");
  day.trace.doctors[person.k] = "pause";
  locate(day, `doctor:${person.k}`, { at: "pause" });
  beginBreak(day, person, slot);
  day.events.schedule(now(day) + slot.minutes, { type: "breakEnd", k: person.k });
}

export function serve(day) {
  const { queues, settings } = day;
  startEach(day, { queue: queues.register, pool: "reception", type: "registerEnd", endAt: (t) => t + settings.register });
  startEach(day, { queue: queues.triage, pool: "ioa", type: "triageEnd", endAt: (t) => t + settings.triage });
  serveTransports(day);
  serveBreaks(day, startBreak);
  queues.scanner.sort(byColour(day));
  startEach(day, { queue: queues.scanner, pool: "scanner", type: "scanEnd", endAt: (t) => t + settings.scan, onStart: intoScanner });
  queues.specialists.sort(byColour(day));
  startEach(day, { queue: queues.specialists, pool: "specialists", type: "adviceEnd", endAt: (t) => t + settings.adviceDelay + settings.advice });
  serveTheatre(day);
  serveUhcd(day);
  while (settings.reviewFirst && queues.review.length && free(day, "doctors") > 0) startReview(day, queues.review.shift());
}
