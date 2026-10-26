import { paired } from "mcts-commun/measure.js";
import { BED_LABELS, BED_RULES, pathwayMeasures, runPathway, startPathway } from "./pathway.js";
import { drawPathwayDay } from "./pathway-scenario.js";
import { RULE_LABELS, RULES } from "./rules.js";

/**
 * The reference rules of the detailed pathway on the same drawn days (Sami, 25/10/2026; shared on 26/10 by
 * scripts/pathway-compare.js and the page's Stats tab): the box rules (rules.js) under the oldest bed decision,
 * then the bed rules under the colour box rule. Each row: the means of the peaks and maxima
 * (docs/recherche/indicateurs.md), and the late cost at the level of the moment with its gain on the arrival
 * order (box) or the oldest decision (bed), by pairs over the same days.
 */
const PAIRS = [
  ...Object.keys(RULES).map((key) => ({ name: `box : ${RULE_LABELS[key]}`, rules: { box: RULES[key], bed: BED_RULES.oldest }, group: "box", key })),
  ...Object.keys(BED_RULES).map((key) => ({ name: `lit : ${BED_LABELS[key]}`, rules: { box: RULES.colour, bed: BED_RULES[key] }, group: "bed", key })),
];
const BASELINES = { box: "arrival", bed: "oldest" };

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
/** The pool most often the busiest over the days. */
function busiestOf(measures) {
  const count = {};
  for (const one of measures) count[one.busiest] = (count[one.busiest] ?? 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

const rowOf = (pair, measures, baseline) => ({
  name: pair.name,
  group: pair.group,
  key: pair.key,
  lateCostNow: mean(measures.map((x) => x.lateCostNow)),
  gain: baseline === measures ? null : paired(baseline.map((x) => x.lateCostNow), measures.map((x) => x.lateCostNow)),
  left: mean(measures.map((x) => x.exits.parti)),
  peakWaiting: mean(measures.map((x) => x.peak.waiting)),
  maxWaitUrgent: mean(measures.map((x) => Math.max(x.maxWait[1], x.maxWait[2]))),
  stayP90: mean(measures.map((x) => x.stay.p90)),
  within4h: mean(measures.map((x) => x.stay.within4h)),
  boardingMax: mean(measures.map((x) => x.boarding.max)),
  elderlyNights: mean(measures.map((x) => x.boarding.elderlyNights)),
  busiest: busiestOf(measures),
});

/**
 * The rows of the comparison over `days` days from seed 1, for `options` (`drawPathwayDay`'s: hospital, accident, plan).
 * @param {{ days?: number, hospital?: string, accident?: boolean, plan?: string }} [options]
 */
export function comparePathwayRules({ days = 50, ...options } = {}) {
  const runs = PAIRS.map(() => []);
  for (let i = 0; i < days; i += 1) {
    const drawn = drawPathwayDay(1 + i, options);
    PAIRS.forEach((pair, k) => runs[k].push(pathwayMeasures(runPathway(startPathway(drawn), pair.rules))));
  }
  const baselineOf = (group) => runs[PAIRS.findIndex((pair) => pair.group === group && pair.key === BASELINES[group])];
  return PAIRS.map((pair, k) => rowOf(pair, runs[k], baselineOf(pair.group)));
}
