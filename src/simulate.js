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
 *
 * **Re-assessment** (`nurses` above 0): when a triage nurse is free and a waiting patient is due for a look
 * (hypotheses.js, `recheck`), the shift stops for a second kind of choice (`nextChoice` returns "nurse", not
 * "box"): a nurse rule (`(candidates, context) => view`, or null to look at nobody until something happens)
 * picks whom to look at (`reassess`). The look takes `reassess` minutes; then the bracelet shows the patient's
 * true level of that moment, and the box rules read it as any colour.
 */
export const HOLD = "attendre";

/** What a waiting patient shows: no true level, no future; when the nurse last looked, if ever. */
const viewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, source: patient.source, reassessedAt: patient.reassessedAt });

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
    // A new array: clones of the shift share their patients' arrays.
    patient.worsenedAt = [...patient.worsenedAt, shift.events.now];
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
  reassessEnd(shift, patient) {
    shift.freeNurses += 1;
    patient.assessing = false;
    // The page replays the looks: when, and the colour given (null if the patient was taken in meanwhile). A new array, as above.
    const colour = patient.start === null ? patient.level : null;
    patient.lookedAt = [...patient.lookedAt, { from: shift.events.now - shift.settings.reassess, to: shift.events.now, colour }];
    // Taken into a box during the look: it came too late to change anything.
    if (patient.start !== null) return;
    if (patient.colour !== patient.level) patient.recoloured = true;
    Object.assign(patient, { colour: patient.level, reassessedAt: shift.events.now });
  },
  wake(shift) {
    shift.wakeAt = null;
  },
  /** The plan's clock (ward.js): a step of the shift walked minute by minute, nothing else. */
  tick() {},
};

/** Applies one event of the queue to `shift`: the plan (ward.js) runs the queue itself, a step at a time. */
export const handleEvent = (shift, event) => HANDLERS[event.type](shift, shift.patients.get(event.id));

/** The start of a shift: `patients` (scenario.js, `drawShift`) to come, every box and doctor free. */
export function startShift(patients, overrides = {}) {
  const settings = { ...DEFAULTS, ...overrides };
  const events = createEvents();
  const course = new Map(patients.map((patient) => [patient.id, { ...patient, arrivalLevel: patient.level, firstColour: patient.colour, worsened: 0, worsenedAt: [], start: null, examEnd: null, end: null, box: null, looks: 0, lookedAt: [], reassessedAt: null, assessing: false, recoloured: false }]));
  for (const patient of course.values()) events.schedule(patient.arrival, { type: "arrive", id: patient.id });
  return { settings, events, patients: course, waiting: [], holding: false, boxIds: Array.from({ length: settings.boxes }, (_, i) => i), freeDoctors: settings.doctors, freeNurses: settings.nurses, resting: false, wakeAt: null, kind: null, boxMinutes: 0, doctorMinutes: 0, peakWaiting: 0 };
}

const choiceNeeded = (shift) => !shift.holding && shift.boxIds.length > 0 && shift.freeDoctors > 0 && shift.waiting.length > 0;
const lastLook = (patient) => patient.reassessedAt ?? patient.arrival;

/** The waiting patients a free nurse may look at now: not being looked at, due for a look (`recheck`). */
export function candidatesOf(shift) {
  const { recheck } = shift.settings;
  return shift.waiting.map((id) => shift.patients.get(id)).filter((patient) => !patient.assessing && lastLook(patient) + recheck <= shift.events.now);
}

/** Wakes a free nurse when the next waiting patient falls due for a look (nothing the department sees may happen before). */
function wakeNurse(shift) {
  const { recheck } = shift.settings;
  const due = Math.min(...shift.waiting.map((id) => shift.patients.get(id)).filter((patient) => !patient.assessing).map((patient) => lastLook(patient) + recheck));
  if (due < Infinity && (shift.wakeAt === null || due < shift.wakeAt)) {
    shift.events.schedule(due, { type: "wake" });
    shift.wakeAt = due;
  }
}

/** Runs the shift to its next choice: "box" or "nurse" there (also kept as `shift.kind`), null once nothing is left to happen. */
export function nextChoice(shift) {
  for (;;) {
    if (choiceNeeded(shift)) return (shift.kind = "box");
    if (shift.freeNurses > 0 && !shift.resting && shift.waiting.length > 0) {
      if (candidatesOf(shift).length > 0) return (shift.kind = "nurse");
      wakeNurse(shift);
    }
    shift.peakWaiting = Math.max(shift.peakWaiting, shift.waiting.length);
    const next = shift.events.next();
    if (!next && shift.holding) {
      shift.holding = false;
      continue;
    }
    if (!next) return (shift.kind = null);
    const { type } = next.event;
    HANDLERS[type](shift, shift.patients.get(next.event.id));
    // A worsening is not seen, and a nurse's wake is only a clock: neither ends a hold.
    if (type !== "worsen" && type !== "wake") shift.holding = false;
    if (type !== "worsen") shift.resting = false;
  }
}

