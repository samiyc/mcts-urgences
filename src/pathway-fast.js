import { free, give, moveTo, now, removeFrom, take } from "./pathway-places.js";
import { drop } from "./pathway-intern.js";
import { doctorBack, locate } from "./pathway-trace.js";

/**
 * The fast track, the « circuit court » (Sami, 26/10/2026, docs/parcours-ajouts.md; FAST_TRACK, H73 to H75; in 58 %
 * of the departments, parcours-patient.md): with `fastTrack` in the settings, from `from` to `to` o'clock a doctor of
 * the day's team (not one more: Sami's choice) sees only light patients who walked in (triaged 4 or 5, not to
 * isolate: what the door sees), in a consultation room (`C` on the plan, the pool `fast`). They go in by their order
 * of arrival as soon as the room and its doctor are free, a fixed order (pathway-serve.js); the box rule may still
 * take one of them into a box. Then, as any light patient who walked in, they wait for their results seated, and the
 * fast track's doctor reads them first. At `to`, the doctor finishes the patient in hand and goes back to the team;
 * the results still to read go to the team's queue. The fast track's doctor is not tired (no fatigue counted).
 */

export const startFast = (settings) => (settings.fastTrack ? { seen: 0, open: false } : null);

/** Who may take the fast track: walked in, light, not to isolate. */
const eligible = (day, patient) => patient.source === "pied" && patient.colour >= day.settings.fastTrack.fromColour && !patient.isolate;

/** The fast track's opening and closing, each day of the shift and the overtime (like the day's extra doctors). */
export function scheduleFast(settings, events) {
  if (!settings.fastTrack) return;
  const { from, to } = settings.fastTrack;
  for (let day = 0; day * 1440 < settings.shift + settings.overtime; day += 1) {
    const at = (hour) => (day * 24 + hour - settings.startHour) * 60;
    if (at(to) > 0) events.schedule(Math.max(0, at(from)), { type: "fastOpen" });
    if (at(to) > 0) events.schedule(at(to), { type: "fastClose" });
  }
}

/** A light patient into the consultation room, with the fast track's doctor: the exam starts. */
function startFastExam(day, patient) {
  removeFrom(day.queues.waiting, patient.id);
  drop(day, patient.id, ["vitals"]);
  moveTo(day, patient, "fast");
  take(day, "fastDoctors");
  day.fast.seen += 1;
  const start = now(day);
  Object.assign(patient, { start, levelAtStart: patient.level, step: "exam", fastTrack: true });
  day.events.schedule(start + day.settings.exam[patient.level] * patient.examFactor, { type: "examEnd", id: patient.id });
}

/** The fast track's fixed order: its results read first, then the light patients waiting, by arrival. */
export function serveFast(day) {
  if (!day.fast?.open) return;
  while (day.queues.fastReview.length && free(day, "fastDoctors") > 0) {
    take(day, "fastDoctors");
    const patient = day.patients.get(day.queues.fastReview.shift());
    patient.fastReviewing = true;
    day.events.schedule(now(day) + day.settings.review, { type: "reviewEnd", id: patient.id });
  }
  while (free(day, "fast") > 0 && free(day, "fastDoctors") > 0) {
    const next = day.queues.waiting.map((id) => day.patients.get(id)).find((patient) => eligible(day, patient));
    if (!next) return;
    startFastExam(day, next);
  }
}

/** A fast track's patient's results wait for its doctor (while it is open); false for the others. */
export function toFastReview(day, patient) {
  if (!patient.fastTrack || !day.fast?.open) return false;
  day.queues.fastReview.push(patient.id);
  return true;
}

/** The doctor of the exam goes free: the fast track's for its patients, else the team's. */
export function releaseExamDoctor(day, patient) {
  if (patient.fastTrack) return give(day, "fastDoctors");
  give(day, "doctors");
  doctorBack(day, patient.id);
}

/** The doctor who read the results goes free: the fast track's when it read them, else the team's. */
export function releaseReviewDoctor(day, patient) {
  if (patient.fastReviewing) {
    patient.fastReviewing = false;
    return give(day, "fastDoctors");
  }
  give(day, "doctors");
  doctorBack(day, patient.id);
}

/** The fast track's events (pathway-handlers.js): it opens, a doctor taken from the team; it closes, given back. */
export const FAST_HANDLERS = {
  fastOpen(day) {
    const doctors = Math.max(1, Math.round(day.settings.fastTrack.doctors * (day.settings.boxes / 12)));
    Object.assign(day.fast, { open: true, doctors });
    day.capacity.doctors -= doctors;
    day.capacity.fastDoctors += doctors;
    locate(day, "fast:0", { at: "fast", slot: 0 });
  },
  fastClose(day) {
    Object.assign(day.fast, { open: false });
    day.capacity.doctors += day.fast.doctors;
    day.capacity.fastDoctors -= day.fast.doctors;
    day.queues.review.push(...day.queues.fastReview.splice(0));
    locate(day, "fast:0", { at: "room" });
  },
};
