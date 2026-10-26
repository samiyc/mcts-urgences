import { createEvents } from "mcts-commun/events.js";
import { HANDLERS } from "./pathway-handlers.js";
import { account, keepPeaks } from "./pathway-measures.js";
import { POOLS, free, moveTo, now, placeFor, removeFrom, startReview, take, walkDelay } from "./pathway-places.js";
import { BREAK_DECIDERS, breakDecision, breakTimes, decideBreak, slowOf, startFatigue } from "./pathway-fatigue.js";
import { drop, startIntern } from "./pathway-intern.js";
import { INTERN_RULES, decideIntern, internDecision } from "./pathway-intern-decided.js";
import { QUEUE_RULES, decideQueue, queueDecision } from "./pathway-queues.js";
import { ALERT_RULES, alertDecision, decideAlert, startAlert } from "./pathway-alert.js";
import { HET_RULES, decideHet, hetDecision, startHet } from "./pathway-het.js";
import { SAUV_RULES, decideSauv, sauvDecision } from "./pathway-sauv.js";
import { noteLent, startIsolation } from "./pathway-isolation.js";
import { startPorters } from "./pathway-porters.js";
import { hourAt } from "./pathway-scenario.js";
import { serve, startBreak } from "./pathway-serve.js";
import { PLACES } from "./pathway-plans.js";
import { layoutOf } from "./pathway-cells.js";
import { doctorTo, startTrace } from "./pathway-trace.js";

/** @typedef {import("./types.js").BedRule} BedRule */
/** @typedef {import("./types.js").Day} Day */
/** @typedef {import("./types.js").Decision} Decision */
/** @typedef {import("./types.js").PathwayPatient} PathwayPatient */
/** @typedef {import("./types.js").Rule} Rule */

/**
 * The detailed pathway (Sami, 25/10/2026, docs/recherche/feuille-de-route.md, step 1): a day of the department, each
 * patient followed from arrival to exit, next to the simple shift (simulate.js), which stays as it was. A
 * discrete-event simulation (`events` of mcts-commun), minutes from `startHour`.
 *
 * A patient arrives (an ambulance may be sent elsewhere first, while the department is saturated), registers at the
 * reception, is triaged by the IOA (the colour), then waits for **a place and a doctor**: the SAUV for a red, the
 * isolation room for a patient to isolate, else a box (the SAUV or the room full: a box). A patient triaged 3 to 5
 * may leave before. The doctor examines; then the exams of the patient's hidden pathway: biology (a sample, the lab's
 * turnaround), the scanner (one patient at a time), a specialist's advice (on call: they come, then advise). When
 * every result is back, a doctor reads them (`review`); then the care, in the place; then the exit: home, the UHCD
 * (a night of watching, some then admitted), a downstream bed (a ward), the operating theatre, a transfer. **A patient
 * waiting for a bed keeps their box** (boarding), or moves to the UHCD if a bed is free there. A place left is
 * cleaned before the next patient.
 *
 * **Two kinds of decisions are left to a rule** (`nextDecision`): who takes a free place and doctor ("box"), and who
 * takes a bed a ward frees ("bed"). Everything else follows fixed orders (the scanner and the specialists: colour,
 * then the order; the theatre: reds first). A rule sees only what the department sees: the colour, the arrival, the
 * source; for a bed, when the admission was decided, where the patient waits, whether they are 75 or more.
 *
 * The parts: the places and pools (pathway-places.js), the events (pathway-handlers.js), the fixed orders
 * (pathway-serve.js), the bed rules (pathway-beds.js), the measures (pathway-measures.js).
 */

export const STEPS = Object.freeze({
  coming: "en route",
  register: "attend l'inscription",
  triage: "attend le tri",
  waiting: "attend un box",
  exam: "examiné",
  exams: "attend ses examens",
  review: "attend la lecture des résultats",
  care: "en soins",
  theatre: "attend le bloc",
  transfer: "attend son transfert",
  uhcdWait: "attend une place en UHCD",
  uhcd: "en UHCD",
  bed: "attend un lit",
  leaving: "part dans son lit",
  med: "attend son médicament",
  out: "sorti",
});

