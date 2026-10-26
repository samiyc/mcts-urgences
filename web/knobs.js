import { HOSPITALS } from "../src/hypotheses.js";
import { NURSE_LABELS, RULE_LABELS } from "../src/rules.js";
import { el, select } from "./dom.js";

/**
 * The settings shared by the tabs, in the side panel (Sami, 26/10/2026): the hospital, the situation, the rule of
 * the boxes, the triage nurse, the shift's number. A tab shows those it uses (`names`); a change is the page's
 * (`data-knob`, app.js).
 */
const FIELDS = {
  hospital: (state) => el("label", {}, "Hôpital", select("hospital", Object.entries(HOSPITALS).map(([id, one]) => [id, `${one.label} (${one.boxes} box, ${one.doctors} médecins)`]), state.hospital)),
  accident: (state) => el("label", {}, "Situation", select("accident", [["oui", "accident à 09:30 (10 victimes)"], ["non", "jour ordinaire"]], state.accident ? "oui" : "non")),
  rule: (state) => el("label", {}, "Règle des box", select("rule", Object.entries(RULE_LABELS), state.rule)),
  nurse: (state) => el("label", {}, "Réévaluation (un infirmier)", select("nurse", Object.entries(NURSE_LABELS), state.nurse)),
  seed: (state) => el("label", {}, "Garde n°", el("input", { type: "number", min: "1", value: String(state.seed), "data-knob": "seed", inputmode: "numeric" })),
};

/** The panel of a tab: its title, the shared settings it uses, then its own fields. */
export function panelOf(title, state, names, ...own) {
  return el(
    "section",
    { class: "panel" },
    el("h2", {}, title),
    ...names.map((name) => FIELDS[name](state)),
    names.includes("seed") ? el("div", { class: "row-buttons" }, el("button", { type: "button", class: "quiet", "data-action": "next" }, "Garde suivante")) : null,
    ...own,
  );
}
