import { createEvents } from "mcts-commun/events.js";
import { MAX_WAIT } from "./hypotheses.js";
import { hourAt } from "./pathway-scenario.js";
import { lateCostNow, scheduleWorsening } from "./simulate.js";

/**
 * The detailed pathway (Sami, 25/10/2026, docs/recherche/feuille-de-route.md, step 1): a day of the department, each
 * patient followed from arrival to exit, next to the simple shift (simulate.js), which stays as it was. A
 * discrete-event simulation (`events` of mcts-commun), minutes from `startHour`.
 *
 * A patient arrives (an ambulance may be sent elsewhere first, while the department is saturated), registers at the
 * reception, is triaged by the IOA (the colour), then waits for **a place and a doctor**: the SAUV for a red, the
 * isolation room for a patient to isolate, else a box (the SAUV or the room full: a box). A patient triaged 3 to 5
 * may leave before. The doctor examines; then the exams of the patient's hidden pathway: biology (a sample, the lab's
 * turnaround), the scanner (one patient at a time), a specialist's advice (on call: they come, then advise). When
 * every result is back, a doctor reads them (`review`); then the care, in the place; then the exit: home, the UHCD
 * (a night of watching, some then admitted), a downstream bed (a ward), the operating theatre, a transfer. **A patient
 * waiting for a bed keeps their box** (boarding), or moves to the UHCD if a bed is free there. A place left is
 * cleaned before the next patient.
 *
 * **Two kinds of decisions are left to a rule** (`nextDecision`): who takes a free place and doctor ("box"), and who
 * takes a bed a ward frees ("bed"). Everything else follows fixed orders (the scanner and the specialists: colour,
 * then the order; the theatre: reds first). A rule sees only what the department sees: the colour, the arrival, the
 * source; for a bed, when the admission was decided, where the patient waits, whether they are 75 or more.
 */

const STEPS = Object.freeze({
  coming: "en route",
  register: "attend l'inscription",
  triage: "attend le tri",
  waiting: "attend un box",
  exam: "examiné",
  exams: "attend ses examens",
  review: "attend la lecture des résultats",
  care: "en soins",
  theatre: "attend le bloc",
  transfer: "attend son transfert",
  uhcdWait: "attend une place en UHCD",
  uhcd: "en UHCD",
  bed: "attend un lit",
  leaving: "part dans son lit",
  out: "sorti",
});
export { STEPS };

/** The places, the people and the machines counted for their use, with their capacities. */
const POOLS = ["boxes", "sauv", "isolation", "uhcd", "doctors", "ioa", "reception", "scanner", "specialists", "theatre"];

const lognormal = (median, factor) => median * factor;

/** The start of a day: `day` drawn by `drawPathwayDay` (pathway-scenario.js); nothing has happened yet. */
export function startPathway(day) {
  const { settings } = day;
  const events = createEvents();
  const patients = new Map(
    day.patients.map((patient) => [
      patient.id,
      {
        ...patient,
        arrivalLevel: patient.level,
        worsened: 0,
        worsenedAt: [],
        step: "coming",
        place: null,
        start: null,
        exit: null,
        exitAt: null,
        pending: 0,
        triagedAt: null,
        orderedAt: null,
        reviewedAt: null,
        admitAt: null,
        uhcdAt: null,
        boxBoarding: 0,
      },
    ]),
  );
  for (const patient of patients.values()) {
    if (patient.source === "ambulance" && patient.announcedAt < patient.arrival) events.schedule(patient.announcedAt, { type: "announce", id: patient.id });
    events.schedule(patient.arrival, { type: "arrive", id: patient.id });
  }
  const wards = {};
  for (const [ward, { free }] of Object.entries(settings.wards)) {
    wards[ward] = { free, waiting: [] };
    for (const at of day.beds[ward] ?? []) events.schedule(at, { type: "bedFreed", ward });
  }
  const capacity = { ...settings.capacity, boxes: settings.boxes, doctors: settings.doctors };
  // The day's extra doctors come and go at their hours, each day of the shift and the overtime.
  const { from, to, extra } = settings.dayDoctors ?? { extra: 0 };
  for (let day = 0; extra > 0 && day * 1440 < settings.shift + settings.overtime; day += 1) {
    const at = (hour) => (day * 24 + hour - settings.startHour) * 60;
    if (at(from) >= 0) events.schedule(at(from), { type: "staff", doctors: extra });
    else if (at(to) > 0) capacity.doctors += extra;
    if (at(to) >= 0) events.schedule(at(to), { type: "staff", doctors: -extra });
  }
  return {
    settings,
    events,
    patients,
    wards,
    capacity,
    busy: Object.fromEntries(POOLS.map((pool) => [pool, 0])),
    // Busy minutes, and minutes full, of each pool.
    used: Object.fromEntries(POOLS.map((pool) => [pool, 0])),
    full: Object.fromEntries(POOLS.map((pool) => [pool, 0])),
    clock: 0,
    queues: { register: [], triage: [], waiting: [], scanner: [], specialists: [], theatre: [], review: [], uhcd: [] },
    diverted: new Set(),
    peak: { waiting: 0, present: 0, urgent: 0 },
    over: false,
  };
}

