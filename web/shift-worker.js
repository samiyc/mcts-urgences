import { NURSE_RULES, RULES } from "../src/rules.js";
import { drawShift } from "../src/scenario.js";
import { searchRule } from "../src/search.js";
import { simulateShift } from "../src/simulate.js";

/**
 * One shift of the page's comparison, played in a worker so that the shifts run side by side on the machine's
 * cores (Sami, 23/10/2026: twelve shifts with the search took long and left the processor idle). Given
 * `{ job, seed, settings, rule, nurse }` (the rules by name, "search" for the search), it answers
 * `{ job, measures }`: the same measures as the page playing the shift itself.
 */
const ruleOf = (name) => (name === "search" ? searchRule() : RULES[name]);
const nurseRuleOf = (name) => (name === "search" ? searchRule() : (NURSE_RULES[name] ?? null));

self.onmessage = ({ data: { job, seed, settings, rule, nurse } }) => {
  const { measures } = simulateShift(drawShift(seed, settings), ruleOf(rule), settings, nurseRuleOf(nurse));
  self.postMessage({ job, measures });
};