/** A free nurse looks again at waiting patient `id`, for `reassess` minutes. */
export function reassess(shift, id) {
  const patient = shift.patients.get(id);
  if (!candidatesOf(shift).includes(patient)) throw new Error("l'infirmier doit revoir un patient qui attend depuis assez longtemps");
  shift.freeNurses -= 1;
  patient.assessing = true;
  patient.looks += 1;
  shift.events.schedule(shift.events.now + shift.settings.reassess, { type: "reassessEnd", id });
}

/** The free nurses look at nobody until something happens. */
export function rest(shift) {
  shift.resting = true;
}

/** The patients a free nurse may look at now, as a nurse rule sees them. */
export const candidateViewsOf = (shift) => candidatesOf(shift).map(viewOf);

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

/** Applies `rule`'s box choice or `nurseRule`'s nurse choice to `shift`, at a choice of kind `kind`. */
export function act(shift, kind, rule, nurseRule) {
  const context = { now: shift.events.now, freeBoxes: shift.boxIds.length, freeDoctors: shift.freeDoctors, shift, kind };
  if (kind === "nurse") {
    const chosen = nurseRule?.(candidateViewsOf(shift), context);
    if (chosen) reassess(shift, chosen.id);
    else rest(shift);
    return;
  }
  const chosen = rule(viewsOf(shift), context);
  if (chosen?.id === HOLD) hold(shift);
  else choose(shift, chosen?.id);
}

/** Plays `shift` to its end, each box choice made by `rule`, each nurse choice by `nurseRule` (none: nobody is looked at again). */
export function runShift(shift, rule, nurseRule = null) {
  for (let kind = nextChoice(shift); kind; kind = nextChoice(shift)) act(shift, kind, rule, nurseRule);
  return shift;
}

/**
 * The late cost of `patient` waiting until `until`, at the level of the moment: each minute past the longest
 * wait of the true level the patient has then (from arrival), at that level's weight. A patient who gets
 * worse while waiting weighs more, and is late sooner, from then on.
 */
export function lateCostNow(patient, until) {
  let cost = 0;
  let level = patient.arrivalLevel;
  let from = patient.arrival;
  for (const at of [...patient.worsenedAt.filter((time) => time < until), until]) {
    const due = patient.arrival + MAX_WAIT[level];
    cost += LATE_WEIGHT[level] * Math.max(0, at - Math.max(from, due));
    from = at;
    level -= 1;
  }
  return cost;
}

/**
 * A finished shift's patients, each with its `wait`, its `late` (minutes past the longest wait of its true
 * level on arrival) and its `costNow` (`lateCostNow`).
 */
export function courseOf(shift) {
  return [...shift.patients.values()].map((patient) => ({ ...patient, wait: patient.start - patient.arrival, late: Math.max(0, patient.start - patient.arrival - MAX_WAIT[patient.arrivalLevel]), costNow: lateCostNow(patient, patient.start) }));
}

/**
 * Plays `patients` under `rule`. Returns each patient's course (`start`, `examEnd`, `end`, `box` (from 0),
 * `wait`, `late`, `worsened`) and the shift's measures (`measuresOf`). The patients given are not changed.
 * `nurseRule` makes the nurse choices when the settings have nurses.
 */
export function simulateShift(patients, rule, overrides = {}, nurseRule = null) {
  const shift = runShift(startShift(patients, overrides), rule, nurseRule);
  const course = courseOf(shift);
  return { patients: course, measures: measuresOf(course, shift) };
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

/**
 * A shift's measures: the late cost (minutes past each true level's longest wait, weighted by level:
 * the score a rule should keep low), the same at the level of the moment (`lateCostNow`: worsening while
 * waiting counts), the patients seen late and worsened while waiting, per true level the
 * count, the mean wait and the share seen in time, the peak of the waiting room, how busy the boxes and
 * the doctors were, and the nurses' looks with the patients whose colour a look changed.
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
    lateCostNow: course.reduce((sum, patient) => sum + patient.costNow, 0),
    late: course.filter((patient) => patient.late > 0).length,
    worsened: course.filter((patient) => patient.worsened > 0).length,
    looks: course.reduce((sum, patient) => sum + patient.looks, 0),
    recoloured: course.filter((patient) => patient.recoloured).length,
    meanWait: mean(course.map((patient) => patient.wait)),
    byLevel,
    peakWaiting: shift.peakWaiting,
    boxUse: end ? shift.boxMinutes / (shift.settings.boxes * end) : 0,
    doctorUse: end ? shift.doctorMinutes / (shift.settings.doctors * end) : 0,
    end,
  };
}
