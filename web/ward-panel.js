import { RULE_LABELS } from "../src/rules.js";
import { MOVES, ROLES, STEP, WARD_FORMAT, playerOf, startWard, stepWard, wardBenchmark, wardReplayOf, wardResult, wardScene } from "../src/ward.js";
import { fixed } from "./dom.js";
import { createReplayStore, download, replayName } from "./replay-store.js";
import { clock } from "./view.js";
import { wardPlan } from "./ward-draw.js";

/**
 * « Le service en plan » (Sami, 23/10/2026, the roadmap's step 3): the department on its plan, people walking, and
 * a doctor or the triage nurse played at the keyboard (Z Q S D or the arrows to walk, E to examine at a bed or to
 * look again beside a waiting patient). Who goes into a box stays the page's rule. At the end, the shift against
 * the same plan with a robot in the person's place. The games are kept (this browser, and replays/ through the page
 * server). The deciding is in src/ward.js; this module draws and listens (the plan itself in ward-draw.js).
 * `createWardPanel({ el, current, render })`.
 *
 * Each function takes the panel's context `ctx`: the page's `el`, `current`, `render`, and `panel`, the game's state.
 */
const store = createReplayStore("urgences-plans");
const downloadReplay = (replay) => download(replayName("urgences-plan", replay), JSON.stringify(replay));
const SPEEDS = [
  ["5", "lent : 30 s de garde par seconde"],
  ["10", "normal : 1 min de garde par seconde"],
  ["20", "rapide : 2 min par seconde"],
  ["60", "très rapide : 6 min par seconde"],
];
const HELP = "Z Q S D (ou les flèches) pour marcher, E pour examiner au lit d'un box ou réévaluer à côté d'un patient.";

function stop({ panel }) {
  clearInterval(panel.timer);
  panel.timer = null;
}

/** Steps a tick plays: one at the slower speeds, several above 20 steps a second (a timer cannot go faster). */
function play(ctx) {
  const { panel } = ctx;
  stop(ctx);
  const perTick = Math.max(1, Math.round(panel.speed / 20));
  panel.timer = setInterval(() => {
    for (let i = 0; i < perTick && !panel.ward.over; i += 1) {
      stepWard(panel.ward, panel.pending);
      panel.pending = null;
    }
    if (panel.ward.over) finish(ctx);
    redraw(ctx);
  }, (1000 * perTick) / panel.speed);
}

function finish(ctx) {
  const { panel } = ctx;
  stop(ctx);
  const replay = wardReplayOf(panel.ward);
  store.keep(replay);
  panel.ended = { replay, result: wardResult(panel.ward).measures, robot: null };
  // The robot in the person's place: a whole shift more (seconds under the search), after the page has drawn.
  setTimeout(() => {
    panel.ended.robot = wardBenchmark(replay);
    ctx.render();
  }, 30);
  ctx.render();
}

const ACTIONS = {
  start: (ctx) => {
    const { panel } = ctx;
    panel.ward = startWard({ ...ctx.current(), role: panel.role });
    panel.ended = null;
    panel.ward.message = panel.role === "aucun" ? "" : HELP;
    play(ctx);
  },
  pause: (ctx) => (ctx.panel.timer ? stop(ctx) : play(ctx)),
  quit: (ctx) => {
    stop(ctx);
    Object.assign(ctx.panel, { ward: null, ended: null });
  },
  download: ({ panel }) => downloadReplay(panel.ended.replay),
};

/** The doctor at the keyboard's patient, and where the exam is. */
function mineOf(me) {
  if (!me || me.kind !== "doctor" || me.patient === null) return "";
  return ` · votre patient : n° ${me.patient}${me.examining ? " (examen en cours)" : ", allez à son lit"}`;
}

