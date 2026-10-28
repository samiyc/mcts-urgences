import { createRng } from "mcts-commun/random.js";
import { ALERT_RULES } from "./pathway-alert.js";
import { HET_RULES } from "./pathway-het.js";
import { BREAK_DECIDERS } from "./pathway-fatigue.js";
import { INTERN_RULES } from "./pathway-intern-decided.js";
import { QUEUE_RULES } from "./pathway-queues.js";
import { SAUV_RULES } from "./pathway-sauv.js";
import { BED_RULES } from "./pathway.js";
import { PATHWAY_SEARCH, problemFor, scaleOf } from "./pathway-search.js";
import { searchTried } from "./search-trials.js";

/**
 * The search of the pathway for its other decisions (Sami, 26/10/2026, step 6), as rules of runPathway: the beds, the
 * breaks, the intern's tasks, the scanner's and the theatre's order, the crisis plan. Each lets the search choose that
 * kind of decision, the others by their rules in its worlds (pathway-search.js has the search and the box rule).
 */

/**
 * The search as a bed rule of the pathway (runPathway's `bed`, reading `context.day`): who takes the bed a ward frees,
 * the box choices that follow by the colour rule; one patient waiting takes it at once. Scored on the late cost and the
 * wait for a bed (`boardingCost`), by the minute, or with `convex` more the longer one has waited (H79). Not for a day
 * with an intern.
 */
export function pathwaySearchBedRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed } = { ...PATHWAY_SEARCH, ...options };
  const bed = options.bed ?? BED_RULES.oldest;
  const convex = Boolean(options.convex);
  return (candidates, { day }) => {
    if (candidates.length === 1) return candidates[0];
    if (day.intern && !day.settings.internDecided) throw new Error("la recherche du parcours ne joue pas une journée avec un interne pas à pas");
    const rng = createRng((Math.imul(seed, 0x85ebca6b) + Math.round(day.events.now * 1000) * 37 + Number(candidates[0].id) * 11 + candidates.length) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, beds: true, convex });
    const found = searchTried(day, problemFor({ scale, width, horizon, bed, beds: true, convex, from: day.events.now, pool: options.pool }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return candidates.find((view) => view.id === found.move?.id) ?? bed(candidates);
  };
}

/**
 * The search deciding the breaks (step 6; runPathway's `breaks`, reading `context.day`): whether a free doctor takes
 * their break now or is asked again later, the other decisions by their rules in the worlds. Scored on the late cost
 * only: the fatigue a break takes away weighs there as the slower exams and the results overlooked, no more.
 */
export function pathwaySearchBreakRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed } = { ...PATHWAY_SEARCH, ...options };
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (day.intern && !day.settings.internDecided) throw new Error("la recherche du parcours ne joue pas une journée avec un interne pas à pas");
    const rng = createRng((Math.imul(seed, 0xc2b2ae35) + Math.round(day.events.now * 1000) * 41) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, breaks: true });
    const found = searchTried(day, problemFor({ scale, width, horizon, bed, breaks: true, from: day.events.now, pool: options.pool }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return candidates.find((one) => one.id === found.move?.id) ?? BREAK_DECIDERS.quiet(candidates, { day });
  };
}

/**
 * The search choosing the intern's next task (step 6; runPathway's `intern`, a day with `internDecided`): the other
 * decisions by their rules in its worlds, played over the horizon, scored on the late cost and the intern's lateness
 * (INTERN_LATE, H52: how strict the follow-up is, Sami's « rigueur du suivi »).
 */
export function pathwaySearchInternRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed } = { ...PATHWAY_SEARCH, ...options };
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (candidates.length === 1) return candidates[0];
    const rng = createRng((Math.imul(seed, 0x27d4eb2f) + Math.round(day.events.now * 1000) * 43 + candidates.length) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, interns: true });
    const found = searchTried(day, problemFor({ scale, width, horizon, bed, interns: true, from: day.events.now, pool: options.pool }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return candidates.find((view) => view.id === found.move?.id) ?? INTERN_RULES.dueFirst(candidates);
  };
}

