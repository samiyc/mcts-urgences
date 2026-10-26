import { ACCIDENT, DEFAULTS, HOSPITALS } from "./hypotheses.js";
import { PATHWAY_PLANS, capacityOf, pathwayPlanOf } from "./pathway-plans.js";

/**
 * Every number of the detailed pathway (Sami, 25/10/2026, docs/recherche/), in one place, over the simple shift's
 * (hypotheses.js). A figure with a source cites docs/recherche/ (DREES: the Urgences 2023 survey, a weekday in
 * June); the others are **hypotheses**, round figures for a plausible department, not medical data (each listed, with
 * the question to ask a professional, in docs/recherche/hypotheses-a-verifier.md). Times are in
 * minutes, `t = 0` being `startHour` o'clock.
 */
export const PATHWAY_DEFAULTS = Object.freeze({
  ...DEFAULTS,
  /** A day from 8 a.m. (the survey's day), and up to a day more for the patients still there (then counted as still there). */
  startHour: 8,
  shift: 1440,
  overtime: 1440,
  /**
   * Arrivals by hour of the day, around the mean rate: low at night, a peak in the afternoon and the early evening
   * (DREES ER 1373, graph 2, for the shape; the figures are a hypothesis). Scaled so that the mean from 8 h to 16 h
   * is the simple shift's rate (pathway-scenario.js).
   */
  hourly: Object.freeze([0.45, 0.35, 0.3, 0.28, 0.28, 0.32, 0.5, 0.8, 1.15, 1.35, 1.45, 1.45, 1.4, 1.4, 1.4, 1.35, 1.3, 1.3, 1.3, 1.25, 1.1, 0.95, 0.8, 0.6]),
  /**
   * A doctor more by day, from 10 h to 22 h, when most patients come (hypothesis: departments staff to their
   * curve; without it, the afternoon peak saturates the doctors that a flat day keeps 80 % busy).
   */
  dayDoctors: Object.freeze({ from: 10, to: 22, extra: 1 }),
  /** How many of each: the medium hospital (12 boxes, 4 doctors), the others scaled on their boxes (`pathwaySettingsOf`). */
  capacity: Object.freeze({ reception: 1, ioa: 1, sauv: 2, isolation: 1, uhcd: 6, scanner: 1, theatre: 1, specialists: 2 }),
  /** Registration (DREES: 80 % within 5 min), triage (hypothesis), the doctor reading the results (hypothesis). */
  register: 2,
  triage: 5,
  review: 5,
  /** Biology: the sample, then the lab's turnaround, a median (troponin: 81 min in 28 French centres, 60 aimed at; SFBC/SFMU). */
  sample: 10,
  labTurnaround: 70,
  /** The scanner, transport included (hypothesis); a specialist's coming (on call at night) and advice (hypotheses). */
  scan: 20,
  adviceDelay: 45,
  advice: 20,
  /** A box made ready again; after a contagious or agitated patient (hypotheses). */
  clean: 10,
  cleanIsolated: 45,
  /** An operation (hypothesis); a transfer to another hospital waits for its transport (hypothesis). */
  theatre: 120,
  transferDelay: 120,
  /** The bed found, the patient leaves: the median is 25 min (DREES ER 1373). */
  toBed: 25,
  /** In the UHCD: half stay more than 11 h 55 (DREES ER 1372); this share then goes on to a ward (DREES: 4 % of 9 %). */
  uhcdStay: 715,
  uhcdThenWard: 0.45,
  /** A patient waiting for a bed moves to the UHCD if a bed is free there, freeing their box (hypothesis: the usual practice). */
  uhcdForBoarders: true,
  /**
   * Walking counts (Sami, 26/10/2026, step 3): the exam waits for the patient and the doctor at the place, the results
   * for the doctor's walk, the scanner for a stretcher-bearer (pathway-porters.js). Off, the day is step 1's.
   */
  walk: false,
  /** The intern (INTERN, step 3), or none: without one, the day is the same as before. */
  intern: null,
  /** The doctors' fatigue and breaks (FATIGUE, step 4), or none: without it, the day is the same as before. */
  fatigue: null,
  /**
   * The care once the results are read, in the place (hypothesis; the simple shift's `stay` held the box for the
   * results as well, here they are their own steps).
   */
  care: Object.freeze({ 1: 60, 2: 45, 3: 30, 4: 10, 5: 5 }),
  /** A patient who walked in and is triaged 3 to 5 waits for the results seated, freeing the box (hypothesis: the usual practice). */
  seated: true,
  /** A free doctor reads the results that are back before taking a new patient (hypothesis). */
  reviewFirst: true,
  /** What each true level needs (hypotheses; DREES ER 1372: 46 % of patients use the technical platform). */
  needs: Object.freeze({
    bio: Object.freeze({ 1: 0.95, 2: 0.9, 3: 0.65, 4: 0.25, 5: 0.05 }),
    scan: Object.freeze({ 1: 0.7, 2: 0.5, 3: 0.3, 4: 0.08, 5: 0 }),
    advice: Object.freeze({ 1: 0.5, 2: 0.35, 3: 0.15, 4: 0.03, 5: 0 }),
  }),
  /**
   * Where each true level goes (hypotheses, set so that a day's mix gives about DREES's: 79 % home, 9 % UHCD,
   * 16 % admitted, ER 1372 and 1373).
   */
  orientation: Object.freeze({
    1: Object.freeze({ home: 0, uhcd: 0.05, ward: 0.45, theatre: 0.4, transfer: 0.1 }),
    2: Object.freeze({ home: 0.35, uhcd: 0.2, ward: 0.38, theatre: 0.05, transfer: 0.02 }),
    3: Object.freeze({ home: 0.72, uhcd: 0.12, ward: 0.15, theatre: 0.01, transfer: 0 }),
    4: Object.freeze({ home: 0.93, uhcd: 0.05, ward: 0.02, theatre: 0, transfer: 0 }),
    5: Object.freeze({ home: 1, uhcd: 0, ward: 0, theatre: 0, transfer: 0 }),
  }),
  /** The wards a patient may be admitted to, by true level (hypothesis). */
  wardOf: Object.freeze({
    1: Object.freeze({ reanimation: 0.6, chirurgie: 0.2, cardiologie: 0.2 }),
    other: Object.freeze({ medecine: 0.55, chirurgie: 0.25, cardiologie: 0.2 }),
  }),
  /**
   * The downstream beds of the medium hospital (hypotheses): free when the day starts, then freed over a day, most
   * near midday (DREES ER 1373: wards free their beds late in the morning; a bed decided between 8 and 12 waits 55 min
   * at the median, 10 min between 16 and 20).
   */
  wards: Object.freeze({
    medecine: Object.freeze({ free: 2, perDay: 9 }),
    chirurgie: Object.freeze({ free: 1, perDay: 4 }),
    cardiologie: Object.freeze({ free: 1, perDay: 3 }),
    reanimation: Object.freeze({ free: 1, perDay: 2 }),
  }),
  /** When the freed beds come: around this hour, with this spread (hours). */
  bedHour: 12.5,
  bedSpread: 1.5,
  /** Patients to isolate, contagious or agitated (hypothesis: 3 %); patients of 75 or more, by true level (hypothesis). */
  isolate: 0.03,
  elderly: Object.freeze({ 1: 0.3, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.05 }),
  /**
   * Leaving without being seen (DREES: 3.4 % of patients, plus 0.6 % against advice): a patient triaged 3 to 5 may
   * leave after a patience: a sure part, then an exponential one of this mean (hypotheses, set for a few per cent on
   * an ordinary day; the longer the wait, the more leave, as every study finds).
   */
  patience: Object.freeze({ 3: 600, 4: 360, 5: 300 }),
  patienceFloor: 120,
  /** The 15 sends ambulances elsewhere (but not the red ones) while this many triaged patients wait for a place (hypothesis). */
  divertAt: 20,
});

