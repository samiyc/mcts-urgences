import { MAX_WAIT } from "./hypotheses.js";
import { exitPatient, give, leavePlace, lognormal, now, removeFrom } from "./pathway-places.js";
import { scheduleWorsening } from "./simulate.js";
import { ask, assign, follows } from "./pathway-intern.js";
import { requestTransport } from "./pathway-porters.js";
import { STAFF_HANDLERS } from "./pathway-staff.js";
import { cleanedSlot, doctorBack, followedTo, locate, outOfScanner, placeOrSeat, seated } from "./pathway-trace.js";

/** @typedef {import("./types.js").Day} Day */
/** @typedef {import("./types.js").PathwayPatient} PathwayPatient */

/**
 * What each event of the detailed pathway (pathway.js) does to the day: an arrival, the end of a registration, of a
 * triage, of an exam, of a scan, of care, a bed freed, a place cleaned…
 */

/** The results all back: the patient waits for a doctor to read them, or goes straight to care when no exam was needed. */
function examsBack(day, patient) {
  if (patient.orderedAt === null) return startCare(day, patient);
  patient.step = "review";
  // The intern reads their patients' results themselves.
  if (follows(day, patient.id)) return ask(day, "result", patient.id);
  day.queues.review.push(patient.id);
}

/** The care, in the place; an intern's patient who needs a medication waits for it, then the care is shorter by its fetching. */
function startCare(day, patient) {
  if (follows(day, patient.id) && patient.needs.med && !patient.medGiven) {
    patient.step = "med";
    return ask(day, "pharmacy", patient.id);
  }
  patient.step = "care";
  const care = day.settings.care[patient.levelAtStart] * patient.stayFactor;
  const minutes = patient.medGiven ? Math.max(1, care - day.settings.intern.medInCare) : care;
  day.events.schedule(now(day) + minutes, { type: "careEnd", id: patient.id });
}

/** The admission decided: the patient waits for a bed of their ward, in their place, or in the UHCD if one is free. */
function admit(day, patient) {
  patient.admitAt ??= now(day);
  patient.step = "bed";
  day.wards[patient.ward].waiting.push(patient.id);
}

/** Out of triage (or straight in): the patient waits for a place and a doctor, and may leave if triaged 3 to 5. */
function toWaiting(day, patient) {
  patient.step = "waiting";
  day.queues.waiting.push(patient.id);
  locate(day, patient.id, { at: "waiting" });
  assign(day, patient);
  if (patient.patience < Infinity) day.events.schedule(now(day) + patient.patience, { type: "leave", id: patient.id });
}

/** The exams a doctor orders, in this order: the sample sent to the lab, the scanner, a specialist's advice. */
/** @type {Array<[keyof PathwayPatient["needs"], (day: Day, patient: PathwayPatient) => void]>} */
const EXAMS = [
  ["bio", (day, patient) => (follows(day, patient.id) ? ask(day, "sample", patient.id) : day.events.schedule(now(day) + day.settings.sample + lognormal(day.settings.labTurnaround, patient.labFactor), { type: "examBack", id: patient.id }))],
  // Walking counts: a stretcher-bearer takes the patient to the scanner first.
  ["scan", (day, patient) => (follows(day, patient.id) ? ask(day, "scanPick", patient.id) : toScanner(day, patient))],
  ["advice", (day, patient) => day.queues.specialists.push(patient.id)],
];

/** To the scanner: by a stretcher-bearer when walking counts, else at once into its queue. */
function toScanner(day, patient) {
  if (day.settings.walk) requestTransport(day, patient.id, { at: "scanner", slot: 0 }, "scan");
  else day.queues.scanner.push(patient.id);
}

/** Where a patient goes once cared for (their hidden orientation); a ward is the default. */
const ORIENTATIONS = {
  home(day, patient) {
    leavePlace(day, patient);
    exitPatient(day, patient, "domicile");
  },
  theatre(day, patient) {
    patient.step = "theatre";
    day.queues.theatre.push(patient.id);
  },
  transfer(day, patient) {
    patient.step = "transfer";
    day.events.schedule(now(day) + day.settings.transferDelay, { type: "transferred", id: patient.id });
  },
  uhcd(day, patient) {
    patient.step = "uhcdWait";
    day.queues.uhcd.push(patient.id);
  },
  ward: admit,
};

/** What each task of the intern does once done (pathway-intern.js). */
const INTERN_DONE = {
  vitals(day, patient) {
    if (patient.step !== "waiting") return;
    // The vitals show a worsening the bracelet did not: the colour is the level now.
    if (patient.level < patient.colour) {
      patient.colour = patient.level;
      day.intern.recoloured += 1;
    }
    if (follows(day, patient.id)) ask(day, "vitals", patient.id);
  },
  sample: (day, patient) => ask(day, "tubes", patient.id),
  tubes: (day, patient) => day.events.schedule(now(day) + lognormal(day.settings.labTurnaround, patient.labFactor), { type: "examBack", id: patient.id }),
  scanPick: (day, patient) => ask(day, "scanDrop", patient.id),
  scanDrop(day, patient) {
    followedTo(day, patient);
    day.queues.scanner.push(patient.id);
  },
  result(day, patient) {
    patient.reviewedAt = now(day);
    startCare(day, patient);
  },
  pharmacy: (day, patient) => ask(day, "med", patient.id),
  med(day, patient) {
    patient.medGiven = true;
    startCare(day, patient);
  },
};