const now = (day) => day.events.now;
/** Takes one of `pool`; never more than there are (the doctors only, when the day's extra ones go while busy). */
function take(day, pool) {
  if (pool !== "doctors" && day.busy[pool] >= day.capacity[pool]) throw new Error(`plus de place libre : ${pool}`);
  day.busy[pool] += 1;
}
const give = (day, pool) => (day.busy[pool] -= 1);
const free = (day, pool) => day.capacity[pool] - day.busy[pool];
const removeFrom = (queue, id) => {
  const index = queue.indexOf(id);
  if (index >= 0) queue.splice(index, 1);
  return index >= 0;
};
/** Colour, then the order they came in: the fixed order of the scanner, the specialists, the UHCD. */
const byColour = (day) => (a, b) => day.patients.get(a).colour - day.patients.get(b).colour;

function exitPatient(day, patient, exit) {
  Object.assign(patient, { exit, exitAt: now(day), step: "out" });
}

/** The place a waiting patient would take now, or null: the SAUV for a red, the isolation room for an isolated one, else a box. */
function placeFor(day, patient) {
  if (patient.colour === 1 && free(day, "sauv") > 0) return "sauv";
  if (patient.isolate && free(day, "isolation") > 0) return "isolation";
  return free(day, "boxes") > 0 ? "boxes" : null;
}

/** Leaves the patient's place; it is cleaned before the next one. */
function leavePlace(day, patient) {
  if (!patient.place) return;
  const place = patient.place;
  patient.place = null;
  const cleaning = patient.isolate && place === "boxes" ? day.settings.cleanIsolated : day.settings.clean;
  day.events.schedule(now(day) + cleaning, { type: "cleaned", place });
}

/** The results all back: the patient waits for a doctor to read them, or goes straight to care when no exam was needed. */
function examsBack(day, patient) {
  if (patient.orderedAt === null) return startCare(day, patient);
  patient.step = "review";
  day.queues.review.push(patient.id);
}

function startCare(day, patient) {
  patient.step = "care";
  day.events.schedule(now(day) + day.settings.care[patient.levelAtStart] * patient.stayFactor, { type: "careEnd", id: patient.id });
}

/** The admission decided: the patient waits for a bed of their ward, in their place, or in the UHCD if one is free. */
function admit(day, patient) {
  patient.admitAt ??= now(day);
  patient.step = "bed";
  day.wards[patient.ward].waiting.push(patient.id);
}

