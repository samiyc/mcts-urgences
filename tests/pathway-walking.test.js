import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathwaySettingsOf } from "../src/pathway-hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULES } from "../src/rules.js";
import { STEP } from "../src/ward-moves.js";

const RULESET = { box: RULES.colour, bed: BED_RULES.oldest };
const played = (seed, options) => runPathway(startPathway(drawPathwayDay(seed, options)), RULESET);
const NO_NEEDS = { bio: false, scan: false, advice: false };
/** A patient made by hand, as in pathway.test.js. */
const patient = (id, arrival, level, extra = {}) => ({
  id, arrival, source: "pied", announcedAt: arrival, level, colour: level, examFactor: 1, stayFactor: 1, worsenDelays: [],
  needs: NO_NEEDS, orientation: "home", ward: "medecine", thenWard: false, isolate: false, elderly: false, patience: Infinity,
  labFactor: 1, uhcdFactor: 1, theatreFactor: 1, ...extra,
});
const dayOf = (patients, overrides = {}) => {
  const settings = pathwaySettingsOf({ boxes: 1, doctors: 1, dayDoctors: { from: 10, to: 22, extra: 0 }, ...overrides });
  settings.capacity = { ...settings.capacity, sauv: 0, uhcd: 0, isolation: 0 };
  settings.wards = { medecine: { free: 0, perDay: 0 } };
  return { settings, patients, beds: {} };
};
/** The cells of the walk of `who` to `at` that started at `t`. */
const walkedAt = (day, who, at, t) => day.trace.walks.find((one) => one.who === who && one.at === at && Math.abs(one.t0 - t) < 1e-9).path.length - 1;

describe("walking counted (settings.walk, step 3)", () => {
  it("starts the exam once the patient and the doctor are both at the box", () => {
    const day = runPathway(startPathway(dayOf([patient(1, 0, 3)], { walk: true })), RULESET);
    const one = day.patients.get(1);
    const { register, triage } = day.settings;
    const called = register + triage;
    const cells = Math.max(walkedAt(day, 1, "boxes", called), walkedAt(day, "doctor:0", "patient", called));
    assert.ok(cells > 0);
    assert.ok(Math.abs(one.start - (called + cells * STEP)) < 1e-9);
  });

  it("changes nothing when walking does not count", () => {
    const days = [1, 2].map((seed) => [played(seed, { hospital: "moyen" }), played(seed, { hospital: "moyen", walk: false })]);
    for (const [a, b] of days) assert.deepEqual(pathwayMeasures(a), pathwayMeasures(b));
  });

  it("takes the patients to the scanner by a stretcher-bearer, one transport at a time each", () => {
    const day = played(2, { hospital: "moyen", accident: true, walk: true });
    assert.ok(day.trace.transports.length > 0);
    for (const porter of day.porters) {
      const own = day.trace.walks.filter((one) => one.who === porter.who);
      own.slice(1).forEach((one, i) => assert.ok(one.t0 >= own[i].t0 + (own[i].path.length - 1) * STEP - 1e-9, `${porter.who} à ${one.t0}`));
    }
    assert.ok([...day.patients.values()].every((one) => one.exit !== null || one.step !== "exams" || day.settings.overtime > 0));
  });

  it("makes the stays longer than when nobody waits for a walk", () => {
    const stay = (walk) => [1, 2, 3].reduce((sum, seed) => sum + pathwayMeasures(played(seed, { hospital: "moyen", walk })).stay.median, 0);
    assert.ok(stay(true) > stay(false), `${stay(true)} contre ${stay(false)}`);
  });
});
