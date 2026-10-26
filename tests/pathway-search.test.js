import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "mcts-commun/random.js";
import { BED_RULES, decide, nextDecision, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { drawWorld, pathwaySearchBedRule, pathwaySearchRule } from "../src/pathway-search.js";
import { followChoices, searchChoices } from "../src/pathway-search-compare.js";
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

  it("replays the very day the search played from its choices (what the page does, the search in a worker)", () => {
    const options = { hospital: "proximite", accident: true };
    const direct = pathwayMeasures(runPathway(startPathway(drawPathwayDay(2, options)), { box: pathwaySearchRule({ budget: 10 }), bed: BED_RULES.oldest }));
    const choices = searchChoices({ seed: 2, options, budget: 10 });
    const replayed = pathwayMeasures(runPathway(startPathway(drawPathwayDay(2, options)), { box: followChoices(choices), bed: BED_RULES.oldest }));
    assert.deepEqual(replayed, direct);
  });

  it("chooses who takes a freed bed among those waiting, the same twice, and plays a whole day", () => {
    let asked = null;
    const search = pathwaySearchBedRule({ budget: 10 });
    const bed = (candidates, context) => {
      const chosen = search(candidates, context);
      if (candidates.length > 1 && !asked) asked = { candidates, chosen, again: search(candidates, context) };
      return chosen;
    };
    const drawn = drawPathwayDay(1, { hospital: "moyen", accident: true });
    const measures = pathwayMeasures(runPathway(startPathway(drawn), { box: RULES.colour, bed }));
    assert.equal(measures.patients, drawn.patients.length);
    assert.ok(asked, "aucune décision de lit à plusieurs candidats");
    assert.ok(asked.candidates.includes(asked.chosen));
    assert.equal(asked.again.id, asked.chosen.id);
  });
});
