import { HOSPITALS } from "../../src/hypotheses.js";
import { BED_LABELS } from "../../src/pathway.js";
import { RULE_LABELS } from "../../src/rules.js";
import { el } from "../dom.js";
import { downloadPathway, openPathwayReplay, pathwayKept } from "./parcours.js";

/**
 * The tab « Replays » (Sami, 26/10/2026): the games kept in this browser, by kind (the shift played, the plan, the
 * days of the pathway), and the files the page server wrote to the project's replays/ (out of git). `ctx`: the page's
 * `state`, `render`, `openTab`, `player`, `internPanel`, `pathway`.
 */
export const replaysPanel = () =>
  el("section", { class: "panel" }, el("h2", {}, "Les replays"), el("p", { class: "hint" }, "Chaque partie jouée se garde ici, dans ce navigateur, et dans le dossier replays/ du projet quand la page passe par son serveur (npm run page). Une journée du parcours se garde par « Garder cette journée » ; elle se rouvre avec ses réglages et son plan."));

function pathwayList() {
  const kept = pathwayKept();
  if (!kept.length) return el("p", { class: "hint" }, "Aucune journée gardée : « Garder cette journée », onglet Parcours détaillé.");
  const item = (replay, i) =>
    el(
      "li",
      {},
      `${replay.savedAt.slice(0, 16).replace("T", " ")} · ${HOSPITALS[replay.hospital]?.label ?? replay.hospital}${replay.accident ? ", accident" : ""} · journée ${replay.seed} · ${RULE_LABELS[replay.box]}, ${BED_LABELS[replay.bed]}${replay.plan ? " · plan modifié" : ""} `,
      el("button", { type: "button", class: "quiet", "data-pathway-kept": String(i), "data-do": "open" }, "Rouvrir"),
      " ",
      el("button", { type: "button", class: "quiet", "data-pathway-kept": String(i), "data-do": "download" }, "Télécharger"),
    );
  return el("ol", { class: "replay-list" }, ...kept.map(item));
}

function serverList(files) {
  if (files === null) return el("p", { class: "hint" }, "Lecture du dossier replays/…");
  if (!files.length) return el("p", { class: "hint" }, "Aucun fichier dans replays/ (ou la page ne passe pas par son serveur).");
  return el("ol", { class: "replay-list" }, ...files.slice(0, 50).map((name) => el("li", {}, el("a", { href: `../replays/${name}`, download: name }, name))));
}

/** The files of replays/, asked once the tab opens (the page server lists them). */
function askServer(ctx) {
  if (ctx.state.serverReplays !== undefined) return;
  ctx.state.serverReplays = null;
  fetch("/api/replays")
    .then((response) => (response.ok ? response.json() : { files: [] }))
    .catch(() => ({ files: [] }))
    .then(({ files }) => {
      ctx.state.serverReplays = files ?? [];
      ctx.render();
    });
}

export function replaysView(ctx) {
  askServer(ctx);
  return [
    el("section", { class: "player" }, el("h2", {}, "Les journées du parcours"), pathwayList()),
    ctx.player.keptView(),
    ctx.internPanel.keptView(),
    el("section", { class: "player" }, el("h2", {}, "Le dossier replays/ du projet"), serverList(ctx.state.serverReplays)),
  ];
}

/** A day of the pathway kept, opened again in its tab, or downloaded; true if the click was this tab's. */
export function replaysClick(ctx, target) {
  const kept = /** @type {HTMLElement | null} */ (target.closest?.("[data-pathway-kept]"));
  if (!kept) return false;
  const replay = pathwayKept()[Number(kept.dataset.pathwayKept)];
  if (kept.dataset.do === "download") {
    downloadPathway(replay);
    return true;
  }
  openPathwayReplay(ctx, replay);
  ctx.openTab("parcours");
  return true;
}
