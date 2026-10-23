import { COLOURS } from "../src/hypotheses.js";
import { RULE_LABELS } from "../src/rules.js";
import { MOVES, ROLES, STEP, WARD_FORMAT, playerOf, startWard, stepWard, wardBenchmark, wardReplayOf, wardResult, wardScene } from "../src/ward.js";
import { clock } from "./view.js";

/**
 * « Le service en plan » (Sami, 23/10/2026, the roadmap's step 3): the department on its plan, people walking, and
 * a doctor or the triage nurse played at the keyboard (Z Q S D or the arrows to walk, E to examine at a bed or to
 * look again beside a waiting patient). Who goes into a box stays the page's rule. At the end, the shift against
 * the same plan with a robot in the person's place. The games are kept (this browser, and replays/ through the page
 * server). The deciding is in src/ward.js; this module draws and listens. `createWardPanel({ el, svg, current, render })`.
 */
const CELL = 30;
const KEPT = 20;
const STORE = "urgences-plans";
const SPEEDS = [
  ["5", "lent : 30 s de garde par seconde"],
  ["10", "normal : 1 min de garde par seconde"],
  ["20", "rapide : 2 min par seconde"],
  ["60", "très rapide : 6 min par seconde"],
];
const fixed = (value) => Math.round(value).toLocaleString("fr-FR");
const CELL_CLASS = { "#": "wall", b: "bed", w: "seat", T: "desk", D: "room", E: "door" };

