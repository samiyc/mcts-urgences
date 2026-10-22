import { COLOURS, LATE_WEIGHT } from "../src/hypotheses.js";

/**
 * What the page shows of a shift, pure and tested under Node (tests/view.test.js): the boxes' timeline, the
 * waiting room over time, the shift in one line, and the patients the rule served worst, with what the
 * department could not see (their true level). The DOM layer (app.js) only draws it.
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
      truth: COLOURS[patient.arrivalLevel],
      mistriaged: patient.colour !== patient.arrivalLevel,
      arrival: clock(patient.arrival),
      wait: Math.round(patient.wait),
      late: Math.round(patient.late),
      worsened: patient.worsened,
      cost: Math.round(cost),
    }));
}
