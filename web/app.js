import { paired } from "mcts-commun/measure.js";
import { compareRules } from "../src/compare.js";
import { ACCIDENT, COLOURS, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { NURSE_LABELS, NURSE_RULES, RULE_LABELS, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { searchRule } from "../src/search.js";
import { act, courseOf, measuresOf, nextChoice, simulateShift, startShift } from "../src/simulate.js";
import { boxRows, clock, curvePath, scaleOf, summaryOf, waitingCurve, worstPatients } from "./view.js";

/**
 * The page: a shift drawn from a seed, played under the chosen rule, in the chosen hospital, with or without
 * the accident, with or without a triage nurse who re-assesses the waiting patients; then the rules on the
 * same shifts. The search (src/search.js) thinks for a while at each choice: its shifts are played choice by
 * choice, the page breathing between two. What it shows is computed in view.js; this module only draws and
 * listens (event delegation on #app).
 */
const COMPARED = 100;
const COMPARED_WITH_SEARCH = 12;
const state = { hospital: "moyen", accident: true, rule: "colour", nurse: "none", seed: 1, compared: null, result: null, busy: "", run: 0 };
const app = document.getElementById("app");
const ruleOf = (name) => (name === "search" ? searchRule() : RULES[name]);
const nurseRuleOf = (name) => (name === "search" ? searchRule() : (NURSE_RULES[name] ?? null));
const searching = () => state.rule === "search" || state.nurse === "search";

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
const settingsOf = () => ({ ...DEFAULTS, ...HOSPITALS[state.hospital], ...(state.accident ? { crisis: ACCIDENT } : {}), nurses: state.nurse === "none" ? 0 : 1 });
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Plays a shift choice by choice, breathing between two; null if a newer run started meanwhile. */
async function playShift(patients, rule, nurseRule, settings, run, label) {
  const shift = startShift(patients, settings);
  let choices = 0;
  for (let kind = nextChoice(shift); kind; kind = nextChoice(shift)) {
    act(shift, kind, rule, nurseRule);
    choices += 1;
    if (choices % 3 === 0) {
      state.busy = `${label} : ${choices} choix, ${clock(shift.events.now)}`;
      renderBusy();
      await breathe();
      if (run !== state.run) return null;
    }
  }
  const course = courseOf(shift);
  return { patients: course, measures: measuresOf(course, shift) };
}

async function refresh() {
  stopWorkers();
  const run = ++state.run;
  const settings = settingsOf();
  const patients = drawShift(state.seed, settings);
  if (!searching()) {
    state.result = simulateShift(patients, RULES[state.rule], settings, nurseRuleOf(state.nurse));
    state.busy = "";
    render();
    return;
  }
  const result = await playShift(patients, ruleOf(state.rule), nurseRuleOf(state.nurse), settings, run, "La recherche réfléchit");
  if (!result) return;
  Object.assign(state, { result, busy: "" });
  render();
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const urgentInTime = (measures) => {
  const urgent = [1, 2].map((level) => measures.byLevel[level]);
  const seen = urgent.reduce((sum, group) => sum + group.count, 0);
  return seen ? urgent.reduce((sum, group) => sum + group.inTime * group.count, 0) / seen : 1;
};

/** The workers playing the comparison's shifts side by side: every core but two, one a shift at most. */
let workers = [];
function stopWorkers() {
  for (const worker of workers) worker.terminate();
  workers = [];
}

/**
 * Plays every `jobs` entry (`{ seed, rule }`) in the workers, the page drawing the count as they finish;
 * the measures in the jobs' order, or null if a newer run started meanwhile.
 */
function playInWorkers(jobs, settings, run) {
  stopWorkers();
  const size = Math.max(1, Math.min(jobs.length, (navigator.hardwareConcurrency || 4) - 2));
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  return new Promise((resolve) => {
    const feed = (worker) => {
      if (next >= jobs.length) return;
      const job = next++;
      worker.postMessage({ job, seed: jobs[job].seed, settings, rule: jobs[job].rule, nurse: state.nurse });
    };
    for (let i = 0; i < size; i += 1) {
      const worker = new Worker(new URL("./shift-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => {
        if (run !== state.run) return;
        results[data.job] = data.measures;
        done += 1;
        state.busy = `Comparaison : ${done} gardes jouées sur ${jobs.length} (${size} en parallèle)`;
        renderBusy();
        if (done === jobs.length) {
          stopWorkers();
          resolve(results);
        } else feed(worker);
      };
      workers.push(worker);
      feed(worker);
    }
  });
}

/** The four rules, the search among them, on the same few shifts with the same nurse, the shifts side by side in workers. */
async function compareWithSearch() {
  const run = ++state.run;
  const settings = settingsOf();
  const runs = { arrival: [], colour: [], deadline: [], search: [] };
  const jobs = Object.keys(runs).flatMap((rule) => Array.from({ length: COMPARED_WITH_SEARCH }, (_, i) => ({ rule, seed: state.seed + i })));
  // The search's shifts first: they are the long ones.
  jobs.sort((a, b) => (b.rule === "search") - (a.rule === "search"));
  state.busy = "Comparaison : les gardes partent dans les workers…";
  renderBusy();
  const results = await playInWorkers(jobs, settings, run);
  if (!results) return;
  jobs.forEach((job, i) => runs[job.rule].push({ seed: job.seed, measures: results[i] }));
  for (const name of Object.keys(runs)) runs[name] = runs[name].sort((a, b) => a.seed - b.seed).map((one) => one.measures);
  const baseline = runs.arrival.map((one) => one.lateCost);
  state.compared = Object.fromEntries(Object.entries(runs).map(([name, measures]) => [name, { lateCost: mean(measures.map((one) => one.lateCost)), lateCostNow: mean(measures.map((one) => one.lateCostNow)), worsened: mean(measures.map((one) => one.worsened)), meanWait: mean(measures.map((one) => one.meanWait)), urgentInTime: mean(measures.map(urgentInTime)), gain: paired(baseline, measures.map((one) => one.lateCost)) }]));
  state.compared.count = COMPARED_WITH_SEARCH;
  state.busy = "";
  render();
}

function select(name, options, current) {
  return el("select", { "data-knob": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

function controls() {
  const count = searching() ? COMPARED_WITH_SEARCH : COMPARED;
  return el(
    "div",
    { class: "controls" },
    el("label", {}, "Hôpital", select("hospital", Object.entries(HOSPITALS).map(([id, one]) => [id, `${one.label} (${one.boxes} box, ${one.doctors} médecins)`]), state.hospital)),
    el("label", {}, "Situation", select("accident", [["oui", "accident à 09:30 (10 victimes)"], ["non", "jour ordinaire"]], state.accident ? "oui" : "non")),
    el("label", {}, "Règle", select("rule", Object.entries(RULE_LABELS), state.rule)),
    el("label", {}, "Réévaluation (un infirmier)", select("nurse", Object.entries(NURSE_LABELS), state.nurse)),
    el("label", {}, "Garde n°", el("input", { type: "number", min: "1", value: String(state.seed), "data-knob": "seed", inputmode: "numeric" })),
    el("button", { type: "button", class: "quiet", "data-action": "next" }, "Garde suivante"),
    el("button", { type: "button", "data-action": "compare" }, `Comparer les règles sur ${count} gardes`),
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
      el("td", {}, el("span", { class: `dot ${one.colour}` }), one.firstColour === one.colour ? one.colour : `${one.colour} (était ${one.firstColour})`),
      el("td", { class: one.mistriaged ? "hidden-truth wrong" : "hidden-truth" }, el("span", { class: `dot ${one.truth}` }), one.truth),
      el("td", {}, one.arrival),
      el("td", { class: "num" }, `${one.wait} min`),
      el("td", { class: "num" }, `${one.late} min`),
      el("td", { class: "num" }, one.worsened ? `+${one.worsened}` : ""),
      el("td", { class: "num" }, String(one.cost)),
    ),
  );
  if (rows.length === 0) return el("p", { class: "hint" }, "Personne n'a attendu au-delà du délai de son niveau réel.");
  const head = ["n°", "arrivée par", "bracelet", "niveau réel (caché)", "arrivé à", "attente", "retard", "aggravé", "coût"].map((label, i) => el("th", { class: i >= 5 ? "num" : null }, label));
  return el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)));
}

function comparison() {
  if (!state.compared) return [];
  const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
  const rows = Object.entries(state.compared)
    .filter(([name]) => RULE_LABELS[name])
    .map(([name, row]) =>
      el(
        "tr",
        { class: name === state.rule ? "current" : null },
        el("td", {}, RULE_LABELS[name]),
        el("td", { class: "num" }, fixed(row.lateCost)),
        el("td", { class: "num" }, fixed(row.lateCostNow)),
        el("td", { class: "num" }, name === "arrival" ? "—" : `${fixed(row.gain.mean)} (${fixed(row.gain.low)} à ${fixed(row.gain.high)})`),
        el("td", { class: "num" }, fixed(row.worsened, 1)),
        el("td", { class: "num" }, `${fixed(100 * row.urgentInTime)} %`),
        el("td", { class: "num" }, `${fixed(row.meanWait)} min`),
      ),
    );
  const head = ["Règle", "coût du retard", "au niveau du moment", "gain sur l'arrivée (IC 95 %)", "aggravés", "urgents à temps", "attente moyenne"].map((label, i) => el("th", { class: i > 0 ? "num" : null }, label));
  return [el("h2", {}, `Les règles sur les mêmes ${state.compared.count ?? COMPARED} gardes`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)))];
}

function legend() {
  return el("p", { class: "legend hint" }, ...Object.values(COLOURS).map((colour) => el("span", { class: "legend-item" }, el("span", { class: `dot ${colour}` }), colour)), " Partie foncée d'une barre : l'examen, avec un médecin ; partie claire : les soins, le box seul.");
}

/** While the search thinks: the controls and where it is. */
function renderBusy() {
  app.replaceChildren(controls(), el("p", { class: "summary busy", role: "status" }, state.busy));
}

function render() {
  if (state.busy || !state.result) {
    renderBusy();
    return;
  }
  const settings = settingsOf();
  const { patients, measures } = state.result;
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
    refresh();
  },
  compare: () => {
    if (searching()) {
      compareWithSearch();
      return;
    }
    state.compared = compareRules({ shifts: COMPARED, settings: settingsOf(), nurseRule: nurseRuleOf(state.nurse) });
    render();
  },
};

app.addEventListener("change", (event) => {
  const name = event.target.dataset?.knob;
  if (!name) return;
  if (name === "accident") state.accident = event.target.value === "oui";
  else if (name === "seed") state.seed = Math.max(1, Number(event.target.value) || 1);
  else state[name] = event.target.value;
  if (name !== "seed") state.compared = null;
  state.busy = searching() ? "La recherche réfléchit…" : "";
  refresh();
});
app.addEventListener("click", (event) => {
  const action = event.target.closest?.("[data-action]")?.dataset.action;
  if (ACTIONS[action]) ACTIONS[action]();
});
refresh();
