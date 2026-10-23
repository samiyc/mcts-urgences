import { MAX_WAIT } from "./hypotheses.js";
import { wardPlanOf } from "./plans.js";
import { settingsOf } from "./play.js";
import { NURSE_RULES, RULES } from "./rules.js";
import { drawShift } from "./scenario.js";
import { searchRule } from "./search.js";
import { HOLD, candidatesOf, cloneShift, courseOf, handleEvent, hold, measuresOf, reassess, rest, startShift, viewsOf } from "./simulate.js";

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
 */
export const STEP = 0.1;
export const WARD_FORMAT = "urgences-plan/1";
export const ROLES = Object.freeze({ aucun: "personne : les robots seuls", medecin: "un médecin", infirmier: "l'infirmier de tri" });
export const MOVES = Object.freeze({ z: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], q: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] });
/** Past the end of the shift plus this (a night), a patient still waiting is counted as seen then (a person who never came). */
const OVERTIME = 720;

const ruleNamed = (name) => (name === "search" ? searchRule() : (RULES[name] ?? RULES.colour));
const nurseRuleNamed = (name) => (name === "search" ? searchRule() : (NURSE_RULES[name] ?? null));
const same = (a, b) => a.x === b.x && a.y === b.y;
/** A doctor in an exam, a nurse in a look: they stay where they are. */
const busy = (one) => (one.kind === "doctor" ? one.examining : one.looking !== null);
const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Walking distances to `target` over the plan, computed once a target (breadth-first). */
function fieldTo(ward, target) {
  const key = `${target.x},${target.y}`;
  const known = ward.fields.get(key);
  if (known) return known;
  const { plan, passable } = ward.layout;
  const distance = new Int32Array(plan.width * plan.height).fill(-1);
  const queue = [target];
  distance[target.y * plan.width + target.x] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const { x, y } = queue[head];
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!passable(nx, ny) || distance[ny * plan.width + nx] >= 0) continue;
      distance[ny * plan.width + nx] = distance[y * plan.width + x] + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  const field = { distance, width: plan.width, at: (x, y) => distance[y * plan.width + x] };
  ward.fields.set(key, field);
  return field;
}

/** Steps from `from` to `to`, walking. */
export const walkSteps = (ward, from, to) => fieldTo(ward, to).at(from.x, from.y);

/** One cell toward `unit.to`, the first neighbour nearer in a fixed order. */
function walk(ward, unit) {
  if (!unit.to || same(unit, unit.to)) return;
  const field = fieldTo(ward, unit.to);
  const here = field.at(unit.x, unit.y);
  for (const [dx, dy] of NEIGHBOURS) {
    const d = field.at(unit.x + dx, unit.y + dy);
    if (ward.layout.passable(unit.x + dx, unit.y + dy) && d >= 0 && d < here) {
      unit.x += dx;
      unit.y += dy;
      return;
    }
  }
}

/** A new shift on its plan, at its first step. `role`: who plays at the keyboard (ROLES). */
export function startWard({ hospital = "moyen", accident = true, seed = 1, nurse = "none", rule = "colour", role = "medecin" } = {}) {
  // The nurse played at the keyboard is the department's one nurse.
  const settings = settingsOf({ hospital, accident, nurse: role === "infirmier" ? "player" : nurse });
  const layout = wardPlanOf(hospital, { boxes: settings.boxes });
  const patients = drawShift(seed, settings);
  const shift = startShift(patients, settings);
  const doctors = Array.from({ length: settings.doctors }, (_, id) => ({ kind: "doctor", id, human: role === "medecin" && id === 0, ...layout.room, to: null, patient: null, examining: false }));
  const nurses = Array.from({ length: settings.nurses }, (_, id) => ({ kind: "nurse", id, human: role === "infirmier" && id === 0, ...layout.desk, to: null, target: null, looking: null }));
  return {
    hospital, accident, seed, nurse, rule, role, settings, layout, patients, shift,
    boxRule: ruleNamed(rule),
    nurseRule: role === "infirmier" ? null : nurseRuleNamed(nurse),
    doctors, nurses, people: new Map(), seats: new Map(), fields: new Map(),
    t: 0, inputs: [], message: "", over: false,
  };
}

/** The person at the keyboard, or null. */
export const playerOf = (ward) => [...ward.doctors, ...ward.nurses].find((one) => one.human) ?? null;

const now = (ward) => ward.shift.events.now;
const bedOf = (ward, patient) => ward.layout.beds[patient.box];

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

