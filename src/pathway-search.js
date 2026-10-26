import { search } from "mcts-commun/mcts.js";
import { createRng } from "mcts-commun/random.js";
import { LEVELS, MAX_WAIT } from "./hypotheses.js";
import { BREAK_DECIDERS } from "./pathway-fatigue.js";
import { BOARDING_COST, INTERN_LATE } from "./pathway-hypotheses.js";
import { INTERN_RULES } from "./pathway-intern-decided.js";
import { QUEUE_RULES } from "./pathway-queues.js";
import { ALERT_RULES, recalledHours } from "./pathway-alert.js";
import { HET_RULES, hetBedsSince } from "./pathway-het.js";
import { redrawExtras, worldExtras } from "./pathway-extras.js";
import { deathsSince } from "./pathway-deaths.js";
import { epidemicComings, epidemicPatient } from "./pathway-epidemic.js";
import { SAUV_RULES } from "./pathway-sauv.js";
import { idOf } from "./pathway.js";
import { hourAt } from "./pathway-scenario.js";
import { BED_RULES, decide, followed, nextDecision } from "./pathway.js";
import { cloneDay } from "./pathway-clone.js";
import { arrivalsByHour, pathwayOf } from "./pathway-scenario.js";
import { RULES } from "./rules.js";
import { patientOf } from "./scenario.js";
import { levelOdds } from "./search.js";
import { lateCostNow, scheduleWorsening } from "./simulate.js";

/**
 * The search on the detailed pathway (Sami, 26/10/2026, docs/recherche/feuille-de-route.md, step 6): the ISMCTS of
 * mcts-commun choosing who takes a free place and a doctor, as the simple shift's search does (search.js), on a day
 * of the pathway. Every iteration draws a world consistent with what the department knows (`drawWorld`):
 * - **the patients not yet seen**: their true level again from the colour on the bracelet (search.js's `levelOdds`:
 *   triage's error model times the source's mix), and with it their hidden pathway (pathway-scenario.js's
 *   `pathwayOf`: the exams they will need, where they will go) and when they would get worse;
 * - **the arrivals not announced yet**, from the department's usual rates by hour, over the horizon;
 * - the patients already seen are taken as known (their exams and care under way, as the simple shift's search does).
 * A tree of `depth` choices, the colour rule beyond (the bed choices by the bed rule), each world scored on the late
 * cost at the level of the moment of the patients waiting or coming within `horizon` minutes, played until they are
 * all in. The root's choices are judged on common worlds. Not for a day with an intern (whose tasks a world would
 * have to play too).
 */
export const PATHWAY_SEARCH = Object.freeze({ budget: 100, depth: 2, explore: 0.7, width: 4, horizon: 120, seed: 1 });
const NEW = 1_000_000;

function drawLevel(rng, odds) {
  let left = rng.next();
  for (const [i, odd] of odds.entries()) {
    left -= odd;
    if (left < 0) return LEVELS[i];
  }
  return LEVELS[odds.findLastIndex((odd) => odd > 0)];
}

/** A known patient not yet seen: their level, hidden pathway and worsening drawn again from what is seen. */
function redraw(world, patient, rng) {
  const { settings } = world;
  const level = drawLevel(rng, levelOdds(patient.colour, patient.source, settings));
  Object.assign(patient, { level, arrivalLevel: level, worsened: 0, worsenedAt: [], worsenDelays: [0, 1, 2].map(() => -settings.worsenAfter * Math.log(1 - rng.next())) });
  // Isolation (contagious, agitated) and age are seen at the door: they stay; the exams and the exit are drawn again.
  const { isolate, elderly } = patient;
  Object.assign(patient, pathwayOf(rng, patient, settings), { isolate, elderly });
  Object.assign(patient, redrawExtras(rng, patient, settings));
  scheduleWorsening(world.events, patient, Math.max(world.events.now, patient.arrival + MAX_WAIT[level]));
}

