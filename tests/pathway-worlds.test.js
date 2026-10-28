import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { streamOf } from "mcts-commun/random.js";
import { BED_RULES, decide, nextDecision, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { drawWorld } from "../src/pathway-search.js";
import { sampleOnce } from "../src/pathway-worlds.js";
import { RULES } from "../src/rules.js";

/** The small hospital's day with the accident, at its first box decision with two candidates or more. */
function dayAtChoice() {
  const day = startPathway(drawPathwayDay(2, { hospital: "proximite", accident: true }));
  for (let decision = nextDecision(day); decision; decision = nextDecision(day)) {
    if (decision.kind === "box" && decision.candidates.length > 1) return day;
    const rule = decision.kind === "box" ? RULES.colour : BED_RULES.oldest;
    decide(day, decision, Number(rule(decision.candidates).id));
  }
  throw new Error("pas de choix");
}

/** What a world is, for comparing two: its patients, its events to come, its decision. */
const shapeOf = (world) => JSON.stringify({ patients: [...world.patients.values()], size: world.events.size, next: world.events.peek(), decision: world.decision });

describe("the worlds of a search, drawn once each (src/pathway-worlds.js, 28/10/2026)", () => {
  it("draws a stream's world once, and gives the same world as a fresh draw, its stream left as the draw leaves it", () => {
    const day = dayAtChoice();
    let draws = 0;
    const sample = sampleOnce((d, rng) => ((draws += 1), drawWorld(d, rng, 120)));
    const fresh = streamOf(7, 3);
    const expected = shapeOf(drawWorld(day, fresh, 120));
    for (let i = 0; i < 3; i += 1) {
      const stream = streamOf(7, 3);
      assert.equal(shapeOf(sample(day, stream)), expected);
      assert.equal(stream.getState(), fresh.getState());
    }
    assert.equal(draws, 1);
  });

  it("gives each play its own copy: a world played leaves the kept one as drawn", () => {
    const day = dayAtChoice();
    const sample = sampleOnce((d, rng) => drawWorld(d, rng, 120));
    const first = sample(day, streamOf(7, 1));
    const before = shapeOf(sample(day, streamOf(7, 1)));
    decide(first, first.decision, Number(RULES.colour(first.decision.candidates).id));
    nextDecision(first);
    assert.equal(shapeOf(sample(day, streamOf(7, 1))), before);
  });

  it("with `pool`, draws that many worlds at most, the next streams replaying them in turn", () => {
    const day = dayAtChoice();
    let draws = 0;
    const sample = sampleOnce((d, rng) => ((draws += 1), drawWorld(d, rng, 120)), { pool: 2 });
    const worlds = [0, 1, 2, 3].map((k) => shapeOf(sample(day, streamOf(5, k))));
    assert.equal(draws, 2);
    assert.deepEqual([worlds[2], worlds[3]], [worlds[0], worlds[1]]);
    assert.notEqual(worlds[0], worlds[1]);
  });
});
