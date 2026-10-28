import { paired } from "mcts-commun/measure.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "./pathway.js";
import { boardingCostOf } from "./pathway-measures.js";
import { drawPathwayDay } from "./pathway-scenario.js";
import { BREAK_DECIDERS, DECIDED, fatigueMeasures } from "./pathway-fatigue.js";
import { ALERT, FATIGUE, HET, INTERN } from "./pathway-hypotheses.js";
import { HET_RULES, hetMeasures } from "./pathway-het.js";
import { INTERN_RULES } from "./pathway-intern-decided.js";
import { internMeasures } from "./pathway-game.js";
import { QUEUE_RULES } from "./pathway-queues.js";
import { ALERT_RULES, alertMeasures } from "./pathway-alert.js";
import { SAUV_RULES } from "./pathway-sauv.js";
import { pathwaySearchRule } from "./pathway-search.js";
import { pathwaySearchAlertRule, pathwaySearchHetRule, pathwaySearchBedRule, pathwaySearchBreakRule, pathwaySearchInternRule, pathwaySearchQueueRule, pathwaySearchSauvRule } from "./pathway-search-rules.js";
import { RULES } from "./rules.js";
import { newTally } from "./search-trials.js";

/**
 * The search on the pathway against the box rules, a day at a time (Sami, 26/10/2026, step 6): shared by
 * scripts/pathway-search-compare.js (in threads) and the page's workers (web/pathway-worker.js), which play the days
 * side by side and gather them with `searchRows`.
 */
export const SEARCHED = Object.freeze(["arrival", "colour", "deadline", "search"]);

/**
 * A day's searches, made by `make` (a search rule's factory) with `budget` iterations: "search", and with `early` an
 * "early" row too, its `earlyStop` on, paired on the same day (mcts-commun's trials of 27/10/2026, src/search-trials.js);
 * with `pool`, a "pool" row, its worlds `pool` at most, reused (pathway-worlds.js, a trial of 28/10/2026).
 * With `early` or `diagnose`, each counts what its searches saw, the day's `tallies` beside the rows' measures.
 */
export function searchesOf({ budget, early = false, diagnose = false, pool = 0 }, make) {
  const trials = [...(early ? ["early"] : []), ...(pool ? ["pool"] : [])];
  const names = ["search", ...trials];
  const tallies = early || diagnose ? Object.fromEntries(names.map((name) => [name, newTally()])) : null;
  const rules = Object.fromEntries(names.map((name) => [name, make({ budget, earlyStop: name === "early", pool: name === "pool" ? pool : undefined, tally: tallies?.[name] })]));
  return {
    rules,
    rows: (base) => [...base, ...trials],
    done: (measures) => (tallies ? { ...measures, tallies } : measures),
  };
}

/** One day: each rule's measures, the search with `budget` iterations; the bed rule « la décision la plus ancienne ». */
export function playSearchDay(job) {
  const drawn = drawPathwayDay(job.seed, job.options);
  const searches = searchesOf(job, pathwaySearchRule);
  const boxOf = (name) => searches.rules[name] ?? RULES[name];
  return searches.done(Object.fromEntries(searches.rows(SEARCHED).map((name) => [name, pathwayMeasures(runPathway(startPathway(drawn), { box: boxOf(name), bed: BED_RULES.oldest }))])));
}

/** The bed rules and the search choosing the beds, the box rule « couleur » (step 6, the downstream beds). */
export const BED_SEARCHED = Object.freeze(["oldest", "box", "elderly", "search"]);

/**
 * One day: each bed rule's measures and the search's for the beds; with `convex`, a row "convex" too, the search
 * scoring the wait for a bed convex (H79).
 */
export function playBedSearchDay(job) {
  const drawn = drawPathwayDay(job.seed, job.options);
  const searches = searchesOf(job, pathwaySearchBedRule);
  const convex = job.convex ? { convex: pathwaySearchBedRule({ budget: job.budget, convex: true }) } : {};
  const bedOf = (name) => convex[name] ?? searches.rules[name] ?? BED_RULES[name];
  return searches.done(Object.fromEntries(searches.rows(job.convex ? [...BED_SEARCHED, "convex"] : BED_SEARCHED).map((name) => [name, pathwayMeasures(runPathway(startPathway(drawn), { box: RULES.colour, bed: bedOf(name) }))])));
}

