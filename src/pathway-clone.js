/**
 * A copy of a day of the detailed pathway under way (Sami, 26/10/2026, step 6): the search plays worlds forward from
 * it (pathway-search.js) without touching the real day. Everything that changes as the day goes is copied; what does
 * not (the settings, the plan, the break windows) is shared. `keep(event)` chooses the events kept; the copy draws no
 * timeline and keeps no walks (a world is played, never drawn); unless walking counts, it walks nobody either.
 */

const copyPatient = (patient) => ({ ...patient, worsenedAt: [...patient.worsenedAt], worsenDelays: [...patient.worsenDelays], needs: { ...patient.needs } });

/** The trace of a world: copied, light when walking does not count (no walks, no seats: pathway-trace.js's `locate`). */
function copyTrace(trace, walk) {
  return {
    ...trace,
    light: !walk,
    walks: [],
    moves: [],
    transports: [],
    last: new Map(trace.last),
    where: new Map(trace.where),
    seats: { waiting: trace.seats.waiting.clone(), results: trace.seats.results.clone() },
    slots: Object.fromEntries(Object.entries(trace.slots).map(([pool, slots]) => [pool, [...slots]])),
    doctors: [...trace.doctors],
    placeOf: new Map(trace.placeOf),
    scanOf: new Map(trace.scanOf),
  };
}

/** The decided intern of a world (pathway-intern-decided.js): their tasks copied, the ones done in the world kept apart. */
function copyIntern(intern) {
  if (!intern) return null;
  return { ...intern, assigned: new Set(intern.assigned), tasks: intern.tasks.map((task) => ({ ...task })), done: [], track: [], cell: { ...intern.cell }, goingTo: intern.goingTo && { ...intern.goingTo } };
}

function copyFatigue(fatigue) {
  if (!fatigue) return null;
  return {
    ...fatigue,
    people: fatigue.people.map((person) => ({ ...person, asked: new Map(person.asked), taken: new Set(person.taken), breaks: [...person.breaks], onBreak: person.onBreak && { ...person.onBreak } })),
    overlookedAt: [],
    slows: [],
  };
}

export function cloneDay(day, keep = () => true) {
  return {
    ...day,
    events: day.events.clone(keep),
    // A patient out of the department changes no more: shared, not copied.
    patients: new Map([...day.patients].map(([id, patient]) => [id, patient.exit === null ? copyPatient(patient) : patient])),
    wards: Object.fromEntries(Object.entries(day.wards).map(([ward, { free, waiting }]) => [ward, { free, waiting: [...waiting] }])),
    capacity: { ...day.capacity },
    busy: { ...day.busy },
    used: { ...day.used },
    full: { ...day.full },
    queues: Object.fromEntries(Object.entries(day.queues).map(([name, queue]) => [name, queue.map((one) => (typeof one === "object" ? { ...one } : one))])),
    diverted: new Set(day.diverted),
    peak: { ...day.peak },
    trace: copyTrace(day.trace, day.settings.walk),
    porters: day.porters.map((porter) => ({ ...porter })),
    fatigue: copyFatigue(day.fatigue),
    intern: copyIntern(day.intern),
    alert: day.alert && { ...day.alert },
    het: day.het && { ...day.het, given: [...day.het.given] },
    isolation: day.isolation && { ...day.isolation },
    series: [],
    nextSample: Infinity,
  };
}
