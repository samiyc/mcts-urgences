import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BED_RULES, decide, nextDecision, runPathway, startPathway } from "../src/pathway.js";
import { HET_RULES, hetMeasures } from "../src/pathway-het.js";
import { HET } from "../src/pathway-hypotheses.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { pathwaySearchHetRule } from "../src/pathway-search-rules.js";
import { RULES } from "../src/rules.js";

const played = (seed, het, options = {}) => runPathway(startPathway(drawPathwayDay(seed, { ...options, het: HET })), { box: RULES.colour, bed: BED_RULES.oldest, het });

describe("the hospital in tension, the HET (pathway-het.js)", () => {
  it("never on, gives no bed; the day is then the one without it", () => {
    const day = played(1, HET_RULES.never, { epidemic: true });
    assert.deepEqual(hetMeasures(day), { at: null, beds: 0, cost: 0 });
    const without = runPathway(startPathway(drawPathwayDay(1, { epidemic: true })), { box: RULES.colour, bed: BED_RULES.oldest });
    assert.deepEqual([...day.patients.values()].map((patient) => patient.exitAt), [...without.patients.values()].map((patient) => patient.exitAt));
  });

  it("on at once, the wards give their beds after the delay, then one every few hours until the day's end", () => {
    const day = startPathway(drawPathwayDay(2, { het: HET }));
    for (let decision = nextDecision(day); decision; decision = nextDecision(day)) {
      if (decision.kind === "het") decide(day, decision, "now");
      else if (decision.kind === "box") decide(day, decision, Number(RULES.colour(decision.candidates, { now: day.events.now, day }).id));
      else decide(day, decision, Number(BED_RULES.oldest(decision.candidates, { now: day.events.now, day }).id));
    }
    const { at, given } = day.het;
    assert.equal(at, 0);
    assert.deepEqual(given.slice(0, 2), [HET.delay, HET.delay]);
    given.slice(2).forEach((time, i) => assert.equal(time, HET.delay + (i + 1) * HET.every));
    assert.ok(given.every((time) => time < day.settings.shift));
    assert.equal(hetMeasures(day).cost, given.length * HET.bedCost);
  });

  it("at the threshold, comes on once patients wait for a bed, and the search decides it too", () => {
    const days = Array.from({ length: 12 }, (_, i) => played(1 + i, HET_RULES.threshold, { epidemic: true }));
    const on = days.filter((day) => day.het.on);
    assert.ok(on.length > 0);
    assert.ok(on.every((day) => day.het.given.every((time) => time >= day.het.at + HET.delay)));
    const searched = played(3, pathwaySearchHetRule({ budget: 8 }), { epidemic: true });
    assert.ok(searched.over);
  });
});
