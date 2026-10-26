import { CELL_METRES } from "./pathway-hypotheses.js";
import { STEP, walk, walkSteps } from "./ward-moves.js";

/**
 * The walks of a finished day of the detailed pathway on its plan (Sami, 26/10/2026, the roadmap's step 2): each
 * move of the day's trace (pathway-trace.js) becomes a path, cell by cell, by the walking distances of ward-moves.js,
 * started when the move happens, a cell each `STEP` minutes. **Drawn, not counted**: nobody waits for a walk before
 * step 3; the minutes walked are measured, for the plans to be compared.
 *
 * The stretcher-bearers are given afterwards: a transport (a patient taken from their place to the scanner, the
 * UHCD, the lifts or the theatre, or back from the scanner) takes the free one nearest, who walks to the patient,
 * along with them, then back to the base. With none free, the transport goes without (counted).
 *
 * A walk: `{ who, role, t0, path: [{ x, y }] }`, `role` "patient", "doctor" or "porter".
 * @typedef {{ who: number | string, role: string, t0: number, path: Array<{ x: number, y: number }>, at?: string, door?: string, from?: string | null }} Walk
 */

const PORTERED = new Set(["scanner", "uhcd", "lifts", "theatre"]);
const PLACE_POOLS = new Set(["boxes", "sauv", "isolation", "uhcd", "scanner"]);

/** The cells from `from` to `to`, both included, by the first nearer neighbour (ward-moves.js's `walk`). */
function pathOf(walker, from, to) {
  if (walkSteps(walker, from, to) < 0) return [from];
  const unit = { x: from.x, y: from.y, to };
  const path = [{ x: from.x, y: from.y }];
  while (unit.x !== to.x || unit.y !== to.y) {
    walk(walker, unit);
    path.push({ x: unit.x, y: unit.y });
  }
  return path;
}

/** Where a walk is at minute `t`: its first cell before it starts, its last once there. */
export const cellAt = (one, t) => one.path[Math.max(0, Math.min(one.path.length - 1, Math.floor((t - one.t0) / STEP)))];
const endOf = (one) => one.t0 + (one.path.length - 1) * STEP;

/** Seats given as patients sit, and given back as they get up; standing at `fallback` when all are taken. */
function seatsOf(cells, fallback) {
  const taken = new Map();
  return {
    take: (who) => {
      const used = new Set(taken.values());
      const index = cells.findIndex((_, i) => !used.has(i));
      if (index >= 0) taken.set(who, index);
      return index >= 0 ? cells[index] : fallback;
    },
    leave: (who) => taken.delete(who),
  };
}

/** The cell a move's `to` stands for, given where each one is (`cells`). */
function targetOf(layout, seats, { who, to }, cells) {
  const { points, places } = layout;
  const pick = {
    reception: () => points.reception,
    triage: () => points.triage,
    waiting: () => seats.waiting.take(who),
    results: () => seats.results.take(who),
    room: () => points.room,
    patient: () => cells.get(to.id) ?? points.room,
    out: () => points[to.door] ?? points.entrance,
  };
  return (pick[to.at] ?? (() => places[to.at]?.[to.slot] ?? points.entrance))();
}

/** Where one starts the day: a doctor in their room, a patient at the entrance. */
const startOf = (layout, isDoctor) => (isDoctor ? layout.points.room : layout.points.entrance);

/** Every walk of the day's moves, in their order; doctors start in their room, patients at the entrance. */
function walksOf(day, layout) {
  const seats = { waiting: seatsOf(layout.seats, layout.points.entrance), results: seatsOf(layout.results.length ? layout.results : layout.seats, layout.points.entrance) };
  const cells = new Map();
  const last = new Map();
  /** @type {Walk[]} */
  const walks = [];
  for (const move of day.trace.moves) {
    seats.waiting.leave(move.who);
    seats.results.leave(move.who);
    const isDoctor = typeof move.who === "string";
    const from = last.has(move.who) ? cellAt(last.get(move.who), move.t) : startOf(layout, isDoctor);
    const to = targetOf(layout, seats, move, cells);
    const one = { who: move.who, role: isDoctor ? "doctor" : "patient", t0: move.t, path: pathOf(layout.walker, from, to), at: move.to.at, door: move.to.door, from: last.get(move.who)?.at ?? null };
    cells.set(move.who, to);
    last.set(move.who, one);
    walks.push(one);
  }
  return walks;
}

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

/**
 * The day's walks on `layout` (pathway-plans.js's `pathwayPlanOf` of its plan), with `porters` stretcher-bearers:
 * `{ walks, transports: [{ t, who, porter, wait }] }`, `porter` null for a transport without one.
 */
export function walksOfDay(day, layout, porters = day.settings.porters ?? 0) {
  const walks = walksOf(day, layout);
  const team = Array.from({ length: porters }, (_, k) => ({ who: `porter:${k}`, cell: layout.points.porters, freeAt: -Infinity }));
  const transports = [];
  for (const one of walks.filter(isTransport)) {
    const given = porterFor(layout, team, one);
    transports.push({ t: one.t0, who: one.who, porter: given ? given.walks[0].who : null, wait: given?.wait ?? null });
    if (given) walks.push(...given.walks);
  }
  return { walks: walks.sort((a, b) => a.t0 - b.t0), transports, porters: team.map((porter) => porter.who) };
}

/** Where each one is at minute `t`: `[{ who, role, x, y }]`, the patients from their arrival until out of the plan. */
export function walkScene({ walks, porters }, t) {
  const now = new Map(porters.map((who) => [who, { who, role: "porter", walk: null }]));
  for (const one of walks) if (one.t0 <= t) now.set(one.who, { who: one.who, role: one.role, walk: one });
  return [...now.values()]
    .filter(({ walk: one }) => !(one?.at === "out" && t >= endOf(one)))
    .map(({ who, role, walk: one }) => ({ who, role, ...(one ? cellAt(one, t) : null) }))
    .filter((one) => one.x !== undefined);
}

const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * What the day walked (`walksOfDay`'s): by role, the metres, the minutes and the longest walk in minutes; the
 * transports, those without a stretcher-bearer, and how long one took to reach the patient (mean, longest).
 */
export function walkMeasures({ walks, transports }) {
  const byRole = Object.fromEntries(
    ["patient", "doctor", "porter"].map((role) => {
      const steps = walks.filter((one) => one.role === role).map((one) => one.path.length - 1);
      return [role, { metres: sum(steps) * CELL_METRES, minutes: sum(steps) * STEP, longest: Math.max(0, ...steps) * STEP }];
    }),
  );
  const waits = transports.filter((one) => one.porter !== null).map((one) => one.wait);
  return { byRole, transports: transports.length, unported: transports.filter((one) => one.porter === null).length, porterWait: { mean: waits.length ? sum(waits) / waits.length : 0, max: Math.max(0, ...waits) } };
}
