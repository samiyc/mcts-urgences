import { capacityOf, PATHWAY_PLANS, pathwayPlanOf, planErrors, planTextOf } from "../../src/pathway-plans.js";
import { BED_LABELS, BED_RULES, pathwayMeasures, runPathway, startPathway } from "../../src/pathway.js";
import { drawPathwayDay } from "../../src/pathway-scenario.js";
import { stepsOf } from "../../src/pathway-status.js";
import { walkMeasures, walksOfDay } from "../../src/pathway-walk.js";
import { RULE_LABELS, RULES } from "../../src/rules.js";
import { el } from "../dom.js";
import { panelOf } from "../knobs.js";
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

export const createPathwayState = () => ({ box: "colour", bed: "oldest", plan: null, draft: null, errors: [], speed: 30, t: 0, frame: null, last: null, run: null });

/** The plan shown: the one applied, else the hospital's. */
const planText = ({ state, pathway }) => pathway.plan ?? planTextOf(PATHWAY_PLANS[state.hospital]);

/** The day for the settings now, played again only when they changed. */
function runOf(ctx) {
  const { state, pathway } = ctx;
  const key = JSON.stringify([state.hospital, state.accident, state.seed, pathway.box, pathway.bed, pathway.plan]);
  if (pathway.run?.key === key) return pathway.run;
  const drawn = drawPathwayDay(state.seed, { hospital: state.hospital, accident: state.accident, ...(pathway.plan ? { plan: pathway.plan } : {}) });
  const day = runPathway(startPathway(drawn), { box: RULES[pathway.box], bed: BED_RULES[pathway.bed] });
  const layout = pathwayPlanOf(day.settings.plan);
  const walks = walksOfDay(day, layout);
  const end = Math.max(...[...day.patients.values()].map((patient) => patient.exitAt ?? day.clock));
  pathway.run = { key, day, layout, walks, steps: stepsOf(day), measures: pathwayMeasures(day), walking: walkMeasures(walks), end };
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
    el("label", {}, "Règle des box", selectOf("box", Object.keys(RULES).map((key) => [key, RULE_LABELS[key]]), ctx.pathway.box)),
    el("label", {}, "Règle des lits d'aval", selectOf("bed", Object.entries(BED_LABELS), ctx.pathway.bed)),
    el("label", {}, "Vitesse", selectOf("speed", SPEEDS, String(ctx.pathway.speed))),
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
  const run = runOf(ctx);
  const t = ctx.pathway.t;
  return [
    el("section", { class: "live", id: "pathway" }, controls(ctx, run), el("p", { class: "summary pathway-line" }, lineAt(run, t)), el("div", { class: "plan-wrap pathway-wrap" }, planAt(run, t)), el("p", { class: "hint legend" }, PATHWAY_LEGEND)),
    el("h2", {}, "Les patients présents"),
    el("div", { class: "pathway-present" }, presentTable(run, t)),
    el("h2", {}, "La journée"),
    figures(run),
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
  const action = /** @type {HTMLElement | null} */ (target.closest?.("[data-parcours-do]"))?.dataset.parcoursDo;
  if (!DOES[action]) return false;
  DOES[action](ctx);
  ctx.render();
  return true;
}

/** A setting of the tab changed: a rule or the speed (the plan's text waits for « Appliquer »). */
export function pathwayChange(ctx, target) {
  const name = target.dataset?.parcours;
  if (!name || name === "plan") return Boolean(name);
  ctx.pathway[name] = name === "speed" ? Number(target.value) : target.value;
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
