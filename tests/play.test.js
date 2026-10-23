import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../src/rules.js";
import { HOLD } from "../src/simulate.js";
import { benchmarksOf, gapsOf, play, playReplay, replayOf, resultOf, startGame, suggestion, waitingOf } from "../src/play.js";

describe("a shift played by a person (src/play.js, Sami 23/10)", () => {
  it("stops at every box choice, takes the person's pick or a wait, and replays the same shift from its choices", () => {
    const game = startGame({ hospital: "moyen", accident: true, seed: 2 });
    assert.equal(game.over, false);
    let held = false;
    while (!game.over) {
      const waiting = waitingOf(game);
      assert.ok(waiting.length > 0, "un choix a toujours quelqu'un en salle d'attente");
      // Once, wait instead of taking someone in.
      if (!held && game.choices.length === 3) {
        held = true;
        play(game, HOLD);
      } else play(game, RULES.colour(waiting).id);
    }
    assert.ok(game.choices.includes(HOLD));
    const replay = JSON.parse(JSON.stringify(replayOf(game)));
    const again = playReplay(replay);
    assert.deepEqual(resultOf(again).measures, resultOf(game).measures);
  });

  it("plays the colour rule's shift when the person follows it", () => {
    const game = startGame({ hospital: "proximite", accident: false, seed: 3 });
    while (!game.over) play(game, RULES.colour(waitingOf(game)).id);
    assert.equal(resultOf(game).measures.lateCostNow, benchmarksOf(game).colour.lateCostNow);
  });

  it("suggests a waiting patient (or a wait) as the assistant, and finds the gaps of each choice with hindsight", () => {
    const game = startGame({ hospital: "proximite", accident: false, seed: 4 });
    const suggested = suggestion(game);
    assert.ok(suggested === HOLD || waitingOf(game).some((view) => view.id === suggested));
    for (let i = 0; i < 6 && !game.over; i += 1) play(game, RULES.arrival(waitingOf(game)).id);
    while (!game.over) play(game, RULES.deadline(waitingOf(game)).id);
    const { choices, agreed, withAssistant } = gapsOf(replayOf(game));
    assert.equal(choices.length, game.choices.length);
    for (const choice of choices) {
      assert.ok(choice.gap >= 0);
      assert.ok(choice.options.some((option) => option.id === choice.best));
    }
    assert.ok(agreed <= choices.length && withAssistant <= choices.length);
  });
});
