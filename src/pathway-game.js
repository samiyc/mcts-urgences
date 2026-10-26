import { createRng } from "mcts-commun/random.js";
import { CELL_METRES, INTERN } from "./pathway-hypotheses.js";
import { busy, moveIntern, tasksHere, targetsOf, useHere } from "./pathway-intern.js";
import { BED_RULES, pathwayMeasures, runPathway, runUntil, startPathway } from "./pathway.js";
import { drawPathwayDay } from "./pathway-scenario.js";
import { walkScene, walksOfDay } from "./pathway-walk.js";
import { RULES } from "./rules.js";
import { MOVES } from "./ward-keys.js";
import { STEP, walk, walkSteps } from "./ward-moves.js";

/**
 * The intern played (Sami, 26/10/2026, docs/recherche/feuille-de-route.md, step 3): a day of the detailed pathway with
 * walking counted, played a step of the plan at a time (`STEP` minutes). In its shift (`from` to `to`, minutes from
 * the day's start), a person plays the intern at the keyboard (Z Q S D or the arrows to walk, E to do the task where
 * they stand); outside it, and in the other modes, the intern is a robot (the task due first, the nearest place) or
 * plays at random among their tasks: a simulated person, for hundreds of days. Who goes into a box and who takes a
 * bed stay the rules'. Deterministic from its settings and the keys pressed, each with its step.
 */
export const INTERN_FORMAT = "urgences-interne/1";
export const INTERN_MODES = Object.freeze({ human: "vous, au clavier", robot: "un interne robot", random: "un interne au hasard", none: "pas d'interne" });

/**
 * A game's settings by default: the medium hospital, the accident, the shift at the keyboard from 10 h to 14 h.
 * @type {Readonly<{ hospital: string, accident: boolean, seed: number, box: string, bed: string, plan: string | null, mode: string, from: number, to: number }>}
 */
const GAME =Object.freeze({ hospital: "moyen", accident: true, seed: 1, box: "colour", bed: "oldest", plan: null, mode: "human", from: 120, to: 360 });
const given = (options) => Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));

/** A new game at the day's start. `mode`: INTERN_MODES; `from`, `to`: the shift played at the keyboard. */
export function startInternGame(options = {}) {
  const settings = { ...GAME, ...given(options) };
  const { hospital, accident, seed, plan, mode } = settings;
  const drawn = drawPathwayDay(seed, { hospital, accident, walk: true, intern: mode === "none" ? null : INTERN, ...(plan ? { plan } : {}) });
  return {
    settings: Object.fromEntries(Object.keys(GAME).map((key) => [key, settings[key]])),
    day: startPathway(drawn),
    rules: { box: RULES[settings.box], bed: BED_RULES[settings.bed] },
    rng: createRng((Math.imul(seed, 40503) + 977) >>> 0),
    steps: 0,
    inputs: [],
    picked: null,
    message: "",
    over: false,
  };
}

export const minuteOf = (game) => game.steps * STEP;
/** Whether the person plays the intern at this step. */
export const atKeyboard = (game) => game.settings.mode === "human" && minuteOf(game) >= game.settings.from && minuteOf(game) < game.settings.to;

/** The intern's next cell toward the nearest of `cells`. */
function towards(day, cells) {
  const { walker } = day.trace.layout;
  const me = day.intern.cell;
  const reachable = cells.filter((cell) => walkSteps(walker, me, cell) >= 0);
  if (!reachable.length) return;
  const target = reachable.reduce((best, cell) => (walkSteps(walker, me, cell) < walkSteps(walker, me, best) ? cell : best));
  const unit = { x: me.x, y: me.y, to: target };
  walk(walker, unit);
  moveIntern(day, [unit.x - me.x, unit.y - me.y]);
}

/** The task the intern goes to: the patient who follows them to the scanner first, else `choose` among the others. */
function taskFor(game, choose) {
  const { intern } = game.day;
  if (intern.following !== null) return intern.tasks.find((task) => task.kind === "scanDrop" && task.id === intern.following);
  return choose(intern.tasks.filter((task) => task.kind !== "scanDrop"));
}

const dueFirst = (tasks) => [...tasks].sort((a, b) => a.due - b.due)[0];

/** A random task among the open ones, kept until it is done or gone. */
function atRandom(game) {
  return (tasks) => {
    if (!tasks.includes(game.picked)) game.picked = tasks.length ? tasks[game.rng.int(tasks.length)] : null;
    return game.picked;
  };
}

