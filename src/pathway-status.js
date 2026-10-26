/**
 * What each patient of a finished day of the detailed pathway was doing at any minute (Sami, 26/10/2026, the
 * roadmap's step 2: « où il est, ce qu'il attend, depuis combien de temps »), rebuilt from the times the day kept
 * and its trace (pathway-trace.js). The steps are pathway.js's `STEPS`.
 */

/** Where a patient goes once cared for, by their orientation: the step they then wait in. */
const AFTER_CARE = { home: "out", theatre: "theatre", transfer: "transfer", uhcd: "uhcdWait", ward: "bed" };
const AT_STEP = { reception: "register", triage: "triage", waiting: "waiting" };

/** The patient's first steps, from the trace: registering, triage, waiting. */
const earlySteps = (moves) => moves.filter((move) => AT_STEP[move.to.at]).map((move) => ({ t: move.t, step: AT_STEP[move.to.at] }));

/** The steps the patient's times tell, those that happened. */
function timedSteps(patient) {
  const boarderInUhcd = patient.admitAt !== null && patient.uhcdAt !== null && patient.admitAt <= patient.uhcdAt;
  return [
    [patient.start, "exam"],
    [patient.examEnd, patient.orderedAt === null ? "care" : "exams"],
    [patient.reviewedAt, "care"],
    [patient.careEnd, AFTER_CARE[patient.orientation] ?? "bed"],
    [boarderInUhcd ? null : patient.uhcdAt, "uhcd"],
    [patient.uhcdAt !== null && patient.admitAt > patient.uhcdAt ? patient.admitAt : null, "bed"],
    [patient.bedAt, "leaving"],
    [patient.exitAt, "out"],
  ]
    .filter(([t]) => t !== null && t !== undefined)
    .map(([t, step]) => ({ t, step }));
}

/** Each patient's steps in time: `Map(id → [{ t, step }])`, sorted. */
export function stepsOf(day) {
  const moves = new Map([...day.patients.keys()].map((id) => [id, []]));
  for (const move of day.trace.moves) moves.get(move.who)?.push(move);
  return new Map(
    [...day.patients.values()].map((patient) => [patient.id, [{ t: patient.arrival, step: "coming" }, ...earlySteps(moves.get(patient.id)), ...timedSteps(patient)].sort((a, b) => a.t - b.t)]),
  );
}

/** The step at minute `t` (`stepsOf`'s list of one patient), and since when: `{ step, since }`; "coming" before the arrival. */
export function statusAt(steps, t) {
  let current = { step: "coming", since: null };
  for (const one of steps) {
    if (one.t > t) break;
    if (one.step !== current.step) current = { step: one.step, since: one.t };
  }
  return current;
}
