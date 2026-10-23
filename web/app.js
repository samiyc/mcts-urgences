import { paired } from "mcts-commun/measure.js";
import { compareRules } from "../src/compare.js";
import { ACCIDENT, COLOURS, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { NURSE_LABELS, NURSE_RULES, RULE_LABELS, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { searchRule } from "../src/search.js";
import { act, courseOf, measuresOf, nextChoice, simulateShift, startShift } from "../src/simulate.js";
import { createPlayer } from "./player.js";
import { boxRows, clock, curvePath, sceneAt, sceneLine, scaleOf, summaryOf, waitingCurve, worstPatients } from "./view.js";

/**
 * The page: a shift drawn from a seed, played under the chosen rule, in the chosen hospital, with or without
 * the accident, with or without a triage nurse who re-assesses the waiting patients; then the rules on the
 * same shifts. The search (src/search.js) thinks for a while at each choice: its shifts are played choice by
 * choice, the page breathing between two. The played shift is replayed on a plan of the department, minute by
 * minute (`sceneAt`), at a chosen speed or from a slider. What it shows is computed in view.js; this module
 * only draws and listens (event delegation on #app).
 */
const COMPARED = 100;
const COMPARED_WITH_SEARCH = 12;
const state = { hospital: "moyen", accident: true, rule: "colour", nurse: "none", seed: 1, compared: null, result: null, busy: "", run: 0 };
/** The animated plan: the minute shown, minutes of shift a second, the animation frame while it plays. */
const live = { t: 0, speed: 5, frame: null, last: null };
const LIVE_SPEEDS = [
  ["1", "1 min par seconde"],
  ["5", "5 min par seconde"],
  ["15", "15 min par seconde"],
  ["30", "30 min par seconde"],
];
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
  pauseLive();
  live.t = 0;
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

const LIVE = { width: 1000, dot: 30, waitingCols: 8, boxCols: 4, boxW: 96, boxH: 70, top: 34 };

/** A patient's dot: the bracelet's colour; the true level in the middle when it is more serious (hidden). */
function patientDot(x, y, one, title) {
  const group = svg("g", { class: `patient${one.overdue ? " overdue" : ""}${one.recent ? " recent" : ""}`, transform: `translate(${x} ${y})` });
  const label = svg("title");
  label.textContent = title;
  group.append(label, svg("circle", { r: LIVE.dot / 2 - 3, class: `fill ${one.colour}` }));
  if (one.worse) group.append(svg("circle", { r: 5, class: `fill truth ${one.truth}` }));
  const id = svg("text", { y: one.worse ? -7 : 4, class: "pid" });
  id.textContent = String(one.id);
  group.append(id);
  return group;
}

function text(x, y, content, attrs = {}) {
  const node = svg("text", { x, y, ...attrs });
  node.textContent = content;
  return node;
}

/** The department at the minute shown: the entrance, the waiting room, the boxes. */
function livePlan(scene) {
  const rows = Math.max(3, Math.ceil(scene.waiting.length / LIVE.waitingCols));
  const boxRowsCount = Math.ceil(scene.boxes.length / LIVE.boxCols);
  const height = LIVE.top + Math.max(rows * LIVE.dot + 20, boxRowsCount * (LIVE.boxH + 8) + 4, 150);
  const plan = svg("svg", { viewBox: `0 0 ${LIVE.width} ${height}`, class: "plan", role: "img", "aria-label": `Le service à ${scene.clock}` });
  // The entrance: ambulances announced, with their minutes to go.
  plan.append(svg("rect", { x: 0, y: 0, width: 150, height, rx: 8, class: `room entrance${scene.crisis ? " crisis" : ""}` }), text(12, 22, scene.crisis ? "Entrée — accident" : "Entrée", { class: "room-title" }));
  scene.coming.slice(0, 6).forEach((one, i) => plan.append(text(14, LIVE.top + 20 + i * 24, `🚑 n° ${one.id} dans ${one.in} min`, { class: "coming" })));
  // The waiting room, the earliest arrivals first.
  const waitingX = 166;
  const waitingW = LIVE.waitingCols * LIVE.dot + 24;
  plan.append(svg("rect", { x: waitingX, y: 0, width: waitingW, height, rx: 8, class: "room" }), text(waitingX + 12, 22, `Salle d'attente (${scene.waiting.length})`, { class: "room-title" }));
  scene.waiting.forEach((one, i) => {
    const x = waitingX + 12 + (i % LIVE.waitingCols) * LIVE.dot + LIVE.dot / 2;
    const y = LIVE.top + Math.floor(i / LIVE.waitingCols) * LIVE.dot + LIVE.dot / 2;
    const title = `Patient ${one.id} (${one.source === "ambulance" ? "ambulance" : "à pied"}) : bracelet ${one.colour}, niveau réel ${one.truth}${one.worse ? " (plus grave, personne ne le voit)" : ""}, attend depuis ${Math.round(one.wait)} min${one.overdue ? ", au-delà du délai de son bracelet" : ""}${one.looked ? ", l'infirmier le réévalue" : ""}`;
    plan.append(patientDot(x, y, one, title));
    if (one.looked) plan.append(text(x + 10, y - 8, "🧑‍⚕️", { class: "nurse" }));
  });
  // The boxes: the patient, the doctor during the exam, how far the stay is.
  const boxesX = waitingX + waitingW + 16;
  const boxesW = LIVE.width - boxesX;
  plan.append(svg("rect", { x: boxesX, y: 0, width: boxesW, height, rx: 8, class: "room" }), text(boxesX + 12, 22, `Box (${scene.boxes.filter((one) => one.patient).length} / ${scene.boxes.length}) · médecins en examen ${scene.doctors.busy} / ${scene.doctors.total}`, { class: "room-title" }));
  const step = (boxesW - 16) / LIVE.boxCols;
  for (const { box, patient } of scene.boxes) {
    const x = boxesX + 8 + (box % LIVE.boxCols) * step;
    const y = LIVE.top - 6 + Math.floor(box / LIVE.boxCols) * (LIVE.boxH + 8);
    plan.append(svg("rect", { x, y, width: step - 8, height: LIVE.boxH, rx: 6, class: `box${patient ? " busy" : ""}` }), text(x + 8, y + 16, `Box ${box + 1}`, { class: "box-title" }));
    if (!patient) continue;
    const title = `Patient ${patient.id} : bracelet ${patient.colour}, niveau réel ${patient.truth} — ${patient.phase === "exam" ? "examen, avec un médecin" : "soins, le box seul"}`;
    plan.append(patientDot(x + 24, y + 42, patient, title));
    if (patient.phase === "exam") plan.append(text(x + 46, y + 48, "🩺", { class: "doctor" }));
    const barW = step - 24;
    plan.append(svg("rect", { x: x + 8, y: y + LIVE.boxH - 10, width: barW, height: 4, rx: 2, class: "stay" }), svg("rect", { x: x + 8, y: y + LIVE.boxH - 10, width: barW * patient.progress, height: 4, rx: 2, class: `stay-done ${patient.phase}` }));
  }
  return plan;
}

/** The animated plan with its controls; `refreshLive` redraws it alone while it plays. */
function liveSection() {
  const { patients } = state.result;
  const end = Math.ceil(Math.max(...patients.map((patient) => patient.end)));
  const scene = sceneAt(patients, settingsOf(), live.t);
  const playing = live.frame !== null;
  return el(
    "section",
    { class: "live", id: "live" },
    el(
      "div",
      { class: "controls" },
      el("button", { type: "button", "data-action": playing ? "livePause" : "livePlay" }, playing ? "Pause" : live.t >= end ? "Revoir" : "Lire la garde"),
      el("label", {}, "Vitesse", select("liveSpeed", LIVE_SPEEDS, String(live.speed))),
      el("label", { class: "scrub" }, `Heure : ${scene.clock}`, el("input", { type: "range", min: "0", max: String(end), step: "1", value: String(Math.round(live.t)), "data-live": "t", "aria-label": "Minute de la garde" })),
    ),
    el("p", { class: "summary live-line", "aria-live": "off" }, sceneLine(scene)),
    el("div", { class: "plan-wrap" }, livePlan(scene)),
    el("p", { class: "hint legend" }, "Une pastille : un patient, de la couleur de son bracelet, avec son numéro. Un point au centre : son niveau réel quand il est plus grave que le bracelet — ce que personne ne voit. Cerclée de rouge : il attend plus que son bracelet ne le permet. 🧑‍⚕️ l'infirmier le réévalue, 🩺 un médecin l'examine ; la barre d'un box : le séjour, foncée pendant l'examen."),
  );
}

function refreshLive() {
  document.getElementById("live")?.replaceWith(liveSection());
}

/** Redraws the plan, its line and the slider in place: the controls stay, so a menu opened while it plays stays open. */
function drawScene() {
  const section = document.getElementById("live");
  if (!section) return;
  const scene = sceneAt(state.result.patients, settingsOf(), live.t);
  section.querySelector(".plan-wrap").replaceChildren(livePlan(scene));
  section.querySelector(".live-line").textContent = sceneLine(scene);
  section.querySelector(".scrub").firstChild.textContent = `Heure : ${scene.clock}`;
  section.querySelector("[data-live='t']").value = String(Math.round(live.t));
}

function tick(now) {
  const end = Math.max(...state.result.patients.map((patient) => patient.end));
  live.t = Math.min(end, live.t + ((now - (live.last ?? now)) / 1000) * live.speed);
  live.last = now;
  if (live.t < end) {
    live.frame = requestAnimationFrame(tick);
    drawScene();
  } else {
    live.frame = null;
    refreshLive();
  }
}

function playLive() {
  const end = Math.max(...state.result.patients.map((patient) => patient.end));
  if (live.t >= end) live.t = 0;
  live.last = null;
  live.frame = requestAnimationFrame(tick);
  refreshLive();
}

function pauseLive() {
  if (live.frame !== null) cancelAnimationFrame(live.frame);
  live.frame = null;
  if (state.result) refreshLive();
}

function legend() {
  return el("p", { class: "legend hint" }, ...Object.values(COLOURS).map((colour) => el("span", { class: "legend-item" }, el("span", { class: `dot ${colour}` }), colour)), " Partie foncée d'une barre : l'examen, avec un médecin ; partie claire : les soins, le box seul.");
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

function render() {
  if (!state.busy && player.playing()) {
    app.replaceChildren(controls(), player.view());
    return;
  }
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
    player.view(),
    el("h2", {}, "La garde, minute par minute"),
    liveSection(),
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
  livePlay: playLive,
  livePause: pauseLive,
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
  if (player.change(event.target)) return;
  const name = event.target.dataset?.knob;
  if (!name) return;
  if (name === "liveSpeed") {
    live.speed = Number(event.target.value);
    return;
  }
  if (name === "accident") state.accident = event.target.value === "oui";
  else if (name === "seed") state.seed = Math.max(1, Number(event.target.value) || 1);
  else state[name] = event.target.value;
  if (name !== "seed") state.compared = null;
  state.busy = searching() ? "La recherche réfléchit…" : "";
  refresh();
});
app.addEventListener("input", (event) => {
  if (event.target.dataset?.live !== "t") return;
  live.t = Number(event.target.value);
  // Redrawn in place, so the slider keeps the pointer.
  drawScene();
});
app.addEventListener("click", (event) => {
  if (player.click(event.target)) return;
  const action = event.target.closest?.("[data-action]")?.dataset.action;
  if (ACTIONS[action]) ACTIONS[action]();
});
refresh();
