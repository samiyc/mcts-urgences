import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "mcts-commun/random.js";
import { BED_RULES, decide, nextDecision, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { drawWorld, pathwaySearchRule } from "../src/pathway-search.js";
import { RULES } from "../src/rules.js";

/** A day of the small hospital with the accident, played by the colour rule up to its `n`-th box decision with two candidates or more. */
function dayAtChoice(n) {
  const day = startPathway(drawPathwayDay(2, { hospital: "proximite", accident: true }));
  let seen = 0;
  for (let decision = nextDecision(day); decision; decision = nextDecision(day)) {
    if (decision.kind === "box" && decision.candidates.length > 1 && (seen += 1) === n) return { day, decision };
    const rule = decision.kind === "box" ? RULES.colour : BED_RULES.oldest;
    decide(day, decision, Number(rule(decision.candidates).id));
  }
  throw new Error("pas assez de choix");
}

describe("the search on the pathway (src/pathway-search.js, step 6)", () => {
  it("draws a world at the same decision, leaving the day untouched, the unknown arrivals drawn again", () => {
    const { day, decision } = dayAtChoice(3);
    const before = JSON.stringify([...day.patients.values()]);
    const world = drawWorld(day, createRng(1), 120);
    assert.equal(JSON.stringify([...day.patients.values()]), before);
    assert.deepEqual(world.decision.candidates.map((one) => one.id), decision.candidates.map((one) => one.id));
    // What nobody knows yet is not in the world as it is in the day.
    const now = day.events.now;
    assert.ok([...world.patients.values()].every((one) => one.id >= 1_000_000 || one.announcedAt <= now));
    assert.ok(world.pending.length >= decision.candidates.length);
  });

  it("chooses one of the candidates, the same twice, and plays a whole day", () => {
    const { day, decision } = dayAtChoice(2);
    const rule = pathwaySearchRule({ budget: 20 });
    const first = rule(decision.candidates, { day });
    assert.ok(decision.candidates.includes(first));
    assert.equal(rule(decision.candidates, { day }).id, first.id);
    const drawn = drawPathwayDay(3, { hospital: "proximite" });
    const played = pathwayMeasures(runPathway(startPathway(drawn), { box: pathwaySearchRule({ budget: 10 }), bed: BED_RULES.oldest }));
    assert.equal(played.patients, drawn.patients.length);
  });

  it("refuses a day with an intern, whose tasks a world does not play", () => {
    const { day, decision } = dayAtChoice(1);
    assert.throws(() => pathwaySearchRule({ budget: 5 })(decision.candidates, { day: { ...day, intern: {} } }));
  });
});
