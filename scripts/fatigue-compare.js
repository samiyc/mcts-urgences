import { HOSPITALS } from "../src/hypotheses.js";
import { compareBreakRules } from "../src/pathway-fatigue-compare.js";

/**
 * `node scripts/fatigue-compare.js [--days 20] [--hopital proximite|moyen|chu] [--accident] [--marche]` (Sami,
 * 26/10/2026, the detailed pathway's step 4): the break rules and the teams on the same days, a line each
 * (src/pathway-fatigue-compare.js, which the page's Stats tab shares).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const hospital = option("--hopital", "moyen");
if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
const accident = args.includes("--accident");
const walk = args.includes("--marche");
const days = Number(option("--days", 20));

const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
const gainOf = (gain) => (gain ? `${fixed(gain.mean)} (${fixed(gain.low)} à ${fixed(gain.high)})` : "—");
const or = (row, show) => (row.fatigue ? show(row.fatigue) : "—");

console.log(`${HOSPITALS[hospital].label}${accident ? ", avec l'accident" : ", jour ordinaire"}${walk ? ", marche comptée" : ""} : ${days} journées, mêmes patients. Moyennes par journée.`);
console.log(["Pauses".padEnd(44), "coût au moment", "gain sur aucune pause (IC 95 %)".padStart(32), "passage méd.", "oublis", "sans pause max", "ralenti", "repas", "repos"].join(" | "));
for (const row of compareBreakRules({ days, hospital, accident, walk })) {
  console.log(
    [
      row.name.padEnd(44),
      fixed(row.lateCostNow).padStart(14),
      gainOf(row.gain).padStart(32),
      `${fixed(row.stayMedian)} min`.padStart(12),
      or(row, (f) => fixed(f.oversights, 1)).padStart(6),
      or(row, (f) => `${fixed(f.longest, 1)} h`).padStart(14),
      or(row, (f) => `${fixed(100 * f.slowing, 1)} %`).padStart(7),
      or(row, (f) => fixed(f.meals, 1)).padStart(5),
      or(row, (f) => fixed(f.rests, 1)).padStart(5),
    ].join(" | "),
  );
}
