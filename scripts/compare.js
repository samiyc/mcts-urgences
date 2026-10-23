import { compareRules } from "../src/compare.js";
import { ACCIDENT, HOSPITALS } from "../src/hypotheses.js";
import { RULE_LABELS, RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";

/**
 * `npm run compare -- [--shifts 200] [--hopital proximite|moyen|chu] [--accident] [--boxes N] [--doctors N]
 * [--search [budget]]`: the reference rules on the same drawn shifts, a line each. `--accident` adds the example
 * crisis (ten victims 1 h 30 into the shift); `--search` adds the search (src/search.js, ~1 to 3 s a shift).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const hospital = HOSPITALS[args.includes("--hopital") ? args[args.indexOf("--hopital") + 1] : "moyen"];
if (!hospital) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
const settings = {
  ...hospital,
  ...(args.includes("--accident") ? { crisis: ACCIDENT } : {}),
  ...(args.includes("--boxes") ? { boxes: option("--boxes") } : {}),
  ...(args.includes("--doctors") ? { doctors: option("--doctors") } : {}),
};
const shifts = option("--shifts", 200);
const searching = args.includes("--search");
const budget = searching && /^\d+$/.test(args[args.indexOf("--search") + 1] ?? "") ? Number(args[args.indexOf("--search") + 1]) : undefined;
const result = compareRules({ shifts, settings, rules: searching ? { ...RULES, search: searchRule(budget ? { budget } : {}) } : RULES });
const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");

console.log(`${hospital.label}, ${settings.boxes} box, ${settings.doctors} médecins : ${shifts} gardes de 8 h tirées${settings.crisis ? ", avec l'accident" : ""} ; mêmes patients pour chaque règle.`);
console.log("Règle                     | coût du retard | gain sur l'arrivée (IC 95 %) | en retard | aggravés | urgents à temps | attente moy. | pic en salle");
for (const [name, row] of Object.entries(result)) {
  const gain = row.gain && name !== "arrival" ? `${fixed(row.gain.mean)} (${fixed(row.gain.low)} à ${fixed(row.gain.high)})` : "—";
  console.log(
    [RULE_LABELS[name].padEnd(25), fixed(row.lateCost).padStart(14), gain.padStart(28), fixed(row.late, 1).padStart(9), fixed(row.worsened, 2).padStart(8), `${fixed(100 * row.urgentInTime)} %`.padStart(15), `${fixed(row.meanWait)} min`.padStart(12), fixed(row.peakWaiting, 1).padStart(12)].join(" | "),
  );
}