/**
 * The stretcher-bearers of each hospital (Sami, 26/10/2026, hypothesis: no source found), drawn on the plan from
 * step 2 (pathway-walk.js); they make nobody wait before step 3, when walking counts.
 */
export const PORTERS = Object.freeze({ proximite: 1, moyen: 2, chu: 3 });
/**
 * The intern (Sami, 26/10/2026, step 3; hypotheses, no source): the patients they follow at most, when each task is
 * due after it is asked, the minutes it takes (the results: the senior's reading), the minutes of the care the
 * department spends fetching a medication, and the share of patients needing one, by level.
 */
export const INTERN = Object.freeze({
  patients: 4,
  due: Object.freeze({ vitals: 30, sample: 15, tubes: 10, scanPick: 15, scanDrop: 10, result: 15, pharmacy: 15, med: 10 }),
  take: Object.freeze({ vitals: 2, sample: 3, tubes: 0.5, scanPick: 0.5, scanDrop: 0.5, result: 5, pharmacy: 1, med: 1 }),
  medInCare: 10,
  needsMed: Object.freeze({ 1: 0.9, 2: 0.8, 3: 0.6, 4: 0.3, 5: 0.1 }),
});

/**
 * The doctors' fatigue and breaks (Sami, 26/10/2026, step 4; hypotheses H43 to H49, docs/recherche/hypotheses-a-verifier.md;
 * the shape after Landrigan 2004 and the « repos de sécurité », soignants.md, not the figures):
 * - `breaks`: the rule (pathway-fatigue.js's BREAK_RULES); `teams`: one shift of 24 h, or two of 12 h;
 * - `slow`: how much slower, at hours of fatigue, `[[hours, share]]`; `night`: more from 0 h to 6 h;
 * - `oversight`: the chance a reading overlooks the results, `base + perHour × hours`; read again `oversightDelay` later;
 * - `minutes` and `rest`: each break's length and the share of fatigue it takes away;
 * - `minDoctors`: always this many doctors at work; `quietWaiting`: « quiet » is this many waiting or fewer;
 * - `handover`: the minutes of a handover between 12 h teams.
 */