const HANDLERS = {
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
  },
  registerEnd(day, patient) {
    give(day, "reception");
    patient.step = "triage";
    day.queues.triage.push(patient.id);
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
    patient.examEnd = now(day);
    const { needs } = patient;
    if (needs.bio || needs.scan || needs.advice) patient.orderedAt = now(day);
    if (needs.bio) {
      patient.pending += 1;
      day.events.schedule(now(day) + day.settings.sample + lognormal(day.settings.labTurnaround, patient.labFactor), { type: "examBack", id: patient.id });
    }
    if (needs.scan) {
      patient.pending += 1;
      day.queues.scanner.push(patient.id);
    }
    if (needs.advice) {
      patient.pending += 1;
      day.queues.specialists.push(patient.id);
    }
    if (patient.pending === 0) return examsBack(day, patient);
    patient.step = "exams";
    // A patient who walked in and is not urgent waits for the results seated, out of the box.
    if (day.settings.seated && patient.source === "pied" && patient.colour >= 3) leavePlace(day, patient);
  },
  examBack(day, patient) {
    patient.pending -= 1;
    if (patient.pending === 0) examsBack(day, patient);
  },
  scanEnd(day, patient) {
    give(day, "scanner");
    HANDLERS.examBack(day, patient);
  },
  adviceEnd(day, patient) {
    give(day, "specialists");
    HANDLERS.examBack(day, patient);
  },
  reviewEnd(day, patient) {
    give(day, "doctors");
    patient.reviewedAt = now(day);
    startCare(day, patient);
  },
  careEnd(day, patient) {
    patient.careEnd = now(day);
    const where = patient.orientation;
    if (where === "home") {
      leavePlace(day, patient);
      return exitPatient(day, patient, "domicile");
    }
    if (where === "theatre") {
      patient.step = "theatre";
      return day.queues.theatre.push(patient.id);
    }
    if (where === "transfer") {
      patient.step = "transfer";
      return day.events.schedule(now(day) + day.settings.transferDelay, { type: "transferred", id: patient.id });
    }
    if (where === "uhcd") {
      patient.step = "uhcdWait";
      return day.queues.uhcd.push(patient.id);
    }
    admit(day, patient);
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
  cleaned(day, event) {
    give(day, event.place);
  },
};

/** Out of triage (or straight in): the patient waits for a place and a doctor, and may leave if triaged 3 to 5. */
function toWaiting(day, patient) {
  patient.step = "waiting";
  day.queues.waiting.push(patient.id);
  if (patient.patience < Infinity) day.events.schedule(now(day) + patient.patience, { type: "leave", id: patient.id });
}

/** Moves a patient into `place` (a pool), from wherever they were. */
function moveTo(day, patient, place) {
  if (patient.place) leavePlace(day, patient);
  take(day, place);
  patient.place = place;
}

/** Everything that follows a fixed order, done at once: the reception, the triage, the scanner, the specialists, the theatre, the UHCD, the results. */
function serve(day) {
  const { queues, settings } = day;
  const t = now(day);
  while (queues.register.length && free(day, "reception") > 0) {
    take(day, "reception");
    day.events.schedule(t + settings.register, { type: "registerEnd", id: queues.register.shift() });
  }
  while (queues.triage.length && free(day, "ioa") > 0) {
    take(day, "ioa");
    day.events.schedule(t + settings.triage, { type: "triageEnd", id: queues.triage.shift() });
  }
  queues.scanner.sort(byColour(day));
  while (queues.scanner.length && free(day, "scanner") > 0) {
    take(day, "scanner");
    day.events.schedule(t + settings.scan, { type: "scanEnd", id: queues.scanner.shift() });
  }
  queues.specialists.sort(byColour(day));
  while (queues.specialists.length && free(day, "specialists") > 0) {
    take(day, "specialists");
    day.events.schedule(t + settings.adviceDelay + settings.advice, { type: "adviceEnd", id: queues.specialists.shift() });
  }
  // The theatre: reds first (NCEPOD: immediate before urgent), then the order of the decisions.
  queues.theatre.sort((a, b) => day.patients.get(a).arrivalLevel - day.patients.get(b).arrivalLevel);
  while (queues.theatre.length && free(day, "theatre") > 0) {
    const patient = day.patients.get(queues.theatre.shift());
    take(day, "theatre");
    day.events.schedule(t + lognormal(settings.theatre, patient.theatreFactor), { type: "theatreEnd" });
    leavePlace(day, patient);
    exitPatient(day, patient, "bloc");
  }
  // The UHCD: its own patients first, then (if the settings say so) the patients waiting for a bed, from a box.
  queues.uhcd.sort(byColour(day));
  while (free(day, "uhcd") > 0) {
    if (queues.uhcd.length) {
      const patient = day.patients.get(queues.uhcd.shift());
      moveTo(day, patient, "uhcd");
      Object.assign(patient, { step: "uhcd", uhcdAt: t });
      day.events.schedule(t + lognormal(settings.uhcdStay, patient.uhcdFactor), { type: "uhcdEnd", id: patient.id });
      continue;
    }
    const boarder = settings.uhcdForBoarders && Object.values(day.wards).flatMap((ward) => ward.waiting).map((id) => day.patients.get(id)).find((patient) => patient.place && patient.place !== "uhcd");
    if (!boarder) break;
    moveTo(day, boarder, "uhcd");
    boarder.uhcdAt ??= t;
  }
  while (settings.reviewFirst && queues.review.length && free(day, "doctors") > 0) startReview(day, queues.review.shift());
}

