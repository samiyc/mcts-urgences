import { el } from "../dom.js";
import { legend, timeline, waitingChart, worstTable } from "../charts.js";
import { panelOf } from "../knobs.js";
import { scaleOf, summaryOf } from "../view.js";

/**
 * The tab « Garde simple » (Sami, 26/10/2026): a shift of 8 h under the rule chosen, its summary, playing it
 * oneself (player.js), the shift minute by minute (live.js), the boxes, the waiting room, the worst served.
 * `ctx`: the page's `state`, `settingsOf`, `live`, `player`.
 */
export const gardePanel = ({ state }) =>
  panelOf("La garde", state, ["hospital", "accident", "rule", "nurse", "seed"], el("p", { class: "hint" }, "Une garde de 8 h simulée : qui passe quand un box et un médecin se libèrent ? Les règles ne voient que la couleur du bracelet ; l'état réel des patients reste caché, et peut s'aggraver pendant l'attente. Les chiffres sont des hypothèses, pas des données médicales."));

export function gardeView({ state, settingsOf, live, player }) {
  if (player.playing()) return [player.view()];
  const { patients, measures } = state.result;
  const scale = scaleOf(patients);
  return [
    el("p", { class: "summary" }, summaryOf(measures)),
    player.view(),
    el("h2", {}, "La garde, minute par minute"),
    live.section(),
    el("h2", {}, "Les box"),
    timeline(patients, settingsOf(), scale),
    legend(),
    waitingChart(patients, scale, state.accident),
    el("h2", {}, "Les patients les plus mal servis, et ce que personne ne voyait"),
    worstTable(patients),
  ];
}
