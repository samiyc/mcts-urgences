import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BED_RULES, decide, nextDecision, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { deathChance } from "../src/pathway-deaths.js";
import { DEATHS, FAMILY, FAST_TRACK, INTERPRETER } from "../src/pathway-hypotheses.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULES } from "../src/rules.js";

const rules = { box: RULES.deadline, bed: BED_RULES.oldest };
const played = (seed, options = {}) => runPathway(startPathway(drawPathwayDay(seed, options)), rules);
const days = (count, options) => Array.from({ length: count }, (_, i) => drawPathwayDay(1 + i, options));
const exitTimes = (day) => [...day.patients.values()].map((patient) => patient.exitAt);

describe("the later additions (docs/parcours-ajouts.md)", () => {
  it("leave the day as it was while they are off, and draw their parts apart", () => {
    const plain = played(4);
    for (const name of ["family", "interpreter", "fastTrack", "deaths"]) assert.equal(plain[name === "fastTrack" ? "fast" : name], null);
    // Each part drawn from its own seed: the deaths' rolls are the same with the families on.
    const deaths = drawPathwayDay(4, { deaths: true }).patients.map((patient) => patient.deathRoll);
    assert.deepEqual(drawPathwayDay(4, { deaths: true, family: true }).patients.map((patient) => patient.deathRoll), deaths);
  });

  it("the families: more of the elderly accompanied, the doctor told, companions in the waiting room", () => {
    const drawn = days(40, { family: true }).flatMap((day) => day.patients);
    const share = (list) => list.filter((patient) => patient.accompanied).length / list.length;
    assert.ok(Math.abs(share(drawn.filter((patient) => patient.elderly)) - FAMILY.share.elderly) < 0.08);
    assert.ok(Math.abs(share(drawn.filter((patient) => !patient.elderly)) - FAMILY.share.other) < 0.05);
    const day = played(2, { family: true });
    assert.equal(day.family.accompanied, [...day.patients.values()].filter((patient) => patient.accompanied && patient.exit !== "reoriente").length);
    assert.ok(day.family.informed > 0 && day.family.informed % FAMILY.inform === 0);
    assert.ok(day.trace.moves.some((move) => move.who === "family:" + [...day.patients.values()].find((patient) => patient.accompanied).id));
  });

  it("the interpreter: a call when nobody translates, none when a companion does", () => {
    const alone = days(60, { interpreter: true }).map((drawn) => runPathway(startPathway(drawn), rules));
    const allophones = alone.reduce((sum, day) => sum + day.interpreter.allophones, 0);
    assert.ok(allophones > 0);
    assert.ok(Math.abs(allophones / alone.reduce((sum, day) => sum + day.patients.size, 0) - INTERPRETER.share) < 0.01);
    assert.ok(alone.every((day) => day.interpreter.waited === day.interpreter.calls * INTERPRETER.connect));
    const helped = days(60, { interpreter: true, family: true }).map((drawn) => runPathway(startPathway(drawn), rules));
    assert.ok(helped.reduce((sum, day) => sum + day.interpreter.calls, 0) < alone.reduce((sum, day) => sum + day.interpreter.calls, 0));
  });

  it("the fast track: light walk-ins by day, a doctor taken from the team and given back", () => {
    const day = startPathway(drawPathwayDay(3, { fastTrack: true }));
    const doctors = [];
    for (let decision = nextDecision(day); decision; decision = nextDecision(day)) {
      doctors.push({ t: day.events.now, team: day.capacity.doctors, fast: day.capacity.fastDoctors });
      decide(day, decision, Number(rules[decision.kind === "box" ? "box" : "bed"](decision.candidates, { now: day.events.now, day }).id));
    }
    const fast = [...day.patients.values()].filter((patient) => patient.fastTrack);
    assert.equal(fast.length, day.fast.seen);
    assert.ok(fast.length > 0 && fast.every((patient) => patient.source === "pied" && patient.colour >= FAST_TRACK.fromColour));
    const hour = (t) => (8 + t / 60) % 24;
    assert.ok(fast.every((patient) => hour(patient.start) >= FAST_TRACK.from && hour(patient.start) < FAST_TRACK.to));
    assert.ok(doctors.filter((one) => hour(one.t) < FAST_TRACK.from || hour(one.t) >= FAST_TRACK.to).every((one) => one.fast === 0));
  });

  it("the deaths: about 0,2 % of the visits, rarer for a light patient, the place held, counted at their weight", () => {
    assert.ok(deathChance({ deaths: DEATHS }, 1, 600) > deathChance({ deaths: DEATHS }, 1, 0));
    assert.equal(deathChance({ deaths: DEATHS }, 4, 600), 0);
    const all = days(60, { deaths: true }).map((drawn) => runPathway(startPathway(drawn), rules));
    const deaths = all.reduce((sum, day) => sum + day.deaths.count, 0);
    const visits = all.reduce((sum, day) => sum + day.patients.size, 0);
    assert.ok(deaths / visits > 0.0008 && deaths / visits < 0.005, `${deaths} sur ${visits}`);
    const day = all.find((one) => one.deaths.count > 0);
    const dead = [...day.patients.values()].find((patient) => patient.exit === "deces");
    assert.ok(Math.abs(dead.exitAt - dead.diedAt - (DEATHS.resus + DEATHS.after)) < 1e-6);
    const measures = pathwayMeasures(day);
    assert.equal(measures.lateCostNow, measures.lateCostOnly + day.deaths.count * DEATHS.cost);
    assert.notDeepEqual(exitTimes(day), exitTimes(played(1 + all.indexOf(day))));
  });
});
