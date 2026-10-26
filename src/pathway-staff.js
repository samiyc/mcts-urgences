import { endBreak, newTeam } from "./pathway-fatigue.js";
import { give, now } from "./pathway-places.js";
import { internArrive } from "./pathway-intern-decided.js";
import { locate } from "./pathway-trace.js";

/**
 * The events of the detailed pathway's staff (pathway-handlers.js has the patients'): a stretcher-bearer back, a step
 * of the plan, a break's window, a break's end, the 12 h teams' handover (pathway-fatigue.js, step 4).
 */
export const STAFF_HANDLERS = {
  /** A stretcher-bearer back at the base: free for the next transport (served at every event). */
  porterFree() {},
  /** A step of the plan played by the intern (pathway-game.js): only the clock. */
  tick() {},
  /** The intern decided by events at their task's place (pathway-intern-decided.js). */
  internArrive,
  /** A window for breaks opens or closes (pathway-fatigue.js): the breaks are served at every event. */
  breakCheck() {},
  breakEnd(day, event) {
    give(day, "doctors");
    day.trace.doctors[event.k] = null;
    endBreak(day, day.fatigue.people[event.k]);
    locate(day, `doctor:${event.k}`, { at: "room" });
  },
  /** The 12 h teams change: the team going out tells the one coming in, who takes no patient meanwhile. */
  handover(day) {
    day.capacity.doctors -= day.settings.doctors;
    newTeam(day);
    day.events.schedule(now(day) + day.settings.fatigue.handover, { type: "handoverEnd" });
  },
  handoverEnd(day) {
    day.capacity.doctors += day.settings.doctors;
  },
  /** The doctors called back by the crisis plan come (pathway-alert.js), and go at the day's end. */
  alertStaff(day) {
    day.capacity.doctors += day.alert.recalled;
  },
  alertEnd(day) {
    day.capacity.doctors -= day.alert.recalled;
  },
};
