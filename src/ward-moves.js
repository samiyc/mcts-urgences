/** How people walk on the plan (ward.js): the distances by breadth-first search, a cell a step. */

/** A step of the plan, in minutes. */
export const STEP = 0.1;

export const same = (a, b) => a.x === b.x && a.y === b.y;
export const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Walking distances to `target` over the plan, computed once a target (breadth-first). */
function fieldTo(ward, target) {
  const key = `${target.x},${target.y}`;
  const known = ward.fields.get(key);
  if (known) return known;
  const { plan, passable } = ward.layout;
  const distance = new Int32Array(plan.width * plan.height).fill(-1);
  const queue = [target];
  distance[target.y * plan.width + target.x] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const { x, y } = queue[head];
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!passable(nx, ny) || distance[ny * plan.width + nx] >= 0) continue;
      distance[ny * plan.width + nx] = distance[y * plan.width + x] + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  const field = { distance, width: plan.width, at: (x, y) => distance[y * plan.width + x] };
  ward.fields.set(key, field);
  return field;
}

/** Steps from `from` to `to`, walking. */
export const walkSteps = (ward, from, to) => fieldTo(ward, to).at(from.x, from.y);

/** One cell toward `unit.to`, the first neighbour nearer in a fixed order. */
export function walk(ward, unit) {
  if (!unit.to || same(unit, unit.to)) return;
  const field = fieldTo(ward, unit.to);
  const here = field.at(unit.x, unit.y);
  for (const [dx, dy] of NEIGHBOURS) {
    const d = field.at(unit.x + dx, unit.y + dy);
    if (ward.layout.passable(unit.x + dx, unit.y + dy) && d >= 0 && d < here) {
      unit.x += dx;
      unit.y += dy;
      return;
    }
  }
}

/** The bed at or beside the person, the one under their feet first. */
export const bedNear = (ward, at) => {
  const { beds } = ward.layout;
  const index = beds.findIndex((bed) => same(bed, at));
  return index >= 0 ? index : beds.findIndex((bed) => near(bed, at));
};
