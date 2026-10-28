import { cloneDay } from "./pathway-clone.js";

/**
 * The worlds of one search, drawn once each (Sami, 28/10/2026: do lighter draws pay?). On common worlds, the k-th
 * visit of every root move plays the k-th world: mcts-commun draws it once and hands each visit `copyWorld` of it
 * (`problem.copy`, since commun 2f5554f; this module drew once itself before).
 *
 * `sampleOnce` stays for a trial, `pool` (off by default): at most `pool` distinct worlds, the next streams replaying
 * them in turn; the stream's state before the draw names a world, and is left as the draw leaves it. Fewer draws, fewer
 * worlds: the results change.
 */

/** A copy of a world as it was drawn: `cloneDay`'s, the intern's tasks done since the search began kept. */
export function copyWorld(world) {
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
    return copyWorld(world);
  };
}
