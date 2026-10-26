import { paired } from "mcts-commun/measure.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "./pathway.js";
import { drawPathwayDay } from "./pathway-scenario.js";
import { BREAK_DECIDERS, DECIDED, fatigueMeasures } from "./pathway-fatigue.js";
import { FATIGUE, INTERN } from "./pathway-hypotheses.js";
import { INTERN_RULES } from "./pathway-intern-decided.js";
import { internMeasures } from "./pathway-game.js";
import { QUEUE_RULES } from "./pathway-queues.js";
import { pathwaySearchBedRule, pathwaySearchBreakRule, pathwaySearchInternRule, pathwaySearchQueueRule, pathwaySearchRule } from "./pathway-search.js";
import { RULES } from "./rules.js";

/**
 * The search on the pathway against the box rules, a day at a time (Sami, 26/10/2026, step 6): shared by
 * scripts/pathway-search-compare.js (in threads) and the page's workers (web/pathway-worker.js), which play the days
 * side by side and gather them with `searchRows`.
 */
export const SEARCHED = Object.freeze(["arrival", "colour", "deadline", "search"]);

/** One day: each rule's measures, the search with `budget` iterations; the bed rule « la décision la plus ancienne ». */
export function playSearchDay({ seed, options, budget }) {
  const drawn = drawPathwayDay(seed, options);
  const boxOf = (name) => (name === "search" ? pathwaySearchRule({ budget }) : RULES[name]);
  return Object.fromEntries(SEARCHED.map((name) => [name, pathwayMeasures(runPathway(startPathway(drawn), { box: boxOf(name), bed: BED_RULES.oldest }))]));
}

/** The bed rules and the search choosing the beds, the box rule « couleur » (step 6, the downstream beds). */
export const BED_SEARCHED = Object.freeze(["oldest", "box", "elderly", "search"]);

/** One day: each bed rule's measures and the search's for the beds. */
export function playBedSearchDay({ seed, options, budget }) {
  const drawn = drawPathwayDay(seed, options);
  const bedOf = (name) => (name === "search" ? pathwaySearchBedRule({ budget }) : BED_RULES[name]);
  return Object.fromEntries(BED_SEARCHED.map((name) => [name, pathwayMeasures(runPathway(startPathway(drawn), { box: RULES.colour, bed: bedOf(name) }))]));
}

/** The breaks: none, the rule « au creux », the same decided one at a time, and the search deciding them (step 6). */
export const BREAK_SEARCHED = Object.freeze(["none", "quiet", "decided", "search"]);

/** One day: each way of taking the breaks, its measures and its fatigue's; the box rule « couleur ». */
export function playBreakSearchDay({ seed, options, budget }) {
  const ways = {
    none: [{ ...FATIGUE, breaks: "none" }, undefined],
    quiet: [{ ...FATIGUE, breaks: "quiet" }, undefined],
    decided: [{ ...FATIGUE, breaks: DECIDED }, BREAK_DECIDERS.quiet],
    search: [{ ...FATIGUE, breaks: DECIDED }, pathwaySearchBreakRule({ budget })],
  };
  return Object.fromEntries(
    BREAK_SEARCHED.map((name) => {
      const [fatigue, breaks] = ways[name];
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, fatigue })), { box: RULES.colour, bed: BED_RULES.oldest, breaks });
      return [name, { ...pathwayMeasures(day), fatigue: fatigueMeasures(day) }];
    }),
  );
}

/** The intern's tasks: no intern, the reference rules, the search choosing them (step 6), walking counted. */
export const INTERN_SEARCHED = Object.freeze(["none", "dueFirst", "nearest", "urgent", "search"]);

/** One day: each way of ordering the intern's tasks, its measures and the intern's; the box rule « couleur ». */
export function playInternSearchDay({ seed, options, budget }) {
  const ruleOf = (name) => (name === "search" ? pathwaySearchInternRule({ budget }) : INTERN_RULES[name]);
  return Object.fromEntries(
    INTERN_SEARCHED.map((name) => {
      const intern = name === "none" ? null : INTERN;
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, walk: true, intern, internDecided: intern !== null })), { box: RULES.colour, bed: BED_RULES.oldest, intern: ruleOf(name) });
      return [name, { ...pathwayMeasures(day), intern: day.intern ? internMeasures(day) : null }];
    }),
  );
}

/** The scanner's and the theatre's order: fixed, decided by each rule, and by the search (step 6). */
export const QUEUE_SEARCHED = Object.freeze(["fixed", "colour", "oldest", "search"]);

/** One day: each way of ordering the scanner and the theatre, its measures; the box rule « couleur ». */
export function playQueueSearchDay({ seed, options, budget }) {
  const ruleOf = (name) => (name === "search" ? pathwaySearchQueueRule({ budget }) : QUEUE_RULES[name]);
  return Object.fromEntries(
    QUEUE_SEARCHED.map((name) => {
      const day = runPathway(startPathway(drawPathwayDay(seed, { ...options, queueDecided: name !== "fixed" })), { box: RULES.colour, bed: BED_RULES.oldest, queue: ruleOf(name) });
      return [name, pathwayMeasures(day)];
    }),
  );
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
