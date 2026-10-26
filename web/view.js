import { COLOURS, LATE_WEIGHT, MAX_WAIT } from "../src/hypotheses.js";

/**
 * What the page shows of a shift, pure and tested under Node (tests/view.test.js): the boxes' timeline, the
 * waiting room over time, the shift in one line, the patients the rule served worst, with what the
 * department could not see (their true level), and the department at any minute (`sceneAt`, the animated
 * plan). The DOM layer (app.js) only draws it.
 */
export const START_HOUR = 8;
const pad = (n) => String(n).padStart(2, "0");
const fixed = (value, digits = 0) => value.toFixed(digits).replace(".", ",");

/** Minutes into the shift as a time of day, the shift starting at 08:00. */
export function clock(minutes) {
  const total = Math.round(START_HOUR * 60 + minutes);
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

/** The time scale: from 0 to the last patient out, a tick an hour. */
export function scaleOf(patients) {
  const end = Math.max(60, ...patients.map((patient) => patient.end));
  const at = (minutes) => (100 * minutes) / end;
  const ticks = [];
  for (let minutes = 0; minutes <= end; minutes += 60) ticks.push({ left: at(minutes), label: clock(minutes) });
  return { end, at, ticks };
}

/** One row per box: each patient's stay, the exam part (with a doctor) first, in the bracelet's colour. */
export function boxRows(patients, boxes, scale) {
  return Array.from({ length: boxes }, (_, box) => ({
    box,
    bars: patients
      .filter((patient) => patient.box === box)
      .map((patient) => ({
        id: patient.id,
        left: scale.at(patient.start),
        width: scale.at(patient.end) - scale.at(patient.start),
        exam: (100 * (patient.examEnd - patient.start)) / Math.max(1e-9, patient.end - patient.start),
        colour: COLOURS[patient.colour],
        title: `Patient ${patient.id}, bracelet ${COLOURS[patient.colour]} (niveau réel ${COLOURS[patient.arrivalLevel]}) : arrivé ${clock(patient.arrival)}, entré ${clock(patient.start)}, sorti ${clock(patient.end)}`,
      })),
  }));
}

/** The waiting room's head count over time, as steps: `[{ t, count }]`, and its peak. An arrival counts before a start at the same minute, so the count never dips below 0. */
export function waitingCurve(patients) {
  const changes = [...patients.map((patient) => ({ t: patient.arrival, d: 1 })), ...patients.map((patient) => ({ t: patient.start, d: -1 }))].sort((a, b) => a.t - b.t || b.d - a.d);
  let count = 0;
  const points = [{ t: 0, count: 0 }];
  for (const change of changes) {
    count += change.d;
    points.push({ t: change.t, count });
  }
  return { points, peak: Math.max(...points.map((point) => point.count)) };
}

/** The SVG path of the waiting curve in a `width` × `height` box. */
export function curvePath({ points, peak }, scale, { width, height }) {
  const x = (t) => (scale.at(t) * width) / 100;
  const y = (count) => height - (height * count) / Math.max(1, peak);
  let path = `M0,${y(0)}`;
  let last = 0;
  for (const point of points) {
    path += ` H${fixed(x(point.t), 1).replace(",", ".")} V${fixed(y(point.count), 1).replace(",", ".")}`;
    last = point.count;
  }
  return `${path} H${width} V${y(last)}`;
}

/** The shift in one line. */
export function summaryOf(measures) {
  const urgent = [1, 2].map((level) => measures.byLevel[level]);
  const seen = urgent.reduce((sum, group) => sum + group.count, 0);
  const inTime = seen ? urgent.reduce((sum, group) => sum + group.inTime * group.count, 0) / seen : 1;
  return [
    `${measures.patients} patients`,
    `coût du retard ${fixed(measures.lateCost)}`,
    `${measures.late} vus en retard`,
    `${measures.worsened} aggravés en attendant`,
    `urgents vus à temps : ${fixed(100 * inTime)} %`,
    `attente moyenne ${fixed(measures.meanWait)} min`,
    `salle d'attente : ${measures.peakWaiting} au plus`,
    `coût au niveau du moment ${fixed(measures.lateCostNow)}`,
    ...(measures.looks ? [`${measures.looks} réévaluations, ${measures.recoloured} bracelets changés`] : []),
  ].join(" · ");
}

/** The patients the rule served worst (late cost, then worsening), with what nobody could see. */
export function worstPatients(patients, count = 10) {
  return patients
    .map((patient) => ({ patient, cost: LATE_WEIGHT[patient.arrivalLevel] * patient.late }))
    .filter(({ cost, patient }) => cost > 0 || patient.worsened > 0)
    .sort((a, b) => b.cost - a.cost || b.patient.worsened - a.patient.worsened)
    .slice(0, count)
    .map(({ patient, cost }) => ({
      id: patient.id,
      source: patient.source === "ambulance" ? "ambulance" : "à pied",
      colour: COLOURS[patient.colour],
      firstColour: COLOURS[patient.firstColour ?? patient.colour],
      truth: COLOURS[patient.arrivalLevel],
      mistriaged: patient.colour !== patient.arrivalLevel,
      arrival: clock(patient.arrival),
      wait: Math.round(patient.wait),
      late: Math.round(patient.late),
      worsened: patient.worsened,
      cost: Math.round(cost),
    }));
}

/** The bracelet's colour (a level) at minute `t`: the triage's, then each look's done by then. */
export function colourAt(patient, t) {
  let colour = patient.firstColour ?? patient.colour;
  for (const look of patient.lookedAt ?? []) if (look.to <= t && look.colour !== null) colour = look.colour;
  return colour;
}

/** The true level at minute `t`: the arrival's, one up for each worsening by then. */
export const levelAt = (patient, t) => patient.arrivalLevel - patient.worsenedAt.filter((at) => at <= t).length;

/** Whether the nurse is looking at `patient` at minute `t`. */
const lookedAt = (patient, t) => (patient.lookedAt ?? []).some((look) => look.from <= t && t < look.to);
const startedBy = (patient, t) => patient.start <= t;

/** The waiting room at minute `t`, the earliest first (see `sceneAt`). */
function waitingAt(patients, t) {
  return patients
    .filter((patient) => patient.arrival <= t && !startedBy(patient, t))
    .sort((a, b) => a.arrival - b.arrival || a.id - b.id)
    .map((patient) => {
      const colour = colourAt(patient, t);
      const level = levelAt(patient, t);
      const wait = t - patient.arrival;
      return { id: patient.id, source: patient.source, colour: COLOURS[colour], truth: COLOURS[level], worse: level < colour, wait, overdue: wait > MAX_WAIT[colour], looked: lookedAt(patient, t), recent: wait < 5 };
    });
}

/** Each box at minute `t`, with its patient if any (see `sceneAt`). */
function boxesAt(patients, settings, t) {
  return Array.from({ length: settings.boxes }, (_, box) => {
    const patient = patients.find((one) => one.box === box && one.start <= t && t < one.end);
    if (!patient) return { box, patient: null };
    const level = patient.levelAtStart ?? patient.level;
    const stay = Math.max(1e-9, patient.end - patient.start);
    return {
      box,
      patient: { id: patient.id, colour: COLOURS[patient.colour], truth: COLOURS[level], worse: level < patient.colour, phase: t < patient.examEnd ? "exam" : "care", progress: Math.min(1, (t - patient.start) / stay), examShare: (patient.examEnd - patient.start) / stay },
    };
  });
}

/**
 * The department at minute `t` of a played shift (Sami, 23/10/2026: see what really happens in the hospital),
 * rebuilt from the patients' courses:
 * - `waiting`: the patients in the waiting room, the earliest first, each with the bracelet's colour, the
 *   true level (`worse` when it is more serious than the bracelet: what nobody sees), the minutes waited,
 *   `overdue` when that passes what the bracelet allows, `looked` while the nurse looks at them;
 * - `boxes`: each box with its patient, if any, in the exam (a doctor there) or the care, and how far;
 * - `coming`: the ambulances announced, not there yet; the doctors and nurses busy; the patients gone.
 */
export function sceneAt(patients, settings, t) {
  const waiting = waitingAt(patients, t);
  const boxes = boxesAt(patients, settings, t);
  const announced = settings.announced ?? 0;
  const coming = patients.filter((patient) => patient.source === "ambulance" && patient.arrival > t && patient.arrival - announced <= t).sort((a, b) => a.arrival - b.arrival).map((patient) => ({ id: patient.id, in: Math.ceil(patient.arrival - t) }));
  const doctorsBusy = boxes.filter((one) => one.patient?.phase === "exam").length;
  const nursesBusy = waiting.filter((one) => one.looked).length + patients.filter((patient) => patient.start !== null && patient.start <= t && lookedAt(patient, t)).length;
  return {
    t,
    clock: clock(t),
    waiting,
    boxes,
    coming,
    doctors: { busy: doctorsBusy, total: settings.doctors },
    nurses: { busy: nursesBusy, total: settings.nurses ?? 0 },
    gone: patients.filter((patient) => patient.end <= t).length,
    arrived: patients.filter((patient) => patient.arrival <= t).length,
    crisis: Boolean(settings.crisis) && t >= settings.crisis.at && t < settings.crisis.at + settings.crisis.over,
  };
}

/** The scene in one line, beside the plan. */
export function sceneLine(scene) {
  const parts = [scene.clock, `${scene.waiting.length} en salle d'attente`, `${scene.boxes.filter((one) => one.patient).length} / ${scene.boxes.length} box occupés`, `médecins ${scene.doctors.busy} / ${scene.doctors.total} en examen`];
  if (scene.nurses.total) parts.push(scene.nurses.busy ? "l'infirmier réévalue" : "l'infirmier est libre");
  const overdue = scene.waiting.filter((one) => one.overdue).length;
  if (overdue) parts.push(`${overdue} au-delà du délai de leur bracelet`);
  const worse = scene.waiting.filter((one) => one.worse).length;
  if (worse) parts.push(`${worse} plus graves que leur bracelet (caché)`);
  parts.push(`${scene.gone} sortis`);
  return parts.join(" · ");
}
