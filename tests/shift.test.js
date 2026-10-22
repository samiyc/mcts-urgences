import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareRules } from "../src/compare.js";
import { ACCIDENT, DEFAULTS, MAX_WAIT } from "../src/hypotheses.js";
import { RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { simulateShift } from "../src/simulate.js";

/** A patient made by hand: no spread, never worse. */
const patient = (id, arrival, level, extra = {}) => ({ id, arrival, source: "pied", announcedAt: arrival, level, colour: level, examFactor: 1, stayFactor: 1, worsenDelays: [], ...extra });
const ONE_ROOM = { boxes: 1, doctors: 1 };

describe("a shift of the emergency department (src/scenario.js, src/simulate.js)", () => {
  it("draws the same shift from the same seed, patients by arrival, some triaged one level off", () => {
    assert.deepEqual(drawShift(3), drawShift(3));
    const shifts = Array.from({ length: 30 }, (_, i) => drawShift(i + 1)).flat();
    assert.ok(shifts.every((one) => one.arrival >= 0 && one.arrival < DEFAULTS.shift));
    const wrong = shifts.filter((one) => one.colour !== one.level);
    assert.ok(wrong.every((one) => Math.abs(one.colour - one.level) === 1));
    assert.ok(Math.abs(wrong.length / shifts.length - 0.2) < 0.04, `${wrong.length} / ${shifts.length}`);
    const withAccident = drawShift(3, { crisis: ACCIDENT });
    assert.equal(withAccident.length, drawShift(3).length + ACCIDENT.size);
  });

  it("lets the colour rule take the red patient first, the arrival rule the earlier one", () => {
    const patients = [patient(1, 0, 4), patient(2, 1, 3), patient(3, 2, 1)];
    const order = (rule) =>
      simulateShift(patients, rule, ONE_ROOM)
        .patients.sort((a, b) => a.start - b.start)
        .map((one) => one.id);
    assert.deepEqual(order(RULES.arrival), [1, 2, 3]);
    assert.deepEqual(order(RULES.colour), [1, 3, 2]);
    const seen = simulateShift(patients, RULES.colour, ONE_ROOM).patients;
    // The green one took the room at 0: exam 15 min, care 20, so the red one goes in at 35.
    assert.equal(seen.find((one) => one.id === 3).start, 35);
    // Arrived at 2, a red one may not wait: 33 minutes late.
    assert.equal(seen.find((one) => one.id === 3).late, 35 - 2 - MAX_WAIT[1]);
  });

  it("shows the rule only what the department sees: no true level", () => {
    const shown = [];
    const spy = (waiting) => {
      shown.push(...waiting);
      return waiting[0];
    };
    simulateShift([patient(1, 0, 3), patient(2, 0, 2, { colour: 3 })], spy, ONE_ROOM);
    assert.ok(shown.length > 0);
    assert.ok(shown.every((one) => Object.keys(one).sort().join() === "arrival,colour,id,reassessedAt,source"));
  });

  it("makes a waiting patient worse past their level's longest wait, the bracelet unchanged", () => {
    const patients = [patient(1, 0, 4), patient(2, 0, 3, { worsenDelays: [5, 1000, 1000] })];
    const [, second] = simulateShift(patients, RULES.arrival, ONE_ROOM).patients;
    // Waiting from 0 to 35, level 3 allows 60 min: no worsening yet.
    assert.equal(second.worsened, 0);
    const slow = [patient(1, 0, 4, { examFactor: 6 }), patient(2, 0, 3, { worsenDelays: [5, 1000, 1000] })];
    const [, late] = simulateShift(slow, RULES.arrival, ONE_ROOM).patients;
    assert.equal(late.worsened, 1);
    assert.equal(late.level, 2);
    assert.equal(late.colour, 3);
    assert.equal(late.arrivalLevel, 3);
  });

  it("sees everyone, and gives every room and doctor back at the end", () => {
    const { patients, measures } = simulateShift(drawShift(9, { crisis: ACCIDENT }), RULES.colour);
    assert.ok(patients.every((one) => one.start >= one.arrival && one.end > one.start));
    assert.equal(measures.patients, patients.length);
    assert.ok(measures.boxUse > 0 && measures.boxUse <= 1 && measures.doctorUse > 0 && measures.doctorUse <= 1);
  });
});

describe("the reference rules on the same shifts (src/compare.js)", () => {
  it("does better by colour than by arrival, on an ordinary day as in the accident", () => {
    for (const settings of [{}, { crisis: ACCIDENT }]) {
      const result = compareRules({ shifts: 40, settings });
      assert.ok(result.colour.gain.low > 0, JSON.stringify(result.colour.gain));
      assert.equal(result.arrival.patients, result.colour.patients);
    }
  });
});