function statusLine({ panel }, scene) {
  const mine = mineOf(playerOf(panel.ward));
  const ambulances = scene.coming.map((one) => `n° ${one.id} dans ${one.in} min`).join(", ");
  const coming = scene.coming.length ? ` · 🚑 ${ambulances}` : "";
  return `${clock(scene.minutes)} · ${scene.waiting} en salle d'attente${coming}${mine}`;
}

const speedSelect = ({ el, panel }) => el("select", { "data-ward-speed": "1" }, ...SPEEDS.map(([value, text]) => el("option", { value, selected: Number(value) === panel.speed }, text)));

/** The game in front of the person: controls, the line, the plan, what the person was told. */
function gameView(ctx) {
  const { el, panel } = ctx;
  const scene = wardScene(panel.ward);
  return el(
    "section",
    { class: "player ward-panel", id: "ward" },
    el("h2", {}, `Le service en plan — vous jouez ${ROLES[panel.ward.role]}`),
    el("div", { class: "controls" }, el("button", { type: "button", "data-ward": "pause" }, panel.timer ? "Pause" : "Reprendre"), el("label", {}, "Vitesse", speedSelect(ctx)), el("button", { type: "button", class: "quiet", "data-ward": "quit" }, "Abandonner")),
    el("p", { class: "summary ward-line", "aria-live": "off" }, statusLine(ctx, scene)),
    el("div", { class: "plan-wrap" }, wardPlan(scene)),
    el("p", { class: "hint ward-message", role: "status" }, scene.message || " "),
    el("p", { class: "hint legend" }, `Une pastille : un patient, de la couleur de son bracelet ; un point au centre : son niveau réel, plus grave ; cerclée de rouge : il attend plus que son bracelet ne le permet. 🩺 un médecin, 🧑‍⚕️ l'infirmier ; vous, cerclé. Une case : quelques mètres, ${Math.round(STEP * 60)} s de marche. Qui entre en box : la règle « ${RULE_LABELS[panel.ward.rule]} » ; le médecin envoyé est le libre le plus proche du lit, vous compris.`),
  );
}

/** Redraws the line, the plan and the message in place: the controls stay, a menu opened stays open. */
function redraw(ctx) {
  const section = document.getElementById("ward");
  if (!section || ctx.panel.ended) return;
  const scene = wardScene(ctx.panel.ward);
  section.querySelector(".ward-line").textContent = statusLine(ctx, scene);
  section.querySelector(".plan-wrap").replaceChildren(wardPlan(scene));
  section.querySelector(".ward-message").textContent = scene.message || " ";
}

function resultRow({ el }, who, measures) {
  const cell = (value) => el("td", { class: "num" }, measures ? value(measures) : "…");
  return el("tr", { class: who === "vous" ? "current" : null }, el("td", {}, who), cell((m) => fixed(m.lateCostNow)), cell((m) => String(m.late)), cell((m) => String(m.unseen)));
}

function endView(ctx) {
  const { el } = ctx;
  const { result, robot, replay } = ctx.panel.ended;
  const robots = replay.role === "aucun";
  const robotName = replay.role === "infirmier" ? "un infirmier robot (le plus en retard sur sa couleur)" : "un médecin robot à votre place";
  const head = el("tr", {}, el("th", {}, "La garde jouée par"), el("th", { class: "num" }, "coût du retard"), el("th", { class: "num" }, "patients en retard"), el("th", { class: "num" }, "jamais vus avant la nuit"));
  return el(
    "section",
    { class: "player ward-panel" },
    el("h2", {}, `La garde sur le plan est finie (vous : ${ROLES[replay.role]})`),
    el("p", { class: "hint" }, "Le coût du retard au niveau du moment (moins, c'est mieux), sur les mêmes patients et le même plan. L'attente compte jusqu'au début de l'examen : la marche coûte des minutes."),
    el("div", { class: "scroll" }, el("table", {}, el("thead", {}, head), el("tbody", {}, resultRow(ctx, robots ? "les robots" : "vous", result), robots ? null : resultRow(ctx, robotName, robot)))),
    el("div", { class: "controls" }, el("button", { type: "button", class: "quiet", "data-ward": "download" }, "Télécharger le replay"), el("button", { type: "button", class: "quiet", "data-ward": "quit" }, "Fermer")),
  );
}

