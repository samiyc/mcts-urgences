import { SHOWN } from "../src/pathway-timeline.js";
import { svg, text, titled } from "./dom.js";

/**
 * The day's timeline drawn (Sami, 26/10/2026, step 5; src/pathway-timeline.js): the curves of the patients present,
 * waiting for a box and waiting for a bed (another day's dashed over them, to compare two ways of playing it), a strip
 * a place showing when it was full, then the moments that count. A click on an hour sets the replay there
 * (`data-timeline-t`).
 */
const W = 1000;
const CURVES = { top: 10, height: 150 };
const STRIP = 9;
const NAMES = { boxes: "box", sauv: "SAUV", uhcd: "UHCD", scanner: "scanner", doctors: "médecins" };
const LINES = [
  ["present", "présents"],
  ["waiting", "attendent un box"],
  ["bed", "attendent un lit"],
];
const MARKS = [
  ["worsened", "aggravation en attente", "rouge"],
  ["left", "parti sans être vu", "orange"],
  ["diverted", "ambulance réorientée", "bleu"],
  ["overlooked", "résultat oublié", "jaune"],
];

const hourLabel = (startHour, t) => `${(startHour + Math.floor(t / 60)) % 24} h`;

/** The curve of `key` over the samples, on the chart's scales. */
function pathOf(series, key, x, y) {
  return series.map((one, i) => `${i ? "L" : "M"}${x(one.t).toFixed(1)},${y(one[key]).toFixed(1)}`).join(" ");
}

function curves(root, { timeline, other, x, top }) {
  const y = (value) => CURVES.top + CURVES.height - (value / top) * CURVES.height;
  for (const [key, label] of LINES) {
    const line = svg("path", { d: pathOf(timeline.series, key, x, y), class: `tl-line ${key}` });
    line.append(titled(label));
    root.append(line);
    if (other) root.append(svg("path", { d: pathOf(other.series, key, x, y), class: `tl-line ${key} other` }));
  }
  root.append(text(4, CURVES.top + 10, `${top} patients`, { class: "tl-axis" }));
}

function strips(root, { timeline, x }) {
  const from = CURVES.top + CURVES.height + 14;
  SHOWN.forEach((pool, i) => {
    const y = from + i * (STRIP + 3);
    root.append(text(4, y + STRIP - 1, NAMES[pool], { class: "tl-axis" }));
    for (const one of timeline.series.filter((s) => s.full.includes(pool))) root.append(svg("rect", { x: x(one.t), y, width: Math.max(1, x(10) - x(0)), height: STRIP, class: "tl-full" }));
  });
  return from + SHOWN.length * (STRIP + 3);
}

function marks(root, { timeline, x, y }) {
  MARKS.forEach(([key, label, colour], i) => {
    for (const t of timeline.markers[key]) {
      const mark = svg("rect", { x: x(t) - 1, y: y + i * 6, width: 2, height: 5, class: `fill ${colour}` });
      mark.append(titled(label));
      root.append(mark);
    }
  });
  for (const { from, to } of timeline.markers.breaks) root.append(svg("rect", { x: x(from), y: y + MARKS.length * 6, width: Math.max(1, x(to) - x(from)), height: 4, class: "tl-break" }));
  return y + MARKS.length * 6 + 8;
}

/** The hours along the bottom, and an invisible column an hour to click. */
function hours(root, { timeline, x, height }) {
  for (let t = 0; t < timeline.end; t += 60) {
    if (t % 120 === 0) root.append(text(x(t) + 2, height - 2, hourLabel(timeline.startHour, t), { class: "tl-axis" }));
    const column = svg("rect", { x: x(t), y: 0, width: x(60) - x(0), height, class: "tl-hour", "data-timeline-t": String(t) });
    column.append(titled(`Revoir le service à ${hourLabel(timeline.startHour, t)}`));
    root.append(column);
  }
}

/** The timeline of a day, `other` (another way of playing it, or null) dashed over it. */
export function timelinePlan(timeline, other = null) {
  const end = Math.max(timeline.end, other?.end ?? 0);
  const x = (t) => 40 + (t / end) * (W - 50);
  const top = Math.max(5, ...[timeline, other].filter(Boolean).flatMap((one) => one.series.map((s) => s.present)));
  const root = svg("svg", { viewBox: `0 0 ${W} 280`, class: "timeline-plan", role: "img", "aria-label": "La journée en une frise" });
  if (timeline.markers.crisis) root.append(svg("rect", { x: x(timeline.markers.crisis.from), y: 0, width: x(timeline.markers.crisis.to) - x(timeline.markers.crisis.from), height: 280, class: "crisis" }));
  if (timeline.markers.alert) {
    const { at, staffAt } = timeline.markers.alert;
    const line = svg("rect", { x: x(at) - 1, y: 0, width: 2, height: 280, class: "tl-alert" });
    line.append(titled(`Plan blanc déclenché ; les médecins rappelés arrivent ${Math.round(staffAt - at)} min plus tard`));
    root.append(line);
  }
  curves(root, { timeline, other, x, top });
  const after = marks(root, { timeline, x, y: strips(root, { timeline, x }) + 4 });
  hours(root, { timeline, x, height: Math.min(280, after + 14) });
  return root;
}

export const TIMELINE_LEGEND =
  "Trait plein : la journée jouée ; tirets : la même journée jouée autrement (à choisir dans le panneau). Noir : présents, rouge : attendent un box, bleu : attendent un lit. Une bande pleine : la ressource est saturée. En dessous : les aggravations (rouge), les départs sans être vus (orange), les ambulances réorientées (bleu), les résultats oubliés (jaune), les pauses des médecins (gris). En ocre : l'accident ; un trait violet : le plan blanc déclenché. Un clic sur une heure y amène le plan.";
