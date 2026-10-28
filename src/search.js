import { createRng } from "mcts-commun/random.js";
import { LATE_WEIGHT, LEVELS, MAX_WAIT } from "./hypotheses.js";
import { NURSE_RULES, RULES } from "./rules.js";
import { arrivals, patientOf } from "./scenario.js";
import { searchTried } from "./search-trials.js";
import { HOLD, act, candidateViewsOf, choose, cloneShift, hold, lateCostNow, nextChoice, reassess, rest, scheduleWorsening, viewsOf } from "./simulate.js";

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
 *
 * With a triage nurse (`nurses`), the search also chooses whom the nurse looks at again, or nobody: a patient
 * looked at has a known level (the bracelet's new colour) in every world drawn after. In the playouts nobody
 * is looked at again. `measure` scores the worlds on the late cost at arrival ("arrival", the first results'
 * score) or at the level of the moment ("now", `lateCostNow`: worsening while waiting counts).
 */
export const SEARCH_SETTINGS = Object.freeze({ budget: 100, depth: 2, explore: 0.7, width: 4, horizon: 120, seed: 1, omniscient: 0, measure: "arrival" });
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

/**
 * Draws again what a patient not yet seen hides: true level, times, worsening. A patient the nurse looked at
 * again has the level the bracelet shows now, taken as their level since arrival.
 */
function redraw(patient, rng, settings) {
  const drawn = drawLevel(rng, levelOdds(patient.colour, patient.source, settings));
  const level = patient.reassessedAt === null || patient.reassessedAt === undefined ? drawn : patient.colour;
  Object.assign(patient, {
    level,
    arrivalLevel: level,
    worsened: 0,
    worsenedAt: [],
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
  const known = (patient) => patient.start !== null || patient.announcedAt <= now;
  const keepsFuture = peek === "future";
  const world = cloneShift(shift, (event) => (peek === "levels" || event.type !== "worsen") && (keepsFuture || event.type !== "arrive" || known(shift.patients.get(event.id))));
  redrawKnown(world, rng, { known, peek });
  if (!keepsFuture) addComings(world, rng);
  world.pending = [...world.patients.values()].filter((patient) => patient.start === null && patient.arrival <= now + horizon).map((patient) => patient.id);
  world.over = false;
  return world;
}

/** The patients nobody knows of are left out (unless `peek` keeps the future); the known ones not yet seen redrawn. */
function redrawKnown(world, rng, { known, peek }) {
  for (const [id, patient] of world.patients) {
    if (!known(patient) && peek !== "future") world.patients.delete(id);
    else if (patient.start === null && peek !== "levels" && known(patient)) redrawWaiting(world, patient, rng);
  }
}

/** A known patient not yet seen: their level drawn again from what is seen, and their worsening if waiting. */
function redrawWaiting(world, patient, rng) {
  redraw(patient, rng, world.settings);
  if (world.waiting.includes(patient.id)) scheduleWorsening(world.events, patient, Math.max(world.events.now, patient.arrival + MAX_WAIT[patient.level]));
}

/** The patients nobody knows of yet, drawn from the rates until the shift's end. */
function addComings(world, rng) {
  const { settings } = world;
  const now = world.events.now;
  const comings = [
    ...arrivals(rng, settings.walkInRate, now, settings.shift).map((arrival) => ({ arrival, source: "pied", mix: settings.walkInMix })),
    ...arrivals(rng, settings.ambulanceRate, now + settings.announced, settings.shift).map((arrival) => ({ arrival, source: "ambulance", mix: settings.ambulanceMix })),
  ];
  for (const [i, coming] of comings.entries()) {
    const drawn = patientOf(rng, coming, settings);
    const patient = { id: NEW + i, ...drawn, arrivalLevel: drawn.level, worsened: 0, worsenedAt: [], firstColour: null, looks: 0, reassessedAt: null, assessing: false, recoloured: false, start: null, examEnd: null, end: null, box: null };
    world.patients.set(patient.id, patient);
    world.events.schedule(patient.arrival, { type: "arrive", id: patient.id });
  }
}

const allIn = (world) => world.pending.every((id) => world.patients.get(id).start !== null);

/** The colour rule until every patient the search counts is in; nobody is looked at again. */
function rollOut(world) {
  while (!allIn(world) && nextChoice(world)) act(world, world.kind, RULES.colour, null);
  return world;
}

/** The late cost of the patients still to be seen when the search began, at arrival or at the level of the moment. */
function pendingCost(world, measure = "arrival") {
  let cost = 0;
  for (const id of world.pending) {
    const patient = world.patients.get(id);
    const start = patient.start ?? world.events.now;
    cost += measure === "now" ? lateCostNow(patient, start) : LATE_WEIGHT[patient.arrivalLevel] * Math.max(0, start - patient.arrival - MAX_WAIT[patient.arrivalLevel]);
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
const NOBODY = Object.freeze({ id: null, key: "personne" });
const keyOf = (view) => (view.id >= NEW ? `nouveau-${view.colour}` : String(view.id));

/** The nurse's shortlist: the reference nurse rules' favourites, then the most urgent colours; and nobody. */
function nurseShortlistOf(world, moves, width) {
  const views = moves.map((move) => move.view);
  const context = { now: world.events.now };
  const favourites = [NURSE_RULES.overdue(views, context), NURSE_RULES.round(views, context)];
  const ranked = [...favourites.map((view) => moves.find((move) => move.view === view)), ...[...moves].sort(byColour)];
  return [...new Map(ranked.map((move) => [move.key, move])).values()].slice(0, width);
}

/** Is an ambulance announced and not yet arrived (the department knows it is coming, and its colour)? */
function onItsWay(world) {
  const now = world.events.now;
  for (const patient of world.patients.values()) if (patient.source === "ambulance" && patient.announcedAt <= now && patient.arrival > now) return true;
  return false;
}

/** The moves of the choice `world` stands at: a box's patients (and the wait), or the nurse's (and nobody). */
function movesOf(world) {
  if (world.kind === "nurse") return [...candidateViewsOf(world).map((view) => ({ id: view.id, view, key: `revoir-${keyOf(view)}` })), NOBODY];
  return [...viewsOf(world).map((view) => ({ id: view.id, view, key: keyOf(view) })), ...(onItsWay(world) ? [WAIT] : [])];
}

function shortlistFor(world, moves, width) {
  const special = moves.filter((move) => move === WAIT || move === NOBODY);
  const patients = moves.filter((move) => move !== WAIT && move !== NOBODY);
  return [...(world.kind === "nurse" ? nurseShortlistOf(world, patients, width) : shortlistOf(patients, width)), ...special];
}

function playMove(world, move) {
  if (move === WAIT) hold(world);
  else if (move === NOBODY) rest(world);
  else if (world.kind === "nurse") reassess(world, move.id);
  else choose(world, move.id);
}

/** The problem the search solves, scored `scale / (scale + cost)`: about ½ for the colour rule's cost. */
function problemFor(scale, { width, root = width, horizon, omniscient, measure }) {
  return {
    sample: (shift, rng) => (omniscient === 1 ? trueWorld(shift, horizon) : drawWorld(shift, rng, horizon, ["", "", "levels", "future"][omniscient])),
    actor: () => "service",
    moves: movesOf,
    shortlist: (world, moves, where) => shortlistFor(world, moves, where?.root ? root : width),
    key: (move) => move.key,
    play(world, move) {
      playMove(world, move);
      world.over = allIn(world) || !nextChoice(world);
      return world;
    },
    over: (world) => world.over,
    rollout: rollOut,
    score: (world) => scale / (scale + pendingCost(world, measure)),
  };
}

/** The colour rule's mean cost over a few drawn worlds: the search's scale. */
function scaleOf(shift, rng, { horizon, measure }, runs = 6) {
  let total = 0;
  for (let i = 0; i < runs; i += 1) total += pendingCost(rollOut(drawWorld(shift, rng, horizon)), measure);
  return Math.max(20, total / runs);
}

/** The seed of one choice: from the search's seed, the shift's clock and its waiting room, the nurse's apart. */
const choiceSeed = (seed, shift, waiting, kind) => (Math.imul(seed, 0x9e3779b1) + Math.round(shift.events.now * 1000) * 31 + waiting[0].id * 7 + waiting.length + (kind === "nurse" ? 17 : 0)) >>> 0;

/** The search's move as a rule's answer: the nurse's patient or nobody; a patient, a hold, or the colour rule's. */
function answerOf(move, waiting, kind) {
  const chosen = waiting.find((view) => view.id === move?.id);
  if (kind === "nurse") return chosen ?? null;
  if (move === WAIT || move?.id === HOLD) return { id: HOLD };
  return chosen ?? RULES.colour(waiting);
}

/**
 * The search as a rule (simulate.js's signature, reading `context.shift`), for the boxes and, given as the
 * nurse rule too, for the nurse: a single waiting patient goes in at once; otherwise `budget` iterations,
 * seeded from the shift's clock and its waiting room. For the nurse, null looks at nobody.
 * @returns {import("./types.js").Rule}
 */
export function searchRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed, omniscient, measure } = { ...SEARCH_SETTINGS, ...options };
  return (waiting, { shift, kind }) => {
    if (kind !== "nurse" && waiting.length === 1 && !onItsWay(shift)) return waiting[0];
    const rng = createRng(choiceSeed(seed, shift, waiting, kind));
    const found = searchTried(shift, problemFor(scaleOf(shift, rng, { horizon, measure }), { width, root: options.root, horizon, omniscient, measure }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return answerOf(found.move, waiting, kind);
  };
}
