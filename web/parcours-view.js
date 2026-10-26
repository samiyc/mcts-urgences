import { COLOURS } from "../src/hypotheses.js";
import { STEPS } from "../src/pathway.js";
import { fatigueMeasures } from "../src/pathway-fatigue.js";
import { internMeasures } from "../src/pathway-game.js";
import { statusAt } from "../src/pathway-status.js";
import { walkScene } from "../src/pathway-walk.js";
import { el } from "./dom.js";
import { pathwayPlan } from "./parcours-draw.js";

/**
 * What the tab « Parcours détaillé » shows of a played day (Sami, 26/10/2026, step 2): the controls of the replay,
 * the plan at the minute shown, the patients present (where they are, what they wait for, since when), and the
 * day's figures with what it walked. `run`: the day played (tabs/parcours.js); `t`: the minute shown.
 */
const decimal = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
const hours = (minutes) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")}`;

/** Minute `t` of the day as a time, from its start hour, the day after marked. */
export function dayClock(settings, t) {
  const minutes = settings.startHour * 60 + Math.round(t);
  const time = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return minutes >= 1440 ? `${time} (J+${Math.floor(minutes / 1440)})` : time;
}

/** The patients present at `t`, the earliest arrived first: `[{ patient, step, since }]`. */
const presentAt = (run, t) =>
  [...run.day.patients.values()]
    .map((patient) => ({ patient, ...statusAt(run.steps.get(patient.id), t) }))
    .filter((one) => one.step !== "coming" && one.step !== "out")
    .sort((a, b) => a.patient.arrival - b.patient.arrival);

const worsenedBy = (patient, t) => patient.worsenedAt.filter((at) => at <= t).length;

export function presentTable(run, t) {
  const rows = presentAt(run, t).map(({ patient, step, since }) =>
    el(
      "tr",
      {},
      el("td", { class: "num" }, String(patient.id)),
      el("td", {}, el("span", { class: `dot ${COLOURS[patient.colour]}` }), COLOURS[patient.colour]),
      el("td", {}, STEPS[step]),
      el("td", { class: "num" }, `${Math.round(t - since)} min`),
      el("td", {}, dayClock(run.day.settings, patient.arrival)),
      el("td", { class: worsenedBy(patient, t) ? "worse" : null }, worsenedBy(patient, t) ? `+${worsenedBy(patient, t)}` : ""),
    ),
  );
  const head = ["n°", "bracelet", "où, ce qu'il attend", "depuis", "arrivé à", "aggravé"].map((text, i) => el("th", { class: i === 0 || i === 3 ? "num" : null }, text));
  return el("div", { class: "scroll present" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)));
}

export const planAt = (run, t) => pathwayPlan({ layout: run.layout, patients: run.day.patients, scene: walkScene(run.walks, t), t, label: dayClock(run.day.settings, t) });

export function lineAt(run, t) {
  const present = presentAt(run, t);
  const waiting = present.filter((one) => one.step === "waiting").length;
  const beds = present.filter((one) => one.step === "bed").length;
  return `${dayClock(run.day.settings, t)} · ${present.length} présents · ${waiting} attendent un box · ${beds} attendent un lit`;
}

const figure = (value, label) => el("div", { class: "figure" }, el("strong", {}, value), el("span", {}, label));

/** What the day's intern did (pathway-game.js), when it had one. */
function internFigures(day) {
  if (!day.intern) return [];
  const one = internMeasures(day);
  return [
    figure(`${one.done} / ${one.late}`, `tâches de l'interne faites / en retard (${one.followed} patients suivis)`),
    figure(`${decimal(one.lateness.mean, 1)} min`, "retard moyen d'une tâche"),
    figure(String(one.recoloured), "aggravations repérées aux constantes"),
    figure(`${decimal(one.metres / 1000, 1)} km`, "marchés par l'interne"),
  ];
}

/** The doctors' fatigue of the day (pathway-fatigue.js), when it counts. */
function fatigueFigures(day) {
  if (!day.fatigue) return [];
  const one = fatigueMeasures(day);
  return [
    figure(`${one.meals} / ${one.rests}`, "repas / repos de nuit pris par les médecins"),
    figure(`${decimal(one.longest, 1)} h`, "la plus longue période sans pause"),
    figure(`${decimal(100 * one.slowing, 1)} %`, "de ralentissement moyen des médecins"),
    figure(String(one.oversights), "résultats oubliés, relus 30 min plus tard"),
  ];
}

/** The day's figures (pathwayMeasures), what it walked (walkMeasures), its intern's and its fatigue. */
export function figures({ day, measures, walking }) {
  const { exits, stay, boarding, peak, maxWait } = measures;
  const { byRole } = walking;
  const km = (role) => `${decimal(byRole[role].metres / 1000, 1)} km`;
  return el(
    "div",
    { class: "figures" },
    figure(String(measures.patients), `patients, ${exits.encore} encore là à la fin`),
    figure(`${decimal(100 * stay.within4h)} %`, "sortis en moins de 4 h"),
    figure(`${hours(stay.median)} / ${hours(stay.p90)}`, "passage : médiane / 9e décile"),
    figure(`${exits.parti} / ${exits.reoriente}`, "partis sans être vus / réorientés"),
    figure(String(peak.waiting), "patients en attente, au plus"),
    figure(`${Math.round(Math.max(maxWait[1], maxWait[2]))} min`, "attente max d'un rouge ou orange"),
    figure(hours(boarding.max), `boarding le plus long (${boarding.patients} patients)`),
    figure(measures.busiest, "la ressource la plus occupée"),
    figure(km("patient"), "marchés par les patients"),
    figure(km("doctor"), "marchés par les médecins"),
    figure(km("porter"), `marchés par les brancardiers (${walking.transports} transports)`),
    figure(`${walking.unported}`, `transports sans brancardier libre ; ${decimal(walking.porterWait.mean, 1)} min pour en avoir un`),
    ...internFigures(day),
    ...fatigueFigures(day),
  );
}

export const PATHWAY_LEGEND =
  "Une pastille : un patient, de la couleur de son bracelet ; un point au centre : son niveau réel, plus grave. 🩺 un médecin, 🛏️ un brancardier. Les marches sont dessinées et mesurées, elles ne retardent pas encore les soins (l'étape 3) : un patient peut être examiné avant que le dessin ne l'ait amené au box. Une case : 2 m, 6 s de marche.";
