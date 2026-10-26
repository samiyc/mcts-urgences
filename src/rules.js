import { MAX_WAIT } from "./hypotheses.js";

/**
 * The reference rules: who goes in when a box and a doctor are free. They see what the department sees
 * (simulate.js): the colour, the arrival, the source. The search will have to beat them, by pairs, on the
 * same shifts.
 */
const first = (waiting, before) => waiting.reduce((best, patient) => (before(patient, best) ? patient : best));
const deadlineOf = (patient) => patient.arrival + MAX_WAIT[patient.colour];

/** @typedef {import("./types.js").Rule} Rule */

/** @type {Readonly<Record<string, Rule>>} */
export const RULES = Object.freeze({
  /** First come, first seen: the colour is ignored. */
  arrival: (waiting) => first(waiting, (a, b) => a.arrival < b.arrival),
  /** The most urgent colour first, then the earliest arrival: what triage is for. */
  colour: (waiting) => first(waiting, (a, b) => a.colour < b.colour || (a.colour === b.colour && a.arrival < b.arrival)),
  /** The earliest deadline (arrival plus the colour's longest wait) first, the more urgent colour between equals. */
  deadline: (waiting) => first(waiting, (a, b) => deadlineOf(a) < deadlineOf(b) || (deadlineOf(a) === deadlineOf(b) && a.colour < b.colour)),
});

const lastLook = (patient) => patient.reassessedAt ?? patient.arrival;
const overdue = (patient, now) => now - patient.arrival - MAX_WAIT[patient.colour];

/**
 * Whom a free triage nurse looks at again (simulate.js: re-assessment), among the patients due for a look:
 * `(candidates, context) => view`, or null for nobody.
 * @type {Readonly<Record<string, Rule>>}
 */
export const NURSE_RULES = Object.freeze({
  /** A round of the waiting room: the patient left longest without a look, since arriving or the last one. */
  round: (candidates) => first(candidates, (a, b) => lastLook(a) < lastLook(b)),
  /** The most overdue for their colour (waited longest past its longest wait), the more urgent colour between equals. */
  overdue: (candidates, { now }) => first(candidates, (a, b) => overdue(a, now) > overdue(b, now) || (overdue(a, now) === overdue(b, now) && a.colour < b.colour)),
});

export const NURSE_LABELS = Object.freeze({
  none: "personne n'est réévalué",
  round: "le tour de la salle d'attente",
  overdue: "le plus en retard sur sa couleur",
  search: "la recherche choisit",
});

export const RULE_LABELS = Object.freeze({
  arrival: "ordre d'arrivée",
  colour: "couleur, puis arrivée",
  deadline: "échéance la plus proche",
  search: "recherche (ISMCTS)",
});
