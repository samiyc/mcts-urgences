import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HOSPITALS } from "../src/hypotheses.js";
import { PLANS, wardPlanOf } from "../src/plans.js";
import { candidatesOf } from "../src/simulate.js";
import { MOVES, STEP, playWardReplay, playerOf, runWard, startWard, stepWard, walkSteps, wardBenchmark, wardReplayOf, wardResult, wardScene } from "../src/ward.js";

const KEY_OF = Object.fromEntries(["z", "q", "s", "d"].map((key) => [MOVES[key].join(","), key]));

/** The key that walks the person one cell nearer `to`, or null there. */
function keyToward(ward, me, to) {
  const here = walkSteps(ward, me, to);
  if (here === 0) return null;
  for (const key of ["z", "q", "s", "d"]) {
    const [dx, dy] = MOVES[key];
    const next = { x: me.x + dx, y: me.y + dy };
    if (ward.layout.passable(next.x, next.y) && walkSteps(ward, next, to) === here - 1) return KEY_OF[MOVES[key].join(",")];
  }
  return null;
}

/** A doctor at the keyboard who walks to their patient's bed and presses E once the patient lies there. */
function diligentDoctor(ward) {
  const me = playerOf(ward);
  if (me.examining || me.patient === null) return null;
  const patient = ward.shift.patients.get(me.patient);
  const bed = ward.layout.beds[patient.box];
  return keyToward(ward, me, bed) ?? "e";
}

describe("the department on its plan (src/ward.js, Sami 23/10: the roadmap's step 3)", () => {
  it("has a plan for every hospital, with a bed for each box", () => {
    for (const [hospital, settings] of Object.entries(HOSPITALS)) {
      assert.ok(PLANS[hospital], hospital);
      const layout = wardPlanOf(hospital, { boxes: settings.boxes });
      assert.equal(layout.beds.length, settings.boxes);
      assert.ok(layout.seats.length > 0);
      assert.ok(layout.passable(layout.entrance.x, layout.entrance.y));
    }
    assert.throws(() => wardPlanOf("moyen", { boxes: 3 }), /12 lits pour 3 box/);
  });

  it("plays an ordinary shift with robots alone to its end, every patient seen, the same twice", () => {
    const settings = { hospital: "moyen", accident: false, seed: 2, nurse: "overdue", role: "aucun" };
    const ward = runWard(startWard(settings));
    const { patients, measures } = wardResult(ward);
    assert.equal(measures.unseen, 0);
    assert.ok(patients.every((patient) => patient.start !== null && patient.end >= patient.start));
    // The wait ends when the exam starts, after the walk to the bed.
    assert.ok(patients.every((patient) => patient.start >= patient.calledAt));
    assert.ok(measures.looks > 0);
    assert.deepEqual(wardResult(runWard(startWard(settings))).measures, measures);
    assert.deepEqual(wardBenchmark(settings), measures);
  });

  it("lets a doctor at the keyboard examine their patients, and replays the shift from the keys", () => {
    const ward = startWard({ hospital: "proximite", accident: false, seed: 3, role: "medecin" });
    let examined = 0;
    while (!ward.over) {
      const wasExamining = playerOf(ward).examining;
      stepWard(ward, diligentDoctor(ward));
      if (!wasExamining && playerOf(ward).examining) examined += 1;
    }
    assert.ok(examined > 3, `examens faits au clavier : ${examined}`);
    const { measures } = wardResult(ward);
    assert.equal(measures.unseen, 0);
    const again = playWardReplay(JSON.parse(JSON.stringify(wardReplayOf(ward))));
    assert.deepEqual(wardResult(again).measures, measures);
  });

  it("keeps a patient waiting while the doctor at the keyboard does not come, and counts them at the overtime", () => {
    const ward = runWard(startWard({ hospital: "proximite", accident: false, seed: 3, role: "medecin" }));
    const { measures } = wardResult(ward);
    assert.ok(measures.unseen > 0);
    assert.ok(measures.lateCostNow > wardBenchmark({ hospital: "proximite", accident: false, seed: 3, role: "medecin" }).lateCostNow);
  });

  it("swaps patients when the doctor at the keyboard examines a colleague's", () => {
    const ward = startWard({ hospital: "moyen", accident: true, seed: 1, role: "medecin" });
    const me = playerOf(ward);
    // Wait for a colleague's patient lying on a bed, the exam not started; then walk there and press E.
    let target = null;
    while (!target && !ward.over) {
      stepWard(ward);
      target = ward.doctors.find((one) => !one.human && one.patient !== null && !one.examining) ?? null;
    }
    const id = target.patient;
    const bed = ward.layout.beds[ward.shift.patients.get(id).box];
    // The person and the patient at the bed, the colleague still on the way: E there takes the patient.
    Object.assign(me, bed);
    Object.assign(ward.people.get(id), bed);
    Object.assign(target, ward.layout.entrance);
    const mine = me.patient;
    stepWard(ward, "e");
    assert.match(ward.message, /vous examinez le patient n° \d+/);
    // The colleague takes the person's patient (or nobody): as many doctors free as before.
    assert.equal(target.patient, mine);
    assert.equal(me.patient, id);
    assert.ok(me.examining);
    assert.ok(Math.abs(ward.shift.patients.get(id).start - ward.t * STEP) < 1e-9);
  });

  it("lets the nurse at the keyboard look again at a waiting patient due for it", () => {
    const ward = startWard({ hospital: "moyen", accident: true, seed: 1, role: "infirmier" });
    const me = playerOf(ward);
    assert.equal(me.kind, "nurse");
    let due = [];
    while (due.length === 0 && !ward.over) {
      stepWard(ward);
      due = candidatesOf(ward.shift).filter((patient) => {
        const at = ward.people.get(patient.id);
        return at.x === at.to?.x && at.y === at.to?.y;
      });
    }
    const patient = due[0];
    const seat = ward.people.get(patient.id);
    Object.assign(me, { x: seat.x, y: seat.y });
    stepWard(ward, "e");
    assert.equal(me.looking, patient.id);
    assert.ok(patient.assessing);
    assert.match(ward.message, /réévaluez/);
    const scene = wardScene(ward);
    assert.ok(scene.staff.some((one) => one.human && one.busy));
  });
});
