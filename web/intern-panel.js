import { COLOURS } from "../src/hypotheses.js";
import { INTERN_FORMAT, atKeyboard, gameScene, internBenchmarks, internReplayOf, internResult, minuteOf, openTasks, runInternGame, startInternGame, stepInternGame } from "../src/pathway-game.js";
import { TASKS } from "../src/pathway-intern.js";
import { MOVES } from "../src/ward-keys.js";
import { STEP } from "../src/ward-moves.js";
import { decimal, fixed } from "./dom.js";
import { pathwayPlan } from "./parcours-draw.js";
import { dayClock } from "./parcours-view.js";
import { createReplayStore, download, replayName } from "./replay-store.js";
import { TIMELINE_LEGEND, timelinePlan } from "./timeline-draw.js";
import { timelineOf } from "../src/pathway-timeline.js";

/**
 * « L'interne au clavier » (Sami, 26/10/2026, the roadmap's step 3), in the tab « Parcours détaillé »: the day of the
 * tab with walking counted, a robot intern until the shift chosen, then the person (Z Q S D or the arrows to walk, E to
 * do the task where they stand), then the robot again. The tasks due are listed with their time. At the end, the day
 * against the same with a robot intern, an intern at random and none. The deciding is in src/pathway-game.js.
 *
 * Each function takes the panel's context `ctx`: the page's `el`, `current` (the tab's settings), `render`, and `panel`.
 */
const store = createReplayStore("urgences-internes");
const SHIFTS = [8, 10, 12, 14, 16, 18, 20].map((hour) => [String((hour - 8) * 60), `${hour} h → ${hour + 4} h`]);
const SPEEDS = [["1", "1 min de garde par seconde"], ["2", "2 min par seconde"], ["5", "5 min par seconde"]];
const HELP = "Z Q S D (ou les flèches) pour marcher, E à côté d'un patient suivi, au labo, à la pharmacie, au poste des médecins (méd.) ou au scanner.";

function stop({ panel }) {
  clearInterval(panel.timer);
  panel.timer = null;
}

/** Steps a tick plays: the minutes a second chosen, a tick every 50 ms. */
function play(ctx) {
  const { panel } = ctx;
  stop(ctx);
  const perTick = Math.max(1, Math.round((panel.speed / STEP) / 20));
  panel.timer = setInterval(() => {
    for (let i = 0; i < perTick && !panel.game.over && atKeyboard(panel.game); i += 1) {
      stepInternGame(panel.game, panel.pending);
      panel.pending = null;
    }
    if (!atKeyboard(panel.game)) finish(ctx);
    else redraw(ctx);
  }, 50);
}

/** The robot plays up to the shift (a few hundred milliseconds), then the person. */
function start(ctx) {
  const { panel } = ctx;
  panel.game = startInternGame({ ...ctx.current(), mode: "human", from: panel.from, to: panel.from + 240 });
  panel.ended = null;
  while (!panel.game.over && !atKeyboard(panel.game)) stepInternGame(panel.game);
  panel.game.message = HELP;
  play(ctx);
}

/** The shift over: the robot finishes the day, then the same day with the robot, at random and without an intern. */
function finish(ctx) {
  const { panel } = ctx;
  stop(ctx);
  runInternGame(panel.game);
  const replay = internReplayOf(panel.game);
  store.keep(replay);
  panel.ended = { replay, result: internResult(panel.game), timeline: timelineOf(panel.game.day), benchmarks: null };
  ctx.render();
  setTimeout(() => {
    panel.ended.benchmarks = internBenchmarks(replay);
    ctx.render();
  }, 30);
}

const ACTIONS = {
  start,
  pause: (ctx) => (ctx.panel.timer ? stop(ctx) : play(ctx)),
  quit: (ctx) => {
    stop(ctx);
    Object.assign(ctx.panel, { game: null, ended: null });
  },
  download: ({ panel }) => download(replayName("urgences-interne", panel.ended.replay), JSON.stringify(panel.ended.replay)),
};