export const HANDLERS = {
  announce(day, patient) {
    // The 15 sends a non-red ambulance elsewhere while the department is saturated.
    if (patient.colour > 1 && day.queues.waiting.length >= day.settings.divertAt) day.diverted.add(patient.id);
  },
  arrive(day, patient) {
    if (day.diverted.has(patient.id)) return exitPatient(day, patient, "reoriente");
    scheduleWorsening(day.events, patient, patient.arrival + MAX_WAIT[patient.level]);
    // A red brought by an ambulance has been triaged outside: straight to a place, registered later.
    if (patient.source === "ambulance" && patient.colour === 1) return toWaiting(day, patient);
    patient.step = "register";
    day.queues.register.push(patient.id);
    locate(day, patient.id, { at: "reception" });
  },
  registerEnd(day, patient) {
    give(day, "reception");
    patient.step = "triage";
    day.queues.triage.push(patient.id);
    locate(day, patient.id, { at: "triage" });
  },
  triageEnd(day, patient) {
    give(day, "ioa");
    patient.triagedAt = now(day);
    toWaiting(day, patient);
  },
  leave(day, patient) {
    if (patient.step !== "waiting") return;
    removeFrom(day.queues.waiting, patient.id);
    exitPatient(day, patient, "parti");
  },
  worsen(day, patient) {
    if (patient.start !== null || patient.exit !== null) return;
    patient.level -= 1;
    patient.worsened += 1;
    patient.worsenedAt = [...patient.worsenedAt, now(day)];
    scheduleWorsening(day.events, patient, now(day));
  },
  examEnd(day, patient) {
    give(day, "doctors");
    doctorBack(day, patient.id);
    patient.examEnd = now(day);
    const ordered = EXAMS.filter(([need]) => patient.needs[need]);
    if (ordered.length) patient.orderedAt = now(day);
    for (const [, order] of ordered) {
      patient.pending += 1;
      order(day, patient);
    }
    if (patient.pending === 0) return examsBack(day, patient);
    patient.step = "exams";
    // A patient who walked in and is not urgent waits for the results seated, out of the box.
    if (!day.settings.seated || patient.source !== "pied" || patient.colour < 3) return;
    leavePlace(day, patient);
    seated(day, patient);
  },
  examBack(day, patient) {
    patient.pending -= 1;
    if (patient.pending === 0) examsBack(day, patient);
  },
  scanEnd(day, patient) {
    give(day, "scanner");
    outOfScanner(day, patient);
    if (day.settings.walk) return requestTransport(day, patient.id, placeOrSeat(day, patient), "back");
    HANDLERS.examBack(day, patient);
  },
  adviceEnd(day, patient) {
    give(day, "specialists");
    HANDLERS.examBack(day, patient);
  },
  reviewEnd(day, patient) {
    give(day, "doctors");
    doctorBack(day, patient.id);
    patient.reviewedAt = now(day);
    if (!patient.overlooked) return startCare(day, patient);
    // A tired doctor overlooked the results: they are read again later (step 4).
    patient.overlooked = false;
    day.fatigue.oversights += 1;
    day.events.schedule(now(day) + day.settings.fatigue.oversightDelay, { type: "reviewLate", id: patient.id });
  },
  reviewLate(day, patient) {
    startCare(day, patient);
  },
  careEnd(day, patient) {
    patient.careEnd = now(day);
    (ORIENTATIONS[patient.orientation] ?? admit)(day, patient);
  },
  transferred(day, patient) {
    leavePlace(day, patient);
    exitPatient(day, patient, "transfert");
  },
  uhcdEnd(day, patient) {
    if (patient.thenWard) return admit(day, patient);
    leavePlace(day, patient);
    exitPatient(day, patient, "domicile");
  },
  theatreEnd(day) {
    give(day, "theatre");
  },
  bedFreed(day, event) {
    day.wards[event.ward].free += 1;
  },
  toBed(day, patient) {
    leavePlace(day, patient);
    exitPatient(day, patient, "hospitalise");
  },
  /** Doctors come or go (the day's extra doctors); one who goes while busy finishes first (the pool is over-full until then). */
  staff(day, event) {
    day.capacity.doctors += event.doctors;
  },
  /** A transport arrived: at the scanner (into its queue), or back from it (the scan done). */
  transported(day, patient, event) {
    if (event.next === "scan") day.queues.scanner.push(patient.id);
    else HANDLERS.examBack(day, patient);
  },
  ...STAFF_HANDLERS,
  /** A task of the intern done (pathway-intern.js), after its minutes: its effect. */
  internDone(day, patient, event) {
    INTERN_DONE[event.kind](day, patient);
  },
  cleaned(day, event) {
    give(day, event.place);
    cleanedSlot(day, event.place, event.slot);
  },
};

export { toWaiting };
