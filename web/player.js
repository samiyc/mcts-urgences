import { COLOURS, MAX_WAIT } from "../src/hypotheses.js";
import { HOLD } from "../src/simulate.js";
import { MODES, REPLAY_FORMAT, benchmarksOf, gapsOf, play, replayOf, resultOf, startGame, suggestion, waitingOf } from "../src/play.js";
import { fixed } from "./dom.js";
import { createReplayStore, download, replayName } from "./replay-store.js";
import { clock } from "./view.js";

/**
 * « Jouer la garde vous-même » (Sami, 23/10/2026, the roadmap's step 2): the person decides who goes into a free
 * box, alone or helped by the assistant (the search's pick shown); the nurse keeps the page's rule. At the end, the
 * shift against the rules and the assistant alone on the same patients, and the gaps of each choice with hindsight.
 * The games are kept in this browser (the last 20) and download as replays. The deciding is in src/play.js;
 * this module draws and listens. `createPlayer({ el, current, render, setBusy })`.
 *
 * Each function takes the player's context `ctx`: the page's `el`, `current`, `render`, `setBusy`, and `player`,
 * the game's state.
 */
const store = createReplayStore("urgences-replays");
const downloadReplay = (replay) => download(replayName("urgences", replay), JSON.stringify(replay, null, 1));

/** The assistant's pick for the choice in front of the person, computed once a choice. */
function suggest({ player }) {
  player.suggested = player.game && !player.game.over && player.game.mode === "aide" ? suggestion(player.game) : null;
}

function finish({ player }) {
  const replay = replayOf(player.game);
  store.keep(replay);
  player.ended = { replay, result: resultOf(player.game).measures, benchmarks: benchmarksOf(player.game) };
  player.gaps = null;
}

/** The gaps of `replay`, a few seconds of play: the page says so first. */
function analyse({ player, setBusy }, replay) {
  setBusy("Analyse des écarts : chaque choix rejoué avec le recul…");
  setTimeout(() => {
    player.gaps = { replay, ...gapsOf(replay) };
    setBusy("");
  }, 30);
}

const ACTIONS = {
  start: (ctx) => {
    const { hospital, accident, seed, nurse } = ctx.current();
    Object.assign(ctx.player, { game: startGame({ hospital, accident, seed, nurse, mode: ctx.player.mode }), ended: null, gaps: null });
    suggest(ctx);
  },
  quit: ({ player }) => Object.assign(player, { game: null, ended: null, gaps: null }),
  analyse: (ctx) => analyse(ctx, ctx.player.ended.replay),
  download: ({ player }) => downloadReplay(player.ended.replay),
};

function choose(ctx, id) {
  play(ctx.player.game, id === HOLD ? HOLD : Number(id));
  if (ctx.player.game.over) finish(ctx);
  else suggest(ctx);
}

/** A waiting patient's card, the assistant's pick marked. */
function patientCard({ el, player }, view, now) {
  const waited = now - view.arrival;
  const over = waited > MAX_WAIT[view.colour];
  const picked = player.suggested === view.id;
  const looked = view.reassessedAt !== null && view.reassessedAt !== undefined;
  const late = over ? ` (délai de ${MAX_WAIT[view.colour]} min dépassé)` : "";
  return el(
    "button",
    { type: "button", class: `patient-card${picked ? " suggested" : ""}${over ? " overdue" : ""}`, "data-patient": String(view.id) },
    el("span", { class: `dot ${COLOURS[view.colour]}` }),
    el("strong", {}, `n° ${view.id}`),
    ` ${COLOURS[view.colour]}${view.source === "ambulance" ? " 🚑" : ""}`,
    el("span", { class: "card-line" }, `arrivé à ${clock(view.arrival)}, attend depuis ${Math.round(waited)} min${late}`),
    looked ? el("span", { class: "card-line" }, `revu à ${clock(view.reassessedAt)}`) : null,
    picked ? el("span", { class: "card-line pick" }, "l'assistant propose ce patient") : null,
  );
}

