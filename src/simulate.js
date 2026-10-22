import { createEvents } from "mcts-commun/events.js";
import { DEFAULTS, LATE_WEIGHT, MAX_WAIT } from "./hypotheses.js";

/**
 * A shift (a discrete-event simulation, `events` of mcts-commun). A patient needs a free box and a free doctor
 * for the exam, then keeps the box alone for the care. When both are free and someone waits, someone must
 * choose who goes in: the shift stops there (`nextChoice`), the choice is applied (`choose`), and it goes on.
 * A rule makes that choice in `runShift`; the search (search.js) plays copies of the shift (`cloneShift`).
 *
 * **A rule sees only what the department sees**: the bracelet's colour, the arrival, the source; never the true
 * level, which may also get worse while waiting. A rule: `(waiting, context) => view`, `waiting` the waiting
 * patients' views (`{ id, arrival, colour, source }`), `context` `{ now, freeBoxes, freeDoctors, shift }`; only
 * the search reads `shift`, and it draws again everything the department cannot know. A rule may also return
 * `{ id: HOLD }`: leave the free box and doctor free until the next thing the department sees happen (an
 * arrival, an exam or a care that ends), for an ambulance announced on its way.
 */
export const HOLD = "attendre";

/** What a waiting patient shows: no true level, no future. */
const viewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, source: patient.source });

/** Schedules the next worsening of a patient left waiting, if their level can still worsen (2 to 4). */
export function scheduleWorsening(events, patient, from) {
  const step = patient.worsened;
  if (patient.level <= 1 || patient.level >= 5 || step >= patient.worsenDelays.length) return;
  events.schedule(from + patient.worsenDelays[step], { type: "worsen", id: patient.id });
}

const HANDLERS = {
  arrive(shift, patient) {
    shift.waiting.push(patient.id);
    scheduleWorsening(shift.events, patient, patient.arrival + MAX_WAIT[patient.level]);
  },
  worsen(shift, patient) {
    if (patient.start !== null) return;
    patient.level -= 1;
    patient.worsened += 1;
    scheduleWorsening(shift.events, patient, shift.events.now);
  },
  examEnd(shift, patient) {
    shift.freeDoctors += 1;
    shift.doctorMinutes += shift.events.now - patient.start;
    patient.examEnd = shift.events.now;
    shift.events.schedule(shift.events.now + shift.settings.stay[patient.levelAtStart] * patient.stayFactor, { type: "stayEnd", id: patient.id });
  },
  stayEnd(shift, patient) {
    shift.boxIds.push(patient.box);
    shift.boxIds.sort((a, b) => a - b);
    shift.boxMinutes += shift.events.now - patient.start;
    patient.end = shift.events.now;
  },
};

/** The start of a shift: `patients` (scenario.js, `drawShift`) to come, every box and doctor free. */
export function startShift(patients, overrides = {}) {
  const settings = { ...DEFAULTS, ...overrides };
  const events = createEvents();
  const course = new Map(patients.map((patient) => [patient.id, { ...patient, arrivalLevel: patient.level, worsened: 0, start: null, examEnd: null, end: null, box: null }]));
  for (const patient of course.values()) events.schedule(patient.arrival, { type: "arrive", id: patient.id });
  return { settings, events, patients: course, waiting: [], holding: false, boxIds: Array.from({ length: settings.boxes }, (_, i) => i), freeDoctors: settings.doctors, boxMinutes: 0, doctorMinutes: 0, peakWaiting: 0 };
}

const choiceNeeded = (shift) => !shift.holding && shift.boxIds.length > 0 && shift.freeDoctors > 0 && shift.waiting.length > 0;

/** Runs the shift to its next choice: true there, false once nothing is left to happen. */
export function nextChoice(shift) {
  for (;;) {
    if (choiceNeeded(shift)) return true;
    shift.peakWaiting = Math.max(shift.peakWaiting, shift.waiting.length);
    const next = shift.events.next();
    if (!next && shift.holding) {
      shift.holding = false;
      continue;
    }
    if (!next) return false;
    HANDLERS[next.event.type](shift, shift.patients.get(next.event.id));
    // A worsening is not seen: it does not end a hold.
    if (next.event.type !== "worsen") shift.holding = false;
  }
}