export const FATIGUE = Object.freeze({
  breaks: "quiet",
  teams: 24,
  slow: Object.freeze([Object.freeze([0, 0]), Object.freeze([12, 0.1]), Object.freeze([20, 0.25]), Object.freeze([28, 0.4])]),
  night: 0.1,
  oversight: Object.freeze({ base: 0.01, perHour: 0.004 }),
  oversightDelay: 30,
  minutes: Object.freeze({ repas: 30, repos: 120 }),
  rest: Object.freeze({ repas: 0.3, repos: 0.6 }),
  minDoctors: 2,
  quietWaiting: 3,
  handover: 15,
});

/**
 * What a minute waiting for a bed costs the bed search (step 6; hypothesis H51): as a green's minute late, three times
 * that for a patient of 75 or more at night (« No Bed Night »: their mortality from 11.1 to 15.7 %, ressources-rares.md).
 */
export const BOARDING_COST = Object.freeze({ perMinute: 2, elderlyAtNight: 3 });

/** A cell of a plan, in metres (as on the simple shift's plan, ward.js: a few metres, 6 s of walking). */
export const CELL_METRES = 2;

/** The places a plan sets (the boxes, the SAUV, the isolation, the UHCD, the scanners) over the hospital's. */
function placesOf(settings, plan) {
  const { boxes, ...places } = capacityOf(pathwayPlanOf(plan));
  return { ...settings, boxes, capacity: { ...settings.capacity, ...places } };
}

/**
 * The pathway's settings for `hospital`, with the accident or not: the rates of hypotheses.js, the capacities scaled
 * on its boxes. `plan` (a plan's text, pathway-plans.js), when given, sets the places instead; the hospital's own plan
 * is kept otherwise, for drawing the day.
 */
export function pathwaySettingsOf({ hospital = "moyen", accident = false, plan = null, ...overrides } = {}) {
  const settings = scaledSettings(hospital, accident, overrides);
  return plan ? { ...placesOf(settings, plan), plan } : settings;
}

function scaledSettings(hospital, accident, overrides) {
  const base = { ...PATHWAY_DEFAULTS, ...HOSPITALS[hospital] };
  const scale = base.boxes / PATHWAY_DEFAULTS.boxes;
  const scaled = (value) => Math.max(1, Math.round(value * scale));
  return {
    ...base,
    capacity: Object.fromEntries(Object.entries(base.capacity).map(([name, value]) => [name, name === "reception" ? value : scaled(value)])),
    wards: Object.fromEntries(Object.entries(base.wards).map(([name, ward]) => [name, { free: Math.round(ward.free * scale), perDay: ward.perDay * scale }])),
    divertAt: Math.round(base.divertAt * scale),
    dayDoctors: { ...base.dayDoctors, extra: Math.round(base.dayDoctors.extra * scale) },
    hospital,
    plan: PATHWAY_PLANS[hospital],
    porters: PORTERS[hospital],
    ...(accident ? { crisis: ACCIDENT } : {}),
    ...overrides,
  };
}
