import { minutesOf } from "./pathway-cells.js";
import { busy, near, targetsOf, useTask } from "./pathway-intern.js";
import { locate } from "./pathway-trace.js";
import { walkSteps } from "./ward-moves.js";

/**
 * The intern decided one task at a time (Sami, 26/10/2026, the roadmap's step 6: the order of the intern's tasks):
 * with `internDecided` in the settings, a free intern with tasks open asks which to do (`internDecision`); they walk to
 * its place for the walk's real time (the cells × `STEP`), then do it. Played by events, not a step at a time
 * (pathway-game.js), so that a day is played in a moment and the search can play worlds of it. `INTERN_RULES`
 * answer as reference rules; the search answers too (pathway-search.js).
 *
 * A candidate: `{ id, kind, patient, due, colour, steps }`, `id` the task's `uid`, `steps` the cells to its place.
 */
export const INTERN_RULES = Object.freeze({
  /** The task due first. */
  dueFirst: (tasks) => tasks.reduce((best, one) => (one.due < best.due ? one : best)),
  /** The nearest task, the one due first between equals. */
  nearest: (tasks) => tasks.reduce((best, one) => (one.steps < best.steps || (one.steps === best.steps && one.due < best.due) ? one : best)),
  /** The most urgent patient's task (the colour of the moment), the one due first between equals. */
  urgent: (tasks) => tasks.reduce((best, one) => (one.colour < best.colour || (one.colour === best.colour && one.due < best.due) ? one : best)),
});

export const INTERN_LABELS = Object.freeze({ dueFirst: "la tâche due la première", nearest: "la tâche la plus proche", urgent: "le patient le plus grave" });

/** The nearest place of `task` from the intern, and the cells to it. */
function placeOf(day, task) {
  const { walker } = day.trace.layout;
  const from = day.intern.cell;
  const options = targetsOf(day, task).map((cell) => ({ cell, steps: walkSteps(walker, from, cell) })).filter((one) => one.steps >= 0);
  return options.reduce((best, one) => (one.steps < best.steps ? one : best), options[0] ?? { cell: from, steps: 0 });
}

const viewOf = (day, task) => ({ id: task.uid, kind: task.kind, patient: task.id, due: task.due, colour: day.patients.get(task.id).colour, steps: placeOf(day, task).steps });

/** The tasks the intern may choose: the scanner's drop alone while a patient follows them to it. */
const choosable = ({ tasks, following }) => tasks.filter((task) => (following === null ? task.kind !== "scanDrop" : task.kind === "scanDrop" && task.id === following));

/** The intern's decision, or null: free, not walking, tasks to choose from. */
export function internDecision(day) {
  const { intern } = day;
  if (!intern || !day.settings.internDecided || busy(day) || intern.walkingUntil > day.events.now + 1e-9 || intern.goingTo) return null;
  const tasks = choosable(intern);
  return tasks.length ? { kind: "intern", candidates: tasks.map((task) => viewOf(day, task)) } : null;
}

/** Applies the intern's decision: they walk to the task's place, and do it once there (`internArrive`). */
export function decideIntern(day, uid) {
  const { intern } = day;
  const task = intern.tasks.find((one) => one.uid === uid);
  if (!task) throw new Error("l'interne doit choisir une de ses tâches ouvertes");
  const { cell, steps } = placeOf(day, task);
  intern.walkingUntil = day.events.now + minutesOf(steps);
  intern.goingTo = { uid, cell };
  locate(day, "intern", { at: "cell", cell });
  day.events.schedule(intern.walkingUntil, { type: "internArrive" });
}

/** The intern arrives: the task done if it is still open and its place where they stand; else they choose again. */
export function internArrive(day) {
  const { intern } = day;
  const { uid, cell } = intern.goingTo;
  Object.assign(intern, { cell: { ...cell }, goingTo: null });
  const task = intern.tasks.find((one) => one.uid === uid);
  if (task && targetsOf(day, task).some((place) => near(place, cell))) useTask(day, task);
}
