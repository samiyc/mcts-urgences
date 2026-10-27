import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { playSauvSearchDay } from "../src/pathway-search-compare.js";
import { addTallies, newTally } from "../src/search-trials.js";

const job = { seed: 2, options: { hospital: "proximite", accident: true }, budget: 10 };

describe("mcts-commun's trials of 27/10/2026 (src/search-trials.js)", () => {
  it("leave the day as it was when not asked, without tallies", () => {
    assert.equal(playSauvSearchDay(job).tallies, undefined);
  });

  it("play the search stopped early to the same day, and count what each search saw", () => {
    const day = playSauvSearchDay({ ...job, early: true, diagnose: true });
    const { tallies, early, search } = day;
    assert.deepEqual(early, search);
    assert.ok(tallies.search.searches > 0);
    assert.ok(tallies.early.iterations <= tallies.search.iterations);
    const codes = Object.values(tallies.search.codes).reduce((sum, count) => sum + count, 0);
    assert.ok(codes >= tallies.search.searches);
    assert.equal(addTallies([tallies.search, newTally()]).iterations, tallies.search.iterations);
  });
});
