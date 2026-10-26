import { ALERT_LABELS, ALERT_RULES } from "../../src/pathway-alert.js";
import { ALERT } from "../../src/pathway-hypotheses.js";
import { QUEUE_LABELS, QUEUE_RULES } from "../../src/pathway-queues.js";
import { SAUV_LABELS, SAUV_RULES } from "../../src/pathway-sauv.js";
import { el } from "../dom.js";

/**
 * The tab « Parcours détaillé »'s other decisions (Sami, 26/10/2026, step 6), each by a reference rule: the scanner's
 * and the theatre's order, the crisis plan (« Plan blanc »), moving a patient out of the SAUV for a red. Off by
 * default, the day as before. The search on them is measured by scripts/pathway-search-compare.js, not played here.
 */
const DECISIONS = Object.freeze({
  queueRule: { label: "Le scanner et le bloc", off: "fixed", offLabel: "l'ordre fixe", labels: QUEUE_LABELS },
  alertRule: { label: "Le plan blanc", off: "off", offLabel: "pas de plan blanc", labels: ALERT_LABELS },
  sauvRule: { label: "La sortie de SAUV", off: "off", offLabel: "pas de sortie de SAUV", labels: SAUV_LABELS },
});

export const decisionDefaults = () => Object.fromEntries(Object.entries(DECISIONS).map(([name, one]) => [name, one.off]));

/** The panel's fields, one select a decision (`data-parcours` its name). */
export const decisionFields = (pathway) =>
  Object.entries(DECISIONS).map(([name, one]) =>
    el("label", {}, one.label, el("select", { "data-parcours": name }, ...[[one.off, one.offLabel], ...Object.entries(one.labels)].map(([value, text]) => el("option", { value, selected: value === pathway[name] }, text)))),
  );

/** The day's settings the decisions ask for (drawPathwayDay's options). */
export const decisionSettings = (pathway) => ({
  queueDecided: pathway.queueRule !== "fixed",
  ...(pathway.alertRule === "off" ? {} : { alert: ALERT }),
  sauvDecided: pathway.sauvRule !== "off",
});

/** The rules that take them (runPathway's). */
export const decisionRules = (pathway) => ({
  ...(pathway.queueRule === "fixed" ? {} : { queue: QUEUE_RULES[pathway.queueRule] }),
  ...(pathway.alertRule === "off" ? {} : { alert: ALERT_RULES[pathway.alertRule] }),
  ...(pathway.sauvRule === "off" ? {} : { sauv: SAUV_RULES[pathway.sauvRule] }),
});

/** What the run's key must hold of them. */
export const decisionKey = (pathway) => Object.keys(DECISIONS).map((name) => pathway[name]);
