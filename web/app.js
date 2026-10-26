import { compareRules } from "../src/compare.js";
import { ACCIDENT, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { comparePathwayRules } from "../src/pathway-compare.js";
import { NURSE_RULES, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { searchRule } from "../src/search.js";
import { act, courseOf, measuresOf, nextChoice, simulateShift, startShift } from "../src/simulate.js";
import { compareWithSearch, stopWorkers } from "./compare-workers.js";
import { el } from "./dom.js";
import { createLive } from "./live.js";
import { createPlayer } from "./player.js";
import { gardePanel, gardeView, planPanel, planView } from "./tabs/garde.js";
import { createPathwayState, pathwayChange, pathwayClick, pathwayInput, pathwayPanel, pathwayView } from "./tabs/parcours.js";
import { replaysClick, replaysPanel, replaysView } from "./tabs/replays.js";
import { statsPanel, statsView } from "./tabs/stats.js";
import { clock } from "./view.js";
import { createInternPanel } from "./intern-panel.js";
import { createWardPanel } from "./ward-panel.js";

/**
 * The page, in tabs (Sami, 26/10/2026, lopin's layout): a tab per kind of simulation (the simple shift, the shift on
 * its plan, the detailed pathway), the replays, the stats; the settings of the tab open in the panel on the left,
 * which folds. The settings shared by the tabs (the hospital, the situation, the shift's number) live in `state`; the
 * tabs are in tabs/, the drawing in view.js and its neighbours. This module only listens (event delegation on the
 * layout) and plays the simple shift, choice by choice when the search thinks.
 */
const COMPARED = 100;
const COMPARED_WITH_SEARCH = 12;
const TAB_NAMES = ["garde", "plan", "parcours", "replays", "stats"];
const STORE = "urgences-onglet";
const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage refused: the tab is only not remembered.
  }
};
const firstTab = () => [location.hash.slice(1), read(STORE)].find((name) => TAB_NAMES.includes(name)) ?? "garde";

const state = { tab: firstTab(), hospital: "moyen", accident: true, rule: "colour", nurse: "none", seed: 1, compared: null, result: null, busy: "", run: 0, pathwayDays: 20, pathwayCompared: null, gains: null, serverReplays: undefined };
const layout = document.getElementById("layout");
const sidebar = document.getElementById("sidebar");
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
    setBusy(`${label} : ${choices} choix, ${clock(shift.events.now)}`);
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
  const options = { rule: ruleOf(state.rule), nurseRule: nurseRuleOf(state.nurse), settings, run, label: "La recherche réfléchit" };
  const result = searching() ? await playShift(patients, options) : simulateShift(patients, RULES[state.rule], settings, nurseRuleOf(state.nurse));
  if (!result) return;
  Object.assign(state, { result, busy: "" });
  render();
}

async function compareSearching() {
  const run = ++state.run;
  const compared = await compareWithSearch({ count: COMPARED_WITH_SEARCH, seed: state.seed, settings: settingsOf(), nurse: state.nurse, current: () => run === state.run, progress: setBusy });
  if (!compared) return;
  Object.assign(state, { compared, busy: "" });
  render();
}

const player = createPlayer({
  el,
  current: () => ({ hospital: state.hospital, accident: state.accident, seed: state.seed, nurse: state.nurse }),
  render: () => render(),
  setBusy: (text) => {
    state.busy = text;
    render();
  },
});
const wardPanel = createWardPanel({ el, current: () => ({ hospital: state.hospital, accident: state.accident, seed: state.seed, nurse: state.nurse, rule: state.rule }), render: () => render() });
const counts = () => (searching() ? COMPARED_WITH_SEARCH : COMPARED);
const pathway = createPathwayState();
const internPanel = createInternPanel({ el, current: () => ({ hospital: state.hospital, accident: state.accident, seed: state.seed, box: pathway.box, bed: pathway.bed, plan: pathway.plan }), render: () => render() });
const ctx = { el, state, settingsOf, live, player, wardPanel, internPanel, pathway, counts, render: () => render(), openTab: (name) => openTab(name) };
const TABS = { garde: [gardePanel, gardeView], plan: [planPanel, planView], parcours: [pathwayPanel, pathwayView], replays: [replaysPanel, replaysView], stats: [statsPanel, statsView] };
/** The tabs the simple shift's work holds up: the shift itself, and the comparisons. */
const WAITS_FOR_SHIFT = new Set(["garde", "stats"]);

/** While the search thinks (or a comparison runs): where it is, in the view of the tabs that wait for it. */
function setBusy(text) {
  state.busy = text;
  if (WAITS_FOR_SHIFT.has(state.tab)) app.replaceChildren(el("p", { class: "summary busy", role: "status" }, text));
}

