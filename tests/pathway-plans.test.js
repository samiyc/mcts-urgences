import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CELL_METRES, pathwaySettingsOf } from "../src/pathway-hypotheses.js";
import { PATHWAY_PLANS, PLACES, capacityOf, pathwayPlanOf, planErrors } from "../src/pathway-plans.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { walkMeasures, walkScene, walksOfDay } from "../src/pathway-walk.js";
import { RULES } from "../src/rules.js";
import { STEP, walkSteps } from "../src/ward-moves.js";

const RULESET = { box: RULES.colour, bed: BED_RULES.oldest };
const HOSPITAL_NAMES = Object.keys(PATHWAY_PLANS);
const played = (seed, options) => runPathway(startPathway(drawPathwayDay(seed, options)), RULESET);
/** The moyen plan with one box fewer: its last `b` made floor. */
const oneBoxLess = (() => {
  const text = PATHWAY_PLANS.moyen;
  const at = text.lastIndexOf("b");
  return `${text.slice(0, at)}.${text.slice(at + 1)}`;
})();

describe("the plans of the detailed pathway (src/pathway-plans.js)", () => {
  it("draws each hospital with exactly the places its settings have, so a day on its plan is the day of step 1", () => {
    for (const hospital of HOSPITAL_NAMES) {
      assert.deepEqual(planErrors(PATHWAY_PLANS[hospital]), [], hospital);
      const settings = pathwaySettingsOf({ hospital });
      const { boxes, ...places } = capacityOf(pathwayPlanOf(PATHWAY_PLANS[hospital]));
      assert.equal(boxes, settings.boxes, hospital);
      for (const [pool, count] of Object.entries(places)) assert.equal(count, settings.capacity[pool], `${hospital} ${pool}`);
      assert.deepEqual(drawPathwayDay(3, { hospital, plan: PATHWAY_PLANS[hospital] }).patients, drawPathwayDay(3, { hospital }).patients);
    }
  });

  it("lets a plan set the places: one box fewer, a day with one box fewer", () => {
    const settings = pathwaySettingsOf({ hospital: "moyen", plan: oneBoxLess });
    assert.equal(settings.boxes, 11);
    const day = played(2, { hospital: "moyen", plan: oneBoxLess });
    assert.equal(day.capacity.boxes, 11);
    assert.equal(day.trace.slots.boxes.length, 11);
  });

  it("says in words what is wrong with a plan", () => {
    const noTriage = PATHWAY_PLANS.moyen.replace("T", ".");
    assert.match(planErrors(noTriage).join(" "), /« T » \(le tri\)/);
    // A box behind walls, below the plan: out of reach from the entrance.
    const shut = `${PATHWAY_PLANS.moyen}
###
#b#
###`;
    assert.match(planErrors(shut).join(" "), /hors d'atteinte depuis l'entrée, la première en colonne 2, ligne 9/);
    assert.match(planErrors("#####\n#E.b#\n#####").join(" "), /au moins un scanner/);
  });
});

/** The places taken by a patient while another still held them, from the day's moves: `["boxes:3 à 412"]`. */
function doubleBooked(day) {
  const holder = new Map();
  const where = new Map();
  const clashes = [];
  for (const { t, who, to } of day.trace.moves) {
    if (where.has(who)) holder.delete(where.get(who));
    where.delete(who);
    if (to.slot === undefined) continue;
    const key = `${to.at}:${to.slot}`;
    if (holder.has(key)) clashes.push(`${key} à ${t}`);
    holder.set(key, who);
    where.set(who, key);
  }
  return clashes;
}

describe("where everyone is, and the walks (src/pathway-trace.js, src/pathway-walk.js)", () => {
  it("never gives a place of the plan to two patients, and frees every one at the end", () => {
    for (const hospital of HOSPITAL_NAMES) {
      const day = played(4, { hospital, accident: true });
      assert.deepEqual(doubleBooked(day), [], hospital);
      const stillThere = [...day.patients.values()].filter((one) => one.exit === null).length;
      const held = Object.values(day.trace.slots).flat().filter((slot) => typeof slot === "number").length;
      assert.ok(held <= stillThere, `${hospital} : ${held} places tenues pour ${stillThere} patients encore là`);
    }
  });

  it("walks a cell every STEP minutes from where one was to where one goes, on cells one may walk", () => {
    const day = played(1, { hospital: "moyen" });
    const layout = pathwayPlanOf(day.settings.plan);
    const { walks } = walksOfDay(day, layout);
    for (const one of walks) {
      assert.ok(one.path.every((cell) => layout.passable(cell.x, cell.y)));
      one.path.slice(1).forEach((cell, i) => assert.equal(Math.abs(cell.x - one.path[i].x) + Math.abs(cell.y - one.path[i].y), 1));
      assert.equal(one.path.length - 1, Math.max(0, walkSteps(layout.walker, one.path[0], one.path.at(-1))));
    }
    // A patient arrives at the entrance, and is in the scene from then on.
    const arrived = walkScene(walksOfDay(day, layout), day.patients.get(1).arrival).find((one) => one.who === 1);
    assert.deepEqual({ x: arrived.x, y: arrived.y }, layout.points.entrance);
  });

  it("gives each transport the stretcher-bearer free nearest, never one on two transports at once", () => {
    const day = played(2, { hospital: "moyen", accident: true });
    const result = walksOfDay(day, pathwayPlanOf(day.settings.plan));
    assert.ok(result.transports.length > 0);
    for (const who of result.porters) {
      const own = result.walks.filter((one) => one.who === who);
      own.slice(1).forEach((one, i) => assert.ok(one.t0 >= own[i].t0 + (own[i].path.length - 1) * STEP - 1e-9, `${who} à ${one.t0}`));
    }
    // Without a stretcher-bearer, every transport goes without one.
    const none = walksOfDay(day, pathwayPlanOf(day.settings.plan), 0);
    assert.equal(walkMeasures(none).unported, none.transports.length);
  });

  it("counts the metres walked as the cells of the paths, and leaves the day's measures as they were", () => {
    const day = played(3, { hospital: "proximite" });
    const before = JSON.stringify(pathwayMeasures(day));
    const result = walksOfDay(day, pathwayPlanOf(day.settings.plan));
    const measures = walkMeasures(result);
    const cells = result.walks.filter((one) => one.role === "patient").reduce((sum, one) => sum + one.path.length - 1, 0);
    assert.equal(measures.byRole.patient.metres, cells * CELL_METRES);
    assert.ok(measures.byRole.doctor.metres > 0 && measures.byRole.porter.metres > 0);
    assert.equal(JSON.stringify(pathwayMeasures(day)), before);
    assert.ok(Object.keys(PLACES).every((pool) => Array.isArray(day.trace.slots[pool])));
  });
});
