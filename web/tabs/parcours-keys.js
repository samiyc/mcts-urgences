import { nextSpeed, replayKey, within } from "../replay-keys.js";
import { SPEEDS, draw, pausePathway, playPathway } from "./parcours.js";

/** The day replayed, as replay-keys.js drives it: the minute shown, the speed, playing or not. */
const playerOf = (ctx) => ({
  t: () => ctx.pathway.t,
  end: () => ctx.pathway.run.end,
  seek: (t) => {
    ctx.pathway.t = within(t, ctx.pathway.run.end);
    draw(ctx);
  },
  toggle: () => {
    (ctx.pathway.frame === null ? playPathway : pausePathway)(ctx);
    ctx.render();
  },
  faster: (way) => {
    ctx.pathway.speed = nextSpeed(SPEEDS, ctx.pathway.speed, way);
    ctx.render();
  },
});

/** A key in the tab « Parcours détaillé » while its day is shown (replay-keys.js); true if it was the tab's. */
export const pathwayKey = (ctx, event) => Boolean(ctx.pathway.run && document.getElementById("pathway")) && replayKey(playerOf(ctx), event);