/** The waiting room at a box choice: a card a patient, the assistant's pick marked when helped. */
function choiceView(ctx) {
  const { el, player } = ctx;
  const { game } = player;
  const now = game.shift.events.now;
  const cards = waitingOf(game).map((view) => patientCard(ctx, view, now));
  const free = `${game.shift.boxIds.length} box et ${game.shift.freeDoctors} médecin${game.shift.freeDoctors > 1 ? "s" : ""} libres`;
  const holds = game.mode === "aide" && player.suggested === HOLD ? " L'assistant propose d'attendre (une ambulance annoncée, un box à garder)." : "";
  return el(
    "section",
    { class: "player" },
    el("h2", {}, `Vous décidez : ${clock(now)}, ${free}, ${waitingOf(game).length} patient(s) en salle d'attente`),
    el("p", { class: "hint" }, `${MODES[game.mode]} · ${game.choices.length} choix faits · qui faites-vous entrer ?${holds}`),
    el("div", { class: "patient-cards" }, ...cards),
    el("div", { class: "controls" }, el("button", { type: "button", class: `quiet${player.suggested === HOLD ? " suggested" : ""}`, "data-patient": HOLD }, "Attendre (garder le box libre)"), el("button", { type: "button", class: "quiet", "data-player": "quit" }, "Abandonner la partie")),
  );
}

/** The end: the person's shift against the rules and the assistant, then the gaps once analysed. */
function endView(ctx) {
  const { el, player } = ctx;
  const { result, benchmarks, replay } = player.ended;
  const rows = [
    ["vous", result.lateCostNow, result.late],
    ["la couleur, puis l'arrivée", benchmarks.colour.lateCostNow, benchmarks.colour.late],
    ["l'échéance la plus proche", benchmarks.deadline.lateCostNow, benchmarks.deadline.late],
    ["l'assistant seul (la recherche)", benchmarks.assistant.lateCostNow, benchmarks.assistant.late],
  ].map(([who, cost, late]) => el("tr", { class: who === "vous" ? "current" : null }, el("td", {}, who), el("td", { class: "num" }, fixed(cost)), el("td", { class: "num" }, String(late))));
  return el(
    "section",
    { class: "player" },
    el("h2", {}, `Votre garde est finie (${MODES[replay.mode]}, ${replay.choices.length} choix)`),
    el("p", { class: "hint" }, "Le coût du retard au niveau du moment : chaque minute d'attente au-delà du délai du vrai niveau du patient, pondérée par sa gravité (moins, c'est mieux). Mêmes patients pour tous."),
    el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "La garde jouée par"), el("th", { class: "num" }, "coût du retard"), el("th", { class: "num" }, "patients en retard"))), el("tbody", {}, ...rows))),
    el("div", { class: "controls" }, el("button", { type: "button", "data-player": "analyse" }, "Analyser mes choix"), el("button", { type: "button", class: "quiet", "data-player": "download" }, "Télécharger le replay"), el("button", { type: "button", class: "quiet", "data-player": "quit" }, "Fermer")),
    player.gaps ? gapsView(ctx, player.gaps) : null,
  );
}

/** A patient of a choice, by number and bracelet; or the hold. */
function choiceLabel(choice, id) {
  if (id === HOLD) return "attendre";
  const option = choice.options.find((one) => one.id === id);
  return option ? `n° ${id} (${COLOURS[option.colour]})` : `n° ${id}`;
}

function gapsView({ el }, { choices, agreed, withAssistant }) {
  const costly = [...choices].filter((choice) => choice.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 8);
  const rows = costly.map((choice) => el("tr", {}, el("td", {}, clock(choice.now)), el("td", {}, choiceLabel(choice, choice.chosen)), el("td", {}, choiceLabel(choice, choice.best)), el("td", {}, choice.assistant === null ? "—" : choiceLabel(choice, choice.assistant)), el("td", { class: "num" }, `+${fixed(choice.gap)}`)));
  const head = ["À", "vous avez pris", "le meilleur avec le recul", "l'assistant proposait", "coût en plus"].map((label, i) => el("th", { class: i === 4 ? "num" : null }, label));
  return el(
    "div",
    { class: "gaps" },
    el("h3", {}, `Vos ${choices.length} choix : ${agreed} aussi bons que le meilleur avec le recul ; ${withAssistant} comme l'assistant`),
    el("p", { class: "hint" }, "Avec le recul : à chaque choix, chaque patient qui pouvait entrer est essayé, puis la garde jouée jusqu'au bout sous « l'échéance la plus proche », avec les vrais patients à venir. Un écart dit ce qu'un choix a coûté à lui seul ; les écarts ne s'additionnent pas (chacun suppose la suite jouée par la règle)."),
    costly.length ? el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows))) : el("p", {}, "Aucun choix coûteux."),
  );
}

