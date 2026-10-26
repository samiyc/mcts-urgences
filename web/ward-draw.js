import { COLOURS } from "../src/hypotheses.js";
import { svg, text, titled } from "./dom.js";
import { clock } from "./view.js";

/** The plan of « Le service en plan » at a step (`wardScene` of src/ward.js): walls, beds, seats, desks, people. */

const CELL = 30;
const CELL_CLASS = { "#": "wall", b: "bed", w: "seat", T: "desk", D: "room", E: "door" };
const LABELS = [
  ["T", "tri"],
  ["D", "méd"],
  ["E", "🚪"],
];

/** The cells, the boxes' numbers, the desk, the doctors' room and the door named. */
function cells(root, scene) {
  scene.lines.forEach((line, y) => [...line].forEach((char, x) => root.append(svg("rect", { x: x * CELL, y: y * CELL, width: CELL, height: CELL, class: `cell ${CELL_CLASS[char] ?? "floor"}` }))));
  scene.beds.forEach((bed, box) => root.append(text(bed.x * CELL + 3, bed.y * CELL + 10, String(box + 1), { class: "box-title" })));
  for (const [char, label] of LABELS) {
    const at = scene.lines.findIndex((line) => line.includes(char));
    if (at >= 0) root.append(text(scene.lines[at].indexOf(char) * CELL + CELL / 2, at * CELL + CELL / 2 + 4, label, { class: "cell-label" }));
  }
}

/** Where to draw a person: people on one cell are spread a little, so that a crowd at the door still shows. */
function spotter() {
  const crowd = new Map();
  return (x, y) => {
    const key = `${x},${y}`;
    const n = crowd.get(key) ?? 0;
    crowd.set(key, n + 1);
    return { cx: x * CELL + CELL / 2 + [0, 9, -9][n % 3], cy: y * CELL + CELL / 2 + Math.floor(n / 3) * 7 };
  };
}

function patientTitle(one) {
  const waits = one.phase === "attente" || one.phase === "appel" ? `, attend depuis ${Math.round(one.wait)} min` : "";
  return `Patient ${one.id} : bracelet ${COLOURS[one.colour]}, niveau réel ${COLOURS[one.level]}, ${one.phase}${waits}`;
}

function patient(one, { cx, cy }) {
  const group = svg("g", { class: `patient${one.overdue ? " overdue" : ""}`, transform: `translate(${cx} ${cy})` });
  group.append(titled(patientTitle(one)), svg("circle", { r: CELL / 2 - 4, class: `fill ${COLOURS[one.colour]}` }));
  if (one.worse) group.append(svg("circle", { r: 4, class: `fill truth ${COLOURS[one.level]}` }));
  group.append(text(0, one.worse ? -5 : 3, String(one.id), { class: "pid" }));
  return group;
}

function staffTitle(one) {
  const who = one.kind === "doctor" ? `médecin ${one.id + 1}` : "infirmier de tri";
  const with_ = one.patient !== null && one.patient !== undefined ? `, patient n° ${one.patient}` : ", libre";
  return `${one.human ? "Vous : " : ""}${who}${with_}${one.busy ? " (occupé)" : ""}`;
}

/** A caregiver: 🩺 a doctor, 🧑‍⚕️ the nurse; the person ringed. */
function staff(root, one, { cx, cy }) {
  if (one.human) root.append(svg("circle", { cx, cy, r: CELL / 2 - 1, class: "me" }));
  const icon = text(cx, cy + 6, one.kind === "doctor" ? "🩺" : "🧑‍⚕️", { class: `staff${one.busy ? " busy" : ""}` });
  icon.append(titled(staffTitle(one)));
  root.append(icon);
}

/** The plan at this step: walls, beds, seats, desks; the patients, the staff, the person ringed. */
export function wardPlan(scene) {
  const root = svg("svg", { viewBox: `0 0 ${scene.width * CELL} ${scene.height * CELL}`, class: "plan ward", role: "img", "aria-label": `Le service à ${clock(scene.minutes)}` });
  cells(root, scene);
  const spot = spotter();
  for (const one of scene.patients) root.append(patient(one, spot(one.x, one.y)));
  for (const one of scene.staff) staff(root, one, spot(one.x, one.y));
  return root;
}
