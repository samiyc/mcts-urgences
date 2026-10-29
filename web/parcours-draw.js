import { COLOURS } from "../src/hypotheses.js";
import { svg, text, titled } from "./dom.js";
import { CELL, spotter } from "./ward-draw.js";

/**
 * The detailed pathway's plan at a minute (Sami, 26/10/2026, step 2): the cells of the plan in text
 * (pathway-plans.js's legend), the patients by their bracelet, the doctors and the stretcher-bearers where their
 * walks put them (pathway-walk.js's `walkScene`).
 */
const CELL_CLASS = { "#": "wall", b: "bed", S: "sauv", I: "isolation", U: "uhcd", X: "machine", w: "seat", r: "results", A: "desk", T: "desk", D: "room", R: "room", B: "room", L: "room", P: "room", O: "door", H: "door", E: "door", C: "room" };
const LABELS = { A: "accueil", T: "tri", D: "méd.", R: "pause", B: "branc.", L: "labo", P: "pharma", O: "bloc", H: "asc.", E: "🚪", X: "scan", S: "SAUV", I: "iso", U: "UHCD", C: "court" };
const ICONS = { doctor: "🩺", porter: "🛏️", intern: "🧑‍⚕️", fast: "🩺", family: "🧍" };
/** Who each mark is, from its `who` (« doctor:0 », « family:12 »…). */
const TITLES = {
  doctor: (n) => `Médecin ${Number(n) + 1}`,
  porter: (n) => `Brancardier ${Number(n) + 1}`,
  intern: () => "L'interne",
  fast: () => "Le médecin du circuit court",
  family: (n) => `L'accompagnant du patient ${n}`,
};

function cells(root, lines) {
  lines.forEach((line, y) =>
    [...line].forEach((char, x) => {
      if (char === " ") return; // outside the building
      root.append(svg("rect", { x: x * CELL, y: y * CELL, width: CELL, height: CELL, class: `cell ${CELL_CLASS[char] ?? "floor"}` }));
      if (LABELS[char]) root.append(text(x * CELL + CELL / 2, y * CELL + CELL / 2 + 3, LABELS[char], { class: "cell-label" }));
    }),
  );
}

/** The true level at minute `t`: the arrival's, one more serious for each worsening by then. */
const levelAt = (patient, t) => patient.arrivalLevel - patient.worsenedAt.filter((at) => at <= t).length;

function patientMark(patient, t, { cx, cy }) {
  const level = levelAt(patient, t);
  const group = svg("g", { class: "patient", transform: `translate(${cx} ${cy})` });
  group.append(titled(`Patient ${patient.id} : bracelet ${COLOURS[patient.colour]}, niveau réel ${COLOURS[level]}`), svg("circle", { r: CELL / 2 - 5, class: `fill ${COLOURS[patient.colour]}` }));
  if (level < patient.colour) group.append(svg("circle", { r: 4, class: `fill truth ${COLOURS[level]}` }));
  group.append(text(0, level < patient.colour ? -5 : 3, String(patient.id), { class: "pid" }));
  return group;
}

function staffMark(root, one, { cx, cy }) {
  if (one.role === "intern" && one.human) root.append(svg("circle", { cx, cy, r: CELL / 2 - 1, class: "me" }));
  const icon = text(cx, cy + 6, ICONS[one.role], { class: "staff" });
  icon.append(titled(TITLES[one.role](String(one.who).split(":")[1])));
  root.append(icon);
}

/** The plan at minute `t`: `layout` (pathwayPlanOf), the day's patients, and `scene` (walkScene at `t`). */
export function pathwayPlan({ layout, patients, scene, t, label }) {
  const { plan } = layout;
  const root = svg("svg", { viewBox: `0 0 ${plan.width * CELL} ${plan.height * CELL}`, class: "plan pathway", role: "img", "aria-label": `Le service à ${label}` });
  cells(root, plan.lines);
  const spot = spotter();
  for (const one of scene) {
    const at = spot(one.x, one.y);
    if (one.role === "patient") root.append(patientMark(patients.get(one.who), t, at));
    else staffMark(root, one, at);
  }
  return root;
}
