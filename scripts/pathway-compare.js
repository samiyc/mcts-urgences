import { paired } from "mcts-commun/measure.js";
import { HOSPITALS } from "../src/hypotheses.js";
import { BED_LABELS, BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULE_LABELS, RULES } from "../src/rules.js";

/**
 * `node scripts/pathway-compare.js [--days 50] [--hopital proximite|moyen|chu] [--accident]` (Sami, 25/10/2026, the
 * detailed pathway's step 1): the reference rules on the same drawn days, a line each. The box rules (rules.js) under
 * the oldest bed decision, then the bed rules under the colour box rule. The late cost at the level of the moment, and
 * its gain on the arrival order (box) or on the oldest decision (bed), by pairs over the same days; then the peaks and
 * maxima (docs/recherche/indicateurs.md).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const hospital = option("--hopital", "moyen");
if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
const accident = args.includes("--accident");
const days = Number(option("--days", 50));

const pairs = [
  ...Object.keys(RULES).map((box) => ({ name: `box : ${RULE_LABELS[box]}`, box: RULES[box], bed: BED_RULES.oldest, group: "box", key: box })),
  ...Object.keys(BED_RULES).map((bed) => ({ name: `lit : ${BED_LABELS[bed]}`, box: RULES.colour, bed: BED_RULES[bed], group: "bed", key: bed })),
];
const runs = pairs.map(() => []);
for (let i = 0; i < days; i += 1) {
  const drawn = drawPathwayDay(1 + i, { hospital, accident });
  pairs.forEach((one, k) => runs[k].push(pathwayMeasures(runPathway(startPathway(drawn), one))));
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
const hours = (minutes) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")}`;
const baselineOf = { box: runs[pairs.findIndex((one) => one.key === "arrival")], bed: runs[pairs.findIndex((one) => one.group === "bed" && one.key === "oldest")] };

console.log(`${HOSPITALS[hospital].label}${accident ? ", avec l'accident" : ", jour ordinaire"} : ${days} journées de 24 h tirées, mêmes patients pour chaque règle. Moyennes par journée.`);
console.log(
  ["Règle".padEnd(42), "coût au moment", "gain (IC 95 %)".padStart(26), "partis", "pic att.", "att. max 1-2", "passage p90", "< 4 h", "boarding max", "75+ la nuit", "plus pleine"].join(" | "),
);
pairs.forEach((one, k) => {
  const measures = runs[k];
  const baseline = baselineOf[one.group];
  const gain = baseline === measures ? "—" : (({ mean: m, low, high }) => `${fixed(m)} (${fixed(low)} à ${fixed(high)})`)(paired(baseline.map((x) => x.lateCostNow), measures.map((x) => x.lateCostNow)));
  const busiest = Object.entries(measures.reduce((count, x) => ({ ...count, [x.busiest]: (count[x.busiest] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0];
  console.log(
    [
      one.name.padEnd(42),
      fixed(mean(measures.map((x) => x.lateCostNow))).padStart(14),
      gain.padStart(26),
      fixed(mean(measures.map((x) => x.exits.parti)), 1).padStart(6),
      fixed(mean(measures.map((x) => x.peak.waiting)), 1).padStart(8),
      `${fixed(mean(measures.map((x) => Math.max(x.maxWait[1], x.maxWait[2]))))} min`.padStart(12),
      hours(mean(measures.map((x) => x.stay.p90))).padStart(11),
      `${fixed(100 * mean(measures.map((x) => x.stay.within4h)))} %`.padStart(5),
      hours(mean(measures.map((x) => x.boarding.max))).padStart(12),
      fixed(mean(measures.map((x) => x.boarding.elderlyNights)), 1).padStart(11),
      busiest,
    ].join(" | "),
  );
});
