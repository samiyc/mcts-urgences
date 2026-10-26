import { parsePlan } from "mcts-commun/grid.js";
import { walkSteps } from "./ward-moves.js";

/**
 * The plans of the detailed pathway (Sami, 26/10/2026, docs/recherche/feuille-de-route.md, step 2): the department
 * drawn as text, one plan per hospital, to be changed by hand in the page. A plan sets the places the day has (the
 * boxes, the SAUV, the isolation room, the UHCD, the scanner) and where everyone walks; at this step the walks are
 * drawn and measured (pathway-walk.js), they do not delay the care yet.
 *
 * Legend: `#` a wall; `.` the floor; `E` the entrance; `A` the reception; `T` the triage (the IOA); `w` a seat of the
 * waiting room, `r` a seat for waiting for results; `b` a box's bed, `S` a SAUV bed, `I` an isolation room, `U` a
 * UHCD bed; `C` a consultation room of the fast track (pathway-fast.js); `X` a scanner; `L` the lab (where the tubes leave); `P` the pharmacy; `O` the theatre's door; `H` the lifts
 * to the wards; `D` the doctors' room; `R` the break room; `B` the stretcher-bearers' base. Places are numbered in
 * reading order (row by row, left to right).
 *
 * The default plans have exactly the capacities `pathwaySettingsOf` gives each hospital (a test holds it), so a day
 * drawn on its hospital's plan is the day of step 1.
 */
export const PATHWAY_PLANS = Object.freeze({
  proximite: `
####################################
#S..#b.b.b#U.U.U#X.#O.#H.#wwwwwwww.#
#...#.....#.....#..#..#..#.........#
#...#.....#.....#..#..#..#wwwwwwww.#
#..................................E
#...#.....#.....#..#..#..#A.T..C...#
#...#.....#.....#..#..#..#.........#
#I..#b.b.b#D.R.B#L.#P.#..#rrrr.....#
####################################`,
  moyen: `
######################################################
#S..S#b.b.b.b.b.b#U.U.U.U.U.U#X..#O..#H..#wwwwwwwwww.#
#....#...........#...........#...#...#...#...........#
#....#...........#...........#...#...#...#wwwwwwwwww.#
#....................................................E
#....#...........#...........#...#...#...#A.T..C.....#
#....#...........#...........#...#...#...#wwwwwwwwww.#
#I...#b.b.b.b.b.b#D...R...B..#L..#P..#...#rrrrrr.....#
######################################################`,
  chu: `
######################################################################
#S.S.S.S#b.b.b.b.b.b.b.b.b.b.b.b#U.U.U.U.U.U#X.X#O..#H..#wwwwwwwwwwww#
#.......#.......................#...........#...#...#...#............#
#.......#.......................#...........#...#...#...#wwwwwwwwwwww#
#....................................................................E
#.......#.......................#...........#...#...#...#A..T..C.C...#
#.......#.......................#...........#...#...#...#wwwwwwwwwwww#
#I.....I#b.b.b.b.b.b.b.b.b.b.b.b#U.U.U.U.U.U#L..#P..#...#wwwwwwwwwwww#
#.......#.......................#D...R...B..#...#...#...#rrrrrrrrrr..#
######################################################################`,
});

/** The pools of the pathway a plan holds, and their character. */
export const PLACES = Object.freeze({ boxes: "b", sauv: "S", isolation: "I", uhcd: "U", scanner: "X", fast: "C" });
/** The points of the plan, one cell each: the required ones, then those a later step will use. */
const POINTS = Object.freeze({ entrance: "E", reception: "A", triage: "T", room: "D", theatre: "O", lifts: "H", porters: "B" });
const LATER = Object.freeze({ lab: "L", pharmacy: "P", pause: "R" });
const NAMES = { entrance: "l'entrée", reception: "l'accueil", triage: "le tri", room: "la salle des médecins", theatre: "la porte du bloc", lifts: "les ascenseurs", porters: "la base des brancardiers", lab: "le labo", pharmacy: "la pharmacie", pause: "la salle de pause" };

/** A plan's text without the line break the plans above start with. */
export const planTextOf = (plan) => plan.replace(/^\n/, "");
const passableOn = (plan) => (x, y) => plan.inside(x, y) && plan.at(x, y) !== "#" && plan.at(x, y) !== " ";

/** The points of `plan` that do not have exactly one cell (the later ones: at most one), as messages. */
function pointErrors(plan) {
  const required = Object.entries(POINTS).filter(([, char]) => plan.find(char).length !== 1);
  const later = Object.entries(LATER).filter(([, char]) => plan.find(char).length > 1);
  return [...required, ...later].map(([name, char]) => `il faut une case « ${char} » (${NAMES[name]}), le plan en a ${plan.find(char).length}`);
}

/** The places none can walk to from the entrance. */
function unreachable(layout) {
  const cells = [...Object.values(layout.places).flat(), ...layout.seats, ...layout.results, ...Object.values(layout.points).filter(Boolean)];
  return cells.filter((cell) => walkSteps(layout.walker, cell, layout.points.entrance) < 0);
}

/**
 * The plan's errors, in words for the page (an empty list: the plan is fine): its points, a box and a scanner at
 * least, a seat, every place within reach of the entrance.
 */
export function planErrors(text) {
  const plan = parsePlan(planTextOf(text));
  const errors = pointErrors(plan);
  if (plan.find("b").length === 0) errors.push("il faut au moins un box (« b »)");
  if (plan.find("X").length === 0) errors.push("il faut au moins un scanner (« X »)");
  if (plan.find("w").length === 0) errors.push("il faut au moins un siège en salle d'attente (« w »)");
  if (errors.length) return errors;
  const far = unreachable(pathwayPlanOf(text));
  return far.length ? [`${far.length} case(s) hors d'atteinte depuis l'entrée, la première en colonne ${far[0].x + 1}, ligne ${far[0].y + 1}`] : [];
}

/**
 * The plan `text` read (it must be free of `planErrors`): `{ plan, places: { boxes: [{ x, y }], … }, points: { entrance,
 * reception, triage, room, theatre, lifts, porters, lab, pharmacy, pause }, seats, results, passable(x, y), walker }`,
 * `walker` what ward-moves.js walks on (the walking distances, computed as they are asked for).
 */
export function pathwayPlanOf(text) {
  const plan = parsePlan(planTextOf(text));
  const points = Object.fromEntries(Object.entries({ ...POINTS, ...LATER }).map(([name, char]) => [name, plan.find(char)[0] ?? null]));
  const layout = {
    plan,
    places: Object.fromEntries(Object.entries(PLACES).map(([pool, char]) => [pool, plan.find(char)])),
    points,
    seats: plan.find("w"),
    results: plan.find("r"),
    passable: passableOn(plan),
  };
  return Object.assign(layout, { walker: { fields: new Map(), layout } });
}

/** How many of each place the plan has: the capacities a day on it takes (`pathwaySettingsOf`). */
export const capacityOf = (layout) => Object.fromEntries(Object.entries(layout.places).map(([pool, cells]) => [pool, cells.length]));
