import { followChoices } from "../../src/pathway-search-compare.js";
import { el } from "../dom.js";
import { searchChoicesInWorker } from "../pathway-search-workers.js";

/**
 * The search as the box rule of the tab « Parcours détaillé » (Sami, 26/10/2026, step 6): it plays the day in a worker
 * (half a minute or so), and the tab replays the day from its choices (`followChoices`), the same day exactly. Not with
 * an intern (the search does not play their tasks).
 */
export const PAGE_BUDGET = 50;

/** The settings the search's day depends on. */
const keyOf = ({ state, pathway }, fatigue) => JSON.stringify([state.hospital, state.accident, state.seed, pathway.bed, pathway.plan, pathway.walk, fatigue]);

/**
 * The box rule replaying the search's choices for the day of the settings, or null while the worker plays it (started
 * once; the tab drawn again when it answers).
 */
export function searchedBox(ctx, fatigue) {
  const { pathway, state } = ctx;
  const key = keyOf(ctx, fatigue);
  if (pathway.searched?.key === key) return pathway.searched.choices ? followChoices(pathway.searched.choices) : null;
  pathway.searched = { key, choices: null };
  const options = { hospital: state.hospital, accident: state.accident, walk: pathway.walk, fatigue, ...(pathway.plan ? { plan: pathway.plan } : {}) };
  searchChoicesInWorker({ seed: state.seed, options, bed: pathway.bed, budget: PAGE_BUDGET })
    .then((choices) => {
      if (pathway.searched?.key === key) pathway.searched.choices = choices;
      ctx.render();
    })
    .catch(() => {
      pathway.searched = null;
      pathway.box = "colour";
      ctx.render();
    });
  return null;
}

export const searchingView = () => [el("p", { class: "summary busy", role: "status" }, `La recherche joue la journée dans un worker, à ${PAGE_BUDGET} itérations par choix : une demi-minute environ…`)];
