import { parsePlan } from "mcts-commun/grid.js";

/**
 * The department drawn as a plan, one per hospital (Sami, 23/10/2026, the roadmap's step 3: the emergency
 * department on the warehouse's grid, with a caregiver played at the keyboard). A cell is a few metres, a step of
 * the plan `STEP` minutes of shift (ward.js): a schematic department, for seeing who walks where, not a real one.
 *
 * Legend: `#` a wall; `.` the floor; `E` the entrance (walk-ins and ambulances); `w` a seat of the waiting room;
 * `T` the triage desk (the nurse's place); `D` the doctors' room; `b` a box's bed, the boxes numbered in reading
 * order (row by row, left to right). A plan has as many beds as its hospital has boxes.
 */
export const PLANS = Object.freeze({
  proximite: `
#####################
#b.b.b#.............#
#.....#.wwwwww......#
#..D...T............E
#.....#.wwwwww......#
#b.b.b#.............#
#####################`,
  moyen: `
############################
#b.b.b.b.b.b#..............#
#...........#.wwwwww.......#
#.....D......T.....wwwwww..E
#...........#.wwwwww.......#
#b.b.b.b.b.b#..............#
############################`,
  chu: `
##################################
#b.b.b.b.b.b.b.b.b.b.b.b#........#
#.......................#.wwwwww.#
#...........D............T.wwwww.E
#.......................#.wwwwww.#
#b.b.b.b.b.b.b.b.b.b.b.b#.wwwwww.#
##################################`,
});

const one = (plan, char, name) => {
  const cells = plan.find(char);
  if (cells.length !== 1) throw new Error(`le plan doit avoir une seule case « ${char} » (${name}), il en a ${cells.length}`);
  return cells[0];
};

/**
 * The plan of `hospital` (or a plan's `text`), its places found: `{ plan, beds, seats, entrance, desk, room,
 * passable(x, y) }`. `boxes`, when given, must be its number of beds.
 */
export function wardPlanOf(hospital, { text = PLANS[hospital], boxes = null } = {}) {
  if (!text) throw new Error(`pas de plan pour l'hôpital « ${hospital} »`);
  const plan = parsePlan(text.replace(/^\n/, ""));
  const beds = plan.find("b");
  if (boxes !== null && beds.length !== boxes) throw new Error(`le plan a ${beds.length} lits pour ${boxes} box`);
  return {
    plan,
    beds,
    seats: plan.find("w"),
    entrance: one(plan, "E", "l'entrée"),
    desk: one(plan, "T", "le tri"),
    room: one(plan, "D", "la salle des médecins"),
    passable: (x, y) => plan.inside(x, y) && plan.at(x, y) !== "#" && plan.at(x, y) !== " ",
  };
}