/**
 * A drawn patient as the day starts following them.
 * @param {PathwayPatient} patient
 * @returns {PathwayPatient}
 */
export const followed = (patient) => ({
  ...patient,
  arrivalLevel: patient.level,
  worsened: 0,
  worsenedAt: [],
  step: "coming",
  place: null,
  start: null,
  exit: null,
  exitAt: null,
  pending: 0,
  triagedAt: null,
  orderedAt: null,
  reviewedAt: null,
  admitAt: null,
  uhcdAt: null,
  boxBoarding: 0,
});

function scheduleArrivals(events, patients) {
  for (const patient of patients.values()) {
    if (patient.source === "ambulance" && patient.announcedAt < patient.arrival) events.schedule(patient.announcedAt, { type: "announce", id: patient.id });
    events.schedule(patient.arrival, { type: "arrive", id: patient.id });
  }
}

/** Each ward's free beds and waiting patients, and the beds it frees during the day. */
function wardsOf(day, events) {
  /** @type {Day["wards"]} */
  const wards = {};
  for (const [ward, { free: beds }] of Object.entries(day.settings.wards)) {
    wards[ward] = { free: beds, waiting: [] };
    for (const at of day.beds[ward] ?? []) events.schedule(at, { type: "bedFreed", ward });
  }
  return wards;
}

/** The day's extra doctors come and go at their hours, each day of the shift and the overtime. */
function scheduleDayDoctors(settings, events, capacity) {
  const { from, to, extra } = settings.dayDoctors ?? { extra: 0 };
  for (let day = 0; extra > 0 && day * 1440 < settings.shift + settings.overtime; day += 1) {
    const at = (hour) => (day * 24 + hour - settings.startHour) * 60;
    if (at(from) >= 0) events.schedule(at(from), { type: "staff", doctors: extra });
    else if (at(to) > 0) capacity.doctors += extra;
    if (at(to) >= 0) events.schedule(at(to), { type: "staff", doctors: -extra });
  }
}

/** The doctors' fatigue (step 4), its windows for breaks and its handovers scheduled; null without fatigue. */
function startFatigueOf(settings, events) {
  const fatigue = startFatigue(settings);
  if (!fatigue) return null;
  const end = settings.shift + settings.overtime;
  // The breaks of the day simulated; its overtime finishes the work.
  fatigue.slots = breakTimes(settings).filter((slot) => slot.from < settings.shift);
  for (const slot of fatigue.slots) for (const at of [slot.from, slot.last]) events.schedule(at, { type: "breakCheck" });
  // A team ends its shift (24 h, or 12 h): the next one takes over.
  for (let at = settings.fatigue.teams * 60; at < end; at += settings.fatigue.teams * 60) events.schedule(at, { type: "handover" });
  return fatigue;
}

const perPool = () => Object.fromEntries(POOLS.map((pool) => [pool, 0]));

/**
 * The start of a day: `day` drawn by `drawPathwayDay` (pathway-scenario.js); nothing has happened yet.
 * @param {{ settings: object, patients: PathwayPatient[], beds: Record<string, number[]> }} day
 * @returns {Day}
 */
export function startPathway(day) {
  const { settings } = day;
  const events = createEvents();
  const patients = new Map(day.patients.map((patient) => [patient.id, followed(patient)]));
  scheduleArrivals(events, patients);
  const wards = wardsOf(day, events);
  const capacity = { ...settings.capacity, boxes: settings.boxes, doctors: settings.doctors };
  scheduleDayDoctors(settings, events, capacity);
  return {
    settings,
    events,
    patients,
    wards,
    capacity,
    busy: perPool(),
    // Busy minutes, and minutes full, of each pool.
    used: perPool(),
    full: perPool(),
    clock: 0,
    queues: { register: [], triage: [], waiting: [], scanner: [], specialists: [], theatre: [], review: [], uhcd: [], transport: [] },
    porters: startPorters(settings),
    intern: startIntern(settings, layoutOf(settings.plan)),
    fatigue: startFatigueOf(settings, events),
    alert: startAlert(settings),
    het: startHet(settings),
    isolation: startIsolation(settings),
    diverted: new Set(),
    peak: { waiting: 0, present: 0, urgent: 0 },
    over: false,
    // The state every few minutes, for the day's timeline (pathway-timeline.js, step 5).
    series: [],
    nextSample: 0,
    trace: startTrace(capacity, Object.keys(PLACES), layoutOf(settings.plan)),
  };
}