/** The breaks: none, the rule « au creux », the same decided one at a time, and the search deciding them (step 6). */
export const BREAK_SEARCHED = Object.freeze(["none", "quiet", "decided", "search"]);

/** One day: each way of taking the breaks, its measures and its fatigue's; the box rule « couleur ». */
export function playBreakSearchDay(job) {
  const { seed, options } = job;
  const searches = searchesOf(job, pathwaySearchBreakRule);
  const ways = {
    none: [{ ...FATIGUE, breaks: "none" }, undefined],
    quiet: [{ ...FATIGUE, breaks: "quiet" }, undefined],
    decided: [{ ...FATIGUE, breaks: DECIDED }, BREAK_DECIDERS.quiet],
    ...Object.fromEntries(Object.entries(searches.rules).map(([name, rule]) => [name, [{ ...FATIGUE, breaks: DECIDED }, rule]])),
  };
  return searches.done(Object.fromEntries(
    searches.rows(BREAK_SEARCHED).map((name) => {
      const [fatigue, breaks] = ways[name];
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, fatigue })), { box: RULES.colour, bed: BED_RULES.oldest, breaks });
      return [name, { ...pathwayMeasures(day), fatigue: fatigueMeasures(day) }];
    }),
  ));
}

/** The intern's tasks: no intern, the reference rules, the search choosing them (step 6), walking counted. */
export const INTERN_SEARCHED = Object.freeze(["none", "dueFirst", "nearest", "urgent", "search"]);

/** One day: each way of ordering the intern's tasks, its measures and the intern's; the box rule « couleur ». */
export function playInternSearchDay(job) {
  const { seed, options } = job;
  const searches = searchesOf(job, pathwaySearchInternRule);
  const ruleOf = (name) => searches.rules[name] ?? INTERN_RULES[name];
  return searches.done(Object.fromEntries(
    searches.rows(INTERN_SEARCHED).map((name) => {
      const intern = name === "none" ? null : INTERN;
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, walk: true, intern, internDecided: intern !== null })), { box: RULES.colour, bed: BED_RULES.oldest, intern: ruleOf(name) });
      return [name, { ...pathwayMeasures(day), intern: day.intern ? internMeasures(day) : null }];
    }),
  ));
}

/** The scanner's and the theatre's order: fixed, decided by each rule, and by the search (step 6). */
export const QUEUE_SEARCHED = Object.freeze(["fixed", "colour", "oldest", "search"]);

/** One day: each way of ordering the scanner and the theatre, its measures; the box rule « couleur ». */
export function playQueueSearchDay(job) {
  const { seed, options } = job;
  const searches = searchesOf(job, pathwaySearchQueueRule);
  const ruleOf = (name) => searches.rules[name] ?? QUEUE_RULES[name];
  return searches.done(Object.fromEntries(
    searches.rows(QUEUE_SEARCHED).map((name) => {
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, queueDecided: name !== "fixed" })), { box: RULES.colour, bed: BED_RULES.oldest, queue: ruleOf(name) });
      return [name, pathwayMeasures(day)];
    }),
  ));
}

/** The crisis plan: never, at the threshold, and decided by the search (step 6). */
export const ALERT_SEARCHED = Object.freeze(["never", "threshold", "search"]);

/**
 * One day: each way of triggering the crisis plan, its measures, the plan's (`alert`), and `total` (the late cost and
 * the doctor-hours called back at their weight), the cost the comparison reads.
 */
