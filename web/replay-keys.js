/**
 * The keys of a replay, as on a video (Sami, 29/10/2026), for the shift of « Garde simple » and the day of « Parcours
 * détaillé »: space plays or pauses; the left and right arrows go 10 min back or on, an hour with Shift; the up and
 * down arrows play faster or slower; 0 to 9, on the keypad or the row of figures, go to 0 %, 10 %… 90 % of it.
 *
 * `player`: `{ t(), end(), seek(t), toggle(), faster(way) }`, the minute shown, the last one, and what the keys do.
 */
export const REPLAY_HINT = "Espace : lecture ou pause ; ← → : 10 min, avec Maj : 1 h ; ↑ ↓ : plus ou moins vite ; 0 à 9 : de 0 à 90 %";

/** Whether a key goes to the replay: no modifier but Shift, not in a field nor on a button, which keep their keys. */
const forTheReplay = (event) => !(event.ctrlKey || event.altKey || event.metaKey || event.target.closest?.("input, textarea, select, button"));

/**
 * The tenth a key goes to: its figure, else the figure of its place on the row (an AZERTY keyboard) or on the keypad
 * (num lock off, but for its arrows); null for another key.
 */
function tenthOf(event) {
  const figure = /^\d$/.test(event.key) ? event.key : (/^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1] ?? null);
  return figure === null ? null : Number(figure);
}

const MOVES = {
  " ": (player) => player.toggle(),
  ArrowLeft: (player, event) => player.seek(player.t() - (event.shiftKey ? 60 : 10)),
  ArrowRight: (player, event) => player.seek(player.t() + (event.shiftKey ? 60 : 10)),
  ArrowUp: (player) => player.faster(1),
  ArrowDown: (player) => player.faster(-1),
};

/** The minute `t` kept within the replay, from its start to `end`. */
export const within = (t, end) => Math.max(0, Math.min(end, t));

/** The speed after `current` in `speeds` (`[[value, label]]`, slowest first), faster (`way` 1) or slower (-1). */
export function nextSpeed(speeds, current, way) {
  const at = speeds.findIndex(([value]) => Number(value) === current);
  return Number(speeds[Math.max(0, Math.min(speeds.length - 1, at + way))][0]);
}

/** A key pressed while a replay is shown; true if it was the replay's. */
export function replayKey(player, event) {
  if (!forTheReplay(event)) return false;
  const tenth = MOVES[event.key] ? null : tenthOf(event);
  if (tenth === null && !MOVES[event.key]) return false;
  if (tenth === null) MOVES[event.key](player, event);
  else player.seek((player.end() * tenth) / 10);
  event.preventDefault();
  return true;
}
