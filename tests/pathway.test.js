import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BED_RULES, decide, nextDecision, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { pathwaySettingsOf } from "../src/pathway-hypotheses.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { RULES } from "../src/rules.js";

const RULESET = { box: RULES.colour, bed: BED_RULES.oldest };
const EXITS = ["domicile", "hospitalise", "bloc", "transfert", "parti", "reoriente"];
const NO_NEEDS = { bio: false, scan: false, advice: false };

/** A patient made by hand: no spread, never worse, no exam, going home, patient forever. */
const patient = (id, arrival, level, extra = {}) => ({
  id, arrival, source: "pied", announcedAt: arrival, level, colour: level, examFactor: 1, stayFactor: 1, worsenDelays: [],
  needs: NO_NEEDS, orientation: "home", ward: "medecine", thenWard: false, isolate: false, elderly: false, patience: Infinity,
  labFactor: 1, uhcdFactor: 1, theatreFactor: 1, ...extra,
});
/** A day made by hand: one box, one doctor all day, no SAUV, no UHCD, the beds given. */
const dayOf = (patients, { beds = {}, capacity = {}, wards = {}, ...overrides } = {}) => {
  const settings = pathwaySettingsOf({ boxes: 1, doctors: 1, dayDoctors: { from: 10, to: 22, extra: 0 }, ...overrides });
  settings.capacity = { ...settings.capacity, sauv: 0, uhcd: 0, isolation: 0, ...capacity };
  settings.wards = { medecine: { free: 0, perDay: 0 }, ...wards };
  return { settings, patients, beds };
};

