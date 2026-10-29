import { el, select } from "./dom.js";
import { livePlan } from "./live-plan.js";
import { REPLAY_HINT, nextSpeed, replayKey, within } from "./replay-keys.js";
import { sceneAt, sceneLine } from "./view.js";

/**
 * The played shift replayed on the plan, minute by minute, at a chosen speed or from a slider.
 * `createLive({ result, settings })`: the played shift and its settings, read at each frame.
 */
const LIVE_SPEEDS = [
  ["1", "1 min par seconde"],
  ["5", "5 min par seconde"],
  ["15", "15 min par seconde"],
  ["30", "30 min par seconde"],
];
const LEGEND =
  "Une pastille : un patient, de la couleur de son bracelet, avec son numéro. Un point au centre : son niveau réel quand il est plus grave que le bracelet — ce que personne ne voit. Cerclée de rouge : il attend plus que son bracelet ne le permet. 🧑‍⚕️ l'infirmier le réévalue, 🩺 un médecin l'examine ; la barre d'un box : le séjour, foncée pendant l'examen.";

const endOf = (live) => Math.max(...live.result().patients.map((patient) => patient.end));
const sceneOf = (live) => sceneAt(live.result().patients, live.settings(), live.t);

function playLabel(live, playing) {
  if (playing) return "Pause";
  return live.t >= Math.ceil(endOf(live)) ? "Revoir" : "Lire la garde";
}

/** The animated plan with its controls; `refresh` redraws it alone while it plays. */
function section(live) {
  const end = Math.ceil(endOf(live));
  const scene = sceneOf(live);
  const playing = live.frame !== null;
  return el(
    "section",
    { class: "live", id: "live" },
    el(
      "div",
      { class: "controls" },
      el("button", { type: "button", "data-action": playing ? "livePause" : "livePlay" }, playLabel(live, playing)),
      el("label", {}, "Vitesse", select("liveSpeed", LIVE_SPEEDS, String(live.speed))),
      el("label", { class: "scrub" }, `Heure : ${scene.clock}`, el("input", { type: "range", min: "0", max: String(end), step: "1", value: String(Math.round(live.t)), "data-live": "t", "aria-label": "Minute de la garde" })),
      el("span", { class: "hint" }, REPLAY_HINT),
    ),
    el("p", { class: "summary live-line", "aria-live": "off" }, sceneLine(scene)),
    el("div", { class: "plan-wrap" }, livePlan(scene)),
    el("p", { class: "hint legend" }, LEGEND),
  );
}

const refresh = (live) => document.getElementById("live")?.replaceWith(section(live));

/** Redraws the plan, its line and the slider in place: the controls stay, so a menu opened while it plays stays open. */
function draw(live) {
  const found = document.getElementById("live");
  if (!found) return;
  const scene = sceneOf(live);
  found.querySelector(".plan-wrap").replaceChildren(livePlan(scene));
  found.querySelector(".live-line").textContent = sceneLine(scene);
  found.querySelector(".scrub").firstChild.textContent = `Heure : ${scene.clock}`;
  /** @type {HTMLInputElement} */ (found.querySelector("[data-live='t']")).value = String(Math.round(live.t));
}

function tick(live, now) {
  const end = endOf(live);
  live.t = Math.min(end, live.t + ((now - (live.last ?? now)) / 1000) * live.speed);
  live.last = now;
  if (live.t < end) {
    live.frame = requestAnimationFrame((at) => tick(live, at));
    draw(live);
  } else {
    live.frame = null;
    refresh(live);
  }
}

function play(live) {
  if (live.t >= endOf(live)) live.t = 0;
  live.last = null;
  live.frame = requestAnimationFrame((at) => tick(live, at));
  refresh(live);
}

function pause(live) {
  if (live.frame !== null) cancelAnimationFrame(live.frame);
  live.frame = null;
  if (live.result()) refresh(live);
}

/** The shift replayed, as replay-keys.js drives it; drawn again whole when paused, so the button says where it is. */
const playerOf = (live) => ({
  t: () => live.t,
  end: () => endOf(live),
  seek: (t) => {
    live.t = within(t, endOf(live));
    if (live.frame === null) refresh(live);
    else draw(live);
  },
  toggle: () => (live.frame === null ? play(live) : pause(live)),
  faster: (way) => {
    live.speed = nextSpeed(LIVE_SPEEDS, live.speed, way);
    refresh(live);
  },
});

export function createLive({ result, settings }) {
  /** The minute shown, minutes of shift a second, the animation frame while it plays. */
  const live = { t: 0, speed: 5, frame: null, last: null, result, settings };
  return {
    section: () => section(live),
    play: () => play(live),
    pause: () => pause(live),
    reset: () => {
      pause(live);
      live.t = 0;
    },
    setSpeed: (speed) => (live.speed = speed),
    /** A key in the tab while the shift is shown (replay-keys.js); true if it was the replay's. */
    key: (event) => Boolean(live.result() && document.getElementById("live")) && replayKey(playerOf(live), event),
    /** The slider moved: redrawn in place, so the slider keeps the pointer. */
    seek: (t) => {
      live.t = t;
      draw(live);
    },
  };
}