/**
 * The search choosing who goes first to a free scanner or theatre (step 6; runPathway's `queue`, a day with
 * `queueDecided`): the other decisions by their rules in its worlds, scored on the late cost.
 */
export function pathwaySearchQueueRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed } = { ...PATHWAY_SEARCH, ...options };
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (day.intern && !day.settings.internDecided) throw new Error("la recherche du parcours ne joue pas une journée avec un interne pas à pas");
    const rng = createRng((Math.imul(seed, 0x165667b1) + Math.round(day.events.now * 1000) * 47 + candidates.length) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, queues: true });
    const found = searchTried(day, problemFor({ scale, width, horizon, bed, queues: true, from: day.events.now, pool: options.pool }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return candidates.find((view) => view.id === found.move?.id) ?? QUEUE_RULES.colour(candidates);
  };
}

/**
 * The search deciding whether to trigger the crisis plan now (step 6; runPathway's `alert`, a day with `alert`): the
 * other decisions by their rules in its worlds, played over the horizon, scored on the late cost and the doctor-hours
 * called back (ALERT.doctorHour, H55).
 */
export function pathwaySearchAlertRule(options = {}) {
  const { budget, depth, explore, width, seed } = { ...PATHWAY_SEARCH, ...options };
  const horizon = options.horizon ?? 240;
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (day.intern && !day.settings.internDecided) throw new Error("la recherche du parcours ne joue pas une journée avec un interne pas à pas");
    const rng = createRng((Math.imul(seed, 0x9e3779b9) + Math.round(day.events.now * 1000) * 53) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, alerts: true });
    const found = searchTried(day, problemFor({ scale, width, horizon, bed, alerts: true, from: day.events.now, pool: options.pool }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return candidates.find((one) => one.id === found.move?.id) ?? ALERT_RULES.threshold(candidates, { day });
  };
}

/**
 * The search deciding whether to move a patient out of the SAUV for a red (step 6; runPathway's `sauv`, a day with
 * `sauvDecided`): the other decisions by their rules in its worlds, scored on the late cost.
 */
export function pathwaySearchSauvRule(options = {}) {
  const { budget, depth, explore, width, horizon, seed } = { ...PATHWAY_SEARCH, ...options };
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (day.intern && !day.settings.internDecided) throw new Error("la recherche du parcours ne joue pas une journée avec un interne pas à pas");
    const rng = createRng((Math.imul(seed, 0x7feb352d) + Math.round(day.events.now * 1000) * 59 + candidates.length) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, sauvs: true });
    const found = searchTried(day, problemFor({ scale, width, horizon, bed, sauvs: true, from: day.events.now, pool: options.pool }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return candidates.find((view) => view.id === found.move?.id) ?? SAUV_RULES.never(candidates);
  };
}

/**
 * The search deciding whether to trigger the HET now (runPathway's `het`, a day with `het`): the other decisions by
 * their rules in its worlds, played over the horizon, scored on the late cost, the wait for a bed of those waiting for
 * one, and the beds the HET gives (HET.bedCost, H65).
 */
export function pathwaySearchHetRule(options = {}) {
  const { budget, depth, explore, width, seed } = { ...PATHWAY_SEARCH, ...options };
  const horizon = options.horizon ?? 240;
  const bed = options.bed ?? BED_RULES.oldest;
  return (candidates, { day }) => {
    if (day.intern && !day.settings.internDecided) throw new Error("la recherche du parcours ne joue pas une journée avec un interne pas à pas");
    const rng = createRng((Math.imul(seed, 0x2545f491) + Math.round(day.events.now * 1000) * 61) >>> 0);
    const scale = scaleOf(day, rng, { horizon, bed, hets: true });
    const found = searchTried(day, problemFor({ scale, width, horizon, bed, hets: true, from: day.events.now, pool: options.pool }), { budget, rng, depth, explore, earlyStop: options.earlyStop, widening: options.widening, tally: options.tally });
    return candidates.find((one) => one.id === found.move?.id) ?? HET_RULES.threshold(candidates, { day });
  };
}
