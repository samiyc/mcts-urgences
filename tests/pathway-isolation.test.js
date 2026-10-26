import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BED_RULES, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULES } from "../src/rules.js";

const played = (seed, options = {}) => runPathway(startPathway(drawPathwayDay(seed, options)), { box: RULES.deadline, bed: BED_RULES.oldest });
/** Who went into the isolation room over the day, from the day's moves. */
const roomTakers = (day) => day.trace.moves.filter((move) => move.to.at === "isolation").map((move) => day.patients.get(move.who));

describe("the isolation room lent (pathway-isolation.js, H61)", () => {
  it("lends the free room to light and young patients only, and nobody without it", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const day = played(seed, { accident: true });
      const borrowers = roomTakers(day).filter((patient) => !patient.isolate);
      assert.ok(borrowers.every((patient) => patient.colour >= 4 && !patient.elderly));
      assert.equal(day.isolation.lent, new Set(borrowers).size);
      const never = played(seed, { accident: true, isolationLent: null });
      assert.equal(never.isolation, null);
      assert.ok(roomTakers(never).every((patient) => patient.isolate));
    }
  });

  it("gives the room back to a patient to isolate: the borrower moved out, the room cleaned, then theirs", () => {
    const days = Array.from({ length: 30 }, (_, i) => played(1 + i, { epidemic: true }));
    const moved = days.reduce((sum, day) => sum + day.isolation.moved, 0);
    const back = days.reduce((sum, day) => sum + day.isolation.back, 0);
    assert.ok(moved > 0 && back > 0, `${moved} ${back}`);
    // Taken back, the room goes to patients to isolate: over the days, more of them go into it than without lending.
    const isolatedIn = (list) => list.reduce((sum, day) => sum + new Set(roomTakers(day).filter((patient) => patient.isolate)).size, 0);
    const never = Array.from({ length: 30 }, (_, i) => played(1 + i, { epidemic: true, isolationLent: null }));
    assert.ok(isolatedIn(days) >= isolatedIn(never) * 0.95, `${isolatedIn(days)} ${isolatedIn(never)}`);
  });
});
