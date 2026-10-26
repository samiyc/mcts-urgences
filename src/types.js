/**
 * The shapes the modules hand each other, for the type check (`npm run types`, tsc on the JSDoc; Sami, 26/10/2026):
 * nothing runs here. A module imports one with `@typedef {import("./types.js").Rule} Rule`.
 */

/**
 * What a rule sees of a waiting patient: never the true level.
 * @typedef {{ id: number | string, arrival: number, colour: number, source: string, reassessedAt?: number | null }} View
 */

/**
 * A rule's context at a choice: the clock, and for the search the shift itself (simulate.js).
 * @typedef {{ now?: number, shift?: object, kind?: string, freeBoxes?: number, freeDoctors?: number, day?: Day }} Context
 */

/**
 * A rule: who among the views goes next (rules.js, search.js), or null for nobody (a nurse rule).
 * @typedef {(views: View[], context?: Context) => View | { id: string } | null} Rule
 */

/**
 * What a bed rule sees of a patient waiting for a bed (pathway.js).
 * @typedef {{ id: number, arrival: number, colour: number, admitAt: number, inBox: boolean, elderly: boolean }} BedView
 */

/** @typedef {(waiting: BedView[], context?: Context) => BedView} BedRule */

/**
 * A patient of the detailed pathway, as drawn (pathway-scenario.js) then followed (pathway.js): what the department
 * sees (colour, source, arrival), the hidden pathway (level, needs, orientation, ward…), and where they are (`step`).
 * @typedef {{
 *   id: number, arrival: number, source: string, announcedAt: number, level: number, colour: number,
 *   examFactor: number, stayFactor: number, worsenDelays: number[],
 *   needs: { bio: boolean, scan: boolean, advice: boolean }, orientation: string, ward: string, thenWard: boolean,
 *   isolate: boolean, elderly: boolean, patience: number, labFactor: number, uhcdFactor: number, theatreFactor: number,
 *   arrivalLevel?: number, levelAtStart?: number, worsened?: number, worsenedAt?: number[], step?: string,
 *   place?: string | null, start?: number | null, examEnd?: number, careEnd?: number, exit?: string | null,
 *   exitAt?: number | null, pending?: number, triagedAt?: number | null, orderedAt?: number | null,
 *   reviewedAt?: number | null, admitAt?: number | null, uhcdAt?: number | null, bedAt?: number, boxBoarding?: number,
 * }} PathwayPatient
 */

/**
 * A day of the detailed pathway under way (`startPathway`): its settings and events, the patients by id, the wards'
 * free beds and waiting patients, the pools' capacities and use, the queues of the fixed orders, the peaks.
 * @typedef {{
 *   settings: object, events: object, patients: Map<number, PathwayPatient>,
 *   wards: Record<string, { free: number, waiting: number[] }>,
 *   capacity: Record<string, number>, busy: Record<string, number>, used: Record<string, number>, full: Record<string, number>,
 *   clock: number, queues: Record<string, number[]>, diverted: Set<number>,
 *   peak: { waiting: number, present: number, urgent: number }, over: boolean, trace: Trace,
 *   porters: Array<{ who: string, freeAt: number }>, intern: object | null, fatigue: object | null,
 *   series: object[], nextSample: number,
 * }} Day
 */

/**
 * Where everyone is during the day (pathway-trace.js): the places by number, the doctors, the moves.
 * @typedef {{ t: number, who: number | string, to: { at: string, slot?: number, id?: number, door?: string } }} Move
 * @typedef {{
 *   slots: Record<string, Array<number | string | null>>, doctors: Array<number | null>, where: Map<number | string, Move["to"]>,
 *   moves: Move[], placeOf: Map<number, number>, scanOf: Map<number, number>,
 * }} Trace
 */

/**
 * A decision the day waits for: who takes a free place and a doctor, who takes a bed a ward freed, or whether a free
 * doctor takes their break now (breaks decided one at a time, pathway-fatigue.js).
 * @typedef {{ kind: "box", candidates: View[] } | { kind: "bed", ward: string, candidates: BedView[] } | { kind: "break", k: number, slot: string, candidates: Array<{ id: string }> } | { kind: "intern", candidates: Array<{ id: number, kind: string, patient: number, due: number, colour: number, steps: number }> }} Decision
 */

export {};
