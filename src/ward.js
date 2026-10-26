import { MAX_WAIT } from "./hypotheses.js";
import { wardPlanOf } from "./plans.js";
import { settingsOf } from "./play.js";
import { NURSE_RULES, RULES } from "./rules.js";
import { drawShift } from "./scenario.js";
import { searchRule } from "./search.js";
import { courseOf, handleEvent, measuresOf, startShift } from "./simulate.js";
import { pressKey } from "./ward-keys.js";
import { STEP, same, walk } from "./ward-moves.js";
import { busy, chooseBoxes, doctorRobots, now, nurseRobots } from "./ward-staff.js";

/**
 * The department on its plan, walked step by step (Sami, 23/10/2026, the roadmap's step 3): the same shift as
 * simulate.js (the same patients, exams, stays, worsening and looks), but people walk. A patient walks from the
 * entrance to a seat, then, once called, to the bed of a box; the exam starts when the patient and the doctor are
 * both at the bed; out of the box, the patient walks out. The triage nurse walks to the patient to look again.
 *
 * Someone may play at the keyboard (`role`): **a doctor** (Z Q S D to walk, E at a bed to examine the patient lying
 * there: their own, or a colleague's not yet started, whose assignment they then swap), or **the triage nurse** (E
 * beside a waiting patient due for a look). Who goes into a box is still the page's rule (`rule`); the doctor sent
 * is the free one nearest the bed, the person included. A person who does not come keeps the patient waiting: that
 * is the randomness a real player adds.
 *
 * A step is `STEP` minutes; people walk a cell a step and pass each other (corridors are wide enough for two).
 * The wait counted is until the exam starts: walking costs minutes. Deterministic from its settings and the keys
 * pressed, each with its step: `{ format, hospital, accident, seed, nurse, rule, role, inputs: [{ t, key }] }`.
 *
 * The parts: the walks (ward-moves.js), the robot staff and the box choices (ward-staff.js), the keyboard
 * (ward-keys.js).
 */
export const WARD_FORMAT = "urgences-plan/1";
export const ROLES = Object.freeze({ aucun: "personne : les robots seuls", medecin: "un médecin", infirmier: "l'infirmier de tri" });
/** Past the end of the shift plus this (a night), a patient still waiting is counted as seen then (a person who never came). */
const OVERTIME = 720;

const ruleNamed = (name) => (name === "search" ? searchRule() : (RULES[name] ?? RULES.colour));
const nurseRuleNamed = (name) => (name === "search" ? searchRule() : (NURSE_RULES[name] ?? null));
/** The nurse played at the keyboard is the department's one nurse ("player"); else the page's nurse rule. */
const nurseOf = (role, nurse) => (role === "infirmier" ? "player" : nurse);

/** A new shift on its plan, at its first step. `role`: who plays at the keyboard (ROLES). */
export function startWard({ hospital = "moyen", accident = true, seed = 1, nurse = "none", rule = "colour", role = "medecin" } = {}) {
  const settings = settingsOf({ hospital, accident, nurse: nurseOf(role, nurse) });
  const layout = wardPlanOf(hospital, { boxes: settings.boxes });
  const patients = drawShift(seed, settings);
  return {
    hospital, accident, seed, nurse, rule, role, settings, layout, patients,
    shift: startShift(patients, settings),
    boxRule: ruleNamed(rule),
    nurseRule: nurseRuleNamed(nurseOf(role, nurse)),
    ...staffOf(settings, layout, role),
    people: new Map(), seats: new Map(), fields: new Map(),
    t: 0, inputs: [], message: "", over: false,
  };
}

/** The doctors in their room and the nurses at their desk; the first of the role played is the person's. */
function staffOf(settings, layout, role) {
  return {
    doctors: Array.from({ length: settings.doctors }, (_, id) => ({ kind: "doctor", id, human: role === "medecin" && id === 0, ...layout.room, to: null, patient: null, examining: false })),
    nurses: Array.from({ length: settings.nurses }, (_, id) => ({ kind: "nurse", id, human: role === "infirmier" && id === 0, ...layout.desk, to: null, target: null, looking: null })),
  };
}

function seatFor(ward, id) {
  const taken = new Set(ward.seats.values());
  const index = ward.layout.seats.findIndex((_, i) => !taken.has(i));
  if (index >= 0) ward.seats.set(id, index);
  // No seat left: standing by the entrance.
  return index >= 0 ? ward.layout.seats[index] : ward.layout.entrance;
}

/** What the plan does when the shift's queue says something happened. */
function onEvent(ward, event) {
  const patient = ward.shift.patients.get(event.id);
  if (event.type === "arrive") ward.people.set(event.id, { ...ward.layout.entrance, to: seatFor(ward, event.id) });
  else if (event.type === "examEnd") {
    const doctor = ward.doctors.find((one) => one.patient === event.id);
    Object.assign(doctor, { patient: null, examining: false });
  } else if (event.type === "stayEnd") ward.people.get(event.id).to = { ...ward.layout.entrance, out: true };
  else if (event.type === "reassessEnd") {
    const nurse = ward.nurses.find((one) => one.looking === event.id);
    if (nurse) Object.assign(nurse, { looking: null, target: null });
  }
  return patient;
}

/** Runs the shift's queue up to the step's minute, as `nextChoice` would (a hold ends on what the department sees). */
function advanceClock(ward) {
  const { shift } = ward;
  shift.events.schedule(ward.t * STEP, { type: "tick" });
  for (let next = shift.events.next(); next; next = shift.events.next()) {
    const { type } = next.event;
    if (type === "tick") break;
    handleEvent(shift, next.event);
    onEvent(ward, next.event);
    if (type !== "worsen" && type !== "wake") shift.holding = false;
    if (type !== "worsen") shift.resting = false;
  }
  if (shift.holding && shift.events.size === 0) shift.holding = false;
  shift.peakWaiting = Math.max(shift.peakWaiting, shift.waiting.length);
}

