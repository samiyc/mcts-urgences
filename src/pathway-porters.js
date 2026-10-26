import { minutesOf } from "./pathway-cells.js";
import { locate, positionOf } from "./pathway-trace.js";
import { walkSteps } from "./ward-moves.js";

/**
 * The stretcher-bearers of a day when walking counts (Sami, 26/10/2026, the roadmap's step 3): a transport (a patient
 * to the scanner and back) waits in `day.queues.transport` for a free one; the nearest walks to the patient, along
 * with them, then back to the base, and is free again once there. Without `walk`, there are none: the scan is
 * reached at once, and the plan gives stretcher-bearers afterwards (pathway-walk.js).
 */

export const startPorters = (settings) => Array.from({ length: settings.walk ? (settings.porters ?? 0) : 0 }, (_, k) => ({ who: `porter:${k}`, freeAt: 0 }));

/** Patient `id` is to be taken to `to` (a place of the trace); then the event `transported` with `next`. */
export function requestTransport(day, id, to, next) {
  day.queues.transport.push({ id, to, next, at: day.events.now });
}

/** The free stretcher-bearer nearest patient `id`. */
function nearest(day, free, id) {
  const { walker } = day.trace.layout;
  const at = positionOf(day, id);
  const steps = (porter) => walkSteps(walker, positionOf(day, porter.who), at);
  return free.reduce((best, porter) => (steps(porter) < steps(best) ? porter : best));
}

/** `porter` takes the patient of `request`: to them, along to the place, back to the base. */
function carry(day, porter, { id, to, next, at }) {
  const t = day.events.now;
  const leave = t + minutesOf(locate(day, porter.who, { at: "patient", id }));
  const along = locate(day, id, to, leave);
  // Beside the patient: from where the patient was found, which their own walk may not have reached yet.
  const there = leave + minutesOf(Math.max(along, locate(day, porter.who, { at: "patient", id }, leave)));
  porter.freeAt = there + minutesOf(locate(day, porter.who, { at: "base" }, there));
  day.events.schedule(there, { type: "transported", id, next });
  day.events.schedule(porter.freeAt, { type: "porterFree" });
  day.trace.transports.push({ t: at, who: id, porter: porter.who, wait: leave - at });
}

/** The transports waiting, in their order, while a stretcher-bearer is free. */
export function serveTransports(day) {
  while (day.queues.transport.length) {
    const free = day.porters.filter((porter) => porter.freeAt <= day.events.now);
    if (!free.length) return;
    const request = day.queues.transport.shift();
    carry(day, nearest(day, free, request.id), request);
  }
}
