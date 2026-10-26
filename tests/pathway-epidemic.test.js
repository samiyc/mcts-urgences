import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { EPIDEMIC, pathwaySettingsOf } from "../src/pathway-hypotheses.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULES } from "../src/rules.js";

const DAYS = 60;
const days = (options) => Array.from({ length: DAYS }, (_, i) => drawPathwayDay(1 + i, options));
const measuresOf = (drawn) => pathwayMeasures(runPathway(startPathway(drawn), { box: RULES.colour, bed: BED_RULES.oldest }));
/** A patient without the number the day gives them by arrival. */
const unnumbered = (patient) => Object.fromEntries(Object.entries(patient).filter(([key]) => key !== "id"));

describe("a day at the peak of a winter epidemic (pathway-epidemic.js)", () => {
  it("adds its patients to the ordinary day, which stays the same", () => {
    const ordinary = days({});
    const winter = days({ epidemic: true });
    ordinary.forEach((day, i) => {
      const kept = winter[i].patients.filter((patient) => !patient.epidemic);
      assert.deepEqual(kept.map(unnumbered), day.patients.map(unnumbered));
      assert.ok(winter[i].patients.every((patient) => patient.arrival >= 0 && patient.arrival <= day.settings.shift));
    });
    const added = winter.reduce((sum, day) => sum + day.patients.filter((patient) => patient.epidemic).length, 0);
    const share = added / ordinary.reduce((sum, day) => sum + day.patients.length, 0);
    assert.ok(Math.abs(share - EPIDEMIC.share) < 0.02, `${share}`);
  });

  it("brings patients about 1 in 4 admitted, half to isolate, and the wards give fewer beds", () => {
    const winter = days({ epidemic: true });
    const added = winter.flatMap((day) => day.patients.filter((patient) => patient.epidemic));
    const admitted = added.filter((patient) => patient.orientation !== "home").length / added.length;
    const isolated = added.filter((patient) => patient.isolate).length / added.length;
    assert.ok(admitted > 0.17 && admitted < 0.31, `${admitted}`);
    assert.ok(Math.abs(isolated - EPIDEMIC.isolate) < 0.08, `${isolated}`);
    const beds = (list) => list.reduce((sum, day) => sum + Object.values(day.beds).flat().length, 0);
    const kept = beds(winter) / beds(days({}));
    assert.ok(Math.abs(kept - EPIDEMIC.beds) < 0.05, `${kept}`);
    const free = (list) => list.reduce((sum, day) => sum + Object.values(day.settings.wards).reduce((all, ward) => all + ward.free, 0), 0);
    const freeKept = free(winter) / (DAYS * Object.values(pathwaySettingsOf({}).wards).reduce((sum, ward) => sum + ward.free, 0));
    assert.ok(Math.abs(freeKept - EPIDEMIC.beds) < 0.1, `${freeKept}`);
  });

  it("costs more than the ordinary day", () => {
    const mean = (options) => days(options).slice(0, 20).reduce((sum, drawn) => sum + measuresOf(drawn).lateCostNow, 0) / 20;
    const ordinary = mean({});
    const winter = mean({ epidemic: true });
    assert.ok(winter > ordinary, `${winter} ${ordinary}`);
  });
});
