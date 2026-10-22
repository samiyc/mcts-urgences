import { search } from "mcts-commun/mcts.js";
import { createRng } from "mcts-commun/random.js";
import { LATE_WEIGHT, LEVELS, MAX_WAIT } from "./hypotheses.js";
import { RULES } from "./rules.js";
import { arrivals, patientOf } from "./scenario.js";
import { HOLD, choose, cloneShift, hold, nextChoice, scheduleWorsening, viewsOf } from "./simulate.js";

/**
 * The search (ISMCTS, `search` of mcts-commun) choosing who goes in when a box and a doctor are free. It knows
 * what the department knows, and draws the rest again at every iteration (`drawWorld`):
 * - **the true level** of every patient not yet seen, from the colour on the bracelet: triage's error model
 *   (right 8 times in 10, else one level off) times how often each level comes by that source;
 * - **the course to come**: exam and care times, and when a waiting patient would get worse;
 * - **the arrivals not announced yet**, from the department's usual rates (a crisis no one has announced is not
 *   foreseen); the ambulances already announced are known, with their colour.
 * Beside the waiting patients, the search may **wait** for an ambulance announced on its way (`HOLD`): keep
 * the box and the doctor free until something happens. No reference rule does; it is the search's own move.
 * The care in progress is taken as known (when each box will be free). A tree of `depth` choices, the colour
 * rule beyond, each world scored on the late cost of the patients waiting or coming within `horizon` minutes,
 * and played only until they are all in. The root's choices are judged on common worlds (`common` of
 * mcts-commun's search): a whole shift to come is far noisier than the gap between two patients.
 */
export const SEARCH_SETTINGS = Object.freeze({ budget: 100, depth: 2, explore: 0.7, width: 4, horizon: 120, seed: 1, omniscient: 0 });
const NEW = 1_000_000;

/** P(true level | colour, source), levels 1 to 5: triage's error model times the source's mix. */
export function levelOdds(colour, source, settings) {
  const mix = source === "ambulance" ? settings.ambulanceMix : settings.walkInMix;
  const likelihood = (level) => {
    if (level === colour) return settings.triageRight;
    if (Math.abs(level - colour) !== 1) return 0;
    return (1 - settings.triageRight) / [level - 1, level + 1].filter((one) => one >= 1 && one <= 5).length;
  };
  const weights = LEVELS.map((level) => mix[level - 1] * likelihood(level));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return total > 0 ? weights.map((weight) => weight / total) : LEVELS.map((level) => (level === colour ? 1 : 0));
}

function drawLevel(rng, odds) {
  let left = rng.next();
  for (const [i, odd] of odds.entries()) {
    left -= odd;
    if (left < 0) return LEVELS[i];
  }
  return LEVELS[odds.findLastIndex((odd) => odd > 0)];
}

/** Draws again what a patient not yet seen hides: true level, times, worsening. */
function redraw(patient, rng, settings) {
  const level = drawLevel(rng, levelOdds(patient.colour, patient.source, settings));
  Object.assign(patient, {
    level,
    arrivalLevel: level,
    worsened: 0,
    examFactor: Math.exp(settings.spread * rng.normal()),
    stayFactor: Math.exp(settings.spread * rng.normal()),
    worsenDelays: [0, 1, 2].map(() => -settings.worsenAfter * Math.log(1 - rng.next())),
  });
}

/**
 * The true world, as an omniscient judge would see it (`omniscient`: a measure of how much there is to gain,
 * never an assistant: it reads the true levels and the future).
 */
function trueWorld(shift, horizon) {
  const world = cloneShift(shift, () => true);
  const now = shift.events.now;
  world.pending = [...world.patients.values()].filter((patient) => patient.start === null && patient.arrival <= now + horizon).map((patient) => patient.id);
  world.over = false;
  return world;
}

/**
 * A world consistent with what the department knows at this choice (see the module's comment). `peek`, for
 * measures only: "levels" keeps the true levels and times of the patients known, "future" the true arrivals.
 */
export function drawWorld(shift, rng, horizon = Infinity, peek = "") {
  const now = shift.events.now;
  const { settings } = shift;
  const known = (patient) => patient.start !== null || patient.announcedAt <= now;
  const keepsFuture = peek === "future";
  const world = cloneShift(shift, (event) => (peek === "levels" || event.type !== "worsen") && (keepsFuture || event.type !== "arrive" || known(shift.patients.get(event.id))));
  for (const [id, patient] of world.patients) {
    if (!known(patient) && !keepsFuture) world.patients.delete(id);
    else if (patient.start === null && peek !== "levels" && known(patient)) {
      redraw(patient, rng, settings);
      if (world.waiting.includes(id)) scheduleWorsening(world.events, patient, Math.max(now, patient.arrival + MAX_WAIT[patient.level]));
    }
  }
  const comings = keepsFuture ? [] : [
    ...arrivals(rng, settings.walkInRate, now, settings.shift).map((arrival) => ({ arrival, source: "pied", mix: settings.walkInMix })),
    ...arrivals(rng, settings.ambulanceRate, now + settings.announced, settings.shift).map((arrival) => ({ arrival, source: "ambulance", mix: settings.ambulanceMix })),
  ];
  for (const [i, coming] of comings.entries()) {
    const patient = { id: NEW + i, ...patientOf(rng, coming, settings), worsened: 0, start: null, examEnd: null, end: null, box: null };
    patient.arrivalLevel = patient.level;
    world.patients.set(patient.id, patient);
    world.events.schedule(patient.arrival, { type: "arrive", id: patient.id });
  }
  world.pending = [...world.patients.values()].filter((patient) => patient.start === null && patient.arrival <= now + horizon).map((patient) => patient.id);
  world.over = false;
  return world;
}

