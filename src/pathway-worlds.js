import { cloneDay } from "./pathway-clone.js";

/**
 * The worlds of one search, drawn once each (Sami, 28/10/2026: do lighter draws pay?). On common worlds
 * (mcts-commun's `iterateCommon`), the k-th visit of every root move plays the k-th world, drawn from the k-th stream:
 * the same world is drawn once per root move. Here it is drawn once, kept, and copied for the others; the stream's
 * state before the draw names it, and is left as the draw leaves it. The same worlds, the same results.
 *
 * `pool` (off by default, a trial): at most `pool` distinct worlds; the next streams replay them in turn. Fewer draws,
 * fewer worlds: the results change.
 */

/** A copy of a world as it was drawn: `cloneDay`'s, the intern's tasks done since the search began kept. */
function cloneWorld(world) {
  const copy = cloneDay(world);
  if (world.intern) Object.assign(copy.intern, { done: [...world.intern.done], track: [...world.intern.track] });
  return copy;
}

/** The `sample` of a search's problem: `draw(day, rng)` once a stream, its worlds then copied. */
export function sampleOnce(draw, { pool = Infinity } = {}) {
  const drawn = new Map();
  const order = [];
  return (day, rng) => {
    const key = rng.getState();
    if (!drawn.has(key)) {
      const replayed = order.length >= pool ? drawn.get(order[order.length % pool]) : null;
      drawn.set(key, replayed ?? { world: draw(day, rng), after: rng.getState() });
      order.push(key);
    }
    const { world, after } = drawn.get(key);
    rng.setState(after);
    return cloneWorld(world);
  };
}
