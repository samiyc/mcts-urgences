import { free, moveTo } from "./pathway-places.js";

/**
 * Out of the SAUV (Sami, 26/10/2026, the roadmap's step 6): with `sauvDecided` in the settings, when the SAUV is full,
 * a red waits for it (or an ambulance brings one, announced), and a box is free, the day asks whether to move a
 * patient already examined out of the SAUV into that box, to free the SAUV for the red (`sauvDecision`), at most every
 * `ASK_EVERY` minutes. A candidate: `{ id, since, colour }` (a patient of the SAUV: since when they are there, their
 * colour now), or `{ id: "none" }`. `SAUV_RULES` answer as reference rules; the search answers too.
 */
const ASK_EVERY = 10;
const NOBODY = Object.freeze({ id: "none" });

export const SAUV_RULES = Object.freeze({
  /** Nobody moves out. */
  never: (_) => NOBODY,
  /** The patient there longest moves out as soon as a red waits. */
  longest: (candidates) => candidates.filter((one) => one.id !== "none").reduce((best, one) => (one.since < best.since ? one : best)),
});

export const SAUV_LABELS = Object.freeze({ never: "jamais", longest: "le plus ancien sort dès qu'un rouge attend" });

/** Whether a red waits for the SAUV, or is announced on its way. */
function redComing(day) {
  const now = day.events.now;
  if (day.queues.waiting.some((id) => day.patients.get(id).colour === 1)) return true;
  for (const patient of day.patients.values()) if (patient.source === "ambulance" && patient.colour === 1 && patient.announcedAt <= now && patient.arrival > now) return true;
  return false;
}

/** The patients of the SAUV who may move out: examined already, not waiting to leave by the theatre or a transfer. */
const movable = (day) => [...day.patients.values()].filter((patient) => patient.place === "sauv" && patient.examEnd !== undefined && patient.examEnd !== null && patient.exit === null);

/** Whether the question stands: decided, the SAUV full, a box free, not asked just before, a red waiting or coming. */
const asks = (day) => day.settings.sauvDecided && day.capacity.sauv > 0 && free(day, "sauv") <= 0 && free(day, "boxes") > 0 && day.events.now - (day.sauvAsked ?? -Infinity) >= ASK_EVERY && redComing(day);

export function sauvDecision(day) {
  if (!asks(day)) return null;
  const candidates = movable(day).map((patient) => ({ id: patient.id, since: patient.start, colour: patient.colour }));
  return candidates.length ? { kind: "sauv", candidates: [...candidates, NOBODY] } : null;
}

/** Applies it: the patient chosen moves to the free box (the SAUV is cleaned for the next), or nobody. */
export function decideSauv(day, id) {
  day.sauvAsked = day.events.now;
  if (id !== "none") moveTo(day, day.patients.get(id), "boxes");
}
