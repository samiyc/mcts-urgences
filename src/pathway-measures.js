import { BOARDING_COST } from "./pathway-hypotheses.js";
import { additionMeasures } from "./pathway-additions.js";
import { deathMeasures } from "./pathway-deaths.js";
import { hourAt } from "./pathway-scenario.js";
import { POOLS } from "./pathway-places.js";
import { sample } from "./pathway-timeline.js";
import { lateCostNow } from "./simulate.js";

/** @typedef {import("./types.js").Day} Day */

/** What the detailed pathway (pathway.js) counts as it goes, and the measures of a finished day. */

/** Adds the minutes since the last event to each pool's use, and to the boarders' minutes in a place. */
export function account(day, until) {
  sample(day, until);
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

export function keepPeaks(day) {
  const waiting = day.queues.register.length + day.queues.triage.length + day.queues.waiting.length;
  let present = 0;
  for (const patient of day.patients.values()) if (patient.step !== "coming" && patient.step !== "out") present += 1;
  const urgent = day.queues.waiting.filter((id) => day.patients.get(id).colour <= 2).length;
  day.peak.waiting = Math.max(day.peak.waiting, waiting);
  day.peak.present = Math.max(day.peak.present, present);
  day.peak.urgent = Math.max(day.peak.urgent, urgent);
}

const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const max = (values) => (values.length ? Math.max(...values) : 0);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const share = (values, test) => (values.length ? values.filter(test).length / values.length : 0);
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

function exitsOf(all) {
  const exits = { domicile: 0, hospitalise: 0, bloc: 0, transfert: 0, parti: 0, reoriente: 0, encore: 0 };
  // A death is counted only on a day with deaths (pathway-deaths.js), so the other days keep their measures.
  for (const patient of all) exits[patient.exit ?? "encore"] = (exits[patient.exit ?? "encore"] ?? 0) + 1;
  return exits;
}

const stayOf = (stays) => ({
  median: quantile(stays, 0.5),
  p90: quantile(stays, 0.9),
  max: max(stays),
  within4h: share(stays, (minutes) => minutes <= 240),
  over12h: stays.filter((minutes) => minutes > 720).length,
});

function boardingOf(day, admitted) {
  const boarding = admitted.map((patient) => (patient.exitAt ?? day.clock) - patient.admitAt);
  return {
    patients: admitted.length,
    minutes: sum(boarding),
    max: max(boarding),
    inBox: sum(admitted.map((patient) => patient.boxBoarding)),
    elderlyNights: admitted.filter((patient) => patient.elderly && nightMinutes(day.settings, patient.admitAt, patient.exitAt ?? day.clock) > 0).length,
  };
}

/**
 * What the wait for a bed cost the day, as the search choosing beds or the HET scores it (BOARDING_COST, H51): a
 * minute, and three for a patient of 75 or more at night (« No Bed Night »).
 */
export function boardingCostOf(day) {
  let cost = 0;
  for (const patient of day.patients.values()) {
    if (patient.admitAt === null) continue;
    const until = patient.exitAt ?? day.clock;
    const night = patient.elderly ? nightMinutes(day.settings, patient.admitAt, until) : 0;
    cost += BOARDING_COST.perMinute * (until - patient.admitAt + (BOARDING_COST.elderlyAtNight - 1) * night);
  }
  return cost;
}

const maxWaitOf = (day, seen) =>
  Object.fromEntries([1, 2, 3, 4, 5].map((level) => [level, max(seen.filter((patient) => patient.arrivalLevel === level).map((patient) => (patient.start ?? patient.exitAt ?? day.clock) - patient.arrival))]));

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
 * @param {Day} day
 */
export function pathwayMeasures(day) {
  const all = [...day.patients.values()];
  const seen = all.filter((patient) => patient.exit !== "reoriente");
  const stayed = seen.filter((patient) => patient.exitAt !== null && patient.exit !== "parti");
  const triaged = seen.filter((patient) => patient.triagedAt !== null).map((patient) => patient.triagedAt - patient.arrival);
  // The use is over the day until the last patient left, not over an empty overtime.
  const end = Math.max(1, ...all.map((patient) => patient.exitAt ?? day.clock));
  const use = Object.fromEntries(POOLS.map((pool) => [pool, day.used[pool] / (day.capacity[pool] * end)]));
  const late = sum(seen.map((patient) => lateCostNow(patient, patient.start ?? patient.exitAt ?? day.clock)));
  const additions = additionMeasures(day, deathMeasures);
  return {
    patients: all.length,
    // With deaths, the cost the comparisons read counts them at their weight (`lateCostOnly`: the lateness alone).
    lateCostNow: late + (additions.deaths?.cost ?? 0),
    ...(additions.deaths ? { lateCostOnly: late } : {}),
    worsened: seen.filter((patient) => patient.worsened > 0).length,
    exits: exitsOf(all),
    peak: { ...day.peak },
    maxWait: maxWaitOf(day, seen),
    triage: { median: quantile(triaged, 0.5), over30: share(triaged, (wait) => wait > 30) },
    stay: stayOf(stayed.map((patient) => patient.exitAt - patient.arrival)),
    boarding: boardingOf(day, seen.filter((patient) => patient.admitAt !== null)),
    turnaround: quantile(seen.filter((patient) => patient.reviewedAt !== null).map((patient) => patient.reviewedAt - patient.orderedAt), 0.5),
    use,
    full: Object.fromEntries(POOLS.map((pool) => [pool, day.full[pool] / end])),
    busiest: POOLS.reduce((best, pool) => (use[pool] > use[best] ? pool : best), POOLS[0]),
    end: day.clock,
    ...additions,
  };
}