/** What a box rule sees of a waiting patient. */
const viewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, source: patient.source });
/** What a bed rule sees of a patient waiting for a bed. */
const bedViewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, admitAt: patient.admitAt, inBox: patient.place === "boxes" || patient.place === "sauv" || patient.place === "isolation", elderly: patient.elderly });

function giveBed(day, ward, id) {
  const patient = day.patients.get(id);
  if (!removeFrom(day.wards[ward].waiting, id)) throw new Error("la règle doit choisir un patient qui attend un lit de ce service");
  day.wards[ward].free -= 1;
  Object.assign(patient, { bedAt: now(day), step: "leaving" });
  day.events.schedule(now(day) + day.settings.toBed, { type: "toBed", id });
}

/** The box decision, or null; without `reviewFirst`, a free doctor reads results only when nobody can be taken in. */
function boxDecision(day) {
  if (free(day, "doctors") <= 0) return null;
  const candidates = day.queues.waiting.map((id) => day.patients.get(id)).filter((patient) => placeFor(day, patient));
  if (candidates.length) return { kind: "box", candidates: candidates.map(viewOf) };
  if (!day.settings.reviewFirst && day.queues.review.length) startReview(day, day.queues.review.shift());
  return null;
}

/** The first ward with a bed and two patients or more waiting for it; a patient alone takes it at once. */
function bedDecision(day) {
  for (const [ward, { free: beds, waiting }] of Object.entries(day.wards)) {
    if (beds <= 0 || waiting.length === 0) continue;
    if (waiting.length > 1) return { kind: "bed", ward, candidates: waiting.map((id) => bedViewOf(day.patients.get(id))) };
    giveBed(day, ward, waiting[0]);
    return decisionAt(day);
  }
  return null;
}

/**
 * The decision the day is at, or null: `{ kind: "box", candidates }` (views of the waiting patients a place is free
 * for, a doctor free), or `{ kind: "bed", ward, candidates }` (a ward has a bed, two patients or more wait for it).
 */
const decisionAt = (day) => sauvDecision(day) ?? boxDecision(day) ?? bedDecision(day) ?? queueDecision(day) ?? hetDecision(day) ?? alertDecision(day) ?? breakDecision(day) ?? internDecision(day);

/** Whether the day is over: past the overtime, or nothing left to happen and no task left to the intern. */
const endsNow = (day, next, end) => (next ? next.at > end : (day.intern?.tasks.length ?? 0) === 0);

/**
 * Runs the day to its next decision (see `decisionAt`), or null once nothing is left to happen (or the overtime is over),
 * or once the next event is past `until` (the day goes on later: pathway-game.js plays it a step at a time).
 * @param {Day} day
 * @param {number} [until]
 * @returns {Decision | null}
 */
export function nextDecision(day, until = Infinity) {
  for (;;) {
    serve(day);
    const decision = decisionAt(day);
    if (decision) return decision;
    keepPeaks(day);
    if (!handleNext(day, until)) return null;
  }
}

/** Handles the day's next event; false when the day is over, or its next event is past `until`. */
function handleNext(day, until) {
  const end = day.settings.shift + day.settings.overtime;
  const next = day.events.peek();
  if (endsNow(day, next, end)) {
    account(day, next ? end : day.clock);
    day.over = true;
    return false;
  }
  if (!next || next.at > until) return false;
  day.events.next();
  account(day, next.at);
  const { event } = next;
  HANDLERS[event.type](day, event.id === undefined ? event : day.patients.get(event.id), event);
  return true;
}

