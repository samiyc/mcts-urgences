import { paired } from "mcts-commun/measure.js";
import { ACCIDENT, HOSPITALS } from "../src/hypotheses.js";
import { NURSE_RULES, RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { drawShift } from "../src/scenario.js";
import { simulateShift } from "../src/simulate.js";
import { newTally } from "../src/search-trials.js";
import { progressReporter } from "./night-results.js";
import { printTallies } from "./search-tallies.js";

/**
 * `node scripts/search-bench.js shifts hospital oui|non variant… [--diagnose]`: the colour and deadline rules, then each
 * variant, on the same shifts (`oui`: with the accident). A variant is `key=value,…`: `rule` the box rule
 * (colour, deadline, arrival or search, the default), `nurse` the nurse rule (none, the default, round,
 * overdue or search: one triage nurse then), `measure` the search's score (arrival or now), and any number of
 * SEARCH_SETTINGS (`budget=200`), or `earlyStop=1` (mcts-commun's trial of 27/10/2026, src/search-trials.js). Each line:
 * the late cost at arrival and at the level of the moment, their gain on the colour rule by pairs, and the shifts won /
 * tied / lost at the level of the moment; from the second variant on, its gain at the level of the moment on the first
 * by pairs. `--diagnose` counts what each variant's searches saw (diagnose's codes, iterations, time), under the table.
 */
const argv = process.argv.slice(2);
const [shifts, hospital, accident, ...texts] = argv.filter((arg) => arg !== "--diagnose");
const settings = { ...HOSPITALS[hospital], ...(accident === "oui" ? { crisis: ACCIDENT } : {}) };
const diagnosing = argv.includes("--diagnose");
const tallyOf = () => (diagnosing ? newTally() : null);

function variantOf(text) {
  const { rule = "search", nurse = "none", measure, ...numbers } = Object.fromEntries(text.split(",").filter(Boolean).map((pair) => pair.split("=")));
  const tally = tallyOf();
  const options = { ...Object.fromEntries(Object.entries(numbers).map(([key, value]) => [key, Number(value)])), ...(measure ? { measure } : {}), tally };
  const search = searchRule(options);
  return {
    rule: rule === "search" ? search : RULES[rule],
    nurseRule: nurse === "search" ? search : (NURSE_RULES[nurse] ?? null),
    settings: nurse === "none" ? settings : { ...settings, nurses: 1 },
    tally,
  };
}

const variants = { colour: { rule: RULES.colour, nurseRule: null, settings }, deadline: { rule: RULES.deadline, nurseRule: null, settings }, ...Object.fromEntries(texts.map((text) => [text, variantOf(text)])) };
const runs = Object.fromEntries(Object.keys(variants).map((name) => [name, []]));
const report = progressReporter("garde", Number(shifts));
const t0 = Date.now();
for (let i = 1; i <= Number(shifts); i += 1) {
  const patients = drawShift(i, settings);
  for (const [name, { rule, nurseRule, settings: own }] of Object.entries(variants)) runs[name].push(simulateShift(patients, rule, own, nurseRule).measures);
  report(i);
}
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value) => String(Math.round(value));
const span = (g) => `${round(g.mean)}, ${round(g.low)} à ${round(g.high)}`;
for (const [name, measures] of Object.entries(runs)) {
  const gain = (key, base = runs.colour) => paired(base.map((one) => one[key]), measures.map((one) => one[key]));
  const [arrival, now] = [gain("lateCost"), gain("lateCostNow")];
  const cell = (key, g) => `${round(mean(measures.map((one) => one[key])))} (${span(g)})`;
  const looks = mean(measures.map((one) => one.looks));
  const nurse = looks ? `  revus ${looks.toFixed(0)}, recolorés ${mean(measures.map((one) => one.recoloured)).toFixed(1)}` : "";
  const first = texts.indexOf(name) > 0 ? `  contre ${texts[0]} : ${span(gain("lateCostNow", runs[texts[0]]))}` : "";
  console.log(`${name.padEnd(40)} à l'arrivée ${cell("lateCost", arrival).padEnd(30)} au moment ${cell("lateCostNow", now).padEnd(32)} ${now.wins}/${now.ties}/${now.losses}${nurse}${first}`);
}
console.log(`${shifts} gardes, ${Math.round((Date.now() - t0) / 1000)} s`);
const tallied = texts.filter((text) => variants[text].tally);
if (tallied.length) printTallies([Object.fromEntries(tallied.map((text) => [text, variants[text].tally]))], (text) => text, tallied[0]);
