import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { QUEUE_RULES } from "../src/pathway-queues.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { pathwaySearchQueueRule } from "../src/pathway-search-rules.js";
import { RULES } from "../src/rules.js";

const played = (seed, queue, options = {}) => runPathway(startPathway(drawPathwayDay(seed, { hospital: "moyen", accident: true, queueDecided: true, ...options })), { box: RULES.colour, bed: BED_RULES.oldest, queue });

describe("the scanner's and the theatre's order decided (src/pathway-queues.js, step 6)", () => {
  it("asks who goes first only when two patients or more wait, and plays the fixed order with the colour rule", () => {
    const asked = [];
    const day = played(1, (candidates, context) => {
      asked.push({ pool: context.day.queues.scanner.includes(candidates[0].id) ? "scanner" : "theatre", candidates });
      return QUEUE_RULES.colour(candidates);
    });
    assert.ok(asked.length > 0 && asked.every(({ candidates }) => candidates.length >= 2));
    const fixed = runPathway(startPathway(drawPathwayDay(1, { hospital: "moyen", accident: true })), { box: RULES.colour, bed: BED_RULES.oldest });
    assert.equal(pathwayMeasures(day).patients, pathwayMeasures(fixed).patients);
    // The scanner's fixed order is the colour rule's: the same day.
    assert.equal(pathwayMeasures(day).lateCostNow, pathwayMeasures(fixed).lateCostNow);
  });

  it("lets the search choose who goes first", () => {
    let seen = null;
    const search = pathwaySearchQueueRule({ budget: 6 });
    played(2, (candidates, context) => {
      const chosen = seen ? QUEUE_RULES.colour(candidates) : search(candidates, context);
      seen ??= { candidates, chosen };
      return chosen;
    }, { hospital: "proximite" });
    assert.ok(seen && seen.candidates.includes(seen.chosen));
  });
});
