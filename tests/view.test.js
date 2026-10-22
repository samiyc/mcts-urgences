import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACCIDENT, HOSPITALS } from "../src/hypotheses.js";
import { RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { simulateShift } from "../src/simulate.js";
import { boxRows, clock, curvePath, scaleOf, summaryOf, waitingCurve, worstPatients } from "../web/view.js";

const settings = { ...HOSPITALS.moyen, crisis: ACCIDENT };
const { patients, measures } = simulateShift(drawShift(4, settings), RULES.colour, settings);

describe("what the page shows (web/view.js)", () => {
  it("reads minutes into the shift as a time of day from 08:00", () => {
    assert.equal(clock(0), "08:00");
    assert.equal(clock(95), "09:35");
  });

  it("puts every patient in exactly one box row, inside the scale", () => {
    const scale = scaleOf(patients);
    const rows = boxRows(patients, settings.boxes, scale);
    assert.equal(rows.length, 12);
    assert.equal(rows.reduce((sum, row) => sum + row.bars.length, 0), patients.length);
    assert.ok(rows.flatMap((row) => row.bars).every((bar) => bar.left >= 0 && bar.left + bar.width <= 100.0001 && bar.exam > 0 && bar.exam <= 100));
    // No two stays overlap in one box.
    for (const row of rows) {
      const stays = patients.filter((one) => one.box === row.box).sort((a, b) => a.start - b.start);
      for (let i = 1; i < stays.length; i += 1) assert.ok(stays[i].start >= stays[i - 1].end - 1e-9);
    }
  });

  it("counts the waiting room up at each arrival and down at each start, back to empty", () => {
    const curve = waitingCurve(patients);
    assert.equal(curve.points.at(-1).count, 0);
    assert.ok(curve.points.every((point) => point.count >= 0));
    assert.equal(curve.peak, measures.peakWaiting);
    assert.match(curvePath(curve, scaleOf(patients), { width: 100, height: 10 }), /^M0,10 H/);
  });

  it("says the shift in one line and lists the worst served with their hidden level", () => {
    assert.match(summaryOf(measures), /^\d+ patients · coût du retard \d+ · \d+ vus en retard/);
    const worst = worstPatients(patients);
    assert.ok(worst.length > 0 && worst.length <= 10);
    assert.ok(worst.every((one, i) => i === 0 || worst[i - 1].cost >= one.cost));
    assert.ok(worst.every((one) => ["rouge", "orange", "jaune", "vert", "bleu"].includes(one.truth)));
  });
});
