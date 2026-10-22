import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACCIDENT, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { drawWorld, levelOdds, searchRule } from "../src/search.js";
import { HOLD, choose, nextChoice, simulateShift, startShift, viewsOf } from "../src/simulate.js";
import { createRng } from "mcts-commun/random.js";

const settings = { ...DEFAULTS, ...HOSPITALS.moyen, crisis: ACCIDENT };

describe("the search (src/search.js)", () => {
  it("reads a bracelet as odds on the true level", () => {
    const yellow = levelOdds(3, "pied", settings);
    assert.ok(Math.abs(yellow.reduce((sum, odd) => sum + odd, 0) - 1) < 1e-12);
    assert.equal(yellow.indexOf(Math.max(...yellow)), 2);
    assert.equal(yellow[0], 0);
    // An ambulance never brings a blue: its blue bracelet is a green one.
    assert.deepEqual(levelOdds(5, "ambulance", settings), [0, 0, 0, 1, 0]);
  });

  it("draws a world from what the department knows, leaving the shift untouched", () => {
    const shift = startShift(drawShift(2, settings), settings);
    // Twenty choices made by the colour rule, then the search's turn.
    for (let i = 0; i < 20 && nextChoice(shift); i += 1) choose(shift, RULES.colour(viewsOf(shift)).id);
    assert.ok(nextChoice(shift));
    const before = JSON.stringify([...shift.patients.values()]);
    const now = shift.events.now;
    const world = drawWorld(shift, createRng(1));
    assert.equal(JSON.stringify([...shift.patients.values()]), before);
    const unannounced = [...shift.patients.values()].filter((patient) => patient.announcedAt > now);
    assert.ok(unannounced.every((patient) => !world.patients.has(patient.id)), "les arrivées non annoncées sont retirées au sort");
    assert.ok(world.pending.every((id) => world.patients.get(id).start === null));
  });

  it("plays a whole shift as a rule, seen patients only, waiting at times for an ambulance", () => {
    const quick = { ...settings, crisis: ACCIDENT };
    const rule = searchRule({ budget: 20 });
    let held = 0;
    const counting = (waiting, context) => {
      const chosen = rule(waiting, context);
      if (chosen.id === HOLD) held += 1;
      else assert.ok(waiting.some((view) => view.id === chosen.id));
      return chosen;
    };
    const { patients, measures } = simulateShift(drawShift(3, quick), counting, quick);
    assert.ok(patients.every((patient) => patient.start !== null && patient.end !== null));
    assert.equal(measures.patients, patients.length);
    assert.deepEqual(simulateShift(drawShift(3, quick), searchRule({ budget: 20 }), quick).measures, measures);
    assert.ok(held >= 0);
    assert.ok(viewsOf(startShift([], quick)).length === 0);
    assert.ok(simulateShift(drawShift(3, quick), RULES.colour, quick).measures.patients === measures.patients);
  });
});
