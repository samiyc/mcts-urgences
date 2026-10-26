import { search } from "mcts-commun/mcts.js";
import { createRng } from "mcts-commun/random.js";
import { LEVELS, MAX_WAIT } from "./hypotheses.js";
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
  world.decision = nextDecision(world);
  return world;
}

const allIn = (world) => world.pending.every((id) => world.patients.get(id).start !== null || world.patients.get(id).exit !== null);

/** Plays the decision with `id` (a box), then the day to its next box decision, the bed decisions by the bed rule. */
function advance(world, id, bed) {
  decide(world, world.decision, id);
  world.decision = nextDecision(world);
  while (world.decision?.kind === "bed") {
    decide(world, world.decision, Number(bed(world.decision.candidates).id));
    world.decision = nextDecision(world);
  }
  return world;
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

/** The problem the search solves on the day, scored `scale / (scale + cost)`. */
function problemFor({ scale, width, horizon, bed }) {
  return {
    sample: (day, rng) => drawWorld(day, rng, horizon),
    actor: () => "service",
    moves: (world) => (world.decision?.kind === "box" ? world.decision.candidates.map((view) => ({ id: view.id, view, key: keyOf(view) })) : []),
    shortlist: (world, moves) => shortlistOf(moves, width),
    key: (move) => move.key,
    play: (world, move) => advance(world, move.id, bed),
    over: (world) => allIn(world) || world.decision === null,
    rollout(world) {
      while (!allIn(world) && world.decision?.kind === "box") advance(world, Number(RULES.colour(world.decision.candidates).id), bed);
      return world;
    },
    score: (world) => scale / (scale + pendingCost(world)),
  };
}

/** The colour rule's cost on a few worlds: the score's scale, so that the rule scores about ½. */
function scaleOf(day, rng, { horizon, bed }) {
  let total = 0;
  for (let i = 0; i < 3; i += 1) total += pendingCost(problemFor({ scale: 1, width: 1, horizon, bed }).rollout(drawWorld(day, rng, horizon)));
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
