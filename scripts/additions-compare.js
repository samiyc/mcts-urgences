import { paired } from "mcts-commun/measure.js";
import { HOSPITALS } from "../src/hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULES } from "../src/rules.js";

/**
 * `node scripts/additions-compare.js [--days 200] [--hopital moyen] [--accident] [--hiver]` (Sami, 26/10/2026,
 * docs/parcours-ajouts.md): each later addition off against on, on the same drawn days, by the deadline rule (the best
 * of the reference rules) and the oldest bed decision. The cost at the level of the moment (with the deaths, their
 * weight in it), its change by pairs, and what each addition counts.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const hospital = option("--hopital", "moyen");
if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
const days = Number(option("--days", 200));
const base = { hospital, accident: args.includes("--accident"), epidemic: args.includes("--hiver") };

/** @type {Array<[string, object, (m: any) => string]>} */
const ADDITIONS = [
  ["les familles", { family: true }, (m) => `${decimals(m.family.accompanied, 1)} accompagnés, ${decimals(m.family.standing, 1)} debout, ${decimals(m.family.informed, 0)} min d'information`],
  ["l'interprète, seul", { interpreter: true }, (m) => `${decimals(m.interpreter.allophones, 1)} allophones, ${decimals(m.interpreter.calls, 1)} appels`],
  ["l'interprète, avec les familles", { interpreter: true, family: true }, (m) => `${decimals(m.interpreter.allophones, 1)} allophones, ${decimals(m.interpreter.calls, 1)} appels`],
  ["le circuit court", { fastTrack: true }, (m) => `${decimals(m.fast.seen, 1)} patients au circuit court`],
  ["les décès", { deaths: true }, (m) => `${decimals(m.deaths.count, 2)} décès, retard seul ${Math.round(m.lateCostOnly)}`],
];

const played = (options) => Array.from({ length: days }, (_, i) => pathwayMeasures(runPathway(startPathway(drawPathwayDay(1 + i, { ...base, ...options })), { box: RULES.deadline, bed: BED_RULES.oldest })));
const mean = (list, read) => list.reduce((sum, one) => sum + read(one), 0) / list.length;
/** The means of an addition's counts over the days, as one object of numbers. */
function meanOf(list, key) {
  const keys = Object.keys(list[0][key]).filter((one) => typeof list[0][key][one] === "number");
  return { ...Object.fromEntries(keys.map((one) => [one, mean(list, (m) => m[key][one])])) };
}
const fixed = (value) => Math.round(value).toLocaleString("fr-FR");
/** A figure with its decimals, a comma between. */
const decimals = (value, digits) => value.toFixed(digits).replace(".", ",");

const t0 = Date.now();
const without = played({});
const situation = `${base.accident ? "avec l'accident" : "jour ordinaire"}${base.epidemic ? ", en pleine épidémie d'hiver" : ""}`;
console.log(`${HOSPITALS[hospital].label}, ${situation} : ${days} journées, par l'échéance. Sans ajout : ${fixed(mean(without, (m) => m.lateCostNow))} · partis ${decimals(mean(without, (m) => m.exits.parti), 1)}`);
for (const [name, options, describe] of ADDITIONS) {
  const withIt = played(options);
  const gap = paired(withIt.map((m) => m.lateCostNow), without.map((m) => m.lateCostNow));
  const counted = Object.fromEntries(["family", "interpreter", "fast", "deaths"].filter((key) => withIt[0][key]).map((key) => [key, meanOf(withIt, key)]));
  const late = withIt[0].lateCostOnly === undefined ? {} : { lateCostOnly: mean(withIt, (m) => m.lateCostOnly) };
  console.log(`${name.padEnd(32)} ${fixed(mean(withIt, (m) => m.lateCostNow)).padStart(8)} · sur sans : ${fixed(gap.mean)} (${fixed(gap.low)} à ${fixed(gap.high)}) · partis ${decimals(mean(withIt, (m) => m.exits.parti), 1)} · ${describe({ ...counted, ...late })}`);
}
console.log(`${Math.round((Date.now() - t0) / 1000)} s.`);