function render() {
  for (const button of document.querySelectorAll(".tabs [role=tab]")) button.setAttribute("aria-selected", String(/** @type {HTMLElement} */ (button).dataset.tab === state.tab));
  const [panel, view] = TABS[state.tab];
  sidebar.replaceChildren(panel(ctx));
  const holdUp = WAITS_FOR_SHIFT.has(state.tab) && (state.busy || (state.tab === "garde" && !state.result));
  if (holdUp) app.replaceChildren(el("p", { class: "summary busy", role: "status" }, state.busy || "La garde se joue…"));
  else app.replaceChildren(...view(ctx));
}

function openTab(name) {
  state.tab = name;
  history.replaceState(null, "", `#${name}`);
  write(STORE, name);
  render();
}

function comparePathway() {
  setBusy(`Le parcours : ${state.pathwayDays} journées de 24 h, six règles…`);
  setTimeout(() => {
    const { plan } = ctx.pathway;
    const rows = comparePathwayRules({ days: state.pathwayDays, hospital: state.hospital, accident: state.accident, ...(plan ? { plan } : {}) });
    const label = `${HOSPITALS[state.hospital].label}, ${state.accident ? "avec l'accident" : "jour ordinaire"}${plan ? ", plan modifié" : ""}`;
    Object.assign(state, { pathwayCompared: { rows, days: state.pathwayDays, label }, busy: "" });
    render();
  }, 30);
}

const ACTIONS = {
  livePlay: () => live.play(),
  livePause: () => live.pause(),
  next: () => {
    state.seed += 1;
    refresh();
  },
  compare: () => {
    if (searching()) return compareSearching();
    state.compared = compareRules({ shifts: COMPARED, settings: settingsOf(), nurseRule: nurseRuleOf(state.nurse) });
    render();
  },
  comparePathway,
};

/** A shared setting changed: the shift is played again (the comparison kept for another seed only). */
function knobChanged(name, value) {
  if (name === "accident") state.accident = value === "oui";
  else if (name === "seed") state.seed = Math.max(1, Number(value) || 1);
  else state[name] = value;
  if (name !== "seed") state.compared = null;
  if (searching()) setBusy("La recherche réfléchit…");
  refresh();
}

/** The parts that take their own clicks, in this order; the page's actions after them. */
const CLICKS = [player.click, wardPanel.click, internPanel.click, (target) => pathwayClick(ctx, target), (target) => replaysClick(ctx, target)];

/** The element an event came from, as the form fields it is. */
const fieldOf = (event) => /** @type {HTMLInputElement} */ (event.target);

/** A setting of the page changed (not one of the games' or the pathway's): the days compared, the live speed, a shared knob. */
function pageChange(target) {
  const { stat, knob } = target.dataset ?? {};
  if (stat === "days") state.pathwayDays = Number(target.value);
  else if (knob === "liveSpeed") live.setSpeed(Number(target.value));
  else if (knob) knobChanged(knob, target.value);
}

layout.addEventListener("change", (event) => {
  const target = fieldOf(event);
  if (!(player.change(target) || wardPanel.change(target) || internPanel.change(target) || pathwayChange(ctx, target))) pageChange(target);
});
layout.addEventListener("input", (event) => {
  const target = fieldOf(event);
  if (pathwayInput(ctx, target)) return;
  if (target.dataset?.live === "t") live.seek(Number(target.value));
});
layout.addEventListener("click", (event) => {
  const target = fieldOf(event);
  if (CLICKS.some((click) => click(target))) return;
  const action = /** @type {HTMLElement | null} */ (target.closest?.("[data-action]"))?.dataset.action;
  if (ACTIONS[action]) ACTIONS[action]();
});
document.querySelector(".tabs").addEventListener("click", (event) => {
  const name = /** @type {HTMLElement | null} */ (fieldOf(event).closest?.("[data-tab]"))?.dataset.tab;
  if (name) openTab(name);
});
// A tab named in the address (a link, the back button) opens.
window.addEventListener("hashchange", () => TAB_NAMES.includes(location.hash.slice(1)) && location.hash.slice(1) !== state.tab && openTab(location.hash.slice(1)));
const fold = document.getElementById("fold");
const setFolded = (folded) => {
  layout.classList.toggle("folded", folded);
  fold.setAttribute("aria-expanded", String(!folded));
  fold.textContent = folded ? "»" : "«";
  write("urgences-replie", folded ? "1" : "0");
};
fold.addEventListener("click", () => setFolded(!layout.classList.contains("folded")));
setFolded(read("urgences-replie") === "1");
// The keys of the caregiver played on the plan, or of the intern, in their tab; a key in a form field is the field's.
const KEYS = { plan: (event) => wardPanel.key(event), parcours: (event) => internPanel.key(event) };
document.addEventListener("keydown", (event) => KEYS[state.tab]?.(event));
fetch("../docs/changelog.json")
  .then((response) => (response.ok ? response.json() : null))
  .then((gains) => (state.gains = gains))
  .catch(() => {});
refresh();
render();
