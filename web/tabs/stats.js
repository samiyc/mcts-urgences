import { RULE_LABELS } from "../../src/rules.js";
import { comparison } from "../charts.js";
import { el } from "../dom.js";
import { panelOf } from "../knobs.js";

/**
 * The tab « Stats » (Sami, 26/10/2026): the rules on the same shifts (the simple shift, with or without the search,
 * in workers), the rules of the detailed pathway on the same days (src/pathway-compare.js), and what the search wins
 * in the night measures (docs/changelog.json). `ctx`: the page's `state`, `counts` (the shifts compared).
 */
const DAYS = ["10", "20", "50"];
const decimal = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
const hours = (minutes) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")}`;

export const statsPanel = ({ state, counts }) =>
  panelOf(
    "Comparer",
    state,
    ["hospital", "accident", "rule", "nurse"],
    el("button", { type: "button", "data-action": "compare" }, `La garde : ${counts()} gardes`),
    el("label", {}, "Le parcours : journées", el("select", { "data-stat": "days" }, ...DAYS.map((days) => el("option", { value: days, selected: Number(days) === state.pathwayDays }, `${days} journées de 24 h`)))),
    el("button", { type: "button", "data-action": "comparePathway" }, "Comparer les règles du parcours"),
    el("button", { type: "button", "data-action": "compareFatigue" }, "Comparer les pauses des médecins"),
    el("button", { type: "button", "data-action": "compareSearchPathway" }, "La recherche sur le parcours (8 journées, dans des workers)"),
    el("p", { class: "hint" }, "Les mêmes patients pour chaque règle ; le gain, par paires, avec son intervalle à 95 %. Le parcours se joue sur le plan de l'onglet Parcours détaillé."),
  );

const PATHWAY_HEAD = ["Règle", "coût au moment", "gain (IC 95 %)", "partis", "pic d'attente", "attente max 1-2", "passage p90", "sortis < 4 h", "boarding max", "75+ la nuit", "plus pleine"];

const pathwayRow = (row) =>
  el(
    "tr",
    {},
    el("td", {}, row.name),
    ...[
      decimal(row.lateCostNow),
      row.gain ? `${decimal(row.gain.mean)} (${decimal(row.gain.low)} à ${decimal(row.gain.high)})` : "—",
      decimal(row.left, 1),
      decimal(row.peakWaiting, 1),
      `${decimal(row.maxWaitUrgent)} min`,
      hours(row.stayP90),
      `${decimal(100 * row.within4h)} %`,
      hours(row.boardingMax),
      decimal(row.elderlyNights, 1),
    ].map((value) => el("td", { class: "num" }, value)),
    el("td", {}, row.busiest),
  );

function pathwayTable({ rows, days, label }) {
  const head = PATHWAY_HEAD.map((text, i) => el("th", { class: i > 0 && i < 10 ? "num" : null }, text));
  return [el("h2", {}, `Le parcours détaillé : les règles sur les mêmes ${days} journées (${label})`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows.map(pathwayRow))))];
}

function gainsTable(gains) {
  if (!gains) return [];
  const rows = gains.gainsRows.map((cells) => el("tr", {}, ...cells.map((cell, i) => Object.assign(el("td", { class: i > 0 ? "num" : null }), { innerHTML: cell }))));
  return [el("h2", {}, gains.gainsTitle), el("p", { class: "hint" }, gains.gainsNote), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...gains.gainsHead.map((head, i) => el("th", { class: i > 0 ? "num" : null }, head)))), el("tbody", {}, ...rows)))];
}

const FATIGUE_HEAD = ["Pauses", "coût au moment", "gain sur aucune pause, 24 h (IC 95 %)", "passage médian", "résultats oubliés", "sans pause, au plus", "ralentissement", "repas", "repos"];

const fatigueCells = (f) => (f ? [decimal(f.oversights, 1), `${decimal(f.longest, 1)} h`, `${decimal(100 * f.slowing, 1)} %`, decimal(f.meals, 1), decimal(f.rests, 1)] : ["—", "—", "—", "—", "—"]);

const fatigueRow = (row) =>
  el(
    "tr",
    {},
    el("td", {}, row.name),
    ...[decimal(row.lateCostNow), row.gain ? `${decimal(row.gain.mean)} (${decimal(row.gain.low)} à ${decimal(row.gain.high)})` : "—", `${decimal(row.stayMedian)} min`, ...fatigueCells(row.fatigue)].map((value) => el("td", { class: "num" }, value)),
  );

function fatigueTable({ rows, days, label }) {
  const head = FATIGUE_HEAD.map((text, i) => el("th", { class: i > 0 ? "num" : null }, text));
  return [el("h2", {}, `La fatigue des médecins et leurs pauses, sur les mêmes ${days} journées (${label})`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows.map(fatigueRow))))];
}

const searchRow = (row) =>
  el(
    "tr",
    { class: row.name === "search" ? "current" : null },
    el("td", {}, RULE_LABELS[row.name]),
    ...[decimal(row.lateCostNow), row.gain ? `${decimal(row.gain.mean)} (${decimal(row.gain.low)} à ${decimal(row.gain.high)})` : "—", decimal(row.left, 1), `${decimal(row.stayMedian)} min`].map((value) => el("td", { class: "num" }, value)),
  );

function searchTable({ rows, days, budget, label }) {
  const head = ["Règle des box", "coût au moment", "la recherche contre elle (IC 95 %)", "partis", "passage médian"].map((text, i) => el("th", { class: i > 0 ? "num" : null }, text));
  return [
    el("h2", {}, `La recherche sur le parcours, ${budget} itérations, sur les mêmes ${days} journées (${label})`),
    el("p", { class: "hint" }, "Un tri rapide : il peut écarter une idée, pas la promouvoir. Les mesures de nuit (night.json) la jouent sur 200 journées."),
    el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows.map(searchRow)))),
  ];
}

export function statsView({ state, counts }) {
  const parts = [...comparison(state.compared, state.rule, counts()), ...(state.pathwayCompared ? pathwayTable(state.pathwayCompared) : []), ...(state.fatigueCompared ? fatigueTable(state.fatigueCompared) : []), ...(state.searchCompared ? searchTable(state.searchCompared) : []), ...gainsTable(state.gains)];
  return parts.length ? parts : [el("p", { class: "hint" }, "Lancez une comparaison dans le panneau.")];
}
