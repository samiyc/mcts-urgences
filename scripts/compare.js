import { compareRules, summariesOf } from "../src/compare.js";
import { ACCIDENT, HOSPITALS } from "../src/hypotheses.js";
import { RULE_LABELS, RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { addResult, gatherResults, optionOf, progressReporter, startResults } from "./night-results.js";

/**
 * `npm run compare -- [--shifts 200] [--hopital proximite|moyen|chu] [--accident] [--boxes N] [--doctors N]
 * [--search [budget]] [--now]`: the reference rules on the same drawn shifts, a line each. `--accident` adds the example
 * crisis (ten victims 1 h 30 into the shift); `--search` adds the search (src/search.js, ~1 to 3 s a shift). `--now`
 * (23/10/2026): the search scored at the level of the moment, its best version, and the table at that level too
 * (the late cost while waiting, at each patient's true level of the moment, and its gain on the arrival order).
 * For the night's queue (27/10/2026, scripts/night-results.js): `--out FICHIER` writes each shift's measures as it
 * ends, `--gather FICHIER` prints the table of the shifts played, should the job stop before its end.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");

/** The run's settings, read from the command line: what its results file keeps as its header. */
function runOf() {
  const hospital = args.includes("--hopital") ? args[args.indexOf("--hopital") + 1] : "moyen";
  if (!HOSPITALS[hospital]) throw new Error(`hôpital inconnu ; au choix : ${Object.keys(HOSPITALS).join(", ")}`);
  const searching = args.includes("--search");
  const budget = searching && /^\d+$/.test(args[args.indexOf("--search") + 1] ?? "") ? Number(args[args.indexOf("--search") + 1]) : null;
  const sizes = { ...(args.includes("--boxes") ? { boxes: option("--boxes") } : {}), ...(args.includes("--doctors") ? { doctors: option("--doctors") } : {}) };
  return { hospital, accident: args.includes("--accident"), sizes, searching, budget, now: args.includes("--now"), days: option("--shifts", 200) };
}

const settingsOf = (run) => ({ ...HOSPITALS[run.hospital], ...(run.accident ? { crisis: ACCIDENT } : {}), ...run.sizes });

/** Plays the run's shifts, each said to the queue and written to `out` as it ends. */
function play(run, out) {
  const searchOptions = { ...(run.budget ? { budget: run.budget } : {}), ...(run.now ? { measure: "now" } : {}) };
  const report = progressReporter("garde", run.days);
  startResults(out, run);
  const onShift = (done, _of, seed, measures) => {
    addResult(out, { seed, measures });
    report(done);
  };
  return compareRules({ shifts: run.days, settings: settingsOf(run), rules: run.searching ? { ...RULES, search: searchRule(searchOptions) } : RULES, onShift });
}

/** The shifts of the files, gathered: each rule's measures shift by shift, then summed up as compareRules does. */
function gathered(files) {
  const { header, units, expected } = gatherResults(files);
  if (units.length < expected) process.exitCode = 1;
  const runs = Object.fromEntries(Object.keys(units[0].measures).map((name) => [name, units.map((unit) => unit.measures[name])]));
  return { run: { ...header, days: units.length }, result: summariesOf(runs) };
}

function print(run, result) {
  const settings = settingsOf(run);
  console.log(`${settings.label}, ${settings.boxes} box, ${settings.doctors} médecins : ${run.days} gardes de 8 h tirées${settings.crisis ? ", avec l'accident" : ""} ; mêmes patients pour chaque règle.`);
  console.log(`Règle                     | ${run.now ? "coût au moment" : "coût du retard"} | gain sur l'arrivée (IC 95 %) | en retard | aggravés | urgents à temps | attente moy. | pic en salle`);
  for (const [name, row] of Object.entries(result)) {
    const shown = run.now ? row.gainNow : row.gain;
    const gain = shown && name !== "arrival" ? `${fixed(shown.mean)} (${fixed(shown.low)} à ${fixed(shown.high)})` : "—";
    console.log(
      [RULE_LABELS[name].padEnd(25), fixed(run.now ? row.lateCostNow : row.lateCost).padStart(14), gain.padStart(28), fixed(row.late, 1).padStart(9), fixed(row.worsened, 2).padStart(8), `${fixed(100 * row.urgentInTime)} %`.padStart(15), `${fixed(row.meanWait)} min`.padStart(12), fixed(row.peakWaiting, 1).padStart(12)].join(" | "),
    );
  }
}

const gather = optionOf(args, "--gather", null);
if (gather) {
  const { run, result } = gathered(gather.split(","));
  print(run, result);
  if (process.exitCode) console.error("une tranche s'est arrêtée avant sa fin : le tableau ne porte que sur les gardes jouées");
} else {
  const run = runOf();
  print(run, play(run, optionOf(args, "--out", null)));
}