/** Ends a shift nobody can finish (a patient waiting for a person who never comes): seen at the overtime. */
function closeOut(ward) {
  for (const patient of ward.shift.patients.values()) {
    if (patient.arrival > now(ward) || patient.end !== null) continue;
    if (patient.start === null) Object.assign(patient, { start: now(ward), levelAtStart: patient.level, unseen: true });
    patient.examEnd ??= now(ward);
    patient.end = now(ward);
  }
  ward.over = true;
}

/** Everyone walks a cell: the patients (out of the plan once at the exit), then the robot staff not busy. */
function walkEveryone(ward) {
  for (const [id, person] of ward.people) {
    walk(ward, person);
    if (person.to?.out && same(person, person.to)) ward.people.delete(id);
  }
  for (const one of [...ward.doctors, ...ward.nurses]) if (!one.human && !busy(one)) walk(ward, one);
}

/** Over once every patient drawn has been out of a box (a worsening may still be queued for one seen meanwhile), or at the overtime. */
function endIfDone(ward) {
  const { shift } = ward;
  if (ward.people.size === 0 && [...shift.patients.values()].every((patient) => patient.end !== null)) ward.over = true;
  else if (now(ward) >= shift.settings.shift + OVERTIME) closeOut(ward);
}

/** One step of the plan: the clock, the person's key (`key`, or null), the walks, the exams and looks, the choices. */
export function stepWard(ward, key = null) {
  if (ward.over) return ward;
  ward.t += 1;
  advanceClock(ward);
  if (key) {
    ward.inputs.push({ t: ward.t, key });
    ward.message = pressKey(ward, key) ?? ward.message;
  }
  walkEveryone(ward);
  doctorRobots(ward);
  nurseRobots(ward);
  chooseBoxes(ward);
  endIfDone(ward);
  return ward;
}

/** Plays `ward` to its end without a key (the robots alone, or a person who stays still). */
export function runWard(ward) {
  while (!ward.over) stepWard(ward);
  return ward;
}

/** A finished plan's course and measures (simulate.js's), and the patients never seen before the overtime. */
export function wardResult(ward) {
  const course = courseOf(ward.shift);
  return { patients: course, measures: { ...measuresOf(course, ward.shift), unseen: course.filter((patient) => patient.unseen).length } };
}

export const wardReplayOf = (ward) => ({ format: WARD_FORMAT, hospital: ward.hospital, accident: ward.accident, seed: ward.seed, nurse: ward.nurse, rule: ward.rule, role: ward.role, inputs: ward.inputs.map(({ t, key }) => ({ t, key })), savedAt: new Date().toISOString() });

/** Plays `replay` again, the keys at their steps; `onStep(ward)` after each. Returns the finished plan. */
export function playWardReplay(replay, { onStep = null } = {}) {
  if (replay.format !== WARD_FORMAT) throw new Error(`format de replay inconnu : ${replay.format}`);
  const ward = startWard(replay);
  const inputs = [...replay.inputs];
  while (!ward.over) {
    const key = inputs[0]?.t === ward.t + 1 ? inputs.shift().key : null;
    stepWard(ward, key);
    onStep?.(ward);
  }
  return ward;
}

/**
 * The same shift on the same plan with a robot in the person's place (a robot doctor; for the nurse, the rule of
 * the most overdue), for the person's result to be read against; and with nobody walking (simulate.js).
 */
export function wardBenchmark({ hospital, accident, seed, nurse, rule, role }) {
  const robotNurse = role === "infirmier" ? "overdue" : nurse;
  return wardResult(runWard(startWard({ hospital, accident, seed, nurse: robotNurse, rule, role: "aucun" }))).measures;
}

/** What the plan shows at this step: the cells, the patients (bracelet, true level, wait), the staff, the clock. */
export function wardScene(ward) {
  const { shift } = ward;
  const patients = [...ward.people].map(([id, person]) => {
    const patient = shift.patients.get(id);
    const waiting = patient.start === null;
    const waited = (waiting ? now(ward) : patient.start) - patient.arrival;
    let phase = "attente";
    if (patient.end !== null) phase = "sortie";
    else if (!waiting) phase = patient.examEnd === null ? "examen" : "soins";
    else if (patient.box !== null) phase = "appel";
    return { id, x: person.x, y: person.y, colour: patient.colour, level: patient.level, worse: patient.level < patient.colour, overdue: waiting && waited > MAX_WAIT[patient.colour], wait: waited, phase, looked: patient.assessing, source: patient.source };
  });
  const staff = [...ward.doctors, ...ward.nurses].map((one) => ({ kind: one.kind, id: one.id, human: one.human, x: one.x, y: one.y, busy: busy(one), patient: one.kind === "doctor" ? one.patient : one.looking }));
  const coming = [...shift.patients.values()].filter((patient) => patient.source === "ambulance" && patient.announcedAt <= now(ward) && patient.arrival > now(ward)).map((patient) => ({ id: patient.id, colour: patient.colour, in: Math.ceil(patient.arrival - now(ward)) }));
  return { minutes: now(ward), lines: ward.layout.plan.lines, width: ward.layout.plan.width, height: ward.layout.plan.height, beds: ward.layout.beds, patients, staff, coming, waiting: shift.waiting.length, message: ward.message, over: ward.over };
}

export { MOVES } from "./ward-keys.js";
export { STEP, walkSteps } from "./ward-moves.js";
export { playerOf } from "./ward-staff.js";
