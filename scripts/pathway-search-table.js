import { HOSPITALS } from "../src/hypotheses.js";
import { ALERT_SEARCHED, BED_SEARCHED, BREAK_SEARCHED, HET_SEARCHED, INTERN_SEARCHED, QUEUE_SEARCHED, SAUV_SEARCHED, searchRows } from "../src/pathway-search-compare.js";
import { QUEUE_LABELS } from "../src/pathway-queues.js";
import { INTERN_LABELS } from "../src/pathway-intern-decided.js";
import { BED_LABELS } from "../src/pathway.js";
import { RULE_LABELS } from "../src/rules.js";

/**
 * The table of scripts/pathway-search-compare.js, from its days' results (`{ seed, measures }`) and the run's
 * settings: played in one go, or gathered from its slices' files (`--gather`).
 */

const BREAK_NAMES = { none: "aucune pause", quiet: "au creux (la règle)", decided: "au creux, une à une", search: "la recherche" };
const TRIGGERS = { never: "jamais", threshold: "au seuil", search: "la recherche" };
const SAUV_NAMES = { never: "jamais", longest: "le plus ancien, dès qu'un rouge attend", search: "la recherche" };
const bedName = (name) => (name === "search" ? "la recherche" : BED_LABELS[name]);
const queueName = (name) => ({ fixed: "l'ordre fixe", search: "la recherche" })[name] ?? `décidé, ${QUEUE_LABELS[name]}`;
const internName = (name) => ({ none: "pas d'interne", search: "la recherche" })[name] ?? INTERN_LABELS[name];

/** Each kind's row names. */
const LABELS = {
  beds: (name) => `lit : ${bedName(name)}`,
  breaks: (name) => `pauses : ${BREAK_NAMES[name]}`,
  interns: (name) => `interne : ${internName(name)}`,
  queues: (name) => `scanner et bloc : ${queueName(name)}`,
  alerts: (name) => `plan blanc : ${TRIGGERS[name]}`,
  hets: (name) => `HET : ${TRIGGERS[name]}`,
  sauvs: (name) => `sortie de SAUV : ${SAUV_NAMES[name]}`,
  boxes: (name) => RULE_LABELS[name],
};
const NAMES = { beds: BED_SEARCHED, breaks: BREAK_SEARCHED, interns: INTERN_SEARCHED, queues: QUEUE_SEARCHED, alerts: ALERT_SEARCHED, hets: HET_SEARCHED, sauvs: SAUV_SEARCHED, boxes: undefined };

const fixed = (value) => Math.round(value).toLocaleString("fr-FR");
const comma = (value, digits) => value.toFixed(digits).replace(".", ",");
const gainOf = (g) => `${fixed(g.mean)} (${fixed(g.low)} à ${fixed(g.high)})`;
/** The mean over the days of what `read` takes from a row's measures. */
const average = (results, name, read) => results.reduce((sum, one) => sum + read(one.measures[name]), 0) / results.length;
const internFigure = (results, name, read) => comma(average(results, name, (m) => (m.intern ? read(m.intern) : 0)), 2);

/** What each kind of comparison adds to a row, after the cost and the departures. */
const EXTRAS = {
  beds: (row) => ` · boarding max ${Math.round(row.boardingMax)} min · 75+ la nuit ${comma(row.elderlyNights, 1)}`,
  breaks: (row, results) => {
    const of = (key) => comma(average(results, row.name, (m) => m.fatigue[key]), 1);
    return ` · repas ${of("meals")} · repos ${of("rests")} · sans pause au plus ${of("longest")} h`;
  },
  interns: (row, results) => (row.name === "none" ? "" : ` · passage méd. ${Math.round(row.stayMedian)} min · tâches en retard ${internFigure(results, row.name, (i) => i.late)} · retard moyen ${internFigure(results, row.name, (i) => i.lateness.mean)} min · aggravations vues ${internFigure(results, row.name, (i) => i.recoloured)}`),
  alerts: (row, results) => ` · retard seul ${Math.round(average(results, row.name, (m) => m.lateCostOnly))} · heures de médecin rappelées ${comma(average(results, row.name, (m) => m.alert.hours), 1)}`,
  hets: (row, results) => ` · retard seul ${Math.round(average(results, row.name, (m) => m.lateCostOnly))} · attente d'un lit ${Math.round(average(results, row.name, (m) => m.boardingCost))} · lits obtenus ${comma(average(results, row.name, (m) => m.het.beds), 1)} · boarding max ${Math.round(row.boardingMax)} min`,
};

/** The table's first line: the hospital, the day, the additions, how many days and how they were played. */
function titleOf({ hospital, options, additions, budget }, results, how) {
  const situation = `${options.accident ? ", avec l'accident" : ", jour ordinaire"}${options.epidemic ? ", en pleine épidémie d'hiver" : ""}`;
  const added = `${additions.length ? ", avec " + additions.join(", ") : ""}${options.walk ? ", marche comptée" : ""}`;
  const seeds = results.length && results[0].seed !== 1 ? ` (graines ${results[0].seed} à ${results.at(-1).seed})` : "";
  return `${HOSPITALS[hospital].label}${situation}${added} : ${results.length} journées${seeds}, la recherche à ${budget} itérations, ${how}.`;
}

/** Prints the table: a line per rule, the search's gain on each by pairs over the same days. */
export function printSearchTable(results, settings, how) {
  const { kind } = settings;
  console.log(titleOf(settings, results, how));
  for (const row of searchRows(results.map((one) => one.measures), NAMES[kind])) {
    const against = row.gain ? ` · la recherche contre elle : ${gainOf(row.gain)}` : "";
    const extra = EXTRAS[kind]?.(row, results) ?? "";
    console.log(`${LABELS[kind](row.name).padEnd(36)} coût au moment ${fixed(row.lateCostNow).padStart(8)} · partis ${comma(row.left, 1)}${extra}${against}`);
  }
}