/** Leaves the free box and doctor free until the next thing the department sees happen. */
export function hold(shift) {
  shift.holding = true;
}

/** The waiting patients as a rule sees them, in arrival order. */
export const viewsOf = (shift) => shift.waiting.map((id) => viewOf(shift.patients.get(id)));

/** Takes waiting patient `id` in: a box, a doctor, the exam scheduled. */
export function choose(shift, id) {
  const index = shift.waiting.indexOf(id);
  if (index < 0) throw new Error("la règle doit choisir un patient qui attend");
  shift.waiting.splice(index, 1);
  const patient = shift.patients.get(id);
  shift.freeDoctors -= 1;
  Object.assign(patient, { start: shift.events.now, levelAtStart: patient.level, box: shift.boxIds.shift() });
  shift.events.schedule(shift.events.now + shift.settings.exam[patient.level] * patient.examFactor, { type: "examEnd", id });
}

/** A copy of `shift` the search may play forward; `keep(event)` filters the events copied. */
export function cloneShift(shift, keep) {
  const patients = new Map([...shift.patients].map(([id, patient]) => [id, { ...patient, worsenDelays: [...patient.worsenDelays] }]));
  return { ...shift, events: shift.events.clone(keep), patients, waiting: [...shift.waiting], boxIds: [...shift.boxIds] };
}

/** Plays `shift` to its end, each choice made by `rule`. */
export function runShift(shift, rule) {
  while (nextChoice(shift)) {
    const context = { now: shift.events.now, freeBoxes: shift.boxIds.length, freeDoctors: shift.freeDoctors, shift };
    const chosen = rule(viewsOf(shift), context);
    if (chosen?.id === HOLD) hold(shift);
    else choose(shift, chosen?.id);
  }
  return shift;
}

/** A finished shift's patients, each with its `wait` and `late` (minutes past the longest wait of its true level on arrival). */
export function courseOf(shift) {
  return [...shift.patients.values()].map((patient) => ({ ...patient, wait: patient.start - patient.arrival, late: Math.max(0, patient.start - patient.arrival - MAX_WAIT[patient.arrivalLevel]) }));
}

/**
 * Plays `patients` under `rule`. Returns each patient's course (`start`, `examEnd`, `end`, `box` (from 0),
 * `wait`, `late`, `worsened`) and the shift's measures (`measuresOf`). The patients given are not changed.
 */
export function simulateShift(patients, rule, overrides = {}) {
  const shift = runShift(startShift(patients, overrides), rule);
  const course = courseOf(shift);
  return { patients: course, measures: measuresOf(course, shift) };
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

/**
 * A shift's measures: the late cost (minutes past each true level's longest wait, weighted by level:
 * the score a rule should keep low), the patients seen late and worsened while waiting, per true level the
 * count, the mean wait and the share seen in time, the peak of the waiting room, and how busy the boxes and
 * the doctors were.
 */
export function measuresOf(course, shift) {
  const end = Math.max(0, ...course.map((patient) => patient.end));
  const byLevel = Object.fromEntries(
    [1, 2, 3, 4, 5].map((level) => {
      const group = course.filter((patient) => patient.arrivalLevel === level);
      return [level, { count: group.length, meanWait: mean(group.map((patient) => patient.wait)), inTime: group.length ? group.filter((patient) => patient.late === 0).length / group.length : 1 }];
    }),
  );
  return {
    patients: course.length,
    lateCost: course.reduce((sum, patient) => sum + LATE_WEIGHT[patient.arrivalLevel] * patient.late, 0),
    late: course.filter((patient) => patient.late > 0).length,
    worsened: course.filter((patient) => patient.worsened > 0).length,
    meanWait: mean(course.map((patient) => patient.wait)),
    byLevel,
    peakWaiting: shift.peakWaiting,
    boxUse: end ? shift.boxMinutes / (shift.settings.boxes * end) : 0,
    doctorUse: end ? shift.doctorMinutes / (shift.settings.doctors * end) : 0,
    end,
  };
}
