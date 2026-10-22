import { MAX_WAIT } from "./hypotheses.js";

/**
 * The reference rules: who goes in when a box and a doctor are free. They see what the department sees
 * (simulate.js): the colour, the arrival, the source. The search will have to beat them, by pairs, on the
 * same shifts.
 */
const first = (waiting, before) => waiting.reduce((best, patient) => (before(patient, best) ? patient : best));
const deadlineOf = (patient) => patient.arrival + MAX_WAIT[patient.colour];

export const RULES = Object.freeze({
  /** First come, first seen: the colour is ignored. */
  arrival: (waiting) => first(waiting, (a, b) => a.arrival < b.arrival),
  /** The most urgent colour first, then the earliest arrival: what triage is for. */
  colour: (waiting) => first(waiting, (a, b) => a.colour < b.colour || (a.colour === b.colour && a.arrival < b.arrival)),
  /** The earliest deadline (arrival plus the colour's longest wait) first, the more urgent colour between equals. */
  deadline: (waiting) => first(waiting, (a, b) => deadlineOf(a) < deadlineOf(b) || (deadlineOf(a) === deadlineOf(b) && a.colour < b.colour)),
});

export const RULE_LABELS = Object.freeze({
  arrival: "ordre d'arrivée",
  colour: "couleur, puis arrivée",
  deadline: "échéance la plus proche",
  search: "recherche (ISMCTS)",
});