/** The patients nobody knows of yet, over the horizon, from the rates by hour. */
function addComings(world, rng, horizon) {
  const { settings } = world;
  const now = world.events.now;
  const window = { from: now, to: Math.min(settings.shift, now + horizon) };
  const comings = [
    ...arrivalsByHour(rng, settings, settings.walkInRate, window).map((arrival) => ({ arrival, source: "pied", mix: settings.walkInMix })),
    ...arrivalsByHour(rng, settings, settings.ambulanceRate, { ...window, from: now + settings.announced }).map((arrival) => ({ arrival, source: "ambulance", mix: settings.ambulanceMix })),
  ];
  const ordinary = comings.map((coming) => {
    const drawn = patientOf(rng, coming, settings);
    const pathway = { ...drawn, ...pathwayOf(rng, drawn, settings) };
    return { ...pathway, ...worldExtras(rng, pathway, settings) };
  });
  const winter = settings.epidemic ? epidemicComings(rng, settings, { ...window, ambulanceFrom: now + settings.announced }).map((coming) => epidemicPatient(rng, coming, settings)).map((patient) => ({ ...patient, ...worldExtras(rng, patient, settings) })) : [];
  [...ordinary, ...winter].forEach((drawn, i) => {
    const patient = followed({ id: NEW + i, ...drawn });
    world.patients.set(patient.id, patient);
    world.events.schedule(patient.arrival, { type: "arrive", id: patient.id });
  });
}

/** A world consistent with what the department knows at this choice, at the same decision. */
export function drawWorld(day, rng, horizon) {
  const now = day.events.now;
  const unknown = (patient) => patient.announcedAt > now;
  const hidden = (event) => event.type === "worsen" || ((event.type === "arrive" || event.type === "announce") && unknown(day.patients.get(event.id)));
  const world = cloneDay(day, (event) => !hidden(event));
  for (const [id, patient] of world.patients) {
    if (unknown(patient)) world.patients.delete(id);
    else if (patient.start === null && patient.exit === null && patient.step !== "coming") redraw(world, patient, rng);
  }
  addComings(world, rng, horizon);
  world.pending = [...world.patients.values()].filter((patient) => patient.start === null && patient.exit === null && patient.arrival <= now + horizon).map((patient) => patient.id);
  // Who waits for a bed now: the search choosing the beds counts their wait too.
  world.boarders = Object.values(world.wards).flatMap((ward) => ward.waiting);
  world.decision = nextDecision(world);
  return world;
}

/** Every patient waiting for a bed when the search began has one, or is gone. */
const allBedded = (world) => world.boarders.every((id) => world.patients.get(id).bedAt !== undefined || world.patients.get(id).exit !== null);

const allIn = (world) => world.pending.every((id) => world.patients.get(id).start !== null || world.patients.get(id).exit !== null);

/** Whether the search chooses this decision: a box's always; a bed's with `beds`; a break's with `breaks`. */
const IN_TREE = { box: () => true, bed: (rules) => rules.beds, break: (rules) => rules.breaks, intern: (rules) => rules.interns, queue: (rules) => rules.queues, alert: (rules) => rules.alerts, het: (rules) => rules.hets, sauv: (rules) => rules.sauvs };
const inTree = (decision, rules) => Boolean(IN_TREE[decision.kind](rules));

/** A decision's answer by its rule in the worlds: the colour rule, the bed rule, the break « au creux ». */
function ruled(world, decision, { bed }) {
  const rule = { box: RULES.colour, bed, break: BREAK_DECIDERS.quiet, intern: INTERN_RULES.dueFirst, queue: QUEUE_RULES.colour, alert: ALERT_RULES.threshold, het: HET_RULES.threshold, sauv: SAUV_RULES.never }[decision.kind];
  return idOf(decision, rule(decision.candidates, { day: world }));
}

/** Plays the decision with `id`, then the day to its next decision the search chooses, the others by their rule. */
function advance(world, id, rules) {
  decide(world, world.decision, id);
  world.decision = nextDecision(world);
  while (world.decision && !inTree(world.decision, rules)) {
    decide(world, world.decision, ruled(world, world.decision, rules));
    world.decision = nextDecision(world);
  }
  return world;
}