function startReview(day, id) {
  take(day, "doctors");
  day.events.schedule(now(day) + day.settings.review, { type: "reviewEnd", id });
}

/** What a box rule sees of a waiting patient. */
const viewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, source: patient.source });
/** What a bed rule sees of a patient waiting for a bed. */
const bedViewOf = (patient) => ({ id: patient.id, arrival: patient.arrival, colour: patient.colour, admitAt: patient.admitAt, inBox: patient.place === "boxes" || patient.place === "sauv" || patient.place === "isolation", elderly: patient.elderly });

/**
 * The decision the day is at, or null: `{ kind: "box", candidates }` (views of the waiting patients a place is free
 * for, a doctor free), or `{ kind: "bed", ward, candidates }` (a ward has a bed, two patients or more wait for it;
 * one alone takes it). Without `reviewFirst`, a free doctor reads results only when nobody can be taken in.
 */
function decisionAt(day) {
  if (free(day, "doctors") > 0) {
    const candidates = day.queues.waiting.map((id) => day.patients.get(id)).filter((patient) => placeFor(day, patient));
    if (candidates.length) return { kind: "box", candidates: candidates.map(viewOf) };
    if (!day.settings.reviewFirst && day.queues.review.length) startReview(day, day.queues.review.shift());
  }
  for (const [ward, { free: beds, waiting }] of Object.entries(day.wards)) {
    if (beds <= 0 || waiting.length === 0) continue;
    if (waiting.length === 1) {
      giveBed(day, ward, waiting[0]);
      return decisionAt(day);
    }
    return { kind: "bed", ward, candidates: waiting.map((id) => bedViewOf(day.patients.get(id))) };
  }
  return null;
}

function giveBed(day, ward, id) {
  const patient = day.patients.get(id);
  if (!removeFrom(day.wards[ward].waiting, id)) throw new Error("la règle doit choisir un patient qui attend un lit de ce service");
  day.wards[ward].free -= 1;
  Object.assign(patient, { bedAt: now(day), step: "leaving" });
  day.events.schedule(now(day) + day.settings.toBed, { type: "toBed", id });
}

/** Adds the minutes since the last event to each pool's use, and keeps the peaks. */
function account(day, until) {
  const span = until - day.clock;
  for (const pool of POOLS) {
    day.used[pool] += span * day.busy[pool];
    if (day.busy[pool] >= day.capacity[pool]) day.full[pool] += span;
  }
  for (const ward of Object.values(day.wards)) {
    for (const id of ward.waiting) {
      const patient = day.patients.get(id);
      if (patient.place && patient.place !== "uhcd") patient.boxBoarding += span;
    }
  }
  day.clock = until;
}

