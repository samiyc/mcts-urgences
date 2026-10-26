import { paired } from "mcts-commun/measure.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "./pathway.js";
import { drawPathwayDay } from "./pathway-scenario.js";
import { pathwaySearchRule } from "./pathway-search.js";
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

/** The days' measures gathered (`[{ arrival, colour, deadline, search }]`): each rule's mean late cost, the search's gain on it. */
export function searchRows(days) {
  const costs = (name) => days.map((one) => one[name].lateCostNow);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return SEARCHED.map((name) => ({
    name,
    lateCostNow: mean(costs(name)),
    left: mean(days.map((one) => one[name].exits.parti)),
    stayMedian: mean(days.map((one) => one[name].stay.median)),
    gain: name === "search" ? null : paired(costs(name), costs("search")),
  }));
}