function taskTable({ el, panel }) {
  const now = minuteOf(panel.game);
  const rows = openTasks(panel.game).map((task) => {
    const patient = panel.game.day.patients.get(task.id);
    const left = Math.round(task.due - now);
    return el("tr", { class: task.late ? "late" : null }, el("td", {}, TASKS[task.kind]), el("td", { class: "num" }, String(task.id)), el("td", {}, el("span", { class: `dot ${COLOURS[patient.colour]}` }), COLOURS[patient.colour]), el("td", { class: "num" }, left >= 0 ? `dans ${left} min` : `en retard de ${-left} min`));
  });
  const head = ["tâche", "patient", "bracelet", "dû"].map((text, i) => el("th", { class: i === 1 || i === 3 ? "num" : null }, text));
  return rows.length ? el("div", { class: "scroll present" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows))) : el("p", { class: "hint" }, "Aucune tâche pour l'instant.");
}

const statusLine = ({ panel }) => {
  const { game } = panel;
  const { intern } = game.day;
  return `${dayClock(game.day.settings, minuteOf(game))} (fin de votre vacation à ${dayClock(game.day.settings, game.settings.to)}) · ${intern.assigned.size} patients suivis · ${intern.tasks.length} tâches ouvertes`;
};

const planOf = ({ panel }) => pathwayPlan({ layout: panel.game.day.trace.layout, patients: panel.game.day.patients, scene: gameScene(panel.game), t: minuteOf(panel.game), label: dayClock(panel.game.day.settings, minuteOf(panel.game)) });

function gameView(ctx) {
  const { el, panel } = ctx;
  return el(
    "section",
    { class: "live", id: "intern" },
    el("div", { class: "controls" }, el("button", { type: "button", "data-intern": "pause" }, panel.timer ? "Pause" : "Reprendre"), el("button", { type: "button", class: "quiet", "data-intern": "quit" }, "Abandonner")),
    el("p", { class: "summary intern-line" }, statusLine(ctx)),
    el("div", { class: "plan-wrap intern-plan" }, planOf(ctx)),
    el("p", { class: "hint intern-message", role: "status" }, panel.game.message || " "),
    el("h3", {}, "Vos tâches"),
    el("div", { class: "intern-tasks" }, taskTable(ctx)),
  );
}

/** Redraws the line, the plan, the message and the tasks in place: the buttons stay. */
function redraw(ctx) {
  const section = document.getElementById("intern");
  if (!section || !ctx.panel.game) return;
  section.querySelector(".intern-line").textContent = statusLine(ctx);
  section.querySelector(".intern-plan").replaceChildren(planOf(ctx));
  section.querySelector(".intern-message").textContent = ctx.panel.game.message || " ";
  section.querySelector(".intern-tasks").replaceChildren(taskTable(ctx));
}

/** @type {Array<[string, (one: any) => string]>} */
const ROWS = [
  ["coût du retard au moment", ({ measures }) => fixed(measures.lateCostNow)],
  ["passage, médiane", ({ measures }) => `${Math.round(measures.stay.median)} min`],
  ["tâches faites / en retard", ({ intern }) => (intern ? `${intern.done} / ${intern.late}` : "—")],
  ["retard moyen d'une tâche", ({ intern }) => (intern ? `${decimal(intern.lateness.mean, 1)} min` : "—")],
  ["aggravations repérées", ({ intern }) => (intern ? String(intern.recoloured) : "—")],
  ["marchés par l'interne", ({ intern }) => (intern ? `${decimal(intern.metres / 1000, 1)} km` : "—")],
];

function endView(ctx) {
  const { el, panel } = ctx;
  const { result, benchmarks, timeline } = panel.ended;
  const columns = [["vous", result], ["un interne robot", benchmarks?.robot], ["un interne au hasard", benchmarks?.random], ["pas d'interne", benchmarks?.none]];
  const rows = ROWS.map(([label, value]) => el("tr", {}, el("td", {}, label), ...columns.map(([, one]) => el("td", { class: "num" }, one ? value(one) : "…"))));
  return el(
    "section",
    { class: "player" },
    el("h2", {}, "Votre vacation d'interne est finie"),
    el("p", { class: "hint" }, "La même journée, les mêmes patients, la marche comptée ; hors de votre vacation, l'interne est un robot. Le coût du retard : l'attente avant l'examen, pondérée par la gravité du moment (moins, c'est mieux)."),
    el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, ""), ...columns.map(([who]) => el("th", { class: "num" }, who)))), el("tbody", {}, ...rows))),
    el("h3", {}, "Votre journée en une frise, contre celle de l'interne robot (tirets)"),
    el("div", { class: "plan-wrap" }, timelinePlan(timeline, benchmarks?.robot.timeline ?? null)),
    el("p", { class: "hint legend" }, TIMELINE_LEGEND),
    el("div", { class: "controls" }, el("button", { type: "button", class: "quiet", "data-intern": "download" }, "Télécharger le replay"), el("button", { type: "button", class: "quiet", "data-intern": "quit" }, "Fermer")),
  );
}