/**
 * The wait for a bed of the patients waiting for one when the search began, until their bed (BOARDING_COST: a minute
 * on a stretcher, more for a patient of 75 or more at night, « No Bed Night »): what the bed search adds to its score.
 */
function boardingCost(world, from) {
  const hour = hourAt(world.settings, from);
  const night = hour >= 20 || hour < 8;
  let cost = 0;
  for (const id of world.boarders) {
    const patient = world.patients.get(id);
    const weight = BOARDING_COST.perMinute * (night && patient.elderly ? BOARDING_COST.elderlyAtNight : 1);
    cost += weight * Math.max(0, (patient.bedAt ?? patient.exitAt ?? world.events.now) - from);
  }
  return cost;
}

function pendingCost(world) {
  let cost = 0;
  for (const id of world.pending) {
    const patient = world.patients.get(id);
    cost += lateCostNow(patient, patient.start ?? patient.exitAt ?? world.events.now);
  }
  return cost;
}

const keyOf = (view) => (view.id >= NEW ? `nouveau-${view.colour}` : String(view.id));
const deadlineOf = (view) => view.arrival + MAX_WAIT[view.colour];
/** The shortlist: the reference rules' favourites (colour, deadline, arrival), `width` at most. */
function shortlistOf(moves, width) {
  const by = (order) => [...moves].sort(order);
  const ranked = [...by((a, b) => a.view.colour - b.view.colour || a.view.arrival - b.view.arrival).slice(0, 2), ...by((a, b) => deadlineOf(a.view) - deadlineOf(b.view)).slice(0, 2), ...by((a, b) => a.view.arrival - b.view.arrival)];
  return [...new Map(ranked.map((move) => [move.key, move])).values()].slice(0, width);
}

const BREAK_MOVES = Object.freeze([Object.freeze({ id: "now", key: "pause-maintenant", whole: true }), Object.freeze({ id: "later", key: "pause-plus-tard", whole: true })]);

/** The moves of the decision the world stands at: a box's patients, or (when the search chooses them) a bed's, a break's. */
const MOVES_OF = {
  box: (decision) => decision.candidates.map((view) => ({ id: view.id, view, key: keyOf(view) })),
  bed: (decision) => decision.candidates.map((view) => ({ id: view.id, view, key: `lit-${view.id}`, whole: true })),
  break: () => [...BREAK_MOVES],
  alert: () => [{ id: "now", key: "plan-maintenant", whole: true }, { id: "later", key: "plan-plus-tard", whole: true }],
  het: () => [{ id: "now", key: "het-maintenant", whole: true }, { id: "later", key: "het-plus-tard", whole: true }],
  sauv: (decision) => decision.candidates.map((view) => ({ id: view.id, view, key: `sauv-${view.id}`, whole: true })),
  intern: (decision) => decision.candidates.map((view) => ({ id: view.id, view, key: `tâche-${view.id}`, whole: true })),
  queue: (decision) => decision.candidates.map((view) => ({ id: view.id, view, key: `${decision.pool}-${view.id}`, whole: true })),
};

function movesOf(world, rules) {
  const { decision } = world;
  return decision && inTree(decision, rules) ? MOVES_OF[decision.kind](decision) : [];
}

/**
 * How late the intern's tasks were in a world (INTERN_LATE a minute past due, H52): those done in it, and those still
 * open at its end. What the search choosing the intern's tasks adds to its score.
 */
function internLateness(world) {
  const now = world.events.now;
  const late = (task, at) => Math.max(0, at - task.due);
  const done = world.intern.done.reduce((sum, task) => sum + late(task, task.at), 0);
  const open = world.intern.tasks.reduce((sum, task) => sum + late(task, now), 0);
  return INTERN_LATE.perMinute * (done + open);
}

/**
 * A world's cost: the late cost, the wait for a bed when the search chooses beds or the HET, the intern's lateness for
 * their tasks, the crisis plan's doctor-hours, the HET's beds (HET.bedCost, H65).
 * @param {any} world
 * @param {SearchFlags} flags
 * @param {number} from
 */
