import { BED_LABELS } from "../../src/pathway.js";
import { timelineOf } from "../../src/pathway-timeline.js";
import { RULE_LABELS, RULES } from "../../src/rules.js";
import { el } from "../dom.js";
import { TIMELINE_LEGEND, timelinePlan } from "../timeline-draw.js";

/**
 * The day's timeline in the tab « Parcours détaillé » (Sami, 26/10/2026, step 5), and the same day played another way
 * dashed over it: another box rule, another bed rule, walking or not, fatigue or not, an intern or not. `played`
 * plays a day from the tab's settings (tabs/parcours.js).
 */

/** The other ways of playing the day the tab is on: `[value, label]`, `value` « field:value ». */
export function compareOptions(pathway) {
  const boxes = Object.keys(RULES).filter((key) => key !== pathway.box).map((key) => [`box:${key}`, `la règle des box « ${RULE_LABELS[key]} »`]);
  const beds = Object.keys(BED_LABELS).filter((key) => key !== pathway.bed).map((key) => [`bed:${key}`, `la règle des lits « ${BED_LABELS[key]} »`]);
  return [
    ["", "rien"],
    ...boxes,
    ...beds,
    [`walk:${!pathway.walk}`, pathway.walk ? "sans la marche comptée" : "avec la marche comptée"],
    [pathway.fatigue === "off" ? "fatigue:quiet" : "fatigue:off", pathway.fatigue === "off" ? "avec la fatigue, pauses au creux" : "sans la fatigue"],
    [pathway.intern === "none" ? "intern:robot" : "intern:none", pathway.intern === "none" ? "avec un interne robot" : "sans interne"],
  ];
}

export const compareField = (pathway) =>
  el("label", {}, "Comparer la frise avec", el("select", { "data-parcours": "compare" }, ...compareOptions(pathway).map(([value, label]) => el("option", { value, selected: value === pathway.compare }, label))));

/** The tab's settings with the comparison's one changed. */
function variantOf(pathway) {
  const [field, value] = pathway.compare.split(":");
  return { ...pathway, [field]: field === "walk" ? value === "true" : value };
}

/** The other day's timeline, played again only when the settings changed; null without a comparison. */
function otherTimeline(ctx, played, key) {
  const { pathway } = ctx;
  if (!pathway.compare || !compareOptions(pathway).some(([value]) => value === pathway.compare)) return null;
  const otherKey = `${key}|${pathway.compare}`;
  if (pathway.other?.key !== otherKey) pathway.other = { key: otherKey, timeline: timelineOf(played({ state: ctx.state, pathway: variantOf(pathway) })) };
  return pathway.other.timeline;
}

export function timelineSection(ctx, run, played) {
  const other = otherTimeline(ctx, played, run.key);
  const label = compareOptions(ctx.pathway).find(([value]) => value === ctx.pathway.compare)?.[1];
  return [
    el("h2", {}, other ? `La journée en une frise, contre la même ${label}` : "La journée en une frise"),
    el("div", { class: "plan-wrap timeline-wrap" }, timelinePlan(run.timeline, other)),
    el("p", { class: "hint legend" }, TIMELINE_LEGEND),
  ];
}

/** A click on an hour of the timeline: the replay there; true if it was one. */
export function timelineClick(ctx, target) {
  const hour = target.closest?.("[data-timeline-t]");
  if (!hour) return false;
  ctx.pathway.t = Number(hour.dataset.timelineT);
  return true;
}
