import { capacityOf, PATHWAY_PLANS, pathwayPlanOf, planErrors, planTextOf } from "../../src/pathway-plans.js";
import { BED_LABELS, BED_RULES, pathwayMeasures, runPathway, startPathway } from "../../src/pathway.js";
import { drawPathwayDay } from "../../src/pathway-scenario.js";
import { stepsOf } from "../../src/pathway-status.js";
import { walkMeasures, walksOfDay } from "../../src/pathway-walk.js";
import { BREAK_RULES } from "../../src/pathway-fatigue.js";
import { INTERN_MODES, runInternGame, startInternGame } from "../../src/pathway-game.js";
import { FATIGUE } from "../../src/pathway-hypotheses.js";
import { RULE_LABELS, RULES } from "../../src/rules.js";
import { el } from "../dom.js";
import { panelOf } from "../knobs.js";
import { compareField, timelineClick, timelineSection } from "./parcours-compare.js";
import { searchedBox, searchingView } from "./parcours-search.js";
import { timelineOf } from "../../src/pathway-timeline.js";
import { PATHWAY_LEGEND, dayClock, figures, lineAt, planAt, presentTable } from "../parcours-view.js";
import { createReplayStore, download, replayName } from "../replay-store.js";

/**
 * The tab « Parcours détaillé » (Sami, 26/10/2026, the roadmap's step 2): a day of 24 h of the detailed pathway on its
 * plan in text, replayed minute by minute. The panel sets the rules and **the plan**: changed and applied, it sets
 * the places (boxes, SAUV, isolation, UHCD, scanners) and the walks. A day kept is its settings (it replays from them).
 *
 * `ctx`: the page's `state` (hospital, accident, seed), `render`, `openTab`; `pathway` the tab's own state.
 */
const FORMAT = "urgences-parcours/1";
const store = createReplayStore("urgences-parcours");
const SPEEDS = [["10", "10 min par seconde"], ["30", "30 min par seconde"], ["60", "1 h par seconde"], ["180", "3 h par seconde"]];
const CAPACITY_LABELS = { boxes: "box", sauv: "SAUV", isolation: "isolement", uhcd: "UHCD", scanner: "scanner" };

export const createPathwayState = () => ({ box: "colour", bed: "oldest", plan: null, draft: null, errors: [], speed: 30, t: 0, frame: null, last: null, run: null, walk: false, intern: "none", fatigue: "off", teams: "24", compare: "", other: null, searched: null });
/** The fatigue settings: off, or a break rule (pathway-fatigue.js); the shifts. */
const FATIGUES = [["off", "pas de fatigue"], ...Object.entries(BREAK_RULES).map(([rule, label]) => [rule, `fatigue, ${label}`])];
const TEAMS = [["24", "gardes de 24 h"], ["12", "deux équipes de 12 h"]];
/** The interns the replayed day may have (the one at the keyboard is played below the day). */
const DAY_INTERNS = Object.entries(INTERN_MODES).filter(([mode]) => mode !== "human");

/** The plan shown: the one applied, else the hospital's. */
const planText = ({ state, pathway }) => pathway.plan ?? planTextOf(PATHWAY_PLANS[state.hospital]);

/** The doctors' fatigue the tab asks for (step 4): none, or FATIGUE with its break rule and its shifts. */
export const fatigueOf = (pathway) => (pathway.fatigue === "off" ? null : { ...FATIGUE, breaks: pathway.fatigue, teams: Number(pathway.teams) });

/** The day of the settings, played: with an intern (a robot, or at random: pathway-game.js), or without one. */
function playedDay(ctx) {
  const { state, pathway } = ctx;
  const plan = pathway.plan ? { plan: pathway.plan } : {};
  const fatigue = fatigueOf(pathway);
  // The search does not play an intern's day: its box choices are the colour rule's there.
  const internBox = pathway.box === "search" ? "colour" : pathway.box;
  if (pathway.intern !== "none") return runInternGame(startInternGame({ hospital: state.hospital, accident: state.accident, seed: state.seed, box: internBox, bed: pathway.bed, mode: pathway.intern, fatigue, ...plan })).day;
  const drawn = drawPathwayDay(state.seed, { hospital: state.hospital, accident: state.accident, walk: pathway.walk, fatigue, ...plan });
  const box = pathway.box === "search" ? searchedBox(ctx, fatigue) : RULES[pathway.box];
  return runPathway(startPathway(drawn), { box, bed: BED_RULES[pathway.bed] });
}

