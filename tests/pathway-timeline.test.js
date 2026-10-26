import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FATIGUE } from "../src/pathway-hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { statusAt, stepsOf } from "../src/pathway-status.js";
import { EVERY, timelineOf } from "../src/pathway-timeline.js";
import { RULES } from "../src/rules.js";

const played = (seed, options = {}) => runPathway(startPathway(drawPathwayDay(seed, { hospital: "moyen", accident: true, ...options })), { box: RULES.colour, bed: BED_RULES.oldest });

describe("the day's timeline (src/pathway-timeline.js, step 5)", () => {
  it("takes the department's state every few minutes, from the start to the last exit", () => {
    const { series, end } = timelineOf(played(1));
    series.forEach((one, i) => assert.equal(one.t, i * EVERY));
    assert.ok(series.at(-1).t <= end && series.at(-1).t > end - EVERY - 1e-9);
  });

  it("counts the patients present as each one's steps tell", () => {
    const day = played(2);
    const steps = stepsOf(day);
    const presentAt = (t) => [...steps.values()].filter((own) => !["coming", "out"].includes(statusAt(own, t).step)).length;
    const { series } = timelineOf(day);
    const differ = series.filter((one) => one.present !== presentAt(one.t));
    assert.ok(differ.length <= 2, `${differ.length} relevés différents sur ${series.length}`);
  });

  it("marks the moments the day's measures count: worsenings, patients gone unseen, ambulances sent elsewhere", () => {
    const day = played(3);
    const measures = pathwayMeasures(day);
    const { markers, series } = timelineOf(day);
    assert.equal(markers.left.length, measures.exits.parti);
    assert.equal(markers.diverted.length, measures.exits.reoriente);
    assert.equal(markers.worsened.length, [...day.patients.values()].reduce((sum, one) => sum + one.worsened, 0));
    assert.deepEqual(markers.crisis, { from: 90, to: 120 });
    if (measures.full.boxes > 0) assert.ok(series.some((one) => one.full.includes("boxes")));
  });

  it("shows the doctors' breaks and the results overlooked when fatigue counts", () => {
    const day = played(4, { fatigue: { ...FATIGUE, oversight: { base: 0.3, perHour: 0 } } });
    const { markers } = timelineOf(day);
    assert.ok(markers.breaks.length > 0 && markers.overlooked.length > 0);
    assert.ok(markers.breaks.every((one) => one.to > one.from));
  });
});
