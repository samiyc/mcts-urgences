import { paired } from "mcts-commun/measure.js";
import { ACCIDENT, HOSPITALS } from "../src/hypotheses.js";
import { NURSE_RULES, RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { drawShift } from "../src/scenario.js";
import { simulateShift } from "../src/simulate.js";

/**
 * `node scripts/search-bench.js shifts hospital oui|non variant…`: the colour and deadline rules, then each
 * variant, on the same shifts (`oui`: with the accident). A variant is `key=value,…`: `rule` the box rule
 * (colour, deadline, arrival or search, the default), `nurse` the nurse rule (none, the default, round,
 * overdue or search: one triage nurse then), `measure` the search's score (arrival or now), and any number of
 * SEARCH_SETTINGS (`budget=200`). Each line: the late cost at arrival and at the level of the moment, their
 * gain on the colour rule by pairs, and the shifts won / tied / lost at the level of the moment.
 */
const [shifts, hospital, accident, ...texts] = process.argv.slice(2);
const settings = { ...HOSPITALS[hospital], ...(accident === "oui" ? { crisis: ACCIDENT } : {}) };

function variantOf(text) {
  const { rule = "search", nurse = "none", measure, ...numbers } = Object.fromEntries(text.split(",").filter(Boolean).map((pair) => pair.split("=")));
  const options = { ...Object.fromEntries(Object.entries(numbers).map(([key, value]) => [key, Number(value)])), ...(measure ? { measure } : {}) };
  const search = searchRule(options);
  return {
    rule: rule === "search" ? search : RULES[rule],
    nurseRule: nurse === "search" ? search : (NURSE_RULES[nurse] ?? null),
    settings: nurse === "none" ? settings : { ...settings, nurses: 1 },
  };
}

const variants = { colour: { rule: RULES.colour, nurseRule: null, settings }, deadline: { rule: RULES.deadline, nurseRule: null, settings }, ...Object.fromEntries(texts.map((text) => [text, variantOf(text)])) };
const runs = Object.fromEntries(Object.keys(variants).map((name) => [name, []]));
const t0 = Date.now();
for (let i = 1; i <= Number(shifts); i += 1) {
  const patients = drawShift(i, settings);
  for (const [name, { rule, nurseRule, settings: own }] of Object.entries(variants)) runs[name].push(simulateShift(patients, rule, own, nurseRule).measures);
}
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value) => String(Math.round(value));
for (const [name, measures] of Object.entries(runs)) {
  const gain = (key) => paired(runs.colour.map((one) => one[key]), measures.map((one) => one[key]));
  const [arrival, now] = [gain("lateCost"), gain("lateCostNow")];
  const cell = (key, g) => `${round(mean(measures.map((one) => one[key])))} (${round(g.mean)}, ${round(g.low)} à ${round(g.high)})`;
  const looks = mean(measures.map((one) => one.looks));
  const nurse = looks ? `  revus ${looks.toFixed(0)}, recolorés ${mean(measures.map((one) => one.recoloured)).toFixed(1)}` : "";
  console.log(`${name.padEnd(40)} à l'arrivée ${cell("lateCost", arrival).padEnd(30)} au moment ${cell("lateCostNow", now).padEnd(32)} ${now.wins}/${now.ties}/${now.losses}${nurse}`);
}
console.log(`${shifts} gardes, ${Math.round((Date.now() - t0) / 1000)} s`);