function keepPeaks(day) {
  const waiting = day.queues.register.length + day.queues.triage.length + day.queues.waiting.length;
  let present = 0;
  for (const patient of day.patients.values()) if (patient.step !== "coming" && patient.step !== "out") present += 1;
  const urgent = day.queues.waiting.filter((id) => day.patients.get(id).colour <= 2).length;
  day.peak.waiting = Math.max(day.peak.waiting, waiting);
  day.peak.present = Math.max(day.peak.present, present);
  day.peak.urgent = Math.max(day.peak.urgent, urgent);
}

/** Runs the day to its next decision (see `decisionAt`), or null once nothing is left to happen (or the overtime is over). */
export function nextDecision(day) {
  const end = day.settings.shift + day.settings.overtime;
  for (;;) {
    serve(day);
    const decision = decisionAt(day);
    if (decision) return decision;
    keepPeaks(day);
    const next = day.events.peek();
    if (!next || next.at > end) {
      account(day, next ? end : day.clock);
      day.over = true;
      return null;
    }
    day.events.next();
    account(day, next.at);
    const { event } = next;
    HANDLERS[event.type](day, event.id === undefined ? event : day.patients.get(event.id));
  }
}

/** Applies a decision: `id` takes the free place and a doctor ("box"), or the ward's bed ("bed"). */
export function decide(day, decision, id) {
  if (decision.kind === "bed") return giveBed(day, decision.ward, id);
  const patient = day.patients.get(id);
  const place = patient && day.queues.waiting.includes(id) ? placeFor(day, patient) : null;
  if (!place || free(day, "doctors") <= 0) throw new Error("la règle doit choisir un patient qui attend, pour qui une place est libre");
  removeFrom(day.queues.waiting, id);
  moveTo(day, patient, place);
  take(day, "doctors");
  Object.assign(patient, { start: now(day), levelAtStart: patient.level, step: "exam" });
  day.events.schedule(now(day) + day.settings.exam[patient.level] * patient.examFactor, { type: "examEnd", id });
}

/** Plays `day` to its end: the box choices by `rules.box` (a rule of rules.js), the bed choices by `rules.bed` (BED_RULES). */
export function runPathway(day, { box, bed }) {
  for (let decision = nextDecision(day); decision; decision = nextDecision(day)) {
    const context = { now: now(day), day };
    const chosen = decision.kind === "box" ? box(decision.candidates, context) : bed(decision.candidates, context);
    decide(day, decision, chosen.id);
  }
  return day;
}

const first = (list, before) => list.reduce((best, one) => (before(one, best) ? one : best));

/** Who takes a bed a ward frees, among its waiting patients (views: `{ id, colour, admitAt, inBox, elderly }`). */
export const BED_RULES = Object.freeze({
  /** The admission decided first. */
  oldest: (waiting) => first(waiting, (a, b) => a.admitAt < b.admitAt),
  /** A patient holding a box first (it frees a box for the waiting room), then the oldest decision. */
  box: (waiting) => first(waiting, (a, b) => (a.inBox !== b.inBox ? a.inBox : a.admitAt < b.admitAt)),
  /** A patient of 75 or more first (a night on a stretcher costs them most, « No Bed Night »), then the oldest decision. */
  elderly: (waiting) => first(waiting, (a, b) => (a.elderly !== b.elderly ? a.elderly : a.admitAt < b.admitAt)),
});

export const BED_LABELS = Object.freeze({
  oldest: "la décision la plus ancienne",
  box: "celui qui tient un box",
  elderly: "les 75 ans et plus d'abord",
});

const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const max = (values) => (values.length ? Math.max(...values) : 0);
const sum = (values) => values.reduce((total, value) => total + value, 0);
/** Whether minute `t` of the day falls at night (from 20 h to 8 h). */
const atNight = (settings, t) => {
  const hour = hourAt(settings, t);
  return hour >= 20 || hour < 8;
};
/** Minutes of [from, to) at night, counted by the quarter of an hour. */
const nightMinutes = (settings, from, to) => {
  let minutes = 0;
  for (let t = from; t < to; t += 15) if (atNight(settings, t)) minutes += Math.min(15, to - t);
  return minutes;
};

