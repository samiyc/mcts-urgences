import { paired } from "mcts-commun/measure.js";
import { BREAK_RULES, fatigueMeasures } from "./pathway-fatigue.js";
import { FATIGUE } from "./pathway-hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "./pathway.js";
import { drawPathwayDay } from "./pathway-scenario.js";
import { RULES } from "./rules.js";

/**
 * The break rules of the detailed pathway on the same days (Sami, 26/10/2026, step 4): no fatigue at all (the day of
 * the steps before), then each rule with shifts of 24 h and of 12 h, the box rule « couleur » and the bed rule « la
 * décision la plus ancienne ». Each row: the late cost at the moment and its gain on « aucune pause » (24 h), by pairs,
 * the median stay, and the fatigue's measures. Shared by scripts/fatigue-compare.js and the page's Stats tab.
 */
const CASES = [
  { name: "sans fatigue", fatigue: null, breaks: null, teams: null },
  ...[24, 12].flatMap((teams) => Object.entries(BREAK_RULES).map(([breaks, label]) => ({ name: `${label}, gardes de ${teams} h`, fatigue: { ...FATIGUE, breaks, teams }, breaks, teams }))),
];
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const fatigueRow = (runs) => (runs[0].fatigue ? Object.fromEntries(Object.keys(runs[0].fatigue).map((key) => [key, mean(runs.map((one) => one.fatigue[key]))])) : null);

/**
 * The rows over `days` days from seed 1, for `options` (`drawPathwayDay`'s: hospital, accident, plan, walk).
 * @param {{ days?: number, hospital?: string, accident?: boolean, plan?: string, walk?: boolean }} [options]
 */
export function compareBreakRules({ days = 20, ...options } = {}) {
  const runs = CASES.map(() => []);
  for (let i = 0; i < days; i += 1) {
    CASES.forEach((one, k) => {
      const day = runPathway(startPathway(drawPathwayDay(1 + i, { ...options, fatigue: one.fatigue })), { box: RULES.colour, bed: BED_RULES.oldest });
      runs[k].push({ measures: pathwayMeasures(day), fatigue: day.fatigue ? fatigueMeasures(day) : null });
    });
  }
  const baseline = runs[CASES.findIndex((one) => one.breaks === "none" && one.teams === 24)].map((one) => one.measures.lateCostNow);
  return CASES.map((one, k) => ({
    name: one.name,
    lateCostNow: mean(runs[k].map((x) => x.measures.lateCostNow)),
    gain: one.breaks === "none" && one.teams === 24 ? null : paired(baseline, runs[k].map((x) => x.measures.lateCostNow)),
    stayMedian: mean(runs[k].map((x) => x.measures.stay.median)),
    fatigue: fatigueRow(runs[k]),
  }));
}
