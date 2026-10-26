import { ACCIDENT, COLOURS } from "../src/hypotheses.js";
import { RULE_LABELS } from "../src/rules.js";
import { el, svg } from "./dom.js";
import { boxRows, curvePath, waitingCurve, worstPatients } from "./view.js";

/** The played shift's charts and tables: the boxes, the waiting room, the worst served, the rules compared. */

export function timeline(patients, settings, scale) {
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

export function waitingChart(patients, scale, accident) {
  const curve = waitingCurve(patients);
  const size = { width: 1000, height: 120 };
  const chart = svg("svg", { viewBox: `0 0 ${size.width} ${size.height}`, preserveAspectRatio: "none", class: "curve", role: "img", "aria-label": `Salle d'attente : ${curve.peak} patients au plus` });
  if (accident) chart.append(svg("rect", { x: (scale.at(ACCIDENT.at) * size.width) / 100, y: 0, width: (scale.at(ACCIDENT.over) * size.width) / 100, height: size.height, class: "crisis" }));
  chart.append(svg("path", { d: curvePath(curve, scale, size), class: "line" }));
  return el("figure", { class: "chart" }, el("figcaption", {}, `Salle d'attente, au plus ${curve.peak} patients${accident ? " (en ocre : l'arrivée des victimes)" : ""}`), chart);
}

const worstRow = (one) =>
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
  );

export function worstTable(patients) {
  const rows = worstPatients(patients).map(worstRow);
  if (rows.length === 0) return el("p", { class: "hint" }, "Personne n'a attendu au-delà du délai de son niveau réel.");
  const head = ["n°", "arrivée par", "bracelet", "niveau réel (caché)", "arrivé à", "attente", "retard", "aggravé", "coût"].map((label, i) => el("th", { class: i >= 5 ? "num" : null }, label));
  return el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)));
}

const decimal = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
const gainOf = ({ gain }) => `${decimal(gain.mean)} (${decimal(gain.low)} à ${decimal(gain.high)})`;

/** The rules on the same shifts (`compared`, the current rule's row marked), or nothing before a comparison. */
export function comparison(compared, currentRule, count) {
  if (!compared) return [];
  const rows = Object.entries(compared)
    .filter(([name]) => RULE_LABELS[name])
    .map(([name, row]) =>
      el(
        "tr",
        { class: name === currentRule ? "current" : null },
        el("td", {}, RULE_LABELS[name]),
        el("td", { class: "num" }, decimal(row.lateCost)),
        el("td", { class: "num" }, decimal(row.lateCostNow)),
        el("td", { class: "num" }, name === "arrival" ? "—" : gainOf(row)),
        el("td", { class: "num" }, decimal(row.worsened, 1)),
        el("td", { class: "num" }, `${decimal(100 * row.urgentInTime)} %`),
        el("td", { class: "num" }, `${decimal(row.meanWait)} min`),
      ),
    );
  const head = ["Règle", "coût du retard", "au niveau du moment", "gain sur l'arrivée (IC 95 %)", "aggravés", "urgents à temps", "attente moyenne"].map((label, i) => el("th", { class: i > 0 ? "num" : null }, label));
  return [el("h2", {}, `Les règles sur les mêmes ${compared.count ?? count} gardes`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)))];
}

export function legend() {
  return el("p", { class: "legend hint" }, ...Object.values(COLOURS).map((colour) => el("span", { class: "legend-item" }, el("span", { class: `dot ${colour}` }), colour)), " Partie foncée d'une barre : l'examen, avec un médecin ; partie claire : les soins, le box seul.");
}
