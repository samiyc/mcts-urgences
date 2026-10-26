import { hourAt } from "./pathway-scenario.js";

/**
 * The doctors' fatigue and their breaks (Sami, 26/10/2026, docs/recherche/feuille-de-route.md, step 4; soignants.md):
 * - **fatigue grows** with the hours worked since the shift began or the last break, more at night; it **slows**
 *   the exams and the readings of results, and makes a result **overlooked** now and then (read again later);
 * - **the breaks** (a meal, a night's rest) take fatigue down; a rule places them (`BREAK_RULES`): never, at the
 *   window's start, or when the waiting room is light; a few doctors always stay;
 * - **the teams**: shifts of 24 h (8 h to 8 h), or of 12 h with a handover at 20 h and 8 h, where the team going
 *   out tells the one coming in (minutes without taking a patient).
 *
 * Doctors are people by their number (pathway-trace.js's `doctors`): the first `settings.doctors` the day's team,
 * the next ones the day's extra doctors, from their hour. Without `fatigue` in the settings, none of this exists.
 * The figures are hypotheses (docs/recherche/hypotheses-a-verifier.md, H43 to H46).
 */

/** When each break may be taken: hours of the day, its minutes, the share of fatigue it takes away. */
const WINDOWS = [
  { kind: "repas", from: 11, to: 15 },
  { kind: "repas", from: 19, to: 22 },
  { kind: "repos", from: 1, to: 6 },
];

export const BREAK_RULES = Object.freeze({
  none: "aucune pause",
  fixed: "à l'heure fixe",
  quiet: "au creux de la salle d'attente",
});

const shiftStartOf = (settings, k) => (k < settings.doctors ? 0 : (settings.dayDoctors.from - settings.startHour) * 60);

export function startFatigue(settings) {
  if (!settings.fatigue) return null;
  const people = settings.doctors + (settings.dayDoctors?.extra ?? 0);
  return {
    people: Array.from({ length: people }, (_, k) => ({ k, base: 0, since: shiftStartOf(settings, k), stretchFrom: shiftStartOf(settings, k), longest: 0, breaks: [], taken: new Set(), onBreak: null })),
    oversights: 0,
    overlookedAt: [],
    slows: [],
  };
}

/** Hours of fatigue of doctor `k` at minute `t`: worked since the shift or a break, less what the breaks took away. */
const fatigueOf = (person, t) => person.base + Math.max(0, t - person.since) / 60;

/** The piecewise-linear slowing at `hours` of fatigue (settings.fatigue.slow: `[[hours, share]]`). */
function slowing(points, hours) {
  const after = points.findIndex(([at]) => at > hours);
  if (after < 0) return points.at(-1)[1];
  if (after === 0) return points[0][1];
  const [[h0, s0], [h1, s1]] = [points[after - 1], points[after]];
  return s0 + ((s1 - s0) * (hours - h0)) / (h1 - h0);
}

const atNight = (settings, t) => hourAt(settings, t) < 6;

/** How much slower doctor `k` works now (1: not at all); 1 without fatigue. */
export function slowOf(day, k) {
  if (!day.fatigue) return 1;
  const person = day.fatigue.people[k];
  if (!person) return 1;
  const { slow, night } = day.settings.fatigue;
  const factor = 1 + slowing(slow, fatigueOf(person, day.events.now)) + (atNight(day.settings, day.events.now) ? night : 0);
  day.fatigue.slows.push(factor);
  return factor;
}

/**
 * How much slower the intern works now (1 without fatigue): on call since the day began, with no break (an intern on
 * call takes none here), on the doctors' curve (step 4, H50).
 */
export function internSlowOf(day) {
  if (!day.fatigue) return 1;
  const { slow, night } = day.settings.fatigue;
  return 1 + slowing(slow, day.events.now / 60) + (atNight(day.settings, day.events.now) ? night : 0);
}

/** Whether doctor `k`, reading patient's results now, overlooks them (read again later): more likely as fatigue grows. */
export function overlooks(day, k, patient) {
  if (!day.fatigue || !day.fatigue.people[k]) return false;
  const { base, perHour } = day.settings.fatigue.oversight;
  return patient.oversightRoll < base + perHour * fatigueOf(day.fatigue.people[k], day.events.now);
}