/** A robot's step (or a random one's): the task where they stand if any, else a cell toward the one they go to. */
function robotStep(game) {
  const { day } = game;
  if (busy(day)) return;
  const task = taskFor(game, game.settings.mode === "random" ? atRandom(game) : dueFirst);
  if (task && tasksHere(day).includes(task)) useHere(day);
  else if (task) towards(day, targetsOf(day, task));
}

/** The key the person pressed at this step: a move, or E. Returns what the page says, or null. */
function pressKey(game, key) {
  const { day } = game;
  if (key === "e") return useHere(day);
  const move = MOVES[key];
  if (!move) return null;
  return busy(day) ? "Occupé : la tâche en cours n'est pas finie." : (moveIntern(day, move), null);
}

/** One step: the day to its minute (the rules choose), then the intern (the key, or the robot), their cell kept. */
export function stepInternGame(game, key = null) {
  if (game.over) return game;
  game.steps += 1;
  const { day } = game;
  runUntil(day, minuteOf(game), game.rules);
  if (day.intern && !day.over) {
    if (!atKeyboard(game)) robotStep(game);
    else if (key) {
      game.inputs.push({ step: game.steps, key });
      game.message = pressKey(game, key) ?? game.message;
    }
    day.intern.track.push({ ...day.intern.cell });
  }
  game.over = day.over;
  return game;
}

/** Plays the game to its end without a key (the robot, or a person who stays still). */
export function runInternGame(game) {
  if (!game.day.intern) {
    runPathway(game.day, game.rules);
    game.over = true;
  }
  while (!game.over) stepInternGame(game);
  return game;
}

/** What the intern did: tasks done and how late, still open, dropped (their patient gone), colours changed, metres. */
export function internMeasures(day) {
  const { done, tasks, dropped, recoloured, track, followed } = day.intern;
  const late = done.map((task) => Math.max(0, task.at - task.due));
  const moves = track.filter((cell, i) => i > 0 && (cell.x !== track[i - 1].x || cell.y !== track[i - 1].y)).length;
  return {
    followed,
    done: done.length,
    late: late.filter((minutes) => minutes > 0).length,
    lateness: { mean: late.length ? late.reduce((sum, minutes) => sum + minutes, 0) / late.length : 0, max: Math.max(0, ...late) },
    open: tasks.length,
    dropped,
    recoloured,
    metres: moves * CELL_METRES,
  };
}

/**
 * Where each one is at the game's minute (pathway-walk.js's `walkScene`), the patient who follows the intern where
 * the intern is; the intern marked `human` while the person plays.
 */
export function gameScene(game) {
  const { day } = game;
  const t = minuteOf(game);
  const { following, cell } = day.intern ?? {};
  return walkScene(walksOfDay(day, day.trace.layout), t).map((one) => {
    if (one.who === "intern") return { ...one, ...cell, human: atKeyboard(game) };
    return one.who === following ? { ...one, ...cell } : one;
  });
}

/** The intern's open tasks, the one due first first: `[{ kind, id, due, late }]`, `late` once past due. */
export const openTasks = (game) => (game.day.intern?.tasks ?? []).map((task) => ({ ...task, late: minuteOf(game) > task.due })).sort((a, b) => a.due - b.due);

export const internResult = (game) => ({ measures: pathwayMeasures(game.day), intern: game.day.intern ? internMeasures(game.day) : null });

/** The same day with a robot intern, an intern at random and no intern, for the person's game to be read against. */
export function internBenchmarks(settings) {
  return Object.fromEntries(["robot", "random", "none"].map((mode) => [mode, internResult(runInternGame(startInternGame({ ...settings, mode })))]));
}

export const internReplayOf = (game) => ({ format: INTERN_FORMAT, ...game.settings, inputs: game.inputs.map(({ step, key }) => ({ step, key })), savedAt: new Date().toISOString() });

/** Plays `replay` again, the keys at their steps; `onStep(game)` after each. Returns the finished game. */
export function playInternReplay(replay, { onStep = null } = {}) {
  if (replay.format !== INTERN_FORMAT) throw new Error(`format de replay inconnu : ${replay.format}`);
  const game = startInternGame(replay);
  const inputs = [...replay.inputs];
  while (!game.over) {
    const key = inputs[0]?.step === game.steps + 1 ? inputs.shift().key : null;
    stepInternGame(game, key);
    onStep?.(game);
  }
  return game;
}
