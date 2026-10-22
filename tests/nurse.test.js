import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACCIDENT, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { NURSE_RULES, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { searchRule } from "../src/search.js";
import { lateCostNow, simulateShift } from "../src/simulate.js";

/** A patient made by hand: no spread, never worse unless told. */
const patient = (id, arrival, level, extra = {}) => ({ id, arrival, source: "pied", announcedAt: arrival, level, colour: level, examFactor: 1, stayFactor: 1, worsenDelays: [], ...extra });
const ONE_ROOM_ONE_NURSE = { boxes: 1, doctors: 1, nurses: 1, reassess: 5, recheck: 30 };

describe("re-assessment by a triage nurse (src/simulate.js, src/rules.js)", () => {
  it("looks at a waiting patient once due, even when nothing else happens, and the bracelet shows the true level", () => {
    // The first patient holds the only room for 90 + 20 min; the second, a true yellow triaged green, waits.
    const patients = [patient(1, 0, 4, { examFactor: 6 }), patient(2, 0, 3, { colour: 4 })];
    const looked = [];
    const nurse = (candidates, context) => {
      looked.push(context.now);
      return NURSE_RULES.round(candidates, context);
    };
    const { patients: course, measures } = simulateShift(patients, RULES.colour, ONE_ROOM_ONE_NURSE, nurse);
    const second = course.find((one) => one.id === 2);
    // Due 30 min after arriving, then 30 min after each look (5 min long), until a room frees at 110.
    assert.deepEqual(looked, [30, 65, 100]);
    assert.equal(second.reassessedAt, 105);
    assert.equal(second.colour, 3);
    assert.equal(second.firstColour, 4);
    assert.ok(second.recoloured);
    assert.equal(measures.looks, 3);
    assert.equal(measures.recoloured, 1);
  });

  it("catches a worsening the bracelet did not show", () => {
    const patients = [patient(1, 0, 4, { examFactor: 12 }), patient(2, 0, 3, { worsenDelays: [10, 1000, 1000] })];
    const { patients: course } = simulateShift(patients, RULES.colour, { ...ONE_ROOM_ONE_NURSE, recheck: 90 }, NURSE_RULES.round);
    const second = course.find((one) => one.id === 2);
    // Worse at 60 + 10 = 70, looked at from 90 to 95: orange now.
    assert.deepEqual(second.worsenedAt, [70]);
    assert.equal(second.colour, 2);
    assert.equal(second.arrivalLevel, 3);
  });

  it("changes nothing without a nurse", () => {
    const settings = { ...DEFAULTS, ...HOSPITALS.moyen, crisis: ACCIDENT };
    const patients = drawShift(4, settings);
    assert.deepEqual(simulateShift(patients, RULES.colour, settings, NURSE_RULES.round).measures, simulateShift(patients, RULES.colour, settings).measures);
    assert.equal(simulateShift(patients, RULES.colour, settings).measures.looks, 0);
  });

  it("counts the late cost at the level of the moment: worse, a patient weighs more and is late sooner", () => {
    const worse = { arrival: 0, arrivalLevel: 3, worsenedAt: [100] };
    // Yellow until 100 (late from 60: 40 min at 4), then orange (late already: 30 min at 8).
    assert.equal(lateCostNow(worse, 130), 40 * 4 + 30 * 8);
    assert.equal(lateCostNow({ arrival: 0, arrivalLevel: 3, worsenedAt: [] }, 130), 70 * 4);
    assert.equal(lateCostNow({ arrival: 0, arrivalLevel: 3, worsenedAt: [100] }, 50), 0);
  });

  it("lets the search choose whom the nurse looks at, the same shift twice", () => {
    const settings = { ...DEFAULTS, ...HOSPITALS.proximite, crisis: ACCIDENT, nurses: 1 };
    const rule = searchRule({ budget: 12, measure: "now" });
    const once = simulateShift(drawShift(2, settings), rule, settings, rule).measures;
    assert.ok(once.looks > 0);
    assert.deepEqual(simulateShift(drawShift(2, settings), searchRule({ budget: 12, measure: "now" }), settings, searchRule({ budget: 12, measure: "now" })).measures, once);
  });
});
