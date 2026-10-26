import { internSlowOf } from "./pathway-fatigue.js";
import { positionOf } from "./pathway-trace.js";

/**
 * The intern of the detailed pathway (Sami, 26/10/2026, docs/recherche/feuille-de-route.md, step 3): a junior doctor
 * who follows a few patients the department gives them (the first non-urgent ones out of triage, `patients` at most)
 * and does their **local tasks**, each with a time it is due:
 * - **vitals** (`vitals`): taken again while the patient waits for a box; a worsening they show changes the colour;
 * - **the sample** (`sample`) taken at the patient's side, then **the tubes** (`tubes`) carried to the lab, whose
 *   turnaround starts once they are there;
 * - **the scanner**: fetch the patient (`scanPick`), who follows, and bring them to it (`scanDrop`);
 * - **the results** (`result`), read at the doctors' poste: the intern reads them instead of a senior;
 * - **a medication**: fetched at the pharmacy (`pharmacy`), given at the patient's side (`med`); the care then starts,
 *   shorter by the time the department would have spent fetching it.
 *
 * The intern walks a cell a step (pathway-game.js plays them: a person at the keyboard, a robot, or at random) and
 * presses E beside a task's place; the task takes them its minutes, then its effect comes (the `internDone` event,
 * pathway-handlers.js). Without an intern in the settings, none of this exists and the day is the same as before.
 *
 * `day.intern`: `{ assigned, tasks, done, cell, busyUntil, following, track, recoloured, dropped }`; a task is
 * `{ kind, id, since, due }`, done ones get `at`.
 */

export const TASKS = Object.freeze({
  vitals: "reprendre les constantes",
  sample: "prélever",
  tubes: "porter les tubes au labo",
  scanPick: "aller chercher pour le scanner",
  scanDrop: "accompagner au scanner",
  result: "regarder les résultats",
  pharmacy: "chercher un médicament à la pharmacie",
  med: "donner le médicament",
});

export function startIntern(settings, layout) {
  if (!settings.intern) return null;
  return { assigned: new Set(), followed: 0, tasks: [], done: [], cell: { ...layout.points.room }, busyUntil: 0, following: null, pickedAt: null, track: [], recoloured: 0, dropped: 0 };
}

/** Whether the intern follows patient `id`. */
export const follows = (day, id) => Boolean(day.intern?.assigned.has(id));

/** A task to do for patient `id`, due after its delay (settings.intern.due). */
export function ask(day, kind, id) {
  const now = day.events.now;
  day.intern.tasks.push({ kind, id, since: now, due: now + day.settings.intern.due[kind] });
}

/** Out of triage: the intern takes a non-urgent patient while they follow fewer than their number; vitals due. */
export function assign(day, patient) {
  const { intern } = day;
  if (!intern || patient.colour < 3 || intern.assigned.size >= day.settings.intern.patients) return;
  intern.assigned.add(patient.id);
  intern.followed += 1;
  ask(day, "vitals", patient.id);
}

/** Patient `id` is out (or in a box, for the vitals only): their tasks are dropped. */
export function drop(day, id, kinds = null) {
  const { intern } = day;
  if (!intern) return;
  const gone = intern.tasks.filter((task) => task.id === id && (!kinds || kinds.includes(task.kind)));
  intern.tasks = intern.tasks.filter((task) => !gone.includes(task));
  if (!kinds) {
    intern.dropped += gone.length;
    intern.assigned.delete(id);
  }
}

/** The cells where a task is done: beside its patient, at the lab, the pharmacy, the poste, a scanner. */
export function targetsOf(day, task) {
  const { points, places } = day.trace.layout;
  const at = { tubes: [points.lab], pharmacy: [points.pharmacy], result: [points.room], scanDrop: places.scanner };
  return (at[task.kind] ?? [positionOf(day, task.id)]).filter(Boolean);
}

const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
export const busy = (day) => day.intern.busyUntil > day.events.now + 1e-9;

/** The tasks the intern may do where they stand, the most overdue first. */
export const tasksHere = (day) =>
  day.intern.tasks.filter((task) => (task.kind !== "scanDrop" || day.intern.following === task.id) && targetsOf(day, task).some((cell) => near(cell, day.intern.cell))).sort((a, b) => a.due - b.due);

/**
 * E pressed: the most overdue task the intern may do here is done, for its minutes; its effect at their end. Returns
 * what the page says.
 */
export function useHere(day) {
  const { intern } = day;
  if (busy(day)) return "Occupé : la tâche en cours n'est pas finie.";
  const [task] = tasksHere(day);
  if (!task) return "Rien à faire ici : E à côté d'un patient suivi, au labo, à la pharmacie, au poste ou au scanner.";
  const now = day.events.now;
  intern.tasks = intern.tasks.filter((one) => one !== task);
  intern.done.push({ ...task, at: now });
  // A tired intern takes longer (pathway-fatigue.js), when fatigue counts.
  const minutes = (day.settings.intern.take[task.kind] ?? 0) * internSlowOf(day);
  intern.busyUntil = now + minutes;
  if (task.kind === "scanPick") Object.assign(intern, { following: task.id, pickedAt: intern.track.length });
  day.events.schedule(now + minutes, { type: "internDone", id: task.id, kind: task.kind });
  const lasting = minutes ? ` (${minutes} min)` : "";
  return `${TASKS[task.kind]}, patient n° ${task.id}${lasting}.`;
}

/** The intern walks a cell (`dx`, `dy`) if they are free and the cell is walkable. */
export function moveIntern(day, [dx, dy]) {
  const { intern } = day;
  const next = { x: intern.cell.x + dx, y: intern.cell.y + dy };
  if (busy(day) || !day.trace.layout.passable(next.x, next.y)) return false;
  intern.cell = next;
  return true;
}
