import { now, removeFrom } from "./pathway-places.js";

/** The bed rules of the detailed pathway (pathway.js): who takes a bed a ward frees, and the bed given. */

/** What a bed rule sees of a patient waiting for a bed. */
export const bedViewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, admitAt: patient.admitAt, inBox: patient.place === "boxes" || patient.place === "sauv" || patient.place === "isolation", elderly: patient.elderly });

/** The ward's bed given to `id`, who leaves for it after `toBed` minutes. */
export function giveBed(day, ward, id) {
  const patient = day.patients.get(id);
  if (!removeFrom(day.wards[ward].waiting, id)) throw new Error("la règle doit choisir un patient qui attend un lit de ce service");
  day.wards[ward].free -= 1;
  Object.assign(patient, { bedAt: now(day), step: "leaving" });
  day.events.schedule(now(day) + day.settings.toBed, { type: "toBed", id });
}

const first = (list, before) => list.reduce((best, one) => (before(one, best) ? one : best));

/** @typedef {import("./types.js").BedRule} BedRule */

/**
 * Who takes a bed a ward frees, among its waiting patients (views: `{ id, colour, admitAt, inBox, elderly }`).
 * @type {Readonly<Record<string, BedRule>>}
 */
export const BED_RULES = Object.freeze({
  /** The admission decided first. */
  oldest: (waiting) => first(waiting, (a, b) => a.admitAt < b.admitAt),
  /** A patient holding a box first (it frees a box for the waiting room), then the oldest decision. */
  box: (waiting) => first(waiting, (a, b) => (a.inBox !== b.inBox ? a.inBox : a.admitAt < b.admitAt)),
  /** A patient of 75 or more first (a night on a stretcher costs them most, « No Bed Night »), then the oldest decision. */
  elderly: (waiting) => first(waiting, (a, b) => (a.elderly !== b.elderly ? a.elderly : a.admitAt < b.admitAt)),
});

export const BED_LABELS = Object.freeze({
  oldest: "la décision la plus ancienne",
  box: "celui qui tient un box",
  elderly: "les 75 ans et plus d'abord",
});