/** The decisions other than a box's: a bed, a break, the intern's next task, the scanner's or the theatre's order. */
const DECIDE = {
  bed: (day, decision, id) => giveBed(day, decision.ward, id),
  break: (day, decision, id) => decideBreak(day, decision, id, startBreak),
  intern: (day, _, id) => decideIntern(day, id),
  queue: (day, decision, id) => decideQueue(day, decision, id),
  alert: (day, _, id) => decideAlert(day, id),
  het: (day, _, id) => decideHet(day, id),
  sauv: (day, _, id) => decideSauv(day, id),
};

/**
 * Applies a decision: `id` takes the free place and a doctor ("box"), or the ward's bed ("bed").
 * @param {Day} day
 * @param {Decision} decision
 * @param {number} id
 */
export function decide(day, decision, id) {
  if (decision.kind !== "box") return DECIDE[decision.kind](day, decision, id);
  const patient = day.patients.get(id);
  const place = patient && day.queues.waiting.includes(id) ? placeFor(day, patient) : null;
  if (!place || free(day, "doctors") <= 0) throw new Error("la règle doit choisir un patient qui attend, pour qui une place est libre");
  removeFrom(day.queues.waiting, id);
  drop(day, id, ["vitals"]);
  noteLent(day, patient, place);
  const walked = moveTo(day, patient, place);
  take(day, "doctors");
  const fetched = doctorTo(day, id);
  // The exam starts once the patient and the doctor are both at the place (at once unless walking counts).
  const start = now(day) + walkDelay(day, Math.max(walked, fetched));
  Object.assign(patient, { start, levelAtStart: patient.level, step: "exam" });
  const exam = day.settings.exam[patient.level] * patient.examFactor * slowOf(day, day.trace.doctors.indexOf(id));
  day.events.schedule(start + exam, { type: "examEnd", id });
}

/**
 * Plays `day` to its end: the box choices by `rules.box` (a rule of rules.js), the bed choices by `rules.bed` (BED_RULES).
 * @param {Day} day
 * @param {{ box: Rule, bed: BedRule, breaks?: Function, intern?: Function, queue?: Function, alert?: Function, het?: Function, sauv?: Function }} rules
 * @returns {Day}
 */
export function runPathway(day, rules) {
  for (let decision = nextDecision(day); decision; decision = nextDecision(day)) choose(day, decision, rules);
  return day;
}

/** A chosen candidate's id as `decide` takes it: a patient's or a task's number, or a word (« now », « none »…). */
export const idOf = (decision, chosen) => (typeof chosen.id === "string" ? chosen.id : Number(chosen.id));

/**
 * A decision taken by its rule: the box rule, the bed rule, the break decider (« au creux » by default).
 * @param {Day} day
 * @param {Decision} decision
 * @param {{ box: Function, bed: Function, breaks?: Function, intern?: Function, queue?: Function, alert?: Function, het?: Function, sauv?: Function }} rules
 */
export function choose(day, decision, { box, bed, breaks = BREAK_DECIDERS.quiet, intern = INTERN_RULES.dueFirst, queue = QUEUE_RULES.colour, alert = ALERT_RULES.threshold, het = HET_RULES.threshold, sauv = SAUV_RULES.never }) {
  const context = { now: now(day), day };
  const rule = { box, bed, break: breaks, intern, queue, alert, het, sauv }[decision.kind];
  decide(day, decision, idOf(decision, rule(decision.candidates, context)));
}

/**
 * Plays `day` up to minute `until`, the choices by `rules` (runPathway's): the intern acts between two such calls.
 * @param {Day} day
 * @param {number} until
 * @param {{ box: Rule, bed: BedRule, breaks?: Function, intern?: Function, queue?: Function, alert?: Function, het?: Function, sauv?: Function }} rules
 */
export function runUntil(day, until, rules) {
  if (day.over) return day;
  day.events.schedule(until, { type: "tick" });
  for (let decision = nextDecision(day, until); decision; decision = nextDecision(day, until)) choose(day, decision, rules);
  return day;
}

export { BED_LABELS, BED_RULES } from "./pathway-beds.js";
export { pathwayMeasures } from "./pathway-measures.js";
export { hourAt };