describe("the detailed pathway (src/pathway*.js)", () => {
  it("draws the same day from the same seed, with each patient's hidden pathway and the beds the wards free", () => {
    assert.deepEqual(drawPathwayDay(4), drawPathwayDay(4));
    const { patients, beds, settings } = drawPathwayDay(4);
    assert.ok(patients.every((one) => one.arrival >= 0 && one.arrival < settings.shift));
    assert.ok(patients.every((one) => ["home", "uhcd", "ward", "theatre", "transfer"].includes(one.orientation) && typeof one.needs.bio === "boolean"));
    assert.ok(Object.keys(settings.wards).every((ward) => beds[ward].every((at) => at > 0)));
    // More come in the afternoon than at night.
    const at = (from, to) => patients.filter((one) => one.arrival >= (from - 8) * 60 && one.arrival < (to - 8) * 60).length;
    assert.ok(at(12, 16) > at(26, 30), `${at(12, 16)} l'après-midi, ${at(26, 30)} la nuit`);
  });

  it("sees every patient out by one of the exits, and never fills a place beyond its capacity", () => {
    for (const hospital of ["proximite", "moyen", "chu"]) {
      for (let seed = 1; seed <= 6; seed += 1) {
        // A place taken beyond its capacity throws (pathway.js, take).
        const day = runPathway(startPathway(drawPathwayDay(seed, { hospital, accident: seed % 2 === 0 })), RULESET);
        const measures = pathwayMeasures(day);
        assert.equal(measures.exits.encore + EXITS.reduce((sum, exit) => sum + measures.exits[exit], 0), measures.patients);
        // The small hospital has few beds: after an accident, a few still wait for one when the overtime ends.
        assert.ok(measures.exits.encore <= 0.1 * measures.patients, `${hospital} ${seed} : ${measures.exits.encore} encore là`);
        assert.ok([...day.patients.values()].every((one) => one.exit === null || EXITS.includes(one.exit)));
      }
    }
  });

  it("walks a patient through the exams: the sample and the lab, the scanner, the advice, then a doctor reads them", () => {
    const settings = pathwaySettingsOf({});
    const day = runPathway(startPathway(dayOf([patient(1, 0, 3, { source: "ambulance", needs: { bio: true, scan: true, advice: true } })])), RULESET);
    const one = day.patients.get(1);
    assert.equal(one.exit, "domicile");
    const examEnd = one.start + settings.exam[3];
    // The slowest of the three: the sample and the lab (10 + 70), the scanner (20), the specialist (45 + 20).
    assert.equal(one.reviewedAt, examEnd + Math.max(settings.sample + settings.labTurnaround, settings.scan, settings.adviceDelay + settings.advice) + settings.review);
    assert.equal(one.exitAt, one.reviewedAt + settings.care[3]);
  });

  it("keeps the box of a patient waiting for a bed (boarding): the next one waits until the bed comes", () => {
    const admitted = patient(1, 0, 3, { orientation: "ward" });
    const next = patient(2, 1, 3);
    const day = runPathway(startPathway(dayOf([admitted, next], { beds: { medecine: [300] } })), RULESET);
    const settings = pathwaySettingsOf({});
    const careEnd = settings.register + settings.triage + settings.exam[3] + settings.care[3];
    assert.equal(day.patients.get(1).admitAt, careEnd);
    assert.equal(day.patients.get(1).exit, "hospitalise");
    // The bed freed at 300, the patient gone 25 min later, the box cleaned 10 min more: then the second one goes in.
    assert.equal(day.patients.get(2).start, 300 + settings.toBed + settings.clean);
    const measures = pathwayMeasures(day);
    assert.equal(measures.boarding.max, 300 + settings.toBed - careEnd);
    // In the box until the bed is found; the walk to it is the departure.
    assert.equal(measures.boarding.inBox, 300 - careEnd);
  });

  it("frees the box when a UHCD bed is free for the boarder", () => {
    const day = runPathway(startPathway(dayOf([patient(1, 0, 3, { orientation: "ward" }), patient(2, 1, 3)], { beds: { medecine: [300] }, capacity: { uhcd: 1 } })), RULESET);
    const settings = pathwaySettingsOf({});
    assert.equal(day.patients.get(2).start, settings.register + settings.triage + settings.exam[3] + settings.care[3] + settings.clean);
    assert.equal(pathwayMeasures(day).boarding.inBox, 0);
  });

  it("leaves the place empty when a resource is missing: no ward bed, the patient is still there at the end", () => {
    const day = runPathway(startPathway(dayOf([patient(1, 0, 3, { orientation: "ward" })])), RULESET);
    assert.equal(day.patients.get(1).exit, null);
    assert.equal(pathwayMeasures(day).exits.encore, 1);
  });

  it("lets a green leave when the wait outlasts their patience, and sends ambulances elsewhere when the waiting room is full", () => {
    const busy = patient(1, 0, 4);
    const leaving = patient(2, 1, 4, { patience: 5 });
    const day = runPathway(startPathway(dayOf([busy, leaving])), RULESET);
    assert.equal(day.patients.get(2).exit, "parti");
    // Triaged after the first one (one IOA), at register + 2 triages, then 5 min of patience.
    const { register, triage } = pathwaySettingsOf({});
    assert.equal(day.patients.get(2).exitAt, register + 2 * triage + 5);
    const crowd = Array.from({ length: 4 }, (_, i) => patient(i + 1, i, 4));
    // Announced at 45: the first one has left, the second is in the box, two wait.
    const ambulance = patient(5, 60, 3, { source: "ambulance", announcedAt: 45 });
    const diverted = runPathway(startPathway(dayOf([...crowd, ambulance], { divertAt: 2 })), RULESET);
    assert.equal(diverted.patients.get(5).exit, "reoriente");
    assert.equal(pathwayMeasures(diverted).exits.reoriente, 1);
  });

  it("gives a freed bed by the bed rule: the oldest decision, or the patient of 75 or more", () => {
    const first = patient(1, 0, 3, { orientation: "ward" });
    const second = patient(2, 0, 3, { orientation: "ward", elderly: true });
    const twoBoxes = { boxes: 2, doctors: 2, beds: { medecine: [500, 900] } };
    const order = (bed) => {
      const day = runPathway(startPathway(dayOf([first, second], twoBoxes)), { box: RULES.arrival, bed });
      return [1, 2].sort((a, b) => day.patients.get(a).bedAt - day.patients.get(b).bedAt);
    };
    assert.deepEqual(order(BED_RULES.oldest), [1, 2]);
    assert.deepEqual(order(BED_RULES.elderly), [2, 1]);
  });

  it("asks for the box choice only among patients a place is free for, and refuses another", () => {
    // The blue one takes the box first; the other two wait for it together.
    const day = startPathway(dayOf([patient(3, 0, 5), patient(1, 1, 4), patient(2, 2, 2)]));
    decide(day, nextDecision(day), 3);
    const decision = nextDecision(day);
    assert.equal(decision.kind, "box");
    assert.deepEqual(decision.candidates.map((one) => one.id).sort(), [1, 2]);
    assert.equal(decision.candidates[0].level, undefined, "a rule never sees the true level");
    decide(day, decision, 2);
    assert.throws(() => decide(day, decision, 1));
  });

  it("measures the peaks and maxima", () => {
    const day = runPathway(startPathway(dayOf([patient(1, 0, 4), patient(2, 0, 4), patient(3, 0, 4)])), RULESET);
    const measures = pathwayMeasures(day);
    const settings = pathwaySettingsOf({});
    // At 0, one registers and two queue: a patient being served is no longer waiting.
    assert.equal(measures.peak.waiting, 2);
    // Each one holds the box for the exam and the care, then it is cleaned: the third waits for two of them.
    const turn = settings.exam[4] + settings.care[4] + settings.clean;
    const firstIn = settings.register + settings.triage;
    assert.equal(day.patients.get(3).start, firstIn + 2 * turn);
    assert.equal(measures.maxWait[4], firstIn + 2 * turn);
    assert.equal(measures.stay.within4h, 1);
    assert.equal(measures.exits.domicile, 3);
  });
});
