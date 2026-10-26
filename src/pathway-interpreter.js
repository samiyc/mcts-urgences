/**
 * The patients who do not speak French (Sami, 26/10/2026, docs/parcours-ajouts.md; INTERPRETER, H70 to H72; the
 * share: 278 of 21 909 consultations at Arras, docs/recherche/oublis.md): with `interpreter` in the settings, an
 * allophone patient (pathway-extras.js) is understood:
 * - by a companion who translates, when the families are on and someone came with them: a triage and an exam a little
 *   longer (`family`);
 * - else by an interpreter on the phone: a wait for them at the triage and at the exam (`connect`), then longer
 *   (`slow`).
 */

export const startInterpreter = (settings) => (settings.interpreter ? { allophones: 0, calls: 0, waited: 0 } : null);

/** How the patient is understood: null (in French), "family" (a companion translates) or "phone". */
export function translationOf(day, patient) {
  if (!day.interpreter || !patient.allophone) return null;
  return day.family && patient.accompanied ? "family" : "phone";
}

/** How much longer a triage or an exam takes for the patient (1 in French). */
export function languageSlowOf(day, patient) {
  const way = translationOf(day, patient);
  if (!way) return 1;
  return way === "phone" ? day.settings.interpreter.slow : day.settings.interpreter.family;
}

/** The minutes waited for the interpreter on the phone before a triage or an exam, counted with the call. */
export function interpreterWait(day, patient) {
  if (translationOf(day, patient) !== "phone") return 0;
  day.interpreter.calls += 1;
  day.interpreter.waited += day.settings.interpreter.connect;
  return day.settings.interpreter.connect;
}

/** An allophone patient arrives, counted. */
export function noteAllophone(day, patient) {
  if (day.interpreter && patient.allophone) day.interpreter.allophones += 1;
}