/** The exam begins: the doctor at the bed, the patient lying there. The wait ends now. */
function startExam(ward, doctor) {
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
function chooseBoxes(ward) {
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

/** The robot nurse: whom to walk to, by the page's nurse rule; the look starts beside the patient. */
function nurseRobots(ward) {
  const { shift } = ward;
  for (const nurse of ward.nurses) {
    if (nurse.human || nurse.looking !== null) continue;
    const target = nurse.target === null ? null : shift.patients.get(nurse.target);
    if (target && !candidatesOf(shift).includes(target)) nurse.target = null;
    if (nurse.target === null && !shift.resting && ward.nurseRule && shift.waiting.length > 0) {
      const candidates = candidatesOf(shift).filter((patient) => !ward.nurses.some((one) => one.target === patient.id));
      if (candidates.length > 0) {
        const chosen = ward.nurseRule(
          candidates.map((patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, source: patient.source, reassessedAt: patient.reassessedAt })),
          { now: now(ward), shift: projected(ward), kind: "nurse" },
        );
        if (chosen) nurse.target = chosen.id;
        else rest(shift);
      }
    }
    if (nurse.target === null) {
      nurse.to = ward.layout.desk;
      continue;
    }
    const person = ward.people.get(nurse.target);
    nurse.to = person;
    if (near(nurse, person)) {
      reassess(shift, nurse.target);
      nurse.looking = nurse.target;
    }
  }
}

/** The robot doctors: to the bed of their patient, the exam once both are there; free, they stay where they are, near the boxes. */
function doctorRobots(ward) {
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

/** The bed at or beside the person, the one under their feet first. */
const bedNear = (ward, at) => {
  const { beds } = ward.layout;
  const index = beds.findIndex((bed) => same(bed, at));
  return index >= 0 ? index : beds.findIndex((bed) => near(bed, at));
};

/** The doctor at the keyboard presses E. Returns what the page says. */
function doctorUses(ward, me) {
  if (me.examining) return `Vous examinez le patient n° ${me.patient}.`;
  const box = bedNear(ward, me);
  if (box < 0) return "Pas de lit ici : E au lit d'un box.";
  const patient = [...ward.shift.patients.values()].find((one) => one.box === box && one.end === null && one.calledAt !== undefined);
  if (!patient) return `Box ${box + 1} : personne.`;
  if (patient.start !== null) return `Box ${box + 1} : le patient n° ${patient.id} est en soins, l'examen est fait.`;
  if (!same(ward.people.get(patient.id), ward.layout.beds[box])) return `Box ${box + 1} : le patient n° ${patient.id} arrive.`;
  if (me.patient !== patient.id) {
    // A colleague's patient, not started: the two swap their patients.
    const colleague = ward.doctors.find((one) => one.patient === patient.id);
    colleague.patient = me.patient;
    me.patient = patient.id;
  }
  Object.assign(me, ward.layout.beds[box]);
  startExam(ward, me);
  return `Box ${box + 1} : vous examinez le patient n° ${patient.id}.`;
}

/** The nurse at the keyboard presses E beside a waiting patient. */
function nurseUses(ward, me) {
  if (me.looking !== null) return `Vous réévaluez le patient n° ${me.looking}.`;
  const { shift } = ward;
  const beside = shift.waiting.map((id) => shift.patients.get(id)).filter((patient) => near(ward.people.get(patient.id), me));
  if (beside.length === 0) return "Personne à côté : E à côté d'un patient qui attend.";
  const due = beside.find((patient) => candidatesOf(shift).includes(patient));
  if (!due) {
    const { recheck } = shift.settings;
    return `Le patient n° ${beside[0].id} a été vu il y a moins de ${recheck} min.`;
  }
  reassess(shift, due.id);
  me.looking = due.id;
  return `Vous réévaluez le patient n° ${due.id} (${shift.settings.reassess} min).`;
}

/** The key pressed by the person, this step: a move, or E. Returns what the page says, or null. */
function pressKey(ward, key) {
  const me = playerOf(ward);
  if (!me) return null;
  if (key === "e") return me.kind === "doctor" ? doctorUses(ward, me) : nurseUses(ward, me);
  const move = MOVES[key];
  if (!move) return null;
  if (busy(me)) return "Occupé : l'examen ou la réévaluation n'est pas fini.";
  const [dx, dy] = move;
  if (ward.layout.passable(me.x + dx, me.y + dy)) {
    me.x += dx;
    me.y += dy;
  }
  return null;
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

/** One step of the plan: the clock, the person's key (`key`, or null), the walks, the exams and looks, the choices. */
export function stepWard(ward, key = null) {
  if (ward.over) return ward;
  ward.t += 1;
  advanceClock(ward);
  if (key) {
    ward.inputs.push({ t: ward.t, key });
    ward.message = pressKey(ward, key) ?? ward.message;
  }
  for (const [id, person] of ward.people) {
    walk(ward, person);
    if (person.to?.out && same(person, person.to)) ward.people.delete(id);
  }
  for (const one of [...ward.doctors, ...ward.nurses]) if (!one.human && !busy(one)) walk(ward, one);
  doctorRobots(ward);
  nurseRobots(ward);
  chooseBoxes(ward);
  const { shift } = ward;
  // Every patient drawn has been out of a box (a worsening may still be queued for one seen meanwhile).
  if (ward.people.size === 0 && [...shift.patients.values()].every((patient) => patient.end !== null)) ward.over = true;
  else if (now(ward) >= shift.settings.shift + OVERTIME) closeOut(ward);
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
