import { exitPatient, free, leavePlace, lognormal, now, removeFrom, take } from "./pathway-places.js";
import { intoScanner } from "./pathway-trace.js";

/**
 * The scanner's and the theatre's order decided (Sami, 26/10/2026, the roadmap's step 6): with `queueDecided` in the
 * settings, when the scanner or the theatre is free and two patients or more wait for it, the day asks who goes first
 * (`queueDecision`); one patient alone goes in at once. Without it, both keep their fixed order (pathway-serve.js: the
 * scanner by colour, the theatre reds first). `QUEUE_RULES` answer as reference rules; the search answers too
 * (pathway-search.js). A candidate: `{ id, colour, order }`, `order` its place in the queue (who asked first).
 */
export const QUEUE_POOLS = Object.freeze(["scanner", "theatre"]);

export const QUEUE_RULES = Object.freeze({
  /** The most urgent colour, who asked first between equals: the fixed order of the scanner. */
  colour: (candidates) => candidates.reduce((best, one) => (one.colour < best.colour || (one.colour === best.colour && one.order < best.order) ? one : best)),
  /** Who asked first. */
  oldest: (candidates) => candidates.reduce((best, one) => (one.order < best.order ? one : best)),
});

export const QUEUE_LABELS = Object.freeze({ colour: "la couleur, puis la demande", oldest: "la première demande" });

/** Patient `id` goes into a scanner now. */
export function startScan(day, id) {
  take(day, "scanner");
  intoScanner(day, id);
  day.events.schedule(now(day) + day.settings.scan, { type: "scanEnd", id });
}

/** Patient `patient` goes to the theatre now: out of the department, the theatre busy for the operation. */
export function startTheatre(day, patient) {
  take(day, "theatre");
  day.events.schedule(now(day) + lognormal(day.settings.theatre, patient.theatreFactor), { type: "theatreEnd" });
  leavePlace(day, patient);
  exitPatient(day, patient, "bloc");
}

/** Whether `pool`'s queue waits for a decision (decided, free, two patients or more). */
export const decidedQueue = (day, pool) => day.settings.queueDecided && free(day, pool) > 0 && day.queues[pool].length >= 2;

/** The decision of a free scanner or theatre with two patients or more waiting; null otherwise. */
export function queueDecision(day) {
  const pool = QUEUE_POOLS.find((one) => decidedQueue(day, one));
  if (!pool) return null;
  return { kind: "queue", pool, candidates: day.queues[pool].map((id, order) => ({ id, order, colour: day.patients.get(id).colour })) };
}

export function decideQueue(day, decision, id) {
  if (!removeFrom(day.queues[decision.pool], id)) throw new Error("la règle doit choisir un patient de la file");
  if (decision.pool === "scanner") startScan(day, id);
  else startTheatre(day, day.patients.get(id));
}
