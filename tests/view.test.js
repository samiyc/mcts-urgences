import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACCIDENT, HOSPITALS } from "../src/hypotheses.js";
import { RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { simulateShift } from "../src/simulate.js";
import { DEFAULTS } from "../src/hypotheses.js";
import { NURSE_RULES } from "../src/rules.js";
import { boxRows, clock, colourAt, curvePath, levelAt, sceneAt, sceneLine, scaleOf, summaryOf, waitingCurve, worstPatients } from "../web/view.js";

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

  it("rebuilds the department at any minute: each patient arrived is waiting, in a box or gone, once", () => {
    const end = Math.max(...patients.map((one) => one.end));
    for (let t = 0; t <= end; t += 7) {
      const scene = sceneAt(patients, settings, t);
      const inBoxes = scene.boxes.filter((one) => one.patient);
      assert.equal(scene.waiting.length + inBoxes.length + scene.gone, scene.arrived, `minute ${t}`);
      assert.ok(scene.doctors.busy <= settings.doctors, `minute ${t} : trop de médecins`);
      assert.equal(scene.waiting.length, waitingCurve(patients).points.filter((point) => point.t <= t).at(-1).count, `minute ${t}`);
      assert.ok(scene.waiting.every((one, i) => i === 0 || scene.waiting[i - 1].wait >= one.wait));
      assert.ok(scene.coming.every((one) => one.in > 0 && one.in <= DEFAULTS.announced));
    }
    assert.match(sceneLine(sceneAt(patients, settings, 120)), /^10:00 · \d+ en salle d'attente · \d+ \/ 12 box occupés · médecins \d \/ 4 en examen/);
  });

  it("shows the bracelet as the nurse changed it, and the true level as it worsened", () => {
    const withNurse = { ...settings, nurses: 1 };
    const course = simulateShift(drawShift(4, withNurse), RULES.colour, withNurse, NURSE_RULES.round).patients;
    const recoloured = course.find((one) => one.lookedAt.some((look) => look.colour !== null && look.colour !== one.firstColour));
    assert.ok(recoloured, "un bracelet changé par une réévaluation");
    const look = recoloured.lookedAt.find((one) => one.colour !== null && one.colour !== recoloured.firstColour);
    assert.equal(colourAt(recoloured, look.to - 1), recoloured.firstColour);
    assert.equal(colourAt(recoloured, look.to), look.colour);
    const scene = sceneAt(course, withNurse, look.from);
    if (recoloured.start === null || recoloured.start > look.from) assert.ok(scene.waiting.find((one) => one.id === recoloured.id).looked);
    const worsened = course.find((one) => one.worsened > 0);
    assert.equal(levelAt(worsened, worsened.worsenedAt[0] - 1), worsened.arrivalLevel);
    assert.equal(levelAt(worsened, worsened.worsenedAt[0]), worsened.arrivalLevel - 1);
  });
});
