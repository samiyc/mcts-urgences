import { createEvents } from "mcts-commun/events.js";
import { DEFAULTS, LATE_WEIGHT, MAX_WAIT } from "./hypotheses.js";

/**
 * A shift played under one rule (a discrete-event simulation, `events` of mcts-commun). A patient needs a
 * free box and a free doctor for the exam, then keeps the box alone for the care. When both are free and
 * someone waits, the rule picks who goes in. **The rule sees only what the department sees**: the bracelet's
 * colour, the arrival, the source; never the true level, which may also get worse while waiting.
 *
 * A rule: `(waiting, context) => view`, where `waiting` are the waiting patients' views
 * (`{ id, arrival, colour, source }`) and `context` is `{ now, freeBoxes, freeDoctors }`.
 */

/** What a waiting patient shows: no true level, no future. */
const viewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, source: patient.source });

/** The first worsening of a patient left waiting, if their level can worsen (2 to 4). */
function scheduleWorsening(events, patient, from) {
  const step = patient.worsened;
  if (patient.level <= 1 || patient.level >= 5 || step >= patient.worsenDelays.length) return;
  events.schedule(from + patient.worsenDelays[step], { type: "worsen", patient });
}

/** Lets the rule fill every free box with a free doctor. */
function dispatch(shift, rule) {
  const { events, waiting, settings } = shift;
  while (shift.freeBoxes > 0 && shift.freeDoctors > 0 && waiting.size > 0) {
    const views = [...waiting.values()].map(viewOf);
    const chosen = waiting.get(rule(views, { now: events.now, freeBoxes: shift.freeBoxes, freeDoctors: shift.freeDoctors })?.id);
    if (!chosen) throw new Error("la règle doit choisir un patient qui attend");
    waiting.delete(chosen.id);
    shift.freeBoxes -= 1;
    shift.freeDoctors -= 1;
    Object.assign(chosen, { start: events.now, levelAtStart: chosen.level });
    events.schedule(events.now + settings.exam[chosen.level] * chosen.examFactor, { type: "examEnd", patient: chosen });
  }
  shift.peakWaiting = Math.max(shift.peakWaiting, waiting.size);
}

const HANDLERS = {
  arrive(shift, patient) {
    shift.waiting.set(patient.id, patient);
    scheduleWorsening(shift.events, patient, patient.arrival + MAX_WAIT[patient.level]);
  },
  worsen(shift, patient) {
    if (!shift.waiting.has(patient.id)) return;
    patient.level -= 1;
    patient.worsened += 1;
    scheduleWorsening(shift.events, patient, shift.events.now);
  },
  examEnd(shift, patient) {
    shift.freeDoctors += 1;
    shift.doctorMinutes += shift.events.now - patient.start;
    shift.events.schedule(shift.events.now + shift.settings.stay[patient.levelAtStart] * patient.stayFactor, { type: "stayEnd", patient });
  },
  stayEnd(shift, patient) {
    shift.freeBoxes += 1;
    shift.boxMinutes += shift.events.now - patient.start;
    patient.end = shift.events.now;
  },
};

/**
 * Plays `patients` (scenario.js, `drawShift`) under `rule`. Returns each patient's course (`start`, `end`,
 * `wait`, `late`: minutes past the longest wait of their true level on arrival, `worsened`) and the shift's
 * measures (`measuresOf`). The patients given are not changed.
 */
export function simulateShift(patients, rule, overrides = {}) {
  const settings = { ...DEFAULTS, ...overrides };
  const events = createEvents();
  const course = patients.map((patient) => ({ ...patient, arrivalLevel: patient.level, worsened: 0 }));
  for (const patient of course) events.schedule(patient.arrival, { type: "arrive", patient });
  const shift = { events, settings, waiting: new Map(), freeBoxes: settings.boxes, freeDoctors: settings.doctors, boxMinutes: 0, doctorMinutes: 0, peakWaiting: 0 };
  for (let next = events.next(); next; next = events.next()) {
    HANDLERS[next.event.type](shift, next.event.patient);
    dispatch(shift, rule);
  }
  for (const patient of course) {
    patient.wait = patient.start - patient.arrival;
    patient.late = Math.max(0, patient.wait - MAX_WAIT[patient.arrivalLevel]);
  }
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