function keptList({ el }, kept) {
  if (!kept.length) return null;
  const item = (replay, i) => el("li", {}, `${replay.savedAt.slice(0, 16).replace("T", " ")} · ${replay.hospital}${replay.accident ? ", accident" : ""} · garde ${replay.seed} · ${ROLES[replay.role]} · ${replay.inputs.length} touches `, el("button", { type: "button", class: "quiet", "data-ward-kept": String(i) }, "Télécharger"));
  return el("ol", { class: "replay-list" }, ...kept.map(item));
}

function startView(ctx) {
  const { el, panel } = ctx;
  return el(
    "details",
    { class: "editor player-start" },
    el("summary", {}, "Le service en plan : jouer un médecin ou l'infirmier au clavier"),
    el("p", { class: "hint" }, "La garde choisie plus haut (hôpital, situation, règle, numéro), sur un plan du service : les patients et les soignants marchent. Vous jouez un médecin (E au lit d'un box pour examiner le patient qui y est couché : le vôtre, ou celui d'un collègue pas encore commencé, et vous échangez vos patients) ou l'infirmier de tri (E à côté d'un patient qui attend depuis 30 min pour le réévaluer). Z Q S D ou les flèches pour marcher."),
    el("div", { class: "controls" }, el("label", {}, "Je joue", el("select", { "data-ward-role": "1" }, ...Object.entries(ROLES).map(([value, text]) => el("option", { value, selected: value === panel.role }, text)))), el("label", {}, "Vitesse", speedSelect(ctx)), el("button", { type: "button", "data-ward": "start" }, "Commencer sur le plan")),
    keptList(ctx, store.load()),
  );
}

function view(ctx) {
  if (ctx.panel.ward && !ctx.panel.ended) return gameView(ctx);
  return ctx.panel.ended ? endView(ctx) : startView(ctx);
}

function click(ctx, target) {
  const action = target.closest?.("[data-ward]")?.dataset.ward;
  if (ACTIONS[action]) {
    ACTIONS[action](ctx);
    ctx.render();
    return true;
  }
  const kept = target.closest?.("[data-ward-kept]");
  if (!kept) return false;
  const replay = store.load()[Number(kept.dataset.wardKept)];
  if (replay?.format === WARD_FORMAT) downloadReplay(replay);
  return true;
}

function change(ctx, target) {
  if (target.dataset?.wardRole) ctx.panel.role = target.value;
  else if (target.dataset?.wardSpeed) {
    ctx.panel.speed = Number(target.value);
    if (ctx.panel.timer) play(ctx);
  } else return false;
  return true;
}

/** Whether a key goes to the plan: a game on, a person playing, not typed in a field nor with a modifier. */
const forThePlan = ({ panel }, event) => panel.ward && !panel.ended && panel.ward.role !== "aucun" && !event.target.closest?.("input, textarea, select") && !(event.ctrlKey || event.altKey || event.metaKey);

/** A key pressed in the page: kept for the next step while the plan plays; true if it was the panel's. */
function key(ctx, event) {
  if (!forThePlan(ctx, event)) return false;
  const name = event.key.toLowerCase();
  if (name !== "e" && !MOVES[name]) return false;
  event.preventDefault();
  ctx.panel.pending = name;
  return true;
}

export function createWardPanel({ el, current, render }) {
  const ctx = { el, current, render, panel: { ward: null, role: "medecin", speed: 10, timer: null, pending: null, ended: null } };
  return {
    view: () => view(ctx),
    click: (target) => click(ctx, target),
    change: (target) => change(ctx, target),
    key: (event) => key(ctx, event),
    active: () => Boolean(ctx.panel.ward),
  };
}
