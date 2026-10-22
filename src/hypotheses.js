/**
 * Every number of the model, in one place (Sami, 22/10/2026). **These are hypotheses, not medical data**:
 * round figures chosen to make a plausible emergency department for a demonstration, to be replaced by
 * published ones (docs/modele.md says which). The assistant organises queues and rooms; it never judges a
 * patient's care.
 *
 * Levels follow a five-colour triage such as Manchester's: 1 red (immediate), 2 orange (10 min), 3 yellow
 * (60 min), 4 green (120 min), 5 blue (240 min). A level is a priority and a deadline.
 */
export const LEVELS = Object.freeze([1, 2, 3, 4, 5]);

export const COLOURS = Object.freeze({ 1: "rouge", 2: "orange", 3: "jaune", 4: "vert", 5: "bleu" });

/** The longest wait each level allows, in minutes. */
export const MAX_WAIT = Object.freeze({ 1: 0, 2: 10, 3: 60, 4: 120, 5: 240 });

/** What a minute late costs at each level, in the crisis's score. */
export const LATE_WEIGHT = Object.freeze({ 1: 16, 2: 8, 3: 4, 4: 2, 5: 1 });

export const DEFAULTS = Object.freeze({
  /** The shift simulated, in minutes; arrivals stop then, the patients still there are seen. */
  shift: 480,
  /**
   * Rooms (boxes) and doctors on duty: about 80 % busy on an ordinary day with the rates below (the doctors
   * ~3.2 of 4, the boxes ~9.7 of 12), so that a crisis, not the ordinary day, overloads the department.
   */
  boxes: 12,
  doctors: 4,
  /** Walk-ins an hour, and their true levels' shares (level 1 to 5). */
  walkInRate: 6,
  walkInMix: Object.freeze([0.02, 0.1, 0.35, 0.4, 0.13]),
  /** Ambulances an hour, announced ahead, and their shares. */
  ambulanceRate: 1.5,
  ambulanceMix: Object.freeze([0.15, 0.35, 0.4, 0.1, 0]),
  announced: 15,
  /** Triage: the colour given is the true level with this chance, else one level off, either way. */
  triageRight: 0.8,
  /** Minutes with a doctor (the exam), then in the box alone (care, waiting for results), by true level. */
  exam: Object.freeze({ 1: 60, 2: 40, 3: 25, 4: 15, 5: 10 }),
  stay: Object.freeze({ 1: 120, 2: 90, 3: 60, 4: 20, 5: 5 }),
  /** The spread of those times: a factor exp(spread · z) around them. */
  spread: 0.4,
  /**
   * Getting worse while waiting: past its true level's longest wait, a patient of level 2 to 4 may move up a
   * level, after an exponential delay of this mean (minutes); the colour on the bracelet does not change.
   */
  worsenAfter: 90,
  /**
   * Re-assessment (Sami, 22/10): a triage nurse looks again at a patient who has waited, `reassess` minutes of
   * the nurse's time; the bracelet then shows the patient's true level of now, worsening included. A patient
   * may be looked at `recheck` minutes after arriving, then again `recheck` minutes after the last look.
   * `nurses: 0`, no re-assessment: the department of the first results.
   */
  nurses: 0,
  reassess: 5,
  recheck: 30,
  /** A crisis: an accident brings `size` ambulance patients over `over` minutes from `at`; none by default. */
  crisis: null,
});

/** The crisis of the examples: a road accident, ten victims brought in over half an hour, 1 h 30 into the shift. */
export const ACCIDENT = Object.freeze({ at: 90, size: 10, over: 30, mix: Object.freeze([0.25, 0.35, 0.3, 0.1, 0]) });

/**
 * Hospitals to try the rules on (Sami, 22/10: change the hospital to test other configurations): each one
 * overrides DEFAULTS. Sized, like the default, to run about 80 % busy on an ordinary day.
 */
export const HOSPITALS = Object.freeze({
  proximite: Object.freeze({ label: "Hôpital de proximité", boxes: 6, doctors: 2, walkInRate: 3, ambulanceRate: 0.75 }),
  moyen: Object.freeze({ label: "Hôpital moyen", boxes: 12, doctors: 4, walkInRate: 6, ambulanceRate: 1.5 }),
  chu: Object.freeze({ label: "Grand CHU", boxes: 24, doctors: 8, walkInRate: 12, ambulanceRate: 3 }),
});
