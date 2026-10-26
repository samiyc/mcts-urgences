import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { SAUV_RULES } from "../src/pathway-sauv.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { pathwaySearchSauvRule } from "../src/pathway-search-rules.js";
import { RULES } from "../src/rules.js";

const played = (seed, sauv, options = {}) => runPathway(startPathway(drawPathwayDay(seed, { hospital: "moyen", accident: true, sauvDecided: true, ...options })), { box: RULES.colour, bed: BED_RULES.oldest, sauv });

describe("out of the SAUV for a red (src/pathway-sauv.js, step 6)", () => {
  it("asks only with the SAUV full, a box free and a red waiting or coming; « never » is the day without it", () => {
    const asked = [];
    const day = played(1, (candidates, context) => {
      const { day: d } = context;
      asked.push({ full: d.busy.sauv >= d.capacity.sauv, boxFree: d.capacity.boxes - d.busy.boxes > 0, candidates });
      return SAUV_RULES.never(candidates);
    });
    assert.ok(asked.length > 0 && asked.every((one) => one.full && one.boxFree && one.candidates.at(-1).id === "none"));
    const without = runPathway(startPathway(drawPathwayDay(1, { hospital: "moyen", accident: true })), { box: RULES.colour, bed: BED_RULES.oldest });
    assert.deepEqual(pathwayMeasures(day), pathwayMeasures(without));
  });

  it("moves the patient chosen into a box, freeing the SAUV", () => {
    let moved = null;
    played(1, (candidates, { day }) => {
      const chosen = moved ? SAUV_RULES.never(candidates) : SAUV_RULES.longest(candidates);
      if (!moved) moved = { id: chosen.id, day };
      return chosen;
    });
    assert.equal(moved.day.patients.get(moved.id).place === "sauv", false);
  });

  it("lets the search decide", () => {
    let seen = null;
    const search = pathwaySearchSauvRule({ budget: 6 });
    played(2, (candidates, context) => {
      const chosen = seen ? SAUV_RULES.never(candidates) : search(candidates, context);
      seen ??= { candidates, chosen };
      return chosen;
    });
    assert.ok(seen && seen.candidates.includes(seen.chosen));
  });
});
