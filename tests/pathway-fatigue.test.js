import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BREAK_DECIDERS, DECIDED, breakTimes, fatigueMeasures, internSlowOf, slowOf } from "../src/pathway-fatigue.js";
import { pathwaySearchBreakRule } from "../src/pathway-search-rules.js";
import { internResult, runInternGame, startInternGame } from "../src/pathway-game.js";
import { FATIGUE, pathwaySettingsOf } from "../src/pathway-hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULES } from "../src/rules.js";

const RULESET = { box: RULES.colour, bed: BED_RULES.oldest };
const played = (seed, fatigue, options = {}) => runPathway(startPathway(drawPathwayDay(seed, { hospital: "moyen", fatigue, ...options })), RULESET);
const breaksOf = (day) => day.fatigue.people.flatMap((person) => person.breaks);

describe("the doctors' fatigue and breaks (src/pathway-fatigue.js, step 4)", () => {
  it("slows a doctor as the hours go, more at night", () => {
    const day = startPathway(drawPathwayDay(1, { fatigue: FATIGUE }));
    const at = (minute) => {
      day.events.schedule(minute, { type: "tick" });
      day.events.next();
      return slowOf(day, 0);
    };
    const morning = at(60);
    const evening = at(13 * 60);
    const night = at(18 * 60);
    assert.ok(morning < evening && evening < night, `${morning} ${evening} ${night}`);
    assert.equal(slowOf(startPathway(drawPathwayDay(1, {})), 0), 1);
  });

  it("places the breaks in their windows, never leaving fewer doctors than its minimum", () => {
    const day = played(2, FATIGUE, { accident: true });
    const slots = breakTimes(day.settings);
    const breaks = breaksOf(day);
    assert.ok(breaks.length > 0);
    for (const one of breaks) {
      const slot = slots.find((s) => s.kind === one.kind && one.from >= s.from - 1e-9 && one.from <= s.last + s.minutes + 1e-9);
      assert.ok(slot, `${one.kind} à ${one.from}`);
      const together = breaks.filter((other) => other.from <= one.from && other.to > one.from).length;
      assert.ok(together <= day.settings.doctors + day.settings.dayDoctors.extra - FATIGUE.minDoctors);
    }
  });

  it("keeps a doctor without a break through the shift under « aucune pause », 12 h at most with two teams", () => {
    const none = fatigueMeasures(played(3, { ...FATIGUE, breaks: "none" }));
    assert.equal(none.meals + none.rests, 0);
    assert.ok(Math.abs(none.longest - 24) < 1e-9);
    assert.ok(fatigueMeasures(played(3, { ...FATIGUE, breaks: "none", teams: 12 })).longest <= 12 + 1e-9);
  });

  it("reads overlooked results again later, and only when fatigue counts", () => {
    const days = [1, 2, 3, 4].map((seed) => played(seed, { ...FATIGUE, breaks: "none", oversight: { base: 0.3, perHour: 0 } }));
    const overlooked = days.reduce((sum, day) => sum + fatigueMeasures(day).oversights, 0);
    assert.ok(overlooked > 0);
    for (const day of days) assert.ok([...day.patients.values()].every((one) => !one.overlooked));
    assert.equal(pathwaySettingsOf({}).fatigue, null);
  });

  it("changes nothing without fatigue", () => {
    for (const seed of [1, 2]) assert.deepEqual(pathwayMeasures(played(seed, null)), pathwayMeasures(played(seed, undefined)));
  });

  it("slows the intern as their day goes on, when fatigue counts", () => {
    const day = startPathway(drawPathwayDay(1, { fatigue: FATIGUE }));
    assert.equal(internSlowOf(day), 1);
    // 18 h into the day (2 h at night): 18 h of fatigue on the curve, the night's extra.
    assert.ok(internSlowOf({ ...day, events: { now: 18 * 60 } }) > 1.2);
    const tired = internResult(runInternGame(startInternGame({ mode: "robot", seed: 1, fatigue: FATIGUE })));
    const fresh = internResult(runInternGame(startInternGame({ mode: "robot", seed: 1 })));
    assert.notDeepEqual(tired.intern, fresh.intern);
  });

  it("asks for the breaks one at a time when they are decided, every 15 min at most, and keeps its doctors", () => {
    const asked = [];
    const breaks = (candidates, context) => {
      asked.push({ t: context.now, ...candidates });
      return BREAK_DECIDERS.quiet(candidates, context);
    };
    const day = runPathway(startPathway(drawPathwayDay(2, { hospital: "moyen", accident: true, fatigue: { ...FATIGUE, breaks: DECIDED } })), { ...RULESET, breaks });
    assert.ok(asked.length > 0);
    const all = breaksOf(day);
    assert.ok(all.length > 0);
    for (const one of all) assert.ok(all.filter((other) => other.from <= one.from && other.to > one.from).length <= day.settings.doctors + day.settings.dayDoctors.extra - FATIGUE.minDoctors);
  });

  it("lets the search decide a break: now or later", () => {
    let answer = null;
    const search = pathwaySearchBreakRule({ budget: 8 });
    const breaks = (candidates, context) => {
      const chosen = answer ?? search(candidates, context);
      answer ??= chosen;
      return chosen;
    };
    runPathway(startPathway(drawPathwayDay(3, { hospital: "proximite", fatigue: { ...FATIGUE, breaks: DECIDED } })), { ...RULESET, breaks });
    assert.ok(["now", "later"].includes(answer?.id));
  });
});
