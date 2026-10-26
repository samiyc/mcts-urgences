/**
 * The whole day of the detailed pathway at a glance (Sami, 26/10/2026, docs/recherche/feuille-de-route.md, step 5):
 * the department's state taken every `EVERY` minutes as the day goes (`sample`, from pathway-measures.js's
 * `account`, which changes nothing), and once the day is over the timeline (`timelineOf`): the patients present,
 * waiting for a box, waiting for a bed, the places full, and the moments that count (worsenings, patients gone
 * unseen, ambulances sent elsewhere, results overlooked, breaks, the accident, the intern's shift).
 */
export const EVERY = 10;

/** The places and people whose fullness the timeline shows, in this order. */
export const SHOWN = Object.freeze(["boxes", "sauv", "uhcd", "scanner", "doctors"]);

function snapshot(day, t) {
  let present = 0;
  for (const patient of day.patients.values()) if (patient.step !== "coming" && patient.step !== "out") present += 1;
  const bed = Object.values(day.wards).reduce((sum, ward) => sum + ward.waiting.length, 0);
  const full = SHOWN.filter((pool) => day.capacity[pool] > 0 && day.busy[pool] >= day.capacity[pool]);
  return { t, present, waiting: day.queues.waiting.length, arriving: day.queues.register.length + day.queues.triage.length, bed, full };
}

/** The samples due up to `until`, of the state between the last event and the next one. */
export function sample(day, until) {
  while (day.nextSample <= until) {
    day.series.push(snapshot(day, day.nextSample));
    day.nextSample += EVERY;
  }
}

/** The moments of the day that count, each `[t]` or `[{ from, to }]`. */
function markersOf(day) {
  const patients = [...day.patients.values()];
  const { crisis } = day.settings;
  return {
    worsened: patients.flatMap((patient) => patient.worsenedAt),
    left: patients.filter((patient) => patient.exit === "parti").map((patient) => patient.exitAt),
    diverted: patients.filter((patient) => patient.exit === "reoriente").map((patient) => patient.exitAt),
    overlooked: day.fatigue?.overlookedAt ?? [],
    breaks: day.fatigue ? day.fatigue.people.flatMap((person) => person.breaks.map(({ from, to }) => ({ from, to, k: person.k }))) : [],
    crisis: crisis ? { from: crisis.at, to: crisis.at + crisis.over } : null,
  };
}

/**
 * A finished day's timeline: `{ series: [{ t, present, waiting, arriving, bed, full }], end, markers }`, `end` the last
 * patient's exit (or the day's end), `full` the pools of SHOWN full at that moment.
 */
export function timelineOf(day) {
  const end = Math.max(day.settings.shift, ...[...day.patients.values()].map((patient) => patient.exitAt ?? day.clock));
  return { series: day.series.filter((one) => one.t <= end), end, markers: markersOf(day), startHour: day.settings.startHour };
}