export function playAlertSearchDay(job) {
  const { seed, options } = job;
  const searches = searchesOf(job, pathwaySearchAlertRule);
  const ruleOf = (name) => searches.rules[name] ?? ALERT_RULES[name];
  return searches.done(Object.fromEntries(
    searches.rows(ALERT_SEARCHED).map((name) => {
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, alert: ALERT })), { box: RULES.colour, bed: BED_RULES.oldest, alert: ruleOf(name) });
      const measures = pathwayMeasures(day);
      const alert = alertMeasures(day);
      return [name, { ...measures, lateCostOnly: measures.lateCostNow, lateCostNow: measures.lateCostNow + alert.cost, alert }];
    }),
  ));
}

/** The HET: never, at the threshold, and decided by the search. */
export const HET_SEARCHED = Object.freeze(["never", "threshold", "search"]);

/**
 * One day: each way of triggering the HET, its measures, the HET's (`het`), and the cost the comparison reads
 * (`lateCostNow`): the late cost, the wait for a bed (Sami, 26/10: the HET is for the beds, as the search scores it)
 * and its beds at their weight; `lateCostOnly` the late cost alone, `boardingCost` the wait for a bed.
 */
export function playHetSearchDay(job) {
  const { seed, options } = job;
  const searches = searchesOf(job, pathwaySearchHetRule);
  const ruleOf = (name) => searches.rules[name] ?? HET_RULES[name];
  return searches.done(Object.fromEntries(
    searches.rows(HET_SEARCHED).map((name) => {
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, het: HET })), { box: RULES.colour, bed: BED_RULES.oldest, het: ruleOf(name) });
      const measures = pathwayMeasures(day);
      const het = hetMeasures(day);
      const boardingCost = boardingCostOf(day);
      return [name, { ...measures, lateCostOnly: measures.lateCostNow, boardingCost, lateCostNow: measures.lateCostNow + boardingCost + het.cost, het }];
    }),
  ));
}

/** Out of the SAUV: never, the longest there as soon as a red waits, and the search (step 6). */
export const SAUV_SEARCHED = Object.freeze(["never", "longest", "search"]);

/** One day: each way of moving patients out of the SAUV, its measures; the box rule « couleur ». */
export function playSauvSearchDay(job) {
  const { seed, options } = job;
  const searches = searchesOf(job, pathwaySearchSauvRule);
  const ruleOf = (name) => searches.rules[name] ?? SAUV_RULES[name];
  return searches.done(Object.fromEntries(searches.rows(SAUV_SEARCHED).map((name) => [name, pathwayMeasures(runPathway(startPathway(drawPathwayDay(seed, { ...options, sauvDecided: true })), { box: RULES.colour, bed: BED_RULES.oldest, sauv: ruleOf(name) }))])));
}

/** The search's choices of a day, in order (each box decision's chosen id): the page replays the day from them. */
export function searchChoices({ seed, options, bed = "oldest", budget }) {
  const choices = [];
  const search = pathwaySearchRule({ budget, bed: BED_RULES[bed] });
  const box = (candidates, context) => {
    const chosen = search(candidates, context);
    choices.push(chosen.id);
    return chosen;
  };
  runPathway(startPathway(drawPathwayDay(seed, options)), { box, bed: BED_RULES[bed] });
  return choices;
}

/** A box rule that plays the choices recorded, in order (the colour rule if they run out). */
export function followChoices(choices) {
  let next = 0;
  return (candidates) => {
    const id = choices[next];
    next += 1;
    return candidates.find((view) => view.id === id) ?? RULES.colour(candidates);
  };
}

/**
 * The days' measures gathered (`[{ arrival, colour, deadline, search }]`, or the bed rules': `names`): each rule's mean
 * late cost, patients gone unseen, median stay, longest boarding and the elderly's nights, the search's gain on it.
 */
export function searchRows(days, names = SEARCHED) {
  const costs = (name) => days.map((one) => one[name].lateCostNow);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return names.map((name) => ({
    name,
    lateCostNow: mean(costs(name)),
    left: mean(days.map((one) => one[name].exits.parti)),
    stayMedian: mean(days.map((one) => one[name].stay.median)),
    boardingMax: mean(days.map((one) => one[name].boarding.max)),
    elderlyNights: mean(days.map((one) => one[name].boarding.elderlyNights)),
    gain: name === "search" ? null : paired(costs(name), costs("search")),
  }));
}
