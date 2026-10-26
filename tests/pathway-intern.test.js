import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { atKeyboard, internBenchmarks, internMeasures, internReplayOf, internResult, minuteOf, playInternReplay, runInternGame, startInternGame, stepInternGame } from "../src/pathway-game.js";
import { INTERN } from "../src/pathway-hypotheses.js";
import { tasksHere, TASKS } from "../src/pathway-intern.js";
import { INTERN_RULES } from "../src/pathway-intern-decided.js";
import { BED_RULES, pathwayMeasures, runPathway, startPathway } from "../src/pathway.js";
import { pathwaySearchInternRule } from "../src/pathway-search.js";
import { RULES } from "../src/rules.js";
import { drawPathwayDay } from "../src/pathway-scenario.js";
import { walkSteps } from "../src/ward-moves.js";

/** A short game: the ordinary day, the keyboard from 10 h to 10 h 30. */
const SHORT = { accident: false, seed: 2, from: 120, to: 150 };
/** Steps the game until `test` holds or the day ends. */
const until = (game, test, key = () => null) => {
  while (!game.over && !test(game)) stepInternGame(game, key(game));
  return game;
};

describe("the intern (src/pathway-intern.js, src/pathway-game.js, step 3)", () => {
  it("follows non-urgent patients out of triage, never more than their number, and does every kind of task", () => {
    const game = runInternGame(startInternGame({ mode: "robot", seed: 1 }));
    const { intern } = game.day;
    assert.ok(intern.followed > INTERN.patients);
    const kinds = new Set(intern.done.map((task) => task.kind));
    for (const kind of Object.keys(TASKS)) assert.ok(kinds.has(kind), `jamais fait : ${kind}`);
    for (const task of intern.done) assert.ok(game.day.patients.get(task.id).arrivalLevel >= 1 && game.day.patients.get(task.id).colour <= 5);
    const measures = internMeasures(game.day);
    assert.equal(measures.open, 0);
    assert.ok(measures.metres > 0);
  });

  it("draws the medication needs apart: the day's patients are the same with or without an intern", () => {
    const strip = (patients) => patients.map(({ needs: { bio, scan, advice }, ...rest }) => ({ ...rest, needs: { bio, scan, advice } }));
    assert.deepEqual(strip(drawPathwayDay(3, { walk: true, intern: INTERN }).patients), strip(drawPathwayDay(3, { walk: true }).patients));
    assert.ok(drawPathwayDay(3, { walk: true, intern: INTERN }).patients.some((one) => one.needs.med));
  });

  it("lets the person play only in their shift, a robot before and after", () => {
    const game = until(startInternGame(SHORT), (one) => minuteOf(one) >= 125);
    assert.ok(atKeyboard(game));
    const before = { ...game.day.intern.cell };
    // Staying still at the keyboard: the intern does not move.
    for (let i = 0; i < 20; i += 1) stepInternGame(game);
    assert.deepEqual(game.day.intern.cell, before);
    until(game, (one) => minuteOf(one) >= 151);
    assert.equal(atKeyboard(game), false);
  });

  it("does the task where the intern stands when E is pressed, the most overdue first", () => {
    const game = until(startInternGame({ ...SHORT, to: 600 }), (one) => minuteOf(one) >= 120 && one.day.intern.tasks.length > 0);
    const { intern, trace } = game.day;
    // Walk to the place of the first task due, by the keys, then E.
    const [task] = [...intern.tasks].sort((a, b) => a.due - b.due);
    const keyToward = (one) => {
      if (tasksHere(one.day).includes(task)) return "e";
      const here = intern.cell;
      return ["z", "q", "s", "d"].find((key) => {
        const [dx, dy] = { z: [0, -1], q: [-1, 0], s: [0, 1], d: [1, 0] }[key];
        const next = { x: here.x + dx, y: here.y + dy };
        const target = trace.layout.points[{ tubes: "lab", pharmacy: "pharmacy", result: "room" }[task.kind]] ?? trace.where.get(task.id).cell;
        return trace.layout.passable(next.x, next.y) && walkSteps(trace.layout.walker, next, target) < walkSteps(trace.layout.walker, here, target);
      });
    };
    until(game, (one) => one.day.intern.done.some((done) => done.kind === task.kind && done.id === task.id), keyToward);
    assert.ok(game.inputs.length > 0);
    assert.match(game.message, /patient n°/);
  });

  it("replays a game from its keys, and reads it against the robot, the random intern and no intern", () => {
    const game = startInternGame(SHORT);
    const keys = ["d", "s", "e", "q", "z", null];
    runInternGame(until(game, (one) => minuteOf(one) >= 150, (one) => keys[one.steps % keys.length]));
    const again = playInternReplay(internReplayOf(game));
    assert.deepEqual(internMeasures(again.day), internMeasures(game.day));
    const benchmarks = internBenchmarks({ ...SHORT, seed: 2 });
    assert.deepEqual(Object.keys(benchmarks), ["robot", "random", "none"]);
    assert.equal(benchmarks.none.intern, null);
    assert.ok(benchmarks.robot.intern.done > 0);
  });
});

describe("the intern decided a task at a time (src/pathway-intern-decided.js, step 6)", () => {
  const decidedDay = (seed, intern, options = {}) => runPathway(startPathway(drawPathwayDay(seed, { hospital: "moyen", accident: true, walk: true, intern: INTERN, internDecided: true, ...options })), { box: RULES.colour, bed: BED_RULES.oldest, intern });

  it("asks which task to do, walks there for the walk's time, does every kind of task, and leaves none open", () => {
    const asked = [];
    const day = decidedDay(1, (candidates, context) => {
      asked.push({ t: context.now, candidates });
      return INTERN_RULES.dueFirst(candidates);
    });
    assert.ok(asked.length > 50);
    assert.ok(asked.every(({ candidates }) => candidates.every((one) => Number.isInteger(one.id) && one.steps >= 0)));
    const kinds = new Set(day.intern.done.map((task) => task.kind));
    for (const kind of Object.keys(TASKS)) assert.ok(kinds.has(kind), `jamais fait : ${kind}`);
    assert.equal(internMeasures(day).open, 0);
    assert.ok(internMeasures(day).metres > 0);
  });

  it("plays the step-by-step robot's day nearly: the same patients followed, the late cost close", () => {
    const decided = pathwayMeasures(decidedDay(1, INTERN_RULES.dueFirst));
    const stepped = internResult(runInternGame(startInternGame({ mode: "robot", seed: 1 }))).measures;
    assert.ok(Math.abs(decided.lateCostNow - stepped.lateCostNow) < 0.1 * stepped.lateCostNow, `${decided.lateCostNow} contre ${stepped.lateCostNow}`);
  });

  it("lets the search choose the intern's next task", () => {
    let seen = null;
    const search = pathwaySearchInternRule({ budget: 6 });
    decidedDay(2, (candidates, context) => {
      const chosen = candidates.length > 1 && !seen ? search(candidates, context) : INTERN_RULES.dueFirst(candidates);
      if (candidates.length > 1 && !seen) seen = { candidates, chosen };
      return chosen;
    }, { hospital: "proximite" });
    assert.ok(seen && seen.candidates.includes(seen.chosen));
  });
});
