/**
 * The hospital in tension, its « HET » (Sami, 26/10/2026, the roadmap's later items; oublis.md, glossaire.md): the
 * level before the Plan blanc, for a mismatch between the patients to admit and the beds, foreseen more than sudden.
 * It involves every ward, not the department alone, and aims to avoid the Plan blanc (ARS Nouvelle-Aquitaine). With
 * `het` in the settings, every `ASK_EVERY` minutes until it is on, the day asks whether to trigger it (`hetDecision`).
 * Once on, after `delay` minutes (the bed managers and the wards organise), the wards give `beds` at once by putting
 * off planned admissions, then a bed more of `flowWard` every `every` minutes for the rest of the day (patients sent
 * home or to follow-up care earlier). No doctor is called back: that is the Plan blanc's (pathway-alert.js). Each bed
 * it gives weighs `bedCost` (an admission put off, a patient out sooner). The figures are hypotheses (H63 to H66).
 */
const ASK_EVERY = 15;
const NOW = Object.freeze({ id: "now" });
const LATER = Object.freeze({ id: "later" });

/** The hospital's size against the medium one's, which the figures are for. */
const sizeOf = (settings) => settings.boxes / 12;
const boardersOf = (day) => Object.values(day.wards).reduce((sum, ward) => sum + ward.waiting.length, 0);

export const HET_RULES = Object.freeze({
  /** Never. */
  never: () => LATER,
  /** Once `boarders` patients (the medium hospital's, the others scaled) wait for a bed. */
  threshold: (_, { day }) => (boardersOf(day) >= Math.max(1, Math.round(day.settings.het.boarders * sizeOf(day.settings))) ? NOW : LATER),
});

export const HET_LABELS = Object.freeze({ never: "jamais", threshold: "dès que des patients attendent un lit" });

export const startHet = (settings) => (settings.het ? { on: false, at: null, bedsAt: null, asked: -Infinity, given: [] } : null);

/** The decision to trigger the HET, every few minutes while it is off and its beds could still come; null otherwise. */
export function hetDecision(day) {
  const { het } = day;
  const t = day.events.now;
  if (!het || het.on || t + day.settings.het.delay >= day.settings.shift || t - het.asked < ASK_EVERY) return null;
  return { kind: "het", candidates: [NOW, LATER] };
}

/** Applies it: the HET on now (its beds after the delay), or asked again later. */
export function decideHet(day, id) {
  const { het } = day;
  const t = day.events.now;
  het.asked = t;
  if (id !== "now") return;
  Object.assign(het, { on: true, at: t, bedsAt: t + day.settings.het.delay });
  day.events.schedule(het.bedsAt, { type: "hetBeds" });
}

/** A ward gives a bed by the HET: counted, with its minute. */
function give(day, ward, count) {
  if (!day.wards[ward]) return;
  day.wards[ward].free += count;
  for (let i = 0; i < count; i += 1) day.het.given.push(day.events.now);
}

/** The next bed of the flow, if it comes before the day's end. */
function nextFlow(day) {
  const at = day.events.now + day.settings.het.every / sizeOf(day.settings);
  if (at < day.settings.shift) day.events.schedule(at, { type: "hetFlow" });
}

/** The HET's events (pathway-handlers.js): its beds at once, then its flow of beds. */
export const HET_HANDLERS = {
  hetBeds(day) {
    for (const [ward, count] of Object.entries(day.settings.het.beds)) give(day, ward, Math.max(1, Math.round(count * sizeOf(day.settings))));
    nextFlow(day);
  },
  hetFlow(day) {
    give(day, day.settings.het.flowWard, 1);
    nextFlow(day);
  },
};

/** The beds the HET gave after minute `from`. */
export const hetBedsSince = (day, from) => (day.het ? day.het.given.filter((at) => at > from).length : 0);

/** What the HET cost the day: when it came on, the beds it gave, and their weight in the score. */
export function hetMeasures(day) {
  const beds = day.het?.given.length ?? 0;
  return { at: day.het?.at ?? null, beds, cost: beds * (day.settings.het?.bedCost ?? 0) };
}