function startView({ el, panel }) {
  const selectOf = (name, options, current) => el("select", { [`data-intern-${name}`]: "1" }, ...options.map(([value, label]) => el("option", { value, selected: value === String(current) }, label)));
  return el(
    "section",
    { class: "player player-start" },
    el("h2", {}, "L'interne au clavier"),
    el("p", { class: "hint" }, `La journée choisie dans le panneau, la marche comptée. Vous suivez jusqu'à 4 patients non urgents que le service vous confie à la sortie du tri, et vous faites leurs tâches : reprendre les constantes (elles révèlent une aggravation), prélever et porter les tubes au labo, les accompagner au scanner, regarder leurs résultats au poste, chercher et donner un médicament. ${HELP}`),
    el("div", { class: "controls" }, el("label", {}, "Ma vacation", selectOf("from", SHIFTS, panel.from)), el("label", {}, "Vitesse", selectOf("speed", SPEEDS, panel.speed)), el("button", { type: "button", "data-intern": "start" }, "Commencer la vacation")),
  );
}

function view(ctx) {
  if (ctx.panel.ended) return endView(ctx);
  return ctx.panel.game ? gameView(ctx) : startView(ctx);
}

function click(ctx, target) {
  const action = target.closest?.("[data-intern]")?.dataset.intern;
  if (!ACTIONS[action]) return false;
  ACTIONS[action](ctx);
  ctx.render();
  return true;
}

function change(ctx, target) {
  if (target.dataset?.internFrom) ctx.panel.from = Number(target.value);
  else if (target.dataset?.internSpeed) ctx.panel.speed = Number(target.value);
  else return false;
  return true;
}

/** Whether a key goes to the game: a shift on, not typed in a field nor with a modifier. */
const forTheGame = ({ panel }, event) => panel.game && !panel.ended && !event.target.closest?.("input, textarea, select") && !(event.ctrlKey || event.altKey || event.metaKey);

/** A key pressed in the page while the person plays: kept for the next step; true if it was the panel's. */
function key(ctx, event) {
  if (!forTheGame(ctx, event)) return false;
  const name = event.key.toLowerCase();
  if (name !== "e" && !MOVES[name]) return false;
  event.preventDefault();
  ctx.panel.pending = name;
  return true;
}

/** The games kept, for the Replays tab. */
function keptView({ el }) {
  const kept = store.load().filter((replay) => replay.format === INTERN_FORMAT);
  const item = (replay, i) => el("li", {}, `${replay.savedAt.slice(0, 16).replace("T", " ")} · ${replay.hospital}${replay.accident ? ", accident" : ""} · journée ${replay.seed} · vacation de ${dayClock({ startHour: 8 }, replay.from)} · ${replay.inputs.length} touches `, el("button", { type: "button", class: "quiet", "data-intern-kept": String(i) }, "Télécharger"));
  return el("section", { class: "player" }, el("h2", {}, "Les vacations d'interne"), kept.length ? el("ol", { class: "replay-list" }, ...kept.map(item)) : el("p", { class: "hint" }, "Aucune vacation jouée dans ce navigateur : onglet Parcours détaillé, « L'interne au clavier »."));
}

function keptClick(target) {
  const kept = target.closest?.("[data-intern-kept]");
  if (!kept) return false;
  const replay = store.load()[Number(kept.dataset.internKept)];
  if (replay) download(replayName("urgences-interne", replay), JSON.stringify(replay));
  return true;
}

export function createInternPanel({ el, current, render }) {
  const ctx = { el, current, render, panel: { game: null, ended: null, timer: null, pending: null, from: 120, speed: 1 } };
  return {
    view: () => view(ctx),
    click: (target) => click(ctx, target) || keptClick(target),
    change: (target) => change(ctx, target),
    key: (event) => key(ctx, event),
    active: () => Boolean(ctx.panel.game),
    keptView: () => keptView(ctx),
  };
}