/** The day for the settings now, played again only when they changed. */
function runOf(ctx) {
  const { state, pathway } = ctx;
  const key = JSON.stringify([state.hospital, state.accident, state.seed, pathway.box, pathway.bed, pathway.plan, pathway.walk, pathway.intern, pathway.fatigue, pathway.teams]);
  if (pathway.run?.key === key) return pathway.run;
  const day = playedDay(ctx);
  const layout = pathwayPlanOf(day.settings.plan);
  const walks = walksOfDay(day, layout);
  const end = Math.max(...[...day.patients.values()].map((patient) => patient.exitAt ?? day.clock));
  pathway.run = { key, day, layout, walks, steps: stepsOf(day), measures: pathwayMeasures(day), walking: walkMeasures(walks), end, timeline: timelineOf(day) };
  pathway.t = Math.min(pathway.t, end);
  return pathway.run;
}

const selectOf = (name, options, current) => el("select", { "data-parcours": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));

function planFields(ctx) {
  const { pathway } = ctx;
  const capacity = capacityOf(pathwayPlanOf(planText(ctx)));
  const places = Object.entries(capacity).map(([pool, n]) => `${n} ${CAPACITY_LABELS[pool]}`).join(", ");
  return [
    el("label", {}, "Le plan en texte", el("textarea", { class: "plan-text", "data-parcours": "plan", spellcheck: "false", wrap: "off" }, pathway.draft ?? planText(ctx))),
    el("div", { class: "row-buttons" }, el("button", { type: "button", "data-parcours-do": "apply" }, "Appliquer le plan"), el("button", { type: "button", class: "quiet", "data-parcours-do": "reset" }, "Revenir au plan de l'hôpital")),
    pathway.errors.length ? el("ul", { class: "plan-errors" }, ...pathway.errors.map((error) => el("li", {}, error))) : null,
    el("p", { class: "hint" }, `${pathway.plan ? "Plan modifié" : "Plan de l'hôpital"} : ${places}. # mur, . sol, E entrée, A accueil, T tri, w attente, r résultats, b box, S SAUV, I isolement, U UHCD, X scanner, L labo, P pharmacie, O bloc, H ascenseurs, D médecins, R pause, B brancardiers.`),
  ];
}

export const pathwayPanel = (ctx) =>
  panelOf(
    "Le parcours",
    ctx.state,
    ["hospital", "accident", "seed"],
    el("label", {}, "Règle des box", selectOf("box", [...Object.keys(RULES).map((key) => [key, RULE_LABELS[key]]), ["search", "recherche (ISMCTS), jouée dans un worker"]], ctx.pathway.box)),
    el("label", {}, "Règle des lits d'aval", selectOf("bed", Object.entries(BED_LABELS), ctx.pathway.bed)),
    el("label", {}, "Vitesse", selectOf("speed", SPEEDS, String(ctx.pathway.speed))),
    el("label", { class: "check" }, el("input", { type: "checkbox", "data-parcours": "walk", checked: ctx.pathway.walk || ctx.pathway.intern !== "none", disabled: ctx.pathway.intern !== "none" }), "Marche comptée (l'examen attend patient et médecin, le scanner un brancardier)"),
    el("label", {}, "L'interne de la journée", selectOf("intern", DAY_INTERNS, ctx.pathway.intern)),
    el("label", {}, "La fatigue des médecins et leurs pauses", selectOf("fatigue", FATIGUES, ctx.pathway.fatigue)),
    ctx.pathway.fatigue === "off" ? null : el("label", {}, "Les gardes", selectOf("teams", TEAMS, ctx.pathway.teams)),
    compareField(ctx.pathway),
    ...planFields(ctx),
  );

function controls(ctx, run) {
  const { pathway } = ctx;
  const playing = pathway.frame !== null;
  return el(
    "div",
    { class: "controls" },
    el("button", { type: "button", "data-parcours-do": playing ? "pause" : "play" }, playing ? "Pause" : "Lire la journée"),
    el("label", { class: "scrub" }, `Heure : ${dayClock(run.day.settings, pathway.t)}`, el("input", { type: "range", min: "0", max: String(Math.ceil(run.end)), step: "1", value: String(Math.round(pathway.t)), "data-parcours-t": "1", "aria-label": "Minute de la journée" })),
    el("button", { type: "button", class: "quiet", "data-parcours-do": "keep" }, "Garder cette journée"),
  );
}

export function pathwayView(ctx) {
  // A shift of the intern at the keyboard takes the view while it lasts.
  if (ctx.internPanel.active()) return [ctx.internPanel.view()];
  // The search plays the day in a worker first; the tab is drawn again when it answers.
  if (ctx.pathway.box === "search" && ctx.pathway.intern === "none" && !searchedBox(ctx, fatigueOf(ctx.pathway))) return searchingView();
  const run = runOf(ctx);
  const t = ctx.pathway.t;
  return [
    el("section", { class: "live", id: "pathway" }, controls(ctx, run), el("p", { class: "summary pathway-line" }, lineAt(run, t)), el("div", { class: "plan-wrap pathway-wrap" }, planAt(run, t)), el("p", { class: "hint legend" }, PATHWAY_LEGEND)),
    el("h2", {}, "Les patients présents"),
    el("div", { class: "pathway-present" }, presentTable(run, t)),
    el("h2", {}, "La journée"),
    figures(run),
    ...timelineSection(ctx, run, playedDay),
    ctx.internPanel.view(),
  ];
}