/** The breaks of the day: each window, each day of the shift and the overtime, its start and its last start. */
export function breakTimes(settings) {
  const days = Math.ceil((settings.shift + settings.overtime) / 1440) + 1;
  return Array.from({ length: days }, (_, d) =>
    WINDOWS.map((window, w) => {
      const at = (hour) => (d * 24 + hour - settings.startHour + (hour < settings.startHour ? 24 : 0)) * 60;
      const minutes = settings.fatigue.minutes[window.kind];
      return { key: `${d}:${w}`, kind: window.kind, from: at(window.from), last: at(window.to) - minutes, minutes };
    }),
  ).flat();
}

/** Doctor `k` is free now: present (within the doctors on duty), with no patient, not on a break. */
const isFree = (day, k) => k < day.capacity.doctors && (day.trace.doctors[k] === null || day.trace.doctors[k] === undefined);

/** Whether the rule lets a free doctor take break `slot` now. */
function wants(day, slot) {
  const rule = day.settings.fatigue.breaks;
  const t = day.events.now;
  if (rule === "none" || t < slot.from || t > slot.last + slot.minutes) return false;
  if (rule === "fixed" || t >= slot.last) return true;
  return day.queues.waiting.length <= day.settings.fatigue.quietWaiting;
}

const onBreak = (day) => day.fatigue.people.filter((person) => person.onBreak).length;

/** The breaks the rule takes now, one doctor after another, while enough doctors stay. */
export function serveBreaks(day, startBreak) {
  if (!day.fatigue) return;
  for (const slot of day.fatigue.slots) {
    for (const person of day.fatigue.people) {
      const enough = day.capacity.doctors - onBreak(day) - 1 >= day.settings.fatigue.minDoctors;
      if (!person.taken.has(slot.key) && enough && isFree(day, person.k) && wants(day, slot)) startBreak(day, person, slot);
    }
  }
}

/** A break begins: the stretch without one ends, the fatigue kept for the break's end. */
export function beginBreak(day, person, slot) {
  const t = day.events.now;
  person.taken.add(slot.key);
  person.longest = Math.max(person.longest, t - person.stretchFrom);
  person.onBreak = { ...slot, at: t, fatigue: fatigueOf(person, t) };
}

/** A break ends: the fatigue down by its share, a new stretch. */
export function endBreak(day, person) {
  const t = day.events.now;
  const { kind, at, fatigue } = person.onBreak;
  Object.assign(person, { base: fatigue * (1 - day.settings.fatigue.rest[kind]), since: t, stretchFrom: t, onBreak: null });
  person.breaks.push({ kind, from: at, to: t });
}

/** A team going out at a handover: its doctors start fresh (12 h teams). */
export function newTeam(day) {
  const t = day.events.now;
  for (const person of day.fatigue.people.filter((one) => one.k < day.settings.doctors)) {
    person.longest = Math.max(person.longest, t - person.stretchFrom);
    Object.assign(person, { base: 0, since: t, stretchFrom: t });
  }
}

/** When doctor `k`'s work of the day ends: the day simulated, the extra doctors at their hour. */
function workEnd(day, k) {
  const { settings } = day;
  const end = Math.min(day.clock, settings.shift);
  return k < settings.doctors ? end : Math.min(end, (settings.dayDoctors.to - settings.startHour) * 60);
}

/** The day's fatigue: breaks taken by kind, the longest stretch without a break (hours), results overlooked, the mean slowing. */
export function fatigueMeasures(day) {
  const { people, oversights, slows } = day.fatigue;
  const stretch = (person) => Math.max(0, (person.onBreak ? person.onBreak.at : workEnd(day, person.k)) - person.stretchFrom);
  const longest = people.map((person) => Math.max(person.longest, stretch(person)) / 60);
  const breaks = people.flatMap((person) => person.breaks);
  return {
    meals: breaks.filter((one) => one.kind === "repas").length,
    rests: breaks.filter((one) => one.kind === "repos").length,
    longest: Math.max(0, ...longest),
    meanLongest: longest.length ? longest.reduce((sum, hours) => sum + hours, 0) / longest.length : 0,
    oversights,
    slowing: slows.length ? slows.reduce((sum, factor) => sum + factor, 0) / slows.length - 1 : 0,
  };
}
