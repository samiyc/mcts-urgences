import { search } from "mcts-commun/mcts.js";
import { createRng } from "mcts-commun/random.js";
import { LEVELS, MAX_WAIT } from "./hypotheses.js";
import { BOARDING_COST } from "./pathway-hypotheses.js";
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
  comings.forEach((coming, i) => {
    const drawn = patientOf(rng, coming, settings);
    const patient = followed({ id: NEW + i, ...drawn, ...pathwayOf(rng, drawn, settings) });
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

/**
 * Plays the decision with `id`, then the day to its next decision: a box's, the bed decisions by the bed rule; or
 * either kind with `beds` (the search choosing the beds as well).
 */
function advance(world, id, { bed, beds }) {
  decide(world, world.decision, id);
  world.decision = nextDecision(world);
  while (!beds && world.decision?.kind === "bed") {
    decide(world, world.decision, Number(bed(world.decision.candidates).id));
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

/** The moves of the decision the world stands at: a box's patients, or (when the search chooses them) a bed's. */
function movesOf(world, beds) {
  const { decision } = world;
  if (decision?.kind === "box") return decision.candidates.map((view) => ({ id: view.id, view, key: keyOf(view) }));
  return beds && decision?.kind === "bed" ? decision.candidates.map((view) => ({ id: view.id, view, key: `lit-${view.id}`, bed: true })) : [];
}

/** The problem the search solves on the day, scored `scale / (scale + cost)`; `beds`: the bed decisions are moves too. */
function problemFor({ scale, width, horizon, bed, beds = false, from = 0 }) {
  const rules = { bed, beds };
  const cost = (world) => pendingCost(world) + (beds ? boardingCost(world, from) : 0);
  // A world is played until its patients are in; choosing the beds, until those waiting for one have it (or the horizon).
  const done = (world) => allIn(world) && (!beds || allBedded(world) || world.events.now > from + horizon);
  return {
    sample: (day, rng) => drawWorld(day, rng, horizon),
    actor: () => "service",
    moves: (world) => movesOf(world, beds),
    shortlist: (world, moves) => (moves[0]?.bed ? moves : shortlistOf(moves, width)),
    key: (move) => move.key,
    play: (world, move) => advance(world, move.id, rules),
    over: (world) => done(world) || world.decision === null,
    rollout(world) {
      while (!done(world) && world.decision) {
        const rule = world.decision.kind === "box" ? RULES.colour : bed;
        advance(world, Number(rule(world.decision.candidates).id), rules);
      }
      return world;
    },
    score: (world) => scale / (scale + cost(world)),
  };
}

/** The colour rule's cost on a few worlds: the score's scale, so that the rule scores about ½. */
function scaleOf(day, rng, { horizon, bed, beds = false }) {
  const from = day.events.now;
  let total = 0;
  for (let i = 0; i < 3; i += 1) {
    const world = problemFor({ scale: 1, width: 1, horizon, bed, beds, from }).rollout(drawWorld(day, rng, horizon));
    total += pendingCost(world) + (beds ? boardingCost(world, from) : 0);
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
    if (day.intern) throw new Error("la recherche du parcours ne joue pas une journée avec un interne");
    const rng = createRng((Math.imul(seed, 0x9e3779b1) + Math.round(day.events.now * 1000) * 31 + Number(candidates[0].id) * 7 + candidates.length) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed });
    const found = search(day, problemFor({ scale, width, horizon, bed }), { budget, rng, depth, explore, common: true });
    return candidates.find((view) => view.id === found.move?.id) ?? RULES.colour(candidates);
  };
}

/**
 * The search as a bed rule of the pathway (runPathway's `bed`, reading `context.day`): who takes the bed a ward frees,
 * the box choices that follow by the colour rule; one patient waiting takes it at once. Scored on the late cost and the
 * wait for a bed (`boardingCost`). Not for a day with an intern.
 */
export function pathwaySearchBedRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed } = { ...PATHWAY_SEARCH, ...options };
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (candidates.length === 1) return candidates[0];
    if (day.intern) throw new Error("la recherche du parcours ne joue pas une journée avec un interne");
    const rng = createRng((Math.imul(seed, 0x85ebca6b) + Math.round(day.events.now * 1000) * 37 + Number(candidates[0].id) * 11 + candidates.length) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, beds: true });
    const found = search(day, problemFor({ scale, width, horizon, bed, beds: true, from: day.events.now }), { budget, rng, depth, explore, common: true });
    return candidates.find((view) => view.id === found.move?.id) ?? bed(candidates);
  };
}
