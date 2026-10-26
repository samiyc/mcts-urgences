import { HOSPITALS } from "../src/hypotheses.js";
import { comparePathwayRules } from "../src/pathway-compare.js";
import { compareBreakRules } from "../src/pathway-fatigue-compare.js";
import { BREAK_SEARCHED, searchRows } from "../src/pathway-search-compare.js";
import { compareSearchInWorkers } from "./pathway-search-workers.js";
import { PAGE_BUDGET } from "./tabs/parcours-search.js";

/**
 * The comparisons of the Stats tab on the detailed pathway (Sami, 26/10/2026): the rules, the breaks, the search on
 * the boxes and on the breaks (these two in workers). Each takes the page's context `ctx` (`state`, `setBusy`,
 * `render`, the tab's `pathway`) and puts its rows in `state`; `statsActions(ctx)` gives them as the page's actions.
 */
const SEARCH_DAYS = 8;

/** The day's settings the comparisons share, and their label. */
function settingsOf({ state, pathway }, { withPlan = false } = {}) {
  const { plan, walk } = pathway;
  const options = { hospital: state.hospital, accident: state.accident, walk, ...(plan ? { plan } : {}) };
  const label = `${HOSPITALS[state.hospital].label}, ${state.accident ? "avec l'accident" : "jour ordinaire"}${walk ? ", marche comptée" : ""}${withPlan && plan ? ", plan modifié" : ""}`;
  return { options, label };
}

/** A comparison on the page's thread: `rowsOf(options)` after the page has said so. */
function onThePage(ctx, { message, key, rowsOf, withPlan = false }) {
  ctx.setBusy(message);
  setTimeout(() => {
    const { options, label } = settingsOf(ctx, { withPlan });
    Object.assign(ctx.state, { [key]: { rows: rowsOf(options), days: ctx.state.pathwayDays, label }, busy: "" });
    ctx.render();
  }, 30);
}

/** A comparison of the search in workers, `kind` its days' play (web/pathway-worker.js). */
async function inWorkers(ctx, { what, key, kind, names = undefined, extra = {} }) {
  const { options, label } = settingsOf(ctx);
  ctx.setBusy(`${what} : ${SEARCH_DAYS} journées dans des workers…`);
  const progress = (done, all, size) => ctx.setBusy(`${what} : ${done} journées sur ${all} (${size} en parallèle)…`);
  const measures = await compareSearchInWorkers({ days: SEARCH_DAYS, options, budget: PAGE_BUDGET, kind, progress });
  Object.assign(ctx.state, { [key]: { rows: searchRows(measures, names).map((row) => ({ ...row, ...extra })), days: SEARCH_DAYS, budget: PAGE_BUDGET, label, title: what }, busy: "" });
  ctx.render();
}

export const statsActions = (ctx) => ({
  comparePathway: () => onThePage(ctx, { message: `Le parcours : ${ctx.state.pathwayDays} journées de 24 h, six règles…`, key: "pathwayCompared", withPlan: true, rowsOf: (options) => comparePathwayRules({ days: ctx.state.pathwayDays, ...options }) }),
  compareFatigue: () => onThePage(ctx, { message: `Les pauses des médecins : ${ctx.state.pathwayDays} journées de 24 h, sept façons…`, key: "fatigueCompared", rowsOf: (options) => compareBreakRules({ days: ctx.state.pathwayDays, ...options }) }),
  compareSearchPathway: () => inWorkers(ctx, { what: "La recherche sur le parcours", key: "searchCompared", kind: "compare", extra: {} }),
  compareSearchBreaks: () => inWorkers(ctx, { what: "La recherche des pauses des médecins", key: "breaksCompared", kind: "breaks", names: BREAK_SEARCHED, extra: { breaks: true } }),
});
