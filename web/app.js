import { compareRules } from "../src/compare.js";
import { ACCIDENT, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { NURSE_LABELS, NURSE_RULES, RULE_LABELS, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { searchRule } from "../src/search.js";
import { act, courseOf, measuresOf, nextChoice, simulateShift, startShift } from "../src/simulate.js";
import { comparison, legend, timeline, waitingChart, worstTable } from "./charts.js";
import { compareWithSearch, stopWorkers } from "./compare-workers.js";
import { el, select } from "./dom.js";
import { createLive } from "./live.js";
import { createPlayer } from "./player.js";
import { createWardPanel } from "./ward-panel.js";
import { clock, scaleOf, summaryOf } from "./view.js";

/**
 * The page: a shift drawn from a seed, played under the chosen rule, in the chosen hospital, with or without
 * the accident, with or without a triage nurse who re-assesses the waiting patients; then the rules on the
 * same shifts. The search (src/search.js) thinks for a while at each choice: its shifts are played choice by
 * choice, the page breathing between two. The played shift is replayed on a plan of the department, minute by
 * minute (`sceneAt`), at a chosen speed or from a slider. What it shows is computed in view.js; this module
 * only draws and listens (event delegation on #app).
 *
 * The parts: the charts (charts.js), the animated plan (live.js, live-plan.js), the comparison in workers
 * (compare-workers.js), playing the shift oneself (player.js) or on the plan (ward-panel.js).
 */
const COMPARED = 100;
const COMPARED_WITH_SEARCH = 12;
const state = { hospital: "moyen", accident: true, rule: "colour", nurse: "none", seed: 1, compared: null, result: null, busy: "", run: 0 };
const app = document.getElementById("app");
const ruleOf = (name) => (name === "search" ? searchRule() : RULES[name]);
const nurseRuleOf = (name) => (name === "search" ? searchRule() : (NURSE_RULES[name] ?? null));
const searching = () => state.rule === "search" || state.nurse === "search";
const settingsOf = () => ({ ...DEFAULTS, ...HOSPITALS[state.hospital], ...(state.accident ? { crisis: ACCIDENT } : {}), nurses: state.nurse === "none" ? 0 : 1 });
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));
const live = createLive({ result: () => state.result, settings: settingsOf });

/** Plays a shift choice by choice, breathing between two; null if a newer run started meanwhile. */
async function playShift(patients, { rule, nurseRule, settings, run, label }) {
  const shift = startShift(patients, settings);
  let choices = 0;
  for (let kind = nextChoice(shift); kind; kind = nextChoice(shift)) {
    act(shift, kind, rule, nurseRule);
    choices += 1;
    if (choices % 3 !== 0) continue;
    state.busy = `${label} : ${choices} choix, ${clock(shift.events.now)}`;
    renderBusy();
    await breathe();
    if (run !== state.run) return null;
  }
  const course = courseOf(shift);
  return { patients: course, measures: measuresOf(course, shift) };
}

async function refresh() {
  stopWorkers();
  live.reset();
  const run = ++state.run;
  const settings = settingsOf();
  const patients = drawShift(state.seed, settings);
  if (!searching()) {
    state.result = simulateShift(patients, RULES[state.rule], settings, nurseRuleOf(state.nurse));
    state.busy = "";
    render();
    return;
  }
  const result = await playShift(patients, { rule: ruleOf(state.rule), nurseRule: nurseRuleOf(state.nurse), settings, run, label: "La recherche réfléchit" });
  if (!result) return;
  Object.assign(state, { result, busy: "" });
  render();
}

async function compareSearching() {
  const run = ++state.run;
  const progress = (text) => {
    state.busy = text;
    renderBusy();
  };
  const compared = await compareWithSearch({ count: COMPARED_WITH_SEARCH, seed: state.seed, settings: settingsOf(), nurse: state.nurse, current: () => run === state.run, progress });
  if (!compared) return;
  Object.assign(state, { compared, busy: "" });
  render();
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

/** While the search thinks: the controls and where it is. */
function renderBusy() {
  app.replaceChildren(controls(), el("p", { class: "summary busy", role: "status" }, state.busy));
}

/** Playing the shift oneself (player.js): the game in front of the person takes the page while it lasts. */
const player = createPlayer({
  el,
  current: () => ({ hospital: state.hospital, accident: state.accident, seed: state.seed, nurse: state.nurse }),
  render: () => render(),
  setBusy: (text) => {
    state.busy = text;
    render();
  },
});

/** The department on its plan (ward-panel.js): while a game is on it, it takes the page too. */
const wardPanel = createWardPanel({
  el,
  current: () => ({ hospital: state.hospital, accident: state.accident, seed: state.seed, nurse: state.nurse, rule: state.rule }),
  render: () => render(),
});

/** The played shift: its summary, the games, the plan minute by minute, the boxes, the waiting room, the rules. */
function shiftView() {
  const settings = settingsOf();
  const { patients, measures } = state.result;
  const scale = scaleOf(patients);
  return [
    el("p", { class: "summary" }, summaryOf(measures)),
    player.view(),
    wardPanel.view(),
    el("h2", {}, "La garde, minute par minute"),
    live.section(),
    el("h2", {}, "Les box"),
    timeline(patients, settings, scale),
    legend(),
    waitingChart(patients, scale, state.accident),
    el("h2", {}, "Les patients les plus mal servis, et ce que personne ne voyait"),
    worstTable(patients),
    ...comparison(state.compared, state.rule, COMPARED),
  ];
}

function render() {
  if (!state.busy && player.playing()) app.replaceChildren(controls(), player.view());
  else if (wardPanel.active()) app.replaceChildren(controls(), wardPanel.view());
  else if (state.busy || !state.result) renderBusy();
  else app.replaceChildren(controls(), ...shiftView());
}

const ACTIONS = {
  livePlay: () => live.play(),
  livePause: () => live.pause(),
  next: () => {
    state.seed += 1;
    refresh();
  },
  compare: () => {
    if (searching()) {
      compareSearching();
      return;
    }
    state.compared = compareRules({ shifts: COMPARED, settings: settingsOf(), nurseRule: nurseRuleOf(state.nurse) });
    render();
  },
};

/** A knob of the controls changed: the shift is played again (the comparison kept for another seed only). */
function knobChanged(name, value) {
  if (name === "accident") state.accident = value === "oui";
  else if (name === "seed") state.seed = Math.max(1, Number(value) || 1);
  else state[name] = value;
  if (name !== "seed") state.compared = null;
  state.busy = searching() ? "La recherche réfléchit…" : "";
  refresh();
}

/** The element an event came from, as the form fields it is. */
const fieldOf = (event) => /** @type {HTMLInputElement} */ (event.target);

app.addEventListener("change", (event) => {
  const target = fieldOf(event);
  if (player.change(target) || wardPanel.change(target)) return;
  const name = target.dataset?.knob;
  if (name === "liveSpeed") live.setSpeed(Number(target.value));
  else if (name) knobChanged(name, target.value);
});
app.addEventListener("input", (event) => {
  const target = fieldOf(event);
  if (target.dataset?.live === "t") live.seek(Number(target.value));
});
app.addEventListener("click", (event) => {
  const target = fieldOf(event);
  if (player.click(target) || wardPanel.click(target)) return;
  const action = /** @type {HTMLElement | null} */ (target.closest?.("[data-action]"))?.dataset.action;
  if (ACTIONS[action]) ACTIONS[action]();
});
refresh();
// The keys of the caregiver played on the plan; a key in a form field is the field's.
document.addEventListener("keydown", (event) => wardPanel.key(event));
