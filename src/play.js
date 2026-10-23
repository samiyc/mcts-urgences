import { ACCIDENT, DEFAULTS, HOSPITALS } from "./hypotheses.js";
import { NURSE_RULES, RULES } from "./rules.js";
import { drawShift } from "./scenario.js";
import { searchRule } from "./search.js";
import { HOLD, act, choose, cloneShift, courseOf, hold, measuresOf, nextChoice, simulateShift, startShift, viewsOf } from "./simulate.js";

/**
 * A shift played by a person (Sami, 23/10/2026, the roadmap's step 2: replays with a human to analyse the gaps). At
 * each box choice the person picks who goes in (or waits); the triage nurse keeps its rule. Two ways to play:
 * alone, or helped by the assistant, which shows the search's pick. A shift is deterministic once its hospital,
 * its seed and the nurse rule are known: a replay keeps those and the choices, in order.
 * `{ format, hospital, accident, seed, nurse, mode, choices: [id | "attendre"], savedAt }`.
 */
export const REPLAY_FORMAT = "urgences-replay/1";
export const MODES = Object.freeze({ seul: "seul", aide: "aidé par l'assistant" });
/** The assistant: the search scored at the level of the moment, its best version (docs/modele.md, 22/10). */
export const assistantRule = () => searchRule({ measure: "now" });

export const settingsOf = ({ hospital, accident, nurse }) => ({ ...DEFAULTS, ...HOSPITALS[hospital], ...(accident ? { crisis: ACCIDENT } : {}), nurses: nurse && nurse !== "none" ? 1 : 0 });
const nurseRuleOf = (name) => (name === "search" ? searchRule() : (NURSE_RULES[name] ?? null));

/** A new game: the shift drawn from `seed`, run to the first box choice. */
export function startGame({ hospital = "moyen", accident = true, seed = 1, nurse = "none", mode = "seul" } = {}) {
  const settings = settingsOf({ hospital, accident, nurse });
  const patients = drawShift(seed, settings);
  const game = { hospital, accident, seed, nurse, mode, settings, patients, shift: startShift(patients, settings), choices: [], over: false };
  advance(game);
  return game;
}

/** Runs `game` to its next box choice, the nurse's choices made by its rule; `game.over` at the end. */
export function advance(game) {
  for (let kind = nextChoice(game.shift); kind; kind = nextChoice(game.shift)) {
    if (kind === "box") return game;
    act(game.shift, kind, null, nurseRuleOf(game.nurse));
  }
  game.over = true;
  return game;
}

/** The waiting room as the person sees it at a box choice: colour, arrival, source, last look. */
export const waitingOf = (game) => viewsOf(game.shift);

/** The assistant's pick at this choice: a patient's id, or "attendre". */
export function suggestion(game) {
  const { shift } = game;
  const picked = assistantRule()(viewsOf(shift), { now: shift.events.now, freeBoxes: shift.boxIds.length, freeDoctors: shift.freeDoctors, shift, kind: "box" });
  return picked?.id ?? null;
}

/** The person takes patient `id` in (or "attendre"), and the shift runs to the next choice. */
export function play(game, id) {
  if (game.over) throw new Error("la garde est finie");
  game.choices.push(id);
  if (id === HOLD) hold(game.shift);
  else choose(game.shift, id);
  return advance(game);
}

/** A finished game's course and measures. */
export function resultOf(game) {
  const course = courseOf(game.shift);
  return { patients: course, measures: measuresOf(course, game.shift) };
}

export const replayOf = (game) => ({ format: REPLAY_FORMAT, hospital: game.hospital, accident: game.accident, seed: game.seed, nurse: game.nurse, mode: game.mode, choices: [...game.choices], savedAt: new Date().toISOString() });

/**
 * Plays `replay` again; `onChoice({ index, before, chosen })` sees the shift just before each choice (a copy the
 * caller may play forward). Returns the finished game.
 */
export function playReplay(replay, { onChoice = null } = {}) {
  if (replay.format !== REPLAY_FORMAT) throw new Error(`format de replay inconnu : ${replay.format}`);
  const game = startGame(replay);
  replay.choices.forEach((chosen, index) => {
    if (game.over) return;
    if (onChoice) onChoice({ index, before: cloneShift(game.shift), chosen, game });
    play(game, chosen);
  });
  return game;
}

/**
 * The gaps of a played shift, with hindsight: at each choice, every patient who could have gone in is tried from the
 * shift just before (that patient in, then the rest of the shift under `rule`, the earliest deadline by default, the
 * nurse under its rule, the real patients to come). Each choice is worth the shift's late cost at the level of the
 * moment (`lateCostNow`; lower is better); the person's own the same way, so the gap is only the choice's. The
 * assistant's pick at each choice is kept too, for how often person and assistant agree. A nurse played by the search
 * is played in those rollouts by the rule of the most overdue (Sami's replays, 23/10: with the search re-deciding every
 * look, the analysis of one shift ran for hours); the shift itself is replayed with its own nurse.
 * `{ choices: [{ index, now, chosen, best, gap, assistant, options: [{ id, colour, cost }] }], agreed, withAssistant, gap }`.
 */
export function gapsOf(replay, { rule = RULES.deadline, assistant = true } = {}) {
  const choices = [];
  const nurseRule = replay.nurse === "search" ? NURSE_RULES.overdue : nurseRuleOf(replay.nurse);
  const costAfter = (before, id) => {
    const shift = cloneShift(before);
    if (id === HOLD) hold(shift);
    else choose(shift, id);
    for (let kind = nextChoice(shift); kind; kind = nextChoice(shift)) act(shift, kind, rule, nurseRule);
    return measuresOf(courseOf(shift), shift).lateCostNow;
  };
  playReplay(replay, {
    onChoice: ({ index, before, chosen, game }) => {
      const options = viewsOf(before).map((view) => ({ id: view.id, colour: view.colour, cost: costAfter(before, view.id) }));
      const best = options.reduce((top, option) => (option.cost < top.cost ? option : top));
      const mine = options.find((option) => option.id === chosen) ?? { id: chosen, cost: costAfter(before, chosen) };
      choices.push({ index, now: before.events.now, chosen, best: best.id, gap: mine.cost - best.cost, assistant: assistant ? suggestion(game) : null, options });
    },
  });
  return {
    choices,
    agreed: choices.filter((choice) => choice.gap <= 0).length,
    withAssistant: choices.filter((choice) => choice.assistant === choice.chosen).length,
    gap: choices.reduce((sum, choice) => sum + choice.gap, 0),
  };
}

/** The same shift under the rules and under the assistant alone, for the person's result to be read against. */
export function benchmarksOf(game) {
  const nurseRule = nurseRuleOf(game.nurse);
  const run = (rule) => simulateShift(game.patients, rule, game.settings, nurseRule).measures;
  return { colour: run(RULES.colour), deadline: run(RULES.deadline), assistant: run(assistantRule()) };
}