export function createWardPanel({ el, svg, current, render }) {
  const panel = { ward: null, role: "medecin", speed: 10, timer: null, pending: null, ended: null };

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE) ?? "[]");
    } catch {
      return [];
    }
  };
  const keep = (replay) => {
    fetch("/api/replays", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(replay) }).catch(() => {});
    try {
      localStorage.setItem(STORE, JSON.stringify([replay, ...load()].slice(0, KEPT)));
    } catch {
      // Storage refused: the replay can still be downloaded.
    }
  };
  const download = (replay) => {
    const link = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(replay)], { type: "application/json" })), download: `urgences-plan-${replay.hospital}-garde${replay.seed}-${replay.savedAt.slice(0, 16).replace(/[:T]/g, "-")}.json` });
    document.body.append(link);
    link.click();
    link.remove();
  };

  const stop = () => {
    clearInterval(panel.timer);
    panel.timer = null;
  };
  /** Steps a tick plays: one at the slower speeds, several above 20 steps a second (a timer cannot go faster). */
  const play = () => {
    stop();
    const perTick = Math.max(1, Math.round(panel.speed / 20));
    panel.timer = setInterval(() => {
      for (let i = 0; i < perTick && !panel.ward.over; i += 1) {
        stepWard(panel.ward, panel.pending);
        panel.pending = null;
      }
      if (panel.ward.over) finish();
      redraw();
    }, (1000 * perTick) / panel.speed);
  };
  function finish() {
    stop();
    const replay = wardReplayOf(panel.ward);
    keep(replay);
    panel.ended = { replay, result: wardResult(panel.ward).measures, robot: null };
    // The robot in the person's place: a whole shift more (seconds under the search), after the page has drawn.
    setTimeout(() => {
      panel.ended.robot = wardBenchmark(replay);
      render();
    }, 30);
    render();
  }

  const actions = {
    start: () => {
      panel.ward = startWard({ ...current(), role: panel.role });
      panel.ended = null;
      panel.ward.message = panel.role === "aucun" ? "" : "Z Q S D (ou les flèches) pour marcher, E pour examiner au lit d'un box ou réévaluer à côté d'un patient.";
      play();
    },
    pause: () => (panel.timer ? stop() : play()),
    quit: () => {
      stop();
      Object.assign(panel, { ward: null, ended: null });
    },
    download: () => download(panel.ended.replay),
  };

  /** The plan at this step: walls, beds, seats, desks; the patients, the staff, the person ringed. */
  function plan(scene) {
    const root = svg("svg", { viewBox: `0 0 ${scene.width * CELL} ${scene.height * CELL}`, class: "plan ward", role: "img", "aria-label": `Le service à ${clock(scene.minutes)}` });
    scene.lines.forEach((line, y) =>
      [...line].forEach((char, x) => {
        root.append(svg("rect", { x: x * CELL, y: y * CELL, width: CELL, height: CELL, class: `cell ${CELL_CLASS[char] ?? "floor"}` }));
      }),
    );
    scene.beds.forEach((bed, box) => {
      const label = svg("text", { x: bed.x * CELL + 3, y: bed.y * CELL + 10, class: "box-title" });
      label.textContent = String(box + 1);
      root.append(label);
    });
    for (const [char, text] of [["T", "tri"], ["D", "méd"], ["E", "🚪"]]) {
      const at = scene.lines.findIndex((line) => line.includes(char));
      if (at < 0) continue;
      const label = svg("text", { x: scene.lines[at].indexOf(char) * CELL + CELL / 2, y: at * CELL + CELL / 2 + 4, class: "cell-label" });
      label.textContent = text;
      root.append(label);
    }
    // People on one cell are spread a little, so that a crowd at the door still shows.
    const crowd = new Map();
    const spot = (x, y) => {
      const key = `${x},${y}`;
      const n = crowd.get(key) ?? 0;
      crowd.set(key, n + 1);
      return { cx: x * CELL + CELL / 2 + [0, 9, -9][n % 3], cy: y * CELL + CELL / 2 + Math.floor(n / 3) * 7 };
    };
    for (const one of scene.patients) {
      const { cx, cy } = spot(one.x, one.y);
      const group = svg("g", { class: `patient${one.overdue ? " overdue" : ""}`, transform: `translate(${cx} ${cy})` });
      const title = svg("title");
      title.textContent = `Patient ${one.id} : bracelet ${COLOURS[one.colour]}, niveau réel ${COLOURS[one.level]}, ${one.phase}${one.phase === "attente" || one.phase === "appel" ? `, attend depuis ${Math.round(one.wait)} min` : ""}`;
      group.append(title, svg("circle", { r: CELL / 2 - 4, class: `fill ${COLOURS[one.colour]}` }));
      if (one.worse) group.append(svg("circle", { r: 4, class: `fill truth ${COLOURS[one.level]}` }));
      const id = svg("text", { y: one.worse ? -5 : 3, class: "pid" });
      id.textContent = String(one.id);
      group.append(id);
      root.append(group);
    }
    for (const one of scene.staff) {
      const { cx, cy } = spot(one.x, one.y);
      if (one.human) root.append(svg("circle", { cx, cy, r: CELL / 2 - 1, class: "me" }));
      const icon = svg("text", { x: cx, y: cy + 6, class: `staff${one.busy ? " busy" : ""}` });
      icon.textContent = one.kind === "doctor" ? "🩺" : "🧑‍⚕️";
      const title = svg("title");
      title.textContent = `${one.human ? "Vous : " : ""}${one.kind === "doctor" ? `médecin ${one.id + 1}` : "infirmier de tri"}${one.patient !== null && one.patient !== undefined ? `, patient n° ${one.patient}` : ", libre"}${one.busy ? " (occupé)" : ""}`;
      icon.append(title);
      root.append(icon);
    }
    return root;
  }

  function statusLine(scene) {
    const me = playerOf(panel.ward);
    const mine = me && me.kind === "doctor" && me.patient !== null ? ` · votre patient : n° ${me.patient}${me.examining ? " (examen en cours)" : ", allez à son lit"}` : "";
    const coming = scene.coming.length ? ` · 🚑 ${scene.coming.map((one) => `n° ${one.id} dans ${one.in} min`).join(", ")}` : "";
    return `${clock(scene.minutes)} · ${scene.waiting} en salle d'attente${coming}${mine}`;
  }

  /** The game in front of the person: controls, the line, the plan, what the person was told. */
  function gameView() {
    const scene = wardScene(panel.ward);
    return el(
      "section",
      { class: "player ward-panel", id: "ward" },
      el("h2", {}, `Le service en plan — vous jouez ${ROLES[panel.ward.role]}`),
      el(
        "div",
        { class: "controls" },
        el("button", { type: "button", "data-ward": "pause" }, panel.timer ? "Pause" : "Reprendre"),
        el("label", {}, "Vitesse", el("select", { "data-ward-speed": "1" }, ...SPEEDS.map(([value, text]) => el("option", { value, selected: Number(value) === panel.speed }, text)))),
        el("button", { type: "button", class: "quiet", "data-ward": "quit" }, "Abandonner"),
      ),
      el("p", { class: "summary ward-line", "aria-live": "off" }, statusLine(scene)),
      el("div", { class: "plan-wrap" }, plan(scene)),
      el("p", { class: "hint ward-message", role: "status" }, scene.message || " "),
      el("p", { class: "hint legend" }, `Une pastille : un patient, de la couleur de son bracelet ; un point au centre : son niveau réel, plus grave ; cerclée de rouge : il attend plus que son bracelet ne le permet. 🩺 un médecin, 🧑‍⚕️ l'infirmier ; vous, cerclé. Une case : quelques mètres, ${Math.round(STEP * 60)} s de marche. Qui entre en box : la règle « ${RULE_LABELS[panel.ward.rule]} » ; le médecin envoyé est le libre le plus proche du lit, vous compris.`),
    );
  }

  /** Redraws the line, the plan and the message in place: the controls stay, a menu opened stays open. */
  function redraw() {
    const section = document.getElementById("ward");
    if (!section || panel.ended) return;
    const scene = wardScene(panel.ward);
    section.querySelector(".ward-line").textContent = statusLine(scene);
    section.querySelector(".plan-wrap").replaceChildren(plan(scene));
    section.querySelector(".ward-message").textContent = scene.message || " ";
  }

  function endView() {
    const { result, robot, replay } = panel.ended;
    const row = (who, measures) => el("tr", { class: who === "vous" ? "current" : null }, el("td", {}, who), el("td", { class: "num" }, measures ? fixed(measures.lateCostNow) : "…"), el("td", { class: "num" }, measures ? String(measures.late) : "…"), el("td", { class: "num" }, measures ? String(measures.unseen) : "…"));
    return el(
      "section",
      { class: "player ward-panel" },
      el("h2", {}, `La garde sur le plan est finie (vous : ${ROLES[replay.role]})`),
      el("p", { class: "hint" }, "Le coût du retard au niveau du moment (moins, c'est mieux), sur les mêmes patients et le même plan. L'attente compte jusqu'au début de l'examen : la marche coûte des minutes."),
      el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "La garde jouée par"), el("th", { class: "num" }, "coût du retard"), el("th", { class: "num" }, "patients en retard"), el("th", { class: "num" }, "jamais vus avant la nuit"))), el("tbody", {}, row(replay.role === "aucun" ? "les robots" : "vous", result), replay.role === "aucun" ? null : row(replay.role === "infirmier" ? "un infirmier robot (le plus en retard sur sa couleur)" : "un médecin robot à votre place", robot)))),
      el("div", { class: "controls" }, el("button", { type: "button", class: "quiet", "data-ward": "download" }, "Télécharger le replay"), el("button", { type: "button", class: "quiet", "data-ward": "quit" }, "Fermer")),
    );
  }

  function view() {
    if (panel.ward && !panel.ended) return gameView();
    if (panel.ended) return endView();
    const kept = load();
    return el(
      "details",
      { class: "editor player-start" },
      el("summary", {}, "Le service en plan : jouer un médecin ou l'infirmier au clavier"),
      el("p", { class: "hint" }, "La garde choisie plus haut (hôpital, situation, règle, numéro), sur un plan du service : les patients et les soignants marchent. Vous jouez un médecin (E au lit d'un box pour examiner le patient qui y est couché : le vôtre, ou celui d'un collègue pas encore commencé, et vous échangez vos patients) ou l'infirmier de tri (E à côté d'un patient qui attend depuis 30 min pour le réévaluer). Z Q S D ou les flèches pour marcher."),
      el(
        "div",
        { class: "controls" },
        el("label", {}, "Je joue", el("select", { "data-ward-role": "1" }, ...Object.entries(ROLES).map(([value, text]) => el("option", { value, selected: value === panel.role }, text)))),
        el("label", {}, "Vitesse", el("select", { "data-ward-speed": "1" }, ...SPEEDS.map(([value, text]) => el("option", { value, selected: Number(value) === panel.speed }, text)))),
        el("button", { type: "button", "data-ward": "start" }, "Commencer sur le plan"),
      ),
      kept.length ? el("ol", { class: "replay-list" }, ...kept.map((replay, i) => el("li", {}, `${replay.savedAt.slice(0, 16).replace("T", " ")} · ${replay.hospital}${replay.accident ? ", accident" : ""} · garde ${replay.seed} · ${ROLES[replay.role]} · ${replay.inputs.length} touches `, el("button", { type: "button", class: "quiet", "data-ward-kept": String(i) }, "Télécharger")))) : null,
    );
  }

  function click(target) {
    const action = target.closest?.("[data-ward]")?.dataset.ward;
    if (actions[action]) {
      actions[action]();
      render();
      return true;
    }
    const kept = target.closest?.("[data-ward-kept]");
    if (kept) {
      const replay = load()[Number(kept.dataset.wardKept)];
      if (replay?.format === WARD_FORMAT) download(replay);
      return true;
    }
    return false;
  }
  function change(target) {
    if (target.dataset?.wardRole) panel.role = target.value;
    else if (target.dataset?.wardSpeed) {
      panel.speed = Number(target.value);
      if (panel.timer) play();
    } else return false;
    return true;
  }
  /** A key pressed in the page: kept for the next step while the plan plays; true if it was the panel's. */
  function key(event) {
    if (!panel.ward || panel.ended || panel.ward.role === "aucun" || event.target.closest?.("input, textarea, select") || event.ctrlKey || event.altKey || event.metaKey) return false;
    const name = event.key.toLowerCase();
    if (name !== "e" && !MOVES[name]) return false;
    event.preventDefault();
    panel.pending = name;
    return true;
  }
  return { view, click, change, key, active: () => Boolean(panel.ward) };
}
