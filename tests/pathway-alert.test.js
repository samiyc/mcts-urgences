import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALERT_RULES, alertMeasures } from "../src/pathway-alert.js";
import { ALERT } from "../src/pathway-hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { pathwaySearchAlertRule } from "../src/pathway-search-rules.js";
import { RULES } from "../src/rules.js";

const played = (seed, alert, options = {}) => runPathway(startPathway(drawPathwayDay(seed, { hospital: "moyen", accident: true, alert: ALERT, ...options })), { box: RULES.colour, bed: BED_RULES.oldest, alert });

describe("the crisis plan, the « Plan blanc » (src/pathway-alert.js, step 6)", () => {
  it("never triggered, the day is the same as without it", () => {
    const without = runPathway(startPathway(drawPathwayDay(1, { hospital: "moyen", accident: true })), { box: RULES.colour, bed: BED_RULES.oldest });
    assert.deepEqual(pathwayMeasures(played(1, ALERT_RULES.never)), pathwayMeasures(without));
    assert.equal(alertMeasures(played(1, ALERT_RULES.never)).hours, 0);
  });

  it("triggered, calls doctors back after its delay and gives beds at once, at a cost in doctor-hours", () => {
    const day = played(1, ALERT_RULES.threshold);
    const plan = alertMeasures(day);
    assert.ok(plan.at !== null && plan.hours > 0);
    assert.ok(Math.abs(plan.cost - plan.hours * ALERT.doctorHour) < 1e-6);
    assert.ok(pathwayMeasures(day).lateCostNow < pathwayMeasures(played(1, ALERT_RULES.never)).lateCostNow);
  });

  it("is asked only while doctors called back would come before the day's end, and lets the search decide", () => {
    let latest = -Infinity;
    const search = pathwaySearchAlertRule({ budget: 6 });
    let decided = null;
    const day = played(2, (candidates, context) => {
      latest = Math.max(latest, context.now);
      const chosen = decided ? ALERT_RULES.never(candidates, context) : search(candidates, context);
      decided ??= chosen;
      return chosen;
    }, { hospital: "proximite" });
    assert.ok(latest + ALERT.delay < day.settings.shift);
    assert.ok(["now", "later"].includes(decided.id));
  });
});
