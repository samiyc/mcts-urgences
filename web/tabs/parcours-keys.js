import { SPEEDS, draw, pausePathway, playPathway } from "./parcours.js";

/** Whether a key goes to the day replayed: its view shown, not in a field nor on a button, which keep their keys. */
const forTheDay = (ctx, event) => ctx.pathway.run && document.getElementById("pathway") && !(event.ctrlKey || event.altKey || event.metaKey || event.target.closest?.("input, textarea, select, button"));

/** The day 10 min back or on (`way` -1 or 1), an hour with Shift, playing or not. */
function stepDay(ctx, way, event) {
  const { pathway } = ctx;
  pathway.t = Math.max(0, Math.min(pathway.run.end, pathway.t + way * (event.shiftKey ? 60 : 10)));
  draw(ctx);
}

/** The next speed of SPEEDS, faster (`way` 1) or slower (-1), playing or not. */
function changeSpeed(ctx, way) {
  const at = SPEEDS.findIndex(([value]) => Number(value) === ctx.pathway.speed);
  ctx.pathway.speed = Number(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, at + way))][0]);
  ctx.render();
}

/**
 * The keys of the day replayed, as on a video (Sami, 29/10/2026): space plays or pauses, the left and right arrows go
 * back or on, the up and down arrows play faster or slower.
 */
const DAY_KEYS = {
  " ": (ctx) => {
    (ctx.pathway.frame === null ? playPathway : pausePathway)(ctx);
    ctx.render();
  },
  ArrowLeft: (ctx, event) => stepDay(ctx, -1, event),
  ArrowRight: (ctx, event) => stepDay(ctx, 1, event),
  ArrowUp: (ctx) => changeSpeed(ctx, 1),
  ArrowDown: (ctx) => changeSpeed(ctx, -1),
};

/** A key in the tab (DAY_KEYS); true if it was the tab's. */
export function pathwayKey(ctx, event) {
  if (!forTheDay(ctx, event) || !DAY_KEYS[event.key]) return false;
  DAY_KEYS[event.key](ctx, event);
  event.preventDefault();
  return true;
}