const allIn = (world) => world.pending.every((id) => world.patients.get(id).start !== null);

/** The colour rule until every patient the search counts is in. */
function rollOut(world) {
  while (!allIn(world) && nextChoice(world)) choose(world, RULES.colour(viewsOf(world)).id);
  return world;
}

/** The late cost of the patients still to be seen when the search began. */
function pendingCost(world) {
  let cost = 0;
  for (const id of world.pending) {
    const patient = world.patients.get(id);
    const start = patient.start ?? world.events.now;
    cost += LATE_WEIGHT[patient.arrivalLevel] * Math.max(0, start - patient.arrival - MAX_WAIT[patient.arrivalLevel]);
  }
  return cost;
}

const deadlineOf = (view) => view.arrival + MAX_WAIT[view.colour];
const byColour = (a, b) => a.view.colour - b.view.colour || a.view.arrival - b.view.arrival;
const byDeadline = (a, b) => deadlineOf(a.view) - deadlineOf(b.view) || a.view.colour - b.view.colour;
const byArrival = (a, b) => a.view.arrival - b.view.arrival;

/** The shortlist: the reference rules' favourites (colour, deadline, arrival), `width` at most, no twice the same. */
function shortlistOf(moves, width) {
  const ranked = [...[...moves].sort(byColour).slice(0, 2), ...[...moves].sort(byDeadline).slice(0, 2), ...[...moves].sort(byArrival).slice(0, 1), ...[...moves].sort(byColour)];
  return [...new Map(ranked.map((move) => [move.key, move])).values()].slice(0, width);
}

const WAIT = Object.freeze({ id: HOLD, key: HOLD });

/** Is an ambulance announced and not yet arrived (the department knows it is coming, and its colour)? */
function onItsWay(world) {
  const now = world.events.now;
  for (const patient of world.patients.values()) if (patient.source === "ambulance" && patient.announcedAt <= now && patient.arrival > now) return true;
  return false;
}

/** The problem the search solves, scored `scale / (scale + cost)`: about ½ for the colour rule's cost. */
function problemFor(scale, { width, horizon, omniscient }) {
  return {
    sample: (shift, rng) => (omniscient === 1 ? trueWorld(shift, horizon) : drawWorld(shift, rng, horizon, ["", "", "levels", "future"][omniscient])),
    actor: () => "service",
    moves: (world) => [...viewsOf(world).map((view) => ({ id: view.id, view, key: view.id >= NEW ? `nouveau-${view.colour}` : String(view.id) })), ...(onItsWay(world) ? [WAIT] : [])],
    shortlist: (world, moves) => [...shortlistOf(moves.filter((move) => move !== WAIT), width), ...moves.filter((move) => move === WAIT)],
    key: (move) => move.key,
    play(world, move) {
      if (move === WAIT) hold(world);
      else choose(world, move.id);
      world.over = allIn(world) || !nextChoice(world);
      return world;
    },
    over: (world) => world.over,
    rollout: rollOut,
    score: (world) => scale / (scale + pendingCost(world)),
  };
}

/** The colour rule's mean cost over a few drawn worlds: the search's scale. */
function scaleOf(shift, rng, horizon, runs = 6) {
  let total = 0;
  for (let i = 0; i < runs; i += 1) total += pendingCost(rollOut(drawWorld(shift, rng, horizon)));
  return Math.max(20, total / runs);
}

/**
 * The search as a rule (simulate.js's signature, reading `context.shift`): a single waiting patient goes in
 * at once; otherwise `budget` iterations, seeded from the shift's clock and its waiting room.
 */
export function searchRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed, omniscient } = { ...SEARCH_SETTINGS, ...options };
  return (waiting, { shift }) => {
    if (waiting.length === 1 && !onItsWay(shift)) return waiting[0];
    const rng = createRng((Math.imul(seed, 0x9e3779b1) + Math.round(shift.events.now * 1000) * 31 + waiting[0].id * 7 + waiting.length) >>> 0);
    const found = search(shift, problemFor(scaleOf(shift, rng, horizon), { width, horizon, omniscient }), { budget, rng, depth, explore, common: true });
    if (found.move === WAIT || found.move?.id === HOLD) return { id: HOLD };
    return waiting.find((view) => view.id === found.move?.id) ?? RULES.colour(waiting);
  };
}
