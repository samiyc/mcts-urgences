import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ACCIDENT, DEFAULTS, HOSPITALS } from "../src/hypotheses.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { NURSE_RULES, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { searchRule } from "../src/search.js";
import { simulateShift } from "../src/simulate.js";
import { compareBreakRules } from "../src/pathway-fatigue-compare.js";
import { pathwaySearchRule } from "../src/pathway-search.js";
import { pathwaySearchHetRule } from "../src/pathway-search-rules.js";
import { HET_RULES } from "../src/pathway-het.js";
import { HET } from "../src/pathway-hypotheses.js";
import { internResult, runInternGame, startInternGame } from "../src/pathway-game.js";
import { runWard, startWard, wardResult } from "../src/ward.js";

/**
 * The behaviour of the models, held in a few hashes (Sami, 26/10/2026, before the code went under the lint budget):
 * a refactor must leave every one unchanged. A change meant to alter what a model does updates its hash here, and
 * its commit says so, with the measures before and after.
 */
const EXPECTED = {
  pathway: "fcc1ce236ad7e3c7",
  shift: "2268a5261e750c8b",
  ward: "57b01014292f8c4d",
  search: "2bc22fa5048d24e8",
  // The plans with two corridors (Sami, 29/10/2026) changed the walks: walked was a59f8ec32aa3b27f, intern 2f8e26fa3de22379;
  // then f19b3a4267ffd803 and 4bffbd3b9ea4eb49, before Sami drew the medium plan.
  walked: "f3a10e16877a81eb",
  intern: "83e223468a87eb43",
  fatigue: "9e82a932b8b806b1",
  pathwaySearch: "0bdc497e0fe40ebb",
  epidemic: "e79be809e5f092a1",
  het: "cd3d771f8c5c191b",
  additions: "c4eacd1c877524af",
};

const digest = (value) => createHash("sha256").update(JSON.stringify(value, (_, x) => (x instanceof Map ? [...x] : x))).digest("hex").slice(0, 16);
const HOSPITAL_NAMES = Object.keys(HOSPITALS);
const situations = () => HOSPITAL_NAMES.flatMap((hospital) => [false, true].map((accident) => ({ hospital, accident })));

/** A day played under `rules`: each patient's course and the day's measures. */
const played = (drawn, rules) => {
  const day = runPathway(startPathway(drawn), rules);
  return { patients: [...day.patients.values()], measures: pathwayMeasures(day) };
};

const FINGERPRINTS = {
  pathway: () =>
    situations().flatMap(({ hospital, accident }) =>
      [1, 2, 3, 4, 5].flatMap((seed) => {
        const drawn = drawPathwayDay(seed, { hospital, accident });
        const boxes = Object.values(RULES).map((box) => played(drawn, { box, bed: BED_RULES.oldest }));
        const beds = Object.values(BED_RULES).map((bed) => played(drawn, { box: RULES.colour, bed }));
        return [...boxes, ...beds];
      }),
    ),
  shift: () =>
    situations().flatMap(({ hospital, accident }) => {
      const settings = { ...DEFAULTS, ...HOSPITALS[hospital], ...(accident ? { crisis: ACCIDENT } : {}) };
      const nursed = { ...settings, nurses: 1 };
      return [1, 2, 3].flatMap((seed) => [
        ...Object.values(RULES).map((rule) => simulateShift(drawShift(seed, settings), rule, settings)),
        simulateShift(drawShift(seed, nursed), RULES.colour, nursed, NURSE_RULES.overdue),
      ]);
    }),
  // Walking counted (step 3, 26/10/2026): the same days, waiting for the walks and the stretcher-bearers.
  walked: () =>
    situations().flatMap(({ hospital, accident }) => [1, 2].map((seed) => played(drawPathwayDay(seed, { hospital, accident, walk: true }), { box: RULES.colour, bed: BED_RULES.oldest }))),
  // The intern (step 3): a robot and one at random, a day each.
  intern: () => ["robot", "random"].map((mode) => internResult(runInternGame(startInternGame({ mode, seed: 1 })))),
  // Fatigue and breaks (step 4): every rule, both teams, 3 days with the accident.
  fatigue: () => compareBreakRules({ days: 3, accident: true }),
  // The search on the pathway (step 6): a day of the small hospital with the accident, 10 iterations.
  pathwaySearch: () => played(drawPathwayDay(2, { hospital: "proximite", accident: true }), { box: pathwaySearchRule({ budget: 10 }), bed: BED_RULES.oldest }),
  // The winter epidemic (26/10/2026): a day of each hospital at its peak by the colour, and the search on one.
  epidemic: () => [
    ...HOSPITAL_NAMES.flatMap((hospital) => [1, 2].map((seed) => played(drawPathwayDay(seed, { hospital, epidemic: true }), { box: RULES.colour, bed: BED_RULES.oldest }))),
    played(drawPathwayDay(3, { hospital: "proximite", epidemic: true }), { box: pathwaySearchRule({ budget: 10 }), bed: BED_RULES.oldest }),
  ],
  // The hospital in tension (26/10/2026): at the threshold, two days of the epidemic, and the search on one.
  het: () => [
    ...[1, 2].map((seed) => played(drawPathwayDay(seed, { epidemic: true, het: HET }), { box: RULES.colour, bed: BED_RULES.oldest, het: HET_RULES.threshold })),
    played(drawPathwayDay(3, { hospital: "proximite", epidemic: true, het: HET }), { box: RULES.colour, bed: BED_RULES.oldest, het: pathwaySearchHetRule({ budget: 10 }) }),
  ],
  // The later additions (26/10/2026): each on, two days of the medium hospital by the colour; the search with the
  // deaths and the fast track on a day of the small hospital with the accident.
  additions: () => [
    ...["family", "interpreter", "fastTrack", "deaths"].flatMap((name) => [1, 2].map((seed) => played(drawPathwayDay(seed, { [name]: true, interpreter: name === "family" || name === "interpreter" }), { box: RULES.colour, bed: BED_RULES.oldest }))),
    played(drawPathwayDay(2, { hospital: "proximite", accident: true, deaths: true, fastTrack: true }), { box: pathwaySearchRule({ budget: 10 }), bed: BED_RULES.oldest }),
  ],
  ward: () => ["aucun", "medecin", "infirmier"].map((role) => wardResult(runWard(startWard({ seed: 2, role, nurse: "round" })))),
  search: () => {
    const settings = { ...DEFAULTS, ...HOSPITALS.moyen, crisis: ACCIDENT };
    return simulateShift(drawShift(1, settings), searchRule({ budget: 50, measure: "now" }), settings).measures;
  },
};

describe("the fingerprints of the models (a refactor changes none)", () => {
  for (const [name, compute] of Object.entries(FINGERPRINTS)) {
    it(`keeps the ${name} unchanged`, () => {
      assert.equal(digest(compute()), EXPECTED[name], `${name} : le comportement a changé`);
    });
  }
});
