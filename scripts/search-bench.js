import { paired } from "mcts-commun/measure.js";
import { ACCIDENT, HOSPITALS } from "../src/hypotheses.js";
import { RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { drawShift } from "../src/scenario.js";
import { simulateShift } from "../src/simulate.js";
const [shifts, hospital, accident, ...pairs] = process.argv.slice(2);
const settings = { ...HOSPITALS[hospital], ...(accident === "oui" ? { crisis: ACCIDENT } : {}) };
const variants = Object.fromEntries(pairs.map((text) => [text, searchRule(Object.fromEntries(text.split(",").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)])))]));
const runs = { colour: [], deadline: [], ...Object.fromEntries(Object.keys(variants).map((k) => [k, []])) };
const t0 = Date.now();
for (let i = 1; i <= Number(shifts); i += 1) {
  const patients = drawShift(i, settings);
  runs.colour.push(simulateShift(patients, RULES.colour, settings).measures.lateCost);
  runs.deadline.push(simulateShift(patients, RULES.deadline, settings).measures.lateCost);
  for (const [name, rule] of Object.entries(variants)) runs[name].push(simulateShift(patients, rule, settings).measures.lateCost);
}
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
for (const [name, costs] of Object.entries(runs)) {
  const g = paired(runs.colour, costs);
  console.log(name.padEnd(36), Math.round(mean(costs)), name === "colour" ? "" : `gain sur la couleur ${Math.round(g.mean)} (${Math.round(g.low)} à ${Math.round(g.high)}), ${g.wins}/${g.ties}/${g.losses}`);
}
console.log(`${shifts} gardes, ${Math.round((Date.now() - t0) / 1000)} s`);
