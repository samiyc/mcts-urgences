import { HOLD, candidatesOf, cloneShift, hold, reassess, rest, viewsOf } from "./simulate.js";
import { STEP, near, same, walkSteps } from "./ward-moves.js";

/** The staff on the plan (ward.js): the robot doctors and nurses, the box choices, the exam that starts at the bed. */

export const now = (ward) => ward.shift.events.now;
export const bedOf = (ward, patient) => ward.layout.beds[patient.box];
/** A doctor in an exam, a nurse in a look: they stay where they are. */
export const busy = (one) => (one.kind === "doctor" ? one.examining : one.looking !== null);
/** The person at the keyboard, or null. */
export const playerOf = (ward) => [...ward.doctors, ...ward.nurses].find((one) => one.human) ?? null;

/** The exam begins: the doctor at the bed, the patient lying there. The wait ends now. */
export function startExam(ward, doctor) {
  const { shift } = ward;
  const patient = shift.patients.get(doctor.patient);
  Object.assign(patient, { start: now(ward), levelAtStart: patient.level });
  doctor.examining = true;
  shift.events.schedule(now(ward) + shift.settings.exam[patient.level] * patient.examFactor, { type: "examEnd", id: patient.id });
}

/** Patient `id` is called into a box: a bed, the free doctor nearest it; both walk there. */
function admit(ward, id) {
  const { shift } = ward;
  shift.waiting.splice(shift.waiting.indexOf(id), 1);
  const patient = shift.patients.get(id);
  shift.freeDoctors -= 1;
  Object.assign(patient, { box: shift.boxIds.shift(), calledAt: now(ward) });
  const bed = bedOf(ward, patient);
  const free = ward.doctors.filter((one) => one.patient === null);
  const doctor = free.reduce((best, one) => (walkSteps(ward, one, bed) < walkSteps(ward, best, bed) ? one : best));
  doctor.patient = id;
  ward.seats.delete(id);
  ward.people.get(id).to = bed;
}

/**
 * The shift as the search should see it: every patient called but not yet examined starts once the slower of
 * the patient and the doctor has walked to the bed. (The search plays simulate.js's shift, where nobody walks.)
 */
function projected(ward) {
  const world = cloneShift(ward.shift);
  for (const doctor of ward.doctors) {
    const patient = doctor.patient === null ? null : world.patients.get(doctor.patient);
    if (!patient || patient.start !== null) continue;
    const bed = bedOf(ward, patient);
    const eta = Math.max(walkSteps(ward, ward.people.get(patient.id), bed), walkSteps(ward, doctor, bed)) * STEP;
    Object.assign(patient, { start: now(ward) + eta, levelAtStart: patient.level });
    world.events.schedule(patient.start + world.settings.exam[patient.level] * patient.examFactor, { type: "examEnd", id: patient.id });
  }
  return world;
}

/** The box choices of this step, by the page's rule, as simulate.js would make them. */
export function chooseBoxes(ward) {
  const { shift } = ward;
  while (!shift.holding && shift.boxIds.length > 0 && shift.freeDoctors > 0 && shift.waiting.length > 0) {
    const context = { now: now(ward), freeBoxes: shift.boxIds.length, freeDoctors: shift.freeDoctors, kind: "box" };
    // Only the search reads the shift: the copy is made for it alone.
    Object.defineProperty(context, "shift", { get: () => projected(ward) });
    const chosen = ward.boxRule(viewsOf(shift), context);
    if (chosen?.id === HOLD) hold(shift);
    else admit(ward, chosen.id);
  }
}

/** A robot nurse with no one in view picks whom to walk to, by the page's nurse rule; nobody, and the nurses rest. */
function pickTarget(ward, nurse) {
  const { shift } = ward;
  if (nurse.target !== null || shift.resting || !ward.nurseRule || shift.waiting.length === 0) return;
  const candidates = candidatesOf(shift).filter((patient) => !ward.nurses.some((one) => one.target === patient.id));
  if (candidates.length === 0) return;
  const views = candidates.map((patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, source: patient.source, reassessedAt: patient.reassessedAt }));
  const chosen = ward.nurseRule(views, { now: now(ward), shift: projected(ward), kind: "nurse" });
  if (chosen) nurse.target = chosen.id;
  else rest(shift);
}

/** A robot nurse's step: drop a target no longer due, pick one, walk to them (or back to the desk), look once beside. */
function nurseRobot(ward, nurse) {
  const { shift } = ward;
  const target = nurse.target === null ? null : shift.patients.get(nurse.target);
  if (target && !candidatesOf(shift).includes(target)) nurse.target = null;
  pickTarget(ward, nurse);
  if (nurse.target === null) {
    nurse.to = ward.layout.desk;
    return;
  }
  const person = ward.people.get(nurse.target);
  nurse.to = person;
  if (near(nurse, person)) {
    reassess(shift, nurse.target);
    nurse.looking = nurse.target;
  }
}

/** The robot nurses: whom to walk to, by the page's nurse rule; the look starts beside the patient. */
export function nurseRobots(ward) {
  for (const nurse of ward.nurses) if (!nurse.human && nurse.looking === null) nurseRobot(ward, nurse);
}

/** The robot doctors: to the bed of their patient, the exam once both are there; free, they stay where they are, near the boxes. */
export function doctorRobots(ward) {
  for (const doctor of ward.doctors) {
    if (doctor.human || doctor.examining) continue;
    if (doctor.patient === null) {
      doctor.to = null;
      continue;
    }
    const patient = ward.shift.patients.get(doctor.patient);
    const bed = bedOf(ward, patient);
    doctor.to = bed;
    if (same(doctor, bed) && same(ward.people.get(patient.id), bed)) startExam(ward, doctor);
  }
}