/** Redraws the minute shown in place (the plan, the line, the list, the slider): the controls stay. */
function draw(ctx) {
  const section = document.getElementById("pathway");
  const run = ctx.pathway.run;
  if (!section || !run) return;
  const { t } = ctx.pathway;
  section.querySelector(".pathway-wrap").replaceChildren(planAt(run, t));
  section.querySelector(".pathway-line").textContent = lineAt(run, t);
  section.querySelector(".scrub").firstChild.textContent = `Heure : ${dayClock(run.day.settings, t)}`;
  /** @type {HTMLInputElement} */ (section.querySelector("[data-parcours-t]")).value = String(Math.round(t));
  document.querySelector(".pathway-present")?.replaceChildren(presentTable(run, t));
}

function tick(ctx, now) {
  const { pathway } = ctx;
  pathway.t = Math.min(pathway.run.end, pathway.t + ((now - (pathway.last ?? now)) / 1000) * pathway.speed);
  pathway.last = now;
  if (pathway.t < pathway.run.end) pathway.frame = requestAnimationFrame((at) => tick(ctx, at));
  else pathway.frame = null;
  if (pathway.frame === null) ctx.render();
  else draw(ctx);
}

export function pausePathway(ctx) {
  if (ctx.pathway.frame !== null) cancelAnimationFrame(ctx.pathway.frame);
  ctx.pathway.frame = null;
}

const replayOf = ({ state, pathway }) => ({ format: FORMAT, hospital: state.hospital, accident: state.accident, seed: state.seed, box: pathway.box, bed: pathway.bed, plan: pathway.plan, savedAt: new Date().toISOString() });

const DOES = {
  play: (ctx) => {
    const { pathway } = ctx;
    if (pathway.t >= pathway.run.end) pathway.t = 0;
    pathway.last = null;
    pathway.frame = requestAnimationFrame((at) => tick(ctx, at));
  },
  pause: pausePathway,
  apply: (ctx) => {
    const { pathway } = ctx;
    const text = pathway.draft ?? planText(ctx);
    pathway.errors = planErrors(text);
    if (pathway.errors.length === 0) Object.assign(pathway, { plan: text === planTextOf(PATHWAY_PLANS[ctx.state.hospital]) ? null : text, draft: null });
  },
  reset: ({ pathway }) => Object.assign(pathway, { plan: null, draft: null, errors: [] }),
  keep: (ctx) => store.keep(replayOf(ctx)),
};

/** A click in the tab (`data-parcours-do`); true if it was the tab's. */
export function pathwayClick(ctx, target) {
  if (timelineClick(ctx, target)) {
    pausePathway(ctx);
    ctx.render();
    document.getElementById("pathway")?.scrollIntoView({ behavior: "smooth" });
    return true;
  }
  const action = /** @type {HTMLElement | null} */ (target.closest?.("[data-parcours-do]"))?.dataset.parcoursDo;
  if (!DOES[action]) return false;
  DOES[action](ctx);
  ctx.render();
  return true;
}

/** A setting's value: the speed a number, walking a box ticked, the others their text. */
const valueOf = (name, target) => ({ speed: () => Number(target.value), walk: () => target.checked })[name]?.() ?? target.value;

/** A setting of the tab changed: a rule, the speed, walking, the intern (the plan's text waits for « Appliquer »). */
export function pathwayChange(ctx, target) {
  const name = target.dataset?.parcours;
  if (!name || name === "plan") return Boolean(name);
  ctx.pathway[name] = valueOf(name, target);
  if (name !== "speed") pausePathway(ctx);
  ctx.render();
  return true;
}

/** Typing in the plan, or the slider moved (redrawn in place, so the slider keeps the pointer). */
export function pathwayInput(ctx, target) {
  if (target.dataset?.parcours === "plan") ctx.pathway.draft = target.value;
  else if (target.dataset?.parcoursT) {
    ctx.pathway.t = Number(target.value);
    draw(ctx);
  } else return false;
  return true;
}

/** A day kept, opened again: its settings back, in the tab. */
export function openPathwayReplay(ctx, replay) {
  if (replay?.format !== FORMAT) return;
  Object.assign(ctx.state, { hospital: replay.hospital, accident: replay.accident, seed: replay.seed });
  Object.assign(ctx.pathway, { box: replay.box, bed: replay.bed, plan: replay.plan, draft: null, errors: [], t: 0 });
  pausePathway(ctx);
}

export const pathwayKept = () => store.load();
export const downloadPathway = (replay) => download(replayName("urgences-parcours", replay), JSON.stringify(replay, null, 1));