/**
 * A finished day's measures (docs/recherche/indicateurs.md): the simple shift's late cost at the level of the moment
 * (`lateCostNow`, until the exam, or until a patient left), and **the peaks and maxima** besides the means:
 * - `exits`: how many went home, to a ward, to the theatre, elsewhere, left without being seen, were sent elsewhere
 *   by the 15, or were still there when the overtime ended;
 * - `peak`: the most patients waiting at once (reception, triage, a place), present, and reds or oranges waiting;
 * - `maxWait` by true level on arrival, until the exam;
 * - `triage`: its median delay and the share over 30 min (SFMU);
 * - `stay`: the length of stay, median, 9th decile and maximum, the share out within 4 h, the count over 12 h;
 * - `boarding`: minutes from the admission decided to the departure, their maximum, the minutes in a box, and the
 *   patients of 75 or more who spent part of the night waiting for a bed (« No Bed Night »);
 * - `turnaround`: the median from the exams ordered to the results read;
 * - `use` and `full`: each pool's busy share, and its share of time full; `busiest`, the pool most used;
 * - `worsened`: patients who got worse while waiting.
 */
export function pathwayMeasures(day) {
  const { settings } = day;
  const all = [...day.patients.values()];
  const seen = all.filter((patient) => patient.exit !== "reoriente");
  const stayed = seen.filter((patient) => patient.exitAt !== null && patient.exit !== "parti");
  const exits = { domicile: 0, hospitalise: 0, bloc: 0, transfert: 0, parti: 0, reoriente: 0, encore: 0 };
  for (const patient of all) exits[patient.exit ?? "encore"] += 1;
  const stays = stayed.map((patient) => patient.exitAt - patient.arrival);
  const triaged = seen.filter((patient) => patient.triagedAt !== null).map((patient) => patient.triagedAt - patient.arrival);
  const admitted = seen.filter((patient) => patient.admitAt !== null);
  const boarding = admitted.map((patient) => (patient.exitAt ?? day.clock) - patient.admitAt);
  // The use is over the day until the last patient left, not over an empty overtime.
  const end = Math.max(1, ...all.map((patient) => patient.exitAt ?? day.clock));
  const use = Object.fromEntries(POOLS.map((pool) => [pool, day.used[pool] / (day.capacity[pool] * end)]));
  const maxWait = Object.fromEntries(
    [1, 2, 3, 4, 5].map((level) => [level, max(seen.filter((patient) => patient.arrivalLevel === level).map((patient) => (patient.start ?? patient.exitAt ?? day.clock) - patient.arrival))]),
  );
  return {
    patients: all.length,
    lateCostNow: sum(seen.map((patient) => lateCostNow(patient, patient.start ?? patient.exitAt ?? day.clock))),
    worsened: seen.filter((patient) => patient.worsened > 0).length,
    exits,
    peak: { ...day.peak },
    maxWait,
    triage: { median: quantile(triaged, 0.5), over30: triaged.length ? triaged.filter((wait) => wait > 30).length / triaged.length : 0 },
    stay: {
      median: quantile(stays, 0.5),
      p90: quantile(stays, 0.9),
      max: max(stays),
      within4h: stays.length ? stays.filter((minutes) => minutes <= 240).length / stays.length : 0,
      over12h: stays.filter((minutes) => minutes > 720).length,
    },
    boarding: {
      patients: admitted.length,
      minutes: sum(boarding),
      max: max(boarding),
      inBox: sum(admitted.map((patient) => patient.boxBoarding)),
      elderlyNights: admitted.filter((patient) => patient.elderly && nightMinutes(settings, patient.admitAt, patient.exitAt ?? day.clock) > 0).length,
    },
    turnaround: quantile(seen.filter((patient) => patient.reviewedAt !== null).map((patient) => patient.reviewedAt - patient.orderedAt), 0.5),
    use,
    full: Object.fromEntries(POOLS.map((pool) => [pool, day.full[pool] / end])),
    busiest: POOLS.reduce((best, pool) => (use[pool] > use[best] ? pool : best)),
    end: day.clock,
  };
}

export { hourAt };
