import { candidatesOf, reassess } from "./simulate.js";
import { bedNear, near, same } from "./ward-moves.js";
import { busy, playerOf, startExam } from "./ward-staff.js";

/** The person at the keyboard on the plan (ward.js): Z Q S D (or the arrows) to walk, E to examine or to look again. */

export const MOVES = Object.freeze({ z: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], q: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] });

/** The patient lying in box `box` and called, not yet out, or undefined. */
const calledIn = (ward, box) => [...ward.shift.patients.values()].find((one) => one.box === box && one.end === null && one.calledAt !== undefined);

/** The doctor at the keyboard examines `patient` in `box`: a colleague's patient, not started, swaps the two. */
function examine(ward, me, { box, patient }) {
  if (me.patient !== patient.id) {
    const colleague = ward.doctors.find((one) => one.patient === patient.id);
    colleague.patient = me.patient;
    me.patient = patient.id;
  }
  Object.assign(me, ward.layout.beds[box]);
  startExam(ward, me);
  return `Box ${box + 1} : vous examinez le patient n° ${patient.id}.`;
}

/** The doctor at the keyboard presses E. Returns what the page says. */
function doctorUses(ward, me) {
  if (me.examining) return `Vous examinez le patient n° ${me.patient}.`;
  const box = bedNear(ward, me);
  if (box < 0) return "Pas de lit ici : E au lit d'un box.";
  const patient = calledIn(ward, box);
  if (!patient) return `Box ${box + 1} : personne.`;
  if (patient.start !== null) return `Box ${box + 1} : le patient n° ${patient.id} est en soins, l'examen est fait.`;
  if (!same(ward.people.get(patient.id), ward.layout.beds[box])) return `Box ${box + 1} : le patient n° ${patient.id} arrive.`;
  return examine(ward, me, { box, patient });
}

/** The nurse at the keyboard presses E beside a waiting patient. */
function nurseUses(ward, me) {
  if (me.looking !== null) return `Vous réévaluez le patient n° ${me.looking}.`;
  const { shift } = ward;
  const beside = shift.waiting.map((id) => shift.patients.get(id)).filter((patient) => near(ward.people.get(patient.id), me));
  if (beside.length === 0) return "Personne à côté : E à côté d'un patient qui attend.";
  const due = beside.find((patient) => candidatesOf(shift).includes(patient));
  if (!due) {
    const { recheck } = shift.settings;
    return `Le patient n° ${beside[0].id} a été vu il y a moins de ${recheck} min.`;
  }
  reassess(shift, due.id);
  me.looking = due.id;
  return `Vous réévaluez le patient n° ${due.id} (${shift.settings.reassess} min).`;
}

/** The key pressed by the person, this step: a move, or E. Returns what the page says, or null. */
export function pressKey(ward, key) {
  const me = playerOf(ward);
  if (!me) return null;
  if (key === "e") return me.kind === "doctor" ? doctorUses(ward, me) : nurseUses(ward, me);
  const move = MOVES[key];
  if (!move) return null;
  if (busy(me)) return "Occupé : l'examen ou la réévaluation n'est pas fini.";
  const [dx, dy] = move;
  if (ward.layout.passable(me.x + dx, me.y + dy)) {
    me.x += dx;
    me.y += dy;
  }
  return null;
}
