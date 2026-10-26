import { pathwayPlanOf } from "./pathway-plans.js";
import { STEP, walk, walkSteps } from "./ward-moves.js";

/**
 * Where the places of a day's trace are on its plan, and the walks between them (Sami, 26/10/2026, the roadmap's
 * step 3: walking counts). A walk is `{ who, role, t0, path: [{ x, y }], at, door, from }`: it starts at `t0` and goes a
 * cell each `STEP` minutes. The day keeps them as they happen (pathway-trace.js), so that the model can wait for
 * them when walking counts, and the plan draws exactly them.
 */

/** @typedef {{ who: number | string, role: string, t0: number, path: Array<{ x: number, y: number }>, at?: string, door?: string, from?: string | null }} Walk */

const layouts = new Map();
/** The plan `text` read once (pathway-plans.js), its walking distances shared by every day on it. */
export function layoutOf(text) {
  if (!layouts.has(text)) layouts.set(text, pathwayPlanOf(text));
  return layouts.get(text);
}

/** The cells from `from` to `to`, both included, by the first nearer neighbour (ward-moves.js's `walk`). */
export function pathOf(walker, from, to) {
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
export const cellAt = (one, t) => one.path[Math.max(0, Math.min(one.path.length - 1, Math.floor((t - one.t0) / STEP + 1e-9)))];
export const endOf = (one) => one.t0 + (one.path.length - 1) * STEP;
/** The minutes a walk of `steps` cells takes. */
export const minutesOf = (steps) => steps * STEP;

/** Who someone is: a patient (a number), `doctor:k`, `porter:k`, or the intern. */
export const roleOf = (who) => (typeof who === "number" ? "patient" : who.split(":")[0]);

/** Where one starts the day: a doctor in their room, a stretcher-bearer at the base, the intern at the doctors' poste, a patient at the entrance. */
export function startCellOf(layout, who) {
  const { points } = layout;
  return { doctor: points.room, porter: points.porters, intern: points.room }[roleOf(who)] ?? points.entrance;
}

/** Seats given as patients sit and given back as they get up; standing at `fallback` once all are taken. */
export function seatsOf(cells, fallback) {
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
