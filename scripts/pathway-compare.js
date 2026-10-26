import { HOSPITALS } from "../src/hypotheses.js";
import { comparePathwayRules } from "../src/pathway-compare.js";

/**
 * `node scripts/pathway-compare.js [--days 50] [--hopital proximite|moyen|chu] [--accident] [--hiver]` (Sami, 25/10/2026, the
 * detailed pathway's step 1): the reference rules on the same drawn days, a line each (src/pathway-compare.js, which
 * the page's Stats tab shares). The late cost at the level of the moment, and its gain on the arrival order (box) or
 * on the oldest decision (bed), by pairs over the same days; then the peaks and maxima (docs/recherche/indicateurs.md).
 * `--hiver`: a day at the peak of a winter epidemic (pathway-epidemic.js); `--familles`, `--interpretes`, `--circuit-court`,
 * `--deces`: the later additions (docs/parcours-ajouts.md), the deaths then counted in the cost at their weight.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const hospital = option("--hopital", "moyen");
if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
const accident = args.includes("--accident");
const epidemic = args.includes("--hiver");
// The later additions (docs/parcours-ajouts.md), each by its flag.
const ADDITION_FLAGS = { "--familles": ["family", "les familles"], "--interpretes": ["interpreter", "l'interprète"], "--circuit-court": ["fastTrack", "le circuit court"], "--deces": ["deaths", "les décès"] };
const additions = Object.entries(ADDITION_FLAGS).filter(([flag]) => args.includes(flag)).map(([, addition]) => addition);
const withAdditions = additions.length ? ", avec " + additions.map(([, label]) => label).join(", ") : "";
const days = Number(option("--days", 50));

const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
const hours = (minutes) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")}`;
const gainOf = (gain) => (gain ? `${fixed(gain.mean)} (${fixed(gain.low)} à ${fixed(gain.high)})` : "—");

console.log(`${HOSPITALS[hospital].label}${accident ? ", avec l'accident" : ", jour ordinaire"}${epidemic ? ", en pleine épidémie d'hiver" : ""}${withAdditions} : ${days} journées de 24 h tirées, mêmes patients pour chaque règle. Moyennes par journée.`);
console.log(["Règle".padEnd(42), "coût au moment", "gain (IC 95 %)".padStart(26), "partis", "pic att.", "att. max 1-2", "passage p90", "< 4 h", "boarding max", "75+ la nuit", "plus pleine"].join(" | "));
for (const row of comparePathwayRules({ days, hospital, accident, epidemic, ...Object.fromEntries(additions.map(([name]) => [name, true])) })) {
  console.log(
    [
      row.name.padEnd(42),
      fixed(row.lateCostNow).padStart(14),
      gainOf(row.gain).padStart(26),
      fixed(row.left, 1).padStart(6),
      fixed(row.peakWaiting, 1).padStart(8),
      `${fixed(row.maxWaitUrgent)} min`.padStart(12),
      hours(row.stayP90).padStart(11),
      `${fixed(100 * row.within4h)} %`.padStart(5),
      hours(row.boardingMax).padStart(12),
      fixed(row.elderlyNights, 1).padStart(11),
      row.busiest,
    ].join(" | "),
  );
}
