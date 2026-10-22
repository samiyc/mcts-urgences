import { paired } from "mcts-commun/measure.js";
import { drawShift } from "./scenario.js";
import { RULES } from "./rules.js";
import { simulateShift } from "./simulate.js";

/**
 * The rules on the same `shifts` shifts (seeds `seed`, `seed + 1`, …), each with the same nurse rule when the
 * settings have nurses: each rule's mean measures, and its late cost against the arrival order's, by pairs
 * (arrival minus rule: above 0, the rule does better).
 */
const MEASURES = ["lateCost", "lateCostNow", "looks", "recoloured", "late", "worsened", "meanWait", "peakWaiting", "boxUse", "doctorUse", "patients"];
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function compareRules({ shifts = 200, seed = 1, settings = {}, rules = RULES, nurseRule = null } = {}) {
  const runs = Object.fromEntries(Object.keys(rules).map((name) => [name, []]));
  for (let i = 0; i < shifts; i += 1) {
    const patients = drawShift(seed + i, settings);
    for (const [name, rule] of Object.entries(rules)) runs[name].push(simulateShift(patients, rule, settings, nurseRule).measures);
  }
  const baseline = runs.arrival?.map((one) => one.lateCost);
  return Object.fromEntries(
    Object.entries(runs).map(([name, measures]) => [
      name,
      {
        ...Object.fromEntries(MEASURES.map((key) => [key, mean(measures.map((one) => one[key]))])),
        urgentInTime: mean(measures.map((one) => (one.byLevel[1].count + one.byLevel[2].count ? (one.byLevel[1].inTime * one.byLevel[1].count + one.byLevel[2].inTime * one.byLevel[2].count) / (one.byLevel[1].count + one.byLevel[2].count) : 1))),
        gain: baseline ? paired(baseline, measures.map((one) => one.lateCost)) : null,
      },
    ]),
  );
}
