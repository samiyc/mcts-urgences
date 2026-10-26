import { CELL_METRES } from "./pathway-hypotheses.js";
import { cellAt, endOf, pathOf } from "./pathway-cells.js";
import { STEP, walkSteps } from "./ward-moves.js";

/**
 * The walks of a finished day of the detailed pathway on its plan (Sami, 26/10/2026, the roadmap's step 2): each
 * move of the day's trace is walked as it happens (pathway-trace.js, pathway-cells.js), a cell each `STEP` minutes.
 * Without `walk` in the settings they are **drawn, not counted**: nobody waits for them; with it (step 3), the day
 * waits for them, and its stretcher-bearers are its own (pathway-porters.js).
 *
 * Without `walk`, the stretcher-bearers are given afterwards: a transport (a patient taken from their place to the scanner, the
 * UHCD, the lifts or the theatre, or back from the scanner) takes the free one nearest, who walks to the patient,
 * along with them, then back to the base. With none free, the transport goes without (counted).
 *
 * A walk: pathway-cells.js's `Walk`.
 * @typedef {import("./pathway-cells.js").Walk} Walk
 */

const PORTERED = new Set(["scanner", "uhcd", "lifts", "theatre"]);
const PLACE_POOLS = new Set(["boxes", "sauv", "isolation", "uhcd", "scanner"]);

const isTransport = (one) => one.role === "patient" && one.from !== null && PLACE_POOLS.has(one.from) && (PORTERED.has(one.at) || PORTERED.has(one.door) || one.from === "scanner");

/** A transport's stretcher-bearer: the free one nearest the patient walks there, along, and back to the base. */
function porterFor(layout, porters, one) {
  const start = one.path[0];
  const free = porters.filter((porter) => porter.freeAt <= one.t0);
  if (!free.length) return null;
  const porter = free.reduce((best, p) => (walkSteps(layout.walker, p.cell, start) < walkSteps(layout.walker, best.cell, start) ? p : best));
  const toPatient = pathOf(layout.walker, porter.cell, start);
  const along = { who: porter.who, role: "porter", t0: one.t0 + (toPatient.length - 1) * STEP, path: one.path };
  const back = { who: porter.who, role: "porter", t0: endOf(along), path: pathOf(layout.walker, one.path.at(-1), layout.points.porters) };
  porter.freeAt = endOf(back);
  return { wait: (toPatient.length - 1) * STEP, walks: [{ who: porter.who, role: "porter", t0: one.t0, path: toPatient }, along, back] };
}

/** The intern's cells, one a step (pathway-game.js), as one walk from the first step. */
const internWalk = (day) => (day.intern?.track.length ? [{ who: "intern", role: "intern", t0: STEP, path: day.intern.track }] : []);

/** The doctors of the day (its extra ones included) in their room, the stretcher-bearers at their base. */
function idleOf(day, layout, team) {
  const doctors = day.settings.doctors + (day.settings.dayDoctors?.extra ?? 0);
  return [...Array.from({ length: doctors }, (_, k) => ({ who: `doctor:${k}`, role: "doctor", cell: layout.points.room })), ...team.map((porter) => ({ who: porter.who, role: "porter", cell: layout.points.porters }))];
}

/**
 * The day's walks on `layout` (pathway-plans.js's `pathwayPlanOf` of its plan), with `porters` stretcher-bearers:
 * `{ walks, transports: [{ t, who, porter, wait }], idle }`, `porter` null for a transport without one, `idle` the doctors
 * (all those of the day, the day's extra ones included) and the stretcher-bearers where they wait, before they first walk.
 */
export function walksOfDay(day, layout, porters = day.settings.porters ?? 0) {
  /** @type {Walk[]} */
  const walks = [...day.trace.walks, ...internWalk(day)];
  const team = Array.from({ length: porters }, (_, k) => ({ who: `porter:${k}`, cell: layout.points.porters, freeAt: -Infinity }));
  const transports = day.settings.walk ? (day.trace.transports ?? []) : portersAfter(layout, team, walks);
  return { walks: walks.sort((a, b) => a.t0 - b.t0), transports, idle: idleOf(day, layout, team) };
}

/** The stretcher-bearers given after the day (walking not counted): each transport's, their walks added to `walks`. */
function portersAfter(layout, team, walks) {
  const transports = [];
  for (const one of walks.filter(isTransport)) {
    const given = porterFor(layout, team, one);
    transports.push({ t: one.t0, who: one.who, porter: given ? given.walks[0].who : null, wait: given?.wait ?? null });
    if (given) walks.push(...given.walks);
  }
  return transports;
}

/** Where each one is at minute `t`: `[{ who, role, x, y }]`, the patients from their arrival until out of the plan. */
export function walkScene({ walks, idle }, t) {
  const now = new Map(idle.map((one) => [one.who, { ...one, walk: null }]));
  for (const one of walks) if (one.t0 <= t) now.set(one.who, { who: one.who, role: one.role, cell: null, walk: one });
  return [...now.values()].filter(({ walk: one }) => !(one?.at === "out" && t >= endOf(one))).map(({ who, role, cell, walk: one }) => ({ who, role, ...(one ? cellAt(one, t) : cell) }));
}

/** The cells a walk changes (a walk with the intern holds a cell while they stand). */
const cellsWalked = (one) => one.path.filter((cell, i) => i > 0 && (cell.x !== one.path[i - 1].x || cell.y !== one.path[i - 1].y)).length;

const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * What the day walked (`walksOfDay`'s): by role, the metres, the minutes and the longest walk in minutes; the
 * transports, those without a stretcher-bearer, and how long one took to reach the patient (mean, longest).
 */
export function walkMeasures({ walks, transports }) {
  const byRole = Object.fromEntries(
    ["patient", "doctor", "porter", "intern"].map((role) => {
      const steps = walks.filter((one) => one.role === role).map(cellsWalked);
      return [role, { metres: sum(steps) * CELL_METRES, minutes: sum(steps) * STEP, longest: Math.max(0, ...steps) * STEP }];
    }),
  );
  const waits = transports.filter((one) => one.porter !== null).map((one) => one.wait);
  return { byRole, transports: transports.length, unported: transports.filter((one) => one.porter === null).length, porterWait: { mean: waits.length ? sum(waits) / waits.length : 0, max: Math.max(0, ...waits) } };
}
