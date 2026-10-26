import { svg, text, titled } from "./dom.js";

/** The department drawn at the minute shown (`sceneAt` of view.js): the entrance, the waiting room, the boxes. */

const LIVE = { width: 1000, dot: 30, waitingCols: 8, boxCols: 4, boxW: 96, boxH: 70, top: 34 };
const WAITING_X = 166;
const WAITING_W = LIVE.waitingCols * LIVE.dot + 24;

/** A patient's dot: the bracelet's colour; the true level in the middle when it is more serious (hidden). */
function patientDot(x, y, one, title) {
  const group = svg("g", { class: `patient${one.overdue ? " overdue" : ""}${one.recent ? " recent" : ""}`, transform: `translate(${x} ${y})` });
  group.append(titled(title), svg("circle", { r: LIVE.dot / 2 - 3, class: `fill ${one.colour}` }));
  if (one.worse) group.append(svg("circle", { r: 5, class: `fill truth ${one.truth}` }));
  group.append(text(0, one.worse ? -7 : 4, String(one.id), { class: "pid" }));
  return group;
}

/** The entrance: ambulances announced, with their minutes to go. */
function entrance(plan, scene, height) {
  plan.append(svg("rect", { x: 0, y: 0, width: 150, height, rx: 8, class: `room entrance${scene.crisis ? " crisis" : ""}` }), text(12, 22, scene.crisis ? "Entrée — accident" : "Entrée", { class: "room-title" }));
  scene.coming.slice(0, 6).forEach((one, i) => plan.append(text(14, LIVE.top + 20 + i * 24, `🚑 n° ${one.id} dans ${one.in} min`, { class: "coming" })));
}

const waitingTitle = (one) =>
  `Patient ${one.id} (${one.source === "ambulance" ? "ambulance" : "à pied"}) : bracelet ${one.colour}, niveau réel ${one.truth}${one.worse ? " (plus grave, personne ne le voit)" : ""}, attend depuis ${Math.round(one.wait)} min${one.overdue ? ", au-delà du délai de son bracelet" : ""}${one.looked ? ", l'infirmier le réévalue" : ""}`;

/** The waiting room, the earliest arrivals first. */
function waitingRoom(plan, scene, height) {
  plan.append(svg("rect", { x: WAITING_X, y: 0, width: WAITING_W, height, rx: 8, class: "room" }), text(WAITING_X + 12, 22, `Salle d'attente (${scene.waiting.length})`, { class: "room-title" }));
  scene.waiting.forEach((one, i) => {
    const x = WAITING_X + 12 + (i % LIVE.waitingCols) * LIVE.dot + LIVE.dot / 2;
    const y = LIVE.top + Math.floor(i / LIVE.waitingCols) * LIVE.dot + LIVE.dot / 2;
    plan.append(patientDot(x, y, one, waitingTitle(one)));
    if (one.looked) plan.append(text(x + 10, y - 8, "🧑‍⚕️", { class: "nurse" }));
  });
}

/** One box: its patient, the doctor during the exam, how far the stay is. */
function boxAt(plan, { box, patient }, { x0, step }) {
  const x = x0 + 8 + (box % LIVE.boxCols) * step;
  const y = LIVE.top - 6 + Math.floor(box / LIVE.boxCols) * (LIVE.boxH + 8);
  plan.append(svg("rect", { x, y, width: step - 8, height: LIVE.boxH, rx: 6, class: `box${patient ? " busy" : ""}` }), text(x + 8, y + 16, `Box ${box + 1}`, { class: "box-title" }));
  if (!patient) return;
  const title = `Patient ${patient.id} : bracelet ${patient.colour}, niveau réel ${patient.truth} — ${patient.phase === "exam" ? "examen, avec un médecin" : "soins, le box seul"}`;
  plan.append(patientDot(x + 24, y + 42, patient, title));
  if (patient.phase === "exam") plan.append(text(x + 46, y + 48, "🩺", { class: "doctor" }));
  const barW = step - 24;
  plan.append(svg("rect", { x: x + 8, y: y + LIVE.boxH - 10, width: barW, height: 4, rx: 2, class: "stay" }), svg("rect", { x: x + 8, y: y + LIVE.boxH - 10, width: barW * patient.progress, height: 4, rx: 2, class: `stay-done ${patient.phase}` }));
}

function boxes(plan, scene, height) {
  const x0 = WAITING_X + WAITING_W + 16;
  const width = LIVE.width - x0;
  plan.append(svg("rect", { x: x0, y: 0, width, height, rx: 8, class: "room" }), text(x0 + 12, 22, `Box (${scene.boxes.filter((one) => one.patient).length} / ${scene.boxes.length}) · médecins en examen ${scene.doctors.busy} / ${scene.doctors.total}`, { class: "room-title" }));
  const step = (width - 16) / LIVE.boxCols;
  for (const one of scene.boxes) boxAt(plan, one, { x0, step });
}

export function livePlan(scene) {
  const rows = Math.max(3, Math.ceil(scene.waiting.length / LIVE.waitingCols));
  const boxRowsCount = Math.ceil(scene.boxes.length / LIVE.boxCols);
  const height = LIVE.top + Math.max(rows * LIVE.dot + 20, boxRowsCount * (LIVE.boxH + 8) + 4, 150);
  const plan = svg("svg", { viewBox: `0 0 ${LIVE.width} ${height}`, class: "plan", role: "img", "aria-label": `Le service à ${scene.clock}` });
  entrance(plan, scene, height);
  waitingRoom(plan, scene, height);
  boxes(plan, scene, height);
  return plan;
}