/** The games kept, each to analyse or download. */
function keptList({ el }, kept) {
  if (!kept.length) return null;
  const item = (replay, i) =>
    el(
      "li",
      {},
      `${replay.savedAt.slice(0, 16).replace("T", " ")} · ${replay.hospital}${replay.accident ? ", accident" : ""} · garde ${replay.seed} · ${MODES[replay.mode]} · ${replay.choices.length} choix `,
      el("button", { type: "button", class: "quiet", "data-kept": String(i), "data-do": "analyse" }, "Analyser"),
      " ",
      el("button", { type: "button", class: "quiet", "data-kept": String(i), "data-do": "download" }, "Télécharger"),
    );
  return el("ol", { class: "replay-list" }, ...kept.map(item));
}

/** How to start a game, the kept games, and the gaps of one analysed. */
function startView(ctx) {
  const { el, player } = ctx;
  return el(
    "details",
    { class: "editor player-start" },
    el("summary", {}, "Jouer la garde vous-même"),
    el("p", { class: "hint" }, "Vous décidez qui entre dans un box libre, sur la garde choisie plus haut (hôpital, situation, numéro) ; l'infirmier de tri garde sa règle. Seul, ou aidé par l'assistant, qui vous montre le patient que la recherche ferait entrer. À la fin : votre garde contre les règles et l'assistant seul, et les écarts de vos choix."),
    el("div", { class: "controls" }, el("label", {}, "Je joue", el("select", { "data-player-mode": "1" }, ...Object.entries(MODES).map(([value, text]) => el("option", { value, selected: value === player.mode }, text)))), el("button", { type: "button", "data-player": "start" }, "Commencer la garde")),
  );
}

/** The games kept, for the Replays tab, and the gaps of the one analysed. */
function keptView(ctx) {
  const { el, player } = ctx;
  return el(
    "section",
    { class: "player" },
    el("h2", {}, "Les gardes jouées"),
    keptList(ctx, store.load()) ?? el("p", { class: "hint" }, "Aucune garde jouée dans ce navigateur : « Jouer la garde vous-même », onglet Garde simple."),
    player.gaps && !player.ended ? gapsView(ctx, player.gaps) : null,
  );
}

/** The panel: the game in front of the person, its end, or how to start one; and the kept games. */
function view(ctx) {
  if (playing(ctx.player)) return choiceView(ctx);
  return ctx.player.ended ? endView(ctx) : startView(ctx);
}

/** A kept game clicked: downloaded, or analysed. */
function keptClicked(ctx, kept) {
  const replay = store.load()[Number(kept.dataset.kept)];
  if (replay?.format !== REPLAY_FORMAT) return;
  if (kept.dataset.do === "download") downloadReplay(replay);
  else analyse(ctx, replay);
}

const closest = (target, selector) => target.closest?.(selector) ?? null;
const playing = (player) => Boolean(player.game && !player.game.over);

/** What a click asks of the player, or null: a patient chosen, an action, a kept game (not drawn again yet). */
function clicked(ctx, target) {
  const patient = closest(target, "[data-patient]");
  if (patient && playing(ctx.player)) return { run: () => choose(ctx, patient.dataset.patient), draw: true };
  const action = closest(target, "[data-player]")?.dataset.player;
  if (ACTIONS[action]) return { run: () => ACTIONS[action](ctx), draw: true };
  const kept = closest(target, "[data-kept]");
  return kept ? { run: () => keptClicked(ctx, kept), draw: false } : null;
}

/** Handles a click in the page; true if it was the player's. */
function click(ctx, target) {
  const asked = clicked(ctx, target);
  if (!asked) return false;
  asked.run();
  if (asked.draw) ctx.render();
  return true;
}

function change({ player }, target) {
  if (!target.dataset?.playerMode) return false;
  player.mode = target.value;
  return true;
}

export function createPlayer({ el, current, render, setBusy }) {
  const ctx = { el, current, render, setBusy, player: { game: null, mode: "aide", suggested: null, ended: null, gaps: null } };
  const { player } = ctx;
  return {
    view: () => view(ctx),
    click: (target) => click(ctx, target),
    change: (target) => change(ctx, target),
    playing: () => playing(player) || Boolean(player.ended),
    keptView: () => keptView(ctx),
  };
}
