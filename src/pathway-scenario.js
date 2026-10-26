import { createRng } from "mcts-commun/random.js";
import { epidemicBeds, epidemicPatients } from "./pathway-epidemic.js";
import { pathwaySettingsOf } from "./pathway-hypotheses.js";
import { arrivals, patientOf } from "./scenario.js";

/**
 * A day of the detailed pathway, drawn from a seed before anything is decided (Sami, 25/10/2026): the patients of
 * the simple shift (scenario.js: arrival, source, true level, colour, exam and care factors, worsening), arriving by
 * the hour of the day, each with **a hidden pathway**: the exams they will need, where they will go, whether they
 * must be isolated, their patience. And the downstream beds the wards will free. Every rule then plays the same day.
 */

/** A key of `shares` drawn by its weight. */
function pick(rng, shares) {
  const entries = Object.entries(shares).filter(([, share]) => share > 0);
  let left = rng.next() * entries.reduce((sum, [, share]) => sum + share, 0);
  for (const [key, share] of entries) {
    left -= share;
    if (left < 0) return key;
  }
  return entries.at(-1)[0];
}

/** The hour of the day at minute `t` of the day (`startHour` at 0). */
export const hourAt = (settings, t) => (settings.startHour + t / 60) % 24;

/**
 * Arrival times over the shift of a Poisson process shaped by the hours of the day (thinning): `perHour` is the
 * mean rate from 8 h to 16 h, the simple shift's day (hypotheses.js), so that the day's doctors and boxes are as busy
 * as there; the night comes fewer.
 */
export function arrivalsByHour(rng, settings, perHour, { from = 0, to = settings.shift } = {}) {
  const mean = settings.hourly.slice(8, 16).reduce((sum, one) => sum + one, 0) / 8;
  const top = Math.max(...settings.hourly) / mean;
  return arrivals(rng, perHour * top, from, to).filter((at) => rng.next() < settings.hourly[Math.floor(hourAt(settings, at))] / mean / top);
}

/** What the department will learn about a patient only along the way. */
export function pathwayOf(rng, patient, settings) {
  const { level } = patient;
  const orientation = pick(rng, settings.orientation[level]);
  const isolate = rng.next() < settings.isolate;
  return {
    needs: {
      bio: rng.next() < settings.needs.bio[level],
      scan: rng.next() < settings.needs.scan[level],
      advice: rng.next() < settings.needs.advice[level],
    },
    orientation,
    ward: pick(rng, level === 1 ? settings.wardOf[1] : settings.wardOf.other),
    // The UHCD's patients: some then go on to a ward.
    thenWard: rng.next() < settings.uhcdThenWard,
    isolate,
    elderly: rng.next() < settings.elderly[level],
    patience: settings.patience[patient.colour] ? settings.patienceFloor - settings.patience[patient.colour] * Math.log(1 - rng.next()) : Infinity,
    labFactor: Math.exp(settings.spread * rng.normal()),
    uhcdFactor: Math.exp(settings.spread * rng.normal()),
    theatreFactor: Math.exp(settings.spread * rng.normal()),
  };
}

/** The beds each ward frees over the day and the overtime: `{ ward: [minutes] }`, most around `bedHour` each day. */
function bedsFreed(rng, settings) {
  const days = Math.ceil((settings.shift + settings.overtime) / 1440) + 1;
  return Object.fromEntries(
    Object.entries(settings.wards).map(([ward, { perDay }]) => {
      const times = [];
      for (let day = 0; day < days; day += 1) {
        // A Poisson count of `perDay` (Knuth), each at a normal hour around `bedHour`.
        let count = 0;
        for (let p = rng.next(), limit = Math.exp(-perDay); p > limit; p *= rng.next()) count += 1;
        for (let i = 0; i < count; i += 1) {
          const hour = settings.bedHour + settings.bedSpread * rng.normal();
          const at = (day * 24 + hour - settings.startHour) * 60;
          if (at > 0) times.push(at);
        }
      }
      return [ward, times.sort((a, b) => a - b)];
    }),
  );
}

/** Who needs a medication (the intern fetches it, step 3), drawn apart so that the rest of the day is drawn the same. */
function withMedication(seed, patients, settings) {
  const rng = createRng((Math.imul(seed, 2654435761) ^ 0x5bd1e995) >>> 0);
  return patients.map((patient) => ({ ...patient, needs: { ...patient.needs, med: rng.next() < settings.intern.needsMed[patient.level] } }));
}

/** The chance each patient's results be overlooked by a tired doctor (step 4), drawn apart like the medication. */
function withOversight(seed, patients) {
  const rng = createRng((Math.imul(seed, 2246822519) ^ 0x27d4eb2f) >>> 0);
  return patients.map((patient) => ({ ...patient, oversightRoll: rng.next() }));
}

/**
 * A day of the pathway: `{ settings, patients, beds }`. `patients` by arrival, numbered from 1, each a patient of
 * scenario.js plus its hidden pathway; `beds` the times each ward frees a bed. `options`: `pathwaySettingsOf`'s.
 */
export function drawPathwayDay(seed, options = {}) {
  const settings = options.capacity ? options : pathwaySettingsOf(options);
  const rng = createRng(seed);
  const patients = patientsOf(seed, rng, settings);
  const freed = bedsFreed(rng, settings);
  // During an epidemic, the wards keep some of their beds: the day's settings hold the beds free at its start.
  const winter = settings.epidemic ? epidemicBeds(seed, settings, freed) : null;
  return { settings: winter ? { ...settings, wards: winter.wards } : settings, patients, beds: winter?.beds ?? freed };
}

/** The day's patients, by arrival and numbered from 1: the ordinary ones, the accident's, the epidemic's. */
function patientsOf(seed, rng, settings) {
  const crisis = settings.crisis;
  const comings = [
    ...arrivalsByHour(rng, settings, settings.walkInRate).map((arrival) => ({ arrival, source: "pied", mix: settings.walkInMix })),
    ...arrivalsByHour(rng, settings, settings.ambulanceRate).map((arrival) => ({ arrival, source: "ambulance", mix: settings.ambulanceMix })),
    ...(crisis ? Array.from({ length: crisis.size }, () => ({ arrival: crisis.at + crisis.over * rng.next(), source: "ambulance", mix: crisis.mix })) : []),
  ];
  const ordinary = comings.map((coming) => patientOf(rng, coming, settings)).map((patient) => ({ ...patient, ...pathwayOf(rng, patient, settings) }));
  const patients = [...ordinary, ...(settings.epidemic ? epidemicPatients(seed, settings) : [])].sort((a, b) => a.arrival - b.arrival).map((patient, i) => ({ id: i + 1, ...patient }));
  const followed = settings.intern ? withMedication(seed, patients, settings) : patients;
  return settings.fatigue ? withOversight(seed, followed) : followed;
}