const costOf = (world, { beds, interns, alerts, hets }, from) => pendingCost(world) + (beds || hets ? boardingCost(world, from) : 0) + (interns ? internLateness(world) : 0) + (alerts ? alertCost(world, from) : 0) + (hets ? hetBedsSince(world, from) * world.settings.het.bedCost : 0) + deathCost(world, from);

/** The deaths in a world after its start, at their weight (DEATHS.cost), on a day with deaths. */
const deathCost = (world, from) => (world.settings.deaths ? deathsSince(world, from) * world.settings.deaths.cost : 0);

/** The doctor-hours the crisis plan called back over the world, at their weight (ALERT.doctorHour, H55). */
const alertCost = (world, from) => (recalledHours(world, world.events.now) - recalledHours(world, from)) * world.settings.alert.doctorHour;

/**
 * The decisions the search chooses besides the box's, each absent or false when it does not.
 * @typedef {{ beds?: boolean, breaks?: boolean, interns?: boolean, queues?: boolean, alerts?: boolean, hets?: boolean, sauvs?: boolean }} SearchFlags
 */

/**
 * The problem the search solves on the day, scored `scale / (scale + cost)`; `beds`, `breaks`: the bed decisions, the
 * break decisions are moves too.
 * @param {{ scale: number, width: number, horizon: number, bed: Function, from?: number } & SearchFlags} options
 */
export function problemFor({ scale, width, horizon, bed, from = 0, ...flags }) {
  /** @type {SearchFlags & { bed: Function }} */
  const rules = { bed, ...flags };
  const { beds, interns, alerts, hets } = rules;
  const cost = (world) => costOf(world, rules, from);
  // A world is played until its patients are in; choosing the beds, until those waiting for one have it (or the
  // horizon); choosing the intern's tasks, over the horizon.
  const done = (world) => (interns || alerts || hets ? world.events.now > from + horizon : allIn(world) && (!beds || allBedded(world) || world.events.now > from + horizon));
  return {
    sample: (day, rng) => drawWorld(day, rng, horizon),
    actor: () => "service",
    moves: (world) => movesOf(world, rules),
    shortlist: (world, moves) => (moves[0]?.whole ? moves : shortlistOf(moves, width)),
    key: (move) => move.key,
    play: (world, move) => advance(world, move.id, rules),
    over: (world) => done(world) || world.decision === null,
    rollout(world) {
      while (!done(world) && world.decision) advance(world, ruled(world, world.decision, rules), rules);
      return world;
    },
    score: (world) => scale / (scale + cost(world)),
  };
}

/**
 * The colour rule's cost on a few worlds: the score's scale, so that the rule scores about ½.
 * @param {any} day
 * @param {any} rng
 * @param {{ horizon: number, bed: Function } & SearchFlags} options
 */
export function scaleOf(day, rng, { horizon, bed, ...flags }) {
  const from = day.events.now;
  let total = 0;
  for (let i = 0; i < 3; i += 1) {
    const world = problemFor({ scale: 1, width: 1, horizon, bed, from, ...flags }).rollout(drawWorld(day, rng, horizon));
    total += costOf(world, flags, from);
  }
  return Math.max(20, total / 3);
}

/**
 * The search as a box rule of the pathway (runPathway's signature, reading `context.day`): one candidate goes in at
 * once; otherwise `budget` iterations, seeded from the day's clock and the candidates. `bed`: the bed rule of the worlds.
 */
export function pathwaySearchRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed } = { ...PATHWAY_SEARCH, ...options };
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (candidates.length === 1) return candidates[0];
    if (day.intern && !day.settings.internDecided) throw new Error("la recherche du parcours ne joue pas une journée avec un interne pas à pas");
    const rng = createRng((Math.imul(seed, 0x9e3779b1) + Math.round(day.events.now * 1000) * 31 + Number(candidates[0].id) * 7 + candidates.length) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed });
    const found = search(day, problemFor({ scale, width, horizon, bed }), { budget, rng, depth, explore, common: true });
    return candidates.find((view) => view.id === found.move?.id) ?? RULES.colour(candidates);
  };
}
