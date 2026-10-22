import { compareRules } from "../src/compare.js";
import { ACCIDENT, COLOURS, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { RULE_LABELS, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { simulateShift } from "../src/simulate.js";
import { boxRows, curvePath, scaleOf, summaryOf, waitingCurve, worstPatients } from "./view.js";

/**
 * The page: a shift drawn from a seed, played under the chosen rule, in the chosen hospital, with or without
 * the accident; then the three rules on the same 100 shifts. What it shows is computed in view.js; this
 * module only draws and listens (event delegation on #app).
 */
const COMPARED = 100;
const state = { hospital: "moyen", accident: true, rule: "colour", seed: 1, compared: null };
const app = document.getElementById("app");

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== false && value !== undefined) node.setAttribute(key, value === true ? "" : value);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}
const svg = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const settingsOf = () => ({ ...HOSPITALS[state.hospital], ...(state.accident ? { crisis: ACCIDENT } : {}) });

function select(name, options, current) {
  return el("select", { "data-knob": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

function controls() {
  return el(
    "div",
    { class: "controls" },
    el("label", {}, "Hôpital", select("hospital", Object.entries(HOSPITALS).map(([id, one]) => [id, `${one.label} (${one.boxes} box, ${one.doctors} médecins)`]), state.hospital)),
    el("label", {}, "Situation", select("accident", [["oui", "accident à 09:30 (10 victimes)"], ["non", "jour ordinaire"]], state.accident ? "oui" : "non")),
    el("label", {}, "Règle", select("rule", Object.entries(RULE_LABELS), state.rule)),
    el("label", {}, "Garde n°", el("input", { type: "number", min: "1", value: String(state.seed), "data-knob": "seed", inputmode: "numeric" })),
    el("button", { type: "button", class: "quiet", "data-action": "next" }, "Garde suivante"),
    el("button", { type: "button", "data-action": "compare" }, `Comparer les règles sur ${COMPARED} gardes`),
  );
}

function timeline(patients, settings, scale) {
  const axis = el("div", { class: "row axis" }, el("span", { class: "label" }), el("div", { class: "track" }, ...scale.ticks.map((tick) => el("span", { class: "tick", style: `left:${tick.left}%` }, tick.label))));
  const rows = boxRows(patients, settings.boxes, scale).map((row) =>
    el(
      "div",
      { class: "row" },
      el("span", { class: "label" }, `Box ${row.box + 1}`),
      el("div", { class: "track" }, ...row.bars.map((bar) => el("span", { class: `bar ${bar.colour}`, style: `left:${bar.left}%;width:${bar.width}%;--exam:${bar.exam}%`, title: bar.title }))),
    ),
  );
  return el("div", { class: "timeline", role: "img", "aria-label": "Occupation des box au fil de la garde" }, axis, ...rows);
}

function waitingChart(patients, scale) {
  const curve = waitingCurve(patients);
  const size = { width: 1000, height: 120 };
  const chart = svg("svg", { viewBox: `0 0 ${size.width} ${size.height}`, preserveAspectRatio: "none", class: "curve", role: "img", "aria-label": `Salle d'attente : ${curve.peak} patients au plus` });
  if (state.accident) chart.append(svg("rect", { x: (scale.at(ACCIDENT.at) * size.width) / 100, y: 0, width: (scale.at(ACCIDENT.over) * size.width) / 100, height: size.height, class: "crisis" }));
  chart.append(svg("path", { d: curvePath(curve, scale, size), class: "line" }));
  return el("figure", { class: "chart" }, el("figcaption", {}, `Salle d'attente, au plus ${curve.peak} patients${state.accident ? " (en ocre : l'arrivée des victimes)" : ""}`), chart);
}

function worstTable(patients) {
  const rows = worstPatients(patients).map((one) =>
    el(
      "tr",
      {},
      el("td", {}, String(one.id)),
      el("td", {}, one.source),
      el("td", {}, el("span", { class: `dot ${one.colour}` }), one.colour),
      el("td", { class: one.mistriaged ? "hidden-truth wrong" : "hidden-truth" }, el("span", { class: `dot ${one.truth}` }), one.truth),
      el("td", {}, one.arrival),
      el("td", { class: "num" }, `${one.wait} min`),
      el("td", { class: "num" }, `${one.late} min`),
      el("td", { class: "num" }, one.worsened ? `+${one.worsened}` : ""),
      el("td", { class: "num" }, String(one.cost)),
    ),
  );
  if (rows.length === 0) return el("p", { class: "hint" }, "Personne n'a attendu au-delà du délai de son niveau réel.");
  const head = ["n°", "arrivée par", "bracelet", "niveau réel (caché)", "arrivé à", "attente", "retard", "aggravé", "coût"].map((label) => el("th", {}, label));
  return el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)));
}

function comparison() {
  if (!state.compared) return [];
  const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
  const rows = Object.entries(state.compared).map(([name, row]) =>
    el(
      "tr",
      { class: name === state.rule ? "current" : null },
      el("td", {}, RULE_LABELS[name]),
      el("td", { class: "num" }, fixed(row.lateCost)),
      el("td", { class: "num" }, name === "arrival" ? "—" : `${fixed(row.gain.mean)} (${fixed(row.gain.low)} à ${fixed(row.gain.high)})`),
      el("td", { class: "num" }, fixed(row.worsened, 1)),
      el("td", { class: "num" }, `${fixed(100 * row.urgentInTime)} %`),
      el("td", { class: "num" }, `${fixed(row.meanWait)} min`),
    ),
  );
  const head = ["Règle", "coût du retard", "gain sur l'arrivée (IC 95 %)", "aggravés", "urgents à temps", "attente moyenne"].map((label) => el("th", {}, label));
  return [el("h2", {}, `Les trois règles sur les mêmes ${COMPARED} gardes`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)))];
}

function legend() {
  return el("p", { class: "legend hint" }, ...Object.values(COLOURS).map((colour) => el("span", { class: "legend-item" }, el("span", { class: `dot ${colour}` }), colour)), " Partie foncée d'une barre : l'examen, avec un médecin ; partie claire : les soins, le box seul.");
}

function render() {
  const settings = { ...DEFAULTS, ...settingsOf() };
  const { patients, measures } = simulateShift(drawShift(state.seed, settings), RULES[state.rule], settings);
  const scale = scaleOf(patients);
  app.replaceChildren(
    controls(),
    el("p", { class: "summary" }, summaryOf(measures)),
    el("h2", {}, "Les box"),
    timeline(patients, settings, scale),
    legend(),
    waitingChart(patients, scale),
    el("h2", {}, "Les patients les plus mal servis, et ce que personne ne voyait"),
    worstTable(patients),
    ...comparison(),
  );
}

const ACTIONS = {
  next: () => {
    state.seed += 1;
  },
  compare: () => {
    state.compared = compareRules({ shifts: COMPARED, settings: settingsOf() });
  },
};

app.addEventListener("change", (event) => {
  const name = event.target.dataset?.knob;
  if (!name) return;
  if (name === "accident") state.accident = event.target.value === "oui";
  else if (name === "seed") state.seed = Math.max(1, Number(event.target.value) || 1);
  else state[name] = event.target.value;
  if (name !== "rule" && name !== "seed") state.compared = null;
  render();
});
app.addEventListener("click", (event) => {
  const action = event.target.closest?.("[data-action]")?.dataset.action;
  if (!ACTIONS[action]) return;
  ACTIONS[action]();
  render();
});
render();
