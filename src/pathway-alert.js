/**
 * The hospital's crisis plan, its « Plan blanc » (Sami, 26/10/2026, the roadmap's step 6; glossaire.md, HET and Plan
 * blanc): with `alert` in the settings, every `ASK_EVERY` minutes until it is on, the day asks whether to trigger it
 * (`alertDecision`). Once on, for the rest of the day: doctors called back come after `delay` minutes, and the wards,
 * their planned admissions put off, give the department beds at once. It costs: each doctor-hour called back weighs
 * `doctorHour` in the score of the search deciding it, and in the measures (`alertMeasures`). The figures are
 * hypotheses (H54, H55, docs/recherche/hypotheses-a-verifier.md).
 */
const ASK_EVERY = 15;
const NOW = Object.freeze({ id: "now" });
const LATER = Object.freeze({ id: "later" });

export const ALERT_RULES = Object.freeze({
  /** Never. */
  never: () => LATER,
  /** Once the waiting room passes the 15's threshold for sending ambulances elsewhere, or 3 reds or oranges wait. */
  threshold: (_, { day }) => {
    const urgent = day.queues.waiting.filter((id) => day.patients.get(id).colour <= 2).length;
    return day.queues.waiting.length >= day.settings.divertAt || urgent >= 3 ? NOW : LATER;
  },
});

export const ALERT_LABELS = Object.freeze({ never: "jamais", threshold: "au seuil de la salle d'attente" });

export const startAlert = (settings) => (settings.alert ? { on: false, at: null, staffAt: null, asked: -Infinity, recalled: 0 } : null);

/** The decision to trigger the plan, every few minutes while it is off and the day still runs; null otherwise. */
export function alertDecision(day) {
  const { alert } = day;
  const t = day.events.now;
  // Asked while doctors called back would still come before the day's end.
  if (!alert || alert.on || t + day.settings.alert.delay >= day.settings.shift || t - alert.asked < ASK_EVERY) return null;
  return { kind: "alert", candidates: [NOW, LATER] };
}

/** Applies it: the plan on now (the beds at once, the doctors later), or asked again later. */
export function decideAlert(day, id) {
  const { alert, settings } = day;
  const t = day.events.now;
  alert.asked = t;
  if (id !== "now") return;
  const { recall, delay, beds } = settings.alert;
  const scale = settings.boxes / 12;
  Object.assign(alert, { on: true, at: t, staffAt: t + delay, recalled: Math.max(1, Math.round(recall * scale)) });
  for (const [ward, count] of Object.entries(beds)) if (day.wards[ward]) day.wards[ward].free += Math.max(1, Math.round(count * scale));
  day.events.schedule(alert.staffAt, { type: "alertStaff" });
  day.events.schedule(Math.max(alert.staffAt, settings.shift), { type: "alertEnd" });
}

/** The doctor-hours called back up to minute `until` (none before they came). */
export const recalledHours = (day, until) => (day.alert?.on ? (day.alert.recalled * Math.max(0, Math.min(until, day.settings.shift) - day.alert.staffAt)) / 60 : 0);

/** What the plan cost the day: when it came on, the doctor-hours called back, and their weight in the score. */
export function alertMeasures(day) {
  const hours = recalledHours(day, day.settings.shift);
  return { at: day.alert?.at ?? null, hours, cost: hours * (day.settings.alert?.doctorHour ?? 0) };
}
