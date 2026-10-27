import { paired } from "mcts-commun/measure.js";
import { drawShift } from "./scenario.js";
import { RULES } from "./rules.js";
import { simulateShift } from "./simulate.js";

/**
 * The rules on the same `shifts` shifts (seeds `seed`, `seed + 1`, …), each with the same nurse rule when the
 * settings have nurses: each rule's mean measures, and its late cost against the arrival order's, by pairs
 * (arrival minus rule: above 0, the rule does better), at arrival (`gain`) and at the level of the moment (`gainNow`).
 */
const MEASURES = ["lateCost", "lateCostNow", "looks", "recoloured", "late", "worsened", "meanWait", "peakWaiting", "boxUse", "doctorUse", "patients"];
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** The share of reds and oranges seen in time. */
function urgentInTime({ byLevel }) {
  const count = byLevel[1].count + byLevel[2].count;
  return count ? (byLevel[1].inTime * byLevel[1].count + byLevel[2].inTime * byLevel[2].count) / count : 1;
}

/**
 * One rule's means over the shifts, and its gains on the arrival order's (`baseline`) when there is one.
 * @returns {Record<string, any>}
 */
function summaryOf(measures, baseline) {
  const costs = (key) => measures.map((one) => one[key]);
  return {
    ...Object.fromEntries(MEASURES.map((key) => [key, mean(costs(key))])),
    urgentInTime: mean(measures.map(urgentInTime)),
    gain: baseline ? paired(baseline.map((one) => one.lateCost), costs("lateCost")) : null,
    // The same, at the level of the moment (lateCostNow): the measure the search scores best on (22/10).
    gainNow: baseline ? paired(baseline.map((one) => one.lateCostNow), costs("lateCostNow")) : null,
  };
}

/** Each rule's measures on each shift; `onShift(done, shifts, seed, measures)` told of each as it ends. */
function runsOf({ shifts, seed, settings, rules, nurseRule, onShift }) {
  const runs = Object.fromEntries(Object.keys(rules).map((name) => [name, []]));
  for (let i = 0; i < shifts; i += 1) {
    const patients = drawShift(seed + i, settings);
    const measures = Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, simulateShift(patients, rule, settings, nurseRule).measures]));
    for (const name of Object.keys(rules)) runs[name].push(measures[name]);
    onShift?.(i + 1, shifts, seed + i, measures);
  }
  return runs;
}

/** Each rule's summary from its measures on each shift (`runs`, the arrival order's among them). */
export const summariesOf = (runs) => Object.fromEntries(Object.entries(runs).map(([name, measures]) => [name, summaryOf(measures, runs.arrival)]));

export function compareRules({ shifts = 200, seed = 1, settings = {}, rules = RULES, nurseRule = null, onShift = null } = {}) {
  return summariesOf(runsOf({ shifts, seed, settings, rules, nurseRule, onShift }));
}
