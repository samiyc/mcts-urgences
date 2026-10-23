import { COLOURS, MAX_WAIT } from "../src/hypotheses.js";
import { HOLD } from "../src/simulate.js";
import { MODES, REPLAY_FORMAT, benchmarksOf, gapsOf, play, replayOf, resultOf, startGame, suggestion, waitingOf } from "../src/play.js";
import { clock } from "./view.js";

/**
 * « Jouer la garde vous-même » (Sami, 23/10/2026, the roadmap's step 2): the person decides who goes into a free
 * box, alone or helped by the assistant (the search's pick shown); the nurse keeps the page's rule. At the end, the
 * shift against the rules and the assistant alone on the same patients, and the gaps of each choice with hindsight.
 * The games are kept in this browser (the last `KEPT`) and download as replays. The deciding is in src/play.js;
 * this module draws and listens. `createPlayer({ el, settings, render, setBusy })`.
 */
const KEPT = 20;
const STORE = "urgences-replays";
const fixed = (value) => Math.round(value).toLocaleString("fr-FR");

export function createPlayer({ el, current, render, setBusy }) {
  const player = { game: null, mode: "aide", suggested: null, ended: null, gaps: null };

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE) ?? "[]");
    } catch {
      return [];
    }
  };
  const keep = (replay) => {
    // Also to the project's replays/ folder, through the page server (out of git; nothing if no server takes it).
    fetch("/api/replays", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(replay) }).catch(() => {});
    try {
      localStorage.setItem(STORE, JSON.stringify([replay, ...load()].slice(0, KEPT)));
    } catch {
      // Storage refused: the replay can still be downloaded.
    }
  };
  const download = (replay) => {
    const link = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(replay, null, 1)], { type: "application/json" })), download: `urgences-${replay.hospital}-garde${replay.seed}-${replay.savedAt.slice(0, 16).replace(/[:T]/g, "-")}.json` });
    document.body.append(link);
    link.click();
    link.remove();
  };
  /** The assistant's pick for the choice in front of the person, computed once a choice. */
  const suggest = () => {
    player.suggested = player.game && !player.game.over && player.game.mode === "aide" ? suggestion(player.game) : null;
  };
  const finish = () => {
    const replay = replayOf(player.game);
    keep(replay);
    player.ended = { replay, result: resultOf(player.game).measures, benchmarks: benchmarksOf(player.game) };
    player.gaps = null;
  };
  /** The gaps of `replay`, a few seconds of play: the page says so first. */
  const analyse = (replay) => {
    setBusy("Analyse des écarts : chaque choix rejoué avec le recul…");
    setTimeout(() => {
      player.gaps = { replay, ...gapsOf(replay) };
      setBusy("");
    }, 30);
  };

  const actions = {
    start: () => {
      const { hospital, accident, seed, nurse } = current();
      Object.assign(player, { game: startGame({ hospital, accident, seed, nurse, mode: player.mode }), ended: null, gaps: null });
      suggest();
    },
    quit: () => Object.assign(player, { game: null, ended: null, gaps: null }),
    analyse: () => analyse(player.ended.replay),
    download: () => download(player.ended.replay),
  };

  function choose(id) {
    play(player.game, id === HOLD ? HOLD : Number(id));
    if (player.game.over) finish();
    else suggest();
  }

  /** The waiting room at a box choice: a card a patient, the assistant's pick marked when helped. */
  function choiceView() {
    const { game } = player;
    const now = game.shift.events.now;
    const cards = waitingOf(game).map((view) => {
      const waited = now - view.arrival;
      const over = waited > MAX_WAIT[view.colour];
      const picked = player.suggested === view.id;
      return el(
        "button",
        { type: "button", class: `patient-card${picked ? " suggested" : ""}${over ? " overdue" : ""}`, "data-patient": String(view.id) },
        el("span", { class: `dot ${COLOURS[view.colour]}` }),
        el("strong", {}, `n° ${view.id}`),
        ` ${COLOURS[view.colour]}${view.source === "ambulance" ? " 🚑" : ""}`,
        el("span", { class: "card-line" }, `arrivé à ${clock(view.arrival)}, attend depuis ${Math.round(waited)} min${over ? ` (délai de ${MAX_WAIT[view.colour]} min dépassé)` : ""}`),
        view.reassessedAt !== null && view.reassessedAt !== undefined ? el("span", { class: "card-line" }, `revu à ${clock(view.reassessedAt)}`) : null,
        picked ? el("span", { class: "card-line pick" }, "l'assistant propose ce patient") : null,
      );
    });
    const free = `${game.shift.boxIds.length} box et ${game.shift.freeDoctors} médecin${game.shift.freeDoctors > 1 ? "s" : ""} libres`;
    return el(
      "section",
      { class: "player" },
      el("h2", {}, `Vous décidez : ${clock(now)}, ${free}, ${waitingOf(game).length} patient(s) en salle d'attente`),
      el("p", { class: "hint" }, `${MODES[game.mode]} · ${game.choices.length} choix faits · qui faites-vous entrer ?${game.mode === "aide" && player.suggested === HOLD ? " L'assistant propose d'attendre (une ambulance annoncée, un box à garder)." : ""}`),
      el("div", { class: "patient-cards" }, ...cards),
      el("div", { class: "controls" }, el("button", { type: "button", class: `quiet${player.suggested === HOLD ? " suggested" : ""}`, "data-patient": HOLD }, "Attendre (garder le box libre)"), el("button", { type: "button", class: "quiet", "data-player": "quit" }, "Abandonner la partie")),
    );
  }

  /** The end: the person's shift against the rules and the assistant, then the gaps once analysed. */
  function endView() {
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
      player.gaps ? gapsView(player.gaps) : null,
    );
  }

  function gapsView({ choices, agreed, withAssistant }) {
    const costly = [...choices].filter((choice) => choice.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 8);
    const label = (choice, id) => {
      if (id === HOLD) return "attendre";
      const option = choice.options.find((one) => one.id === id);
      return `n° ${id}${option ? ` (${COLOURS[option.colour]})` : ""}`;
    };
    const rows = costly.map((choice) => el("tr", {}, el("td", {}, clock(choice.now)), el("td", {}, label(choice, choice.chosen)), el("td", {}, label(choice, choice.best)), el("td", {}, choice.assistant === null ? "—" : label(choice, choice.assistant)), el("td", { class: "num" }, `+${fixed(choice.gap)}`)));
    return el(
      "div",
      { class: "gaps" },
      el("h3", {}, `Vos ${choices.length} choix : ${agreed} aussi bons que le meilleur avec le recul ; ${withAssistant} comme l'assistant`),
      el("p", { class: "hint" }, "Avec le recul : à chaque choix, chaque patient qui pouvait entrer est essayé, puis la garde jouée jusqu'au bout sous « l'échéance la plus proche », avec les vrais patients à venir. Un écart dit ce qu'un choix a coûté à lui seul ; les écarts ne s'additionnent pas (chacun suppose la suite jouée par la règle)."),
      costly.length ? el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...["À", "vous avez pris", "le meilleur avec le recul", "l'assistant proposait", "coût en plus"].map((head, i) => el("th", { class: i === 4 ? "num" : null }, head)))), el("tbody", {}, ...rows))) : el("p", {}, "Aucun choix coûteux."),
    );
  }

  /** The panel: the game in front of the person, its end, or how to start one; and the kept games. */
  function view() {
    if (player.game && !player.game.over) return choiceView();
    if (player.ended) return endView();
    const kept = load();
    return el(
      "details",
      { class: "editor player-start", open: Boolean(player.gaps) },
      el("summary", {}, "Jouer la garde vous-même"),
      el("p", { class: "hint" }, "Vous décidez qui entre dans un box libre, sur la garde choisie plus haut (hôpital, situation, numéro) ; l'infirmier de tri garde sa règle. Seul, ou aidé par l'assistant, qui vous montre le patient que la recherche ferait entrer. À la fin : votre garde contre les règles et l'assistant seul, et les écarts de vos choix."),
      el("div", { class: "controls" }, el("label", {}, "Je joue", el("select", { "data-player-mode": "1" }, ...Object.entries(MODES).map(([value, text]) => el("option", { value, selected: value === player.mode }, text)))), el("button", { type: "button", "data-player": "start" }, "Commencer la garde")),
      kept.length ? el("ol", { class: "replay-list" }, ...kept.map((replay, i) => el("li", {}, `${replay.savedAt.slice(0, 16).replace("T", " ")} · ${replay.hospital}${replay.accident ? ", accident" : ""} · garde ${replay.seed} · ${MODES[replay.mode]} · ${replay.choices.length} choix `, el("button", { type: "button", class: "quiet", "data-kept": String(i), "data-do": "analyse" }, "Analyser"), " ", el("button", { type: "button", class: "quiet", "data-kept": String(i), "data-do": "download" }, "Télécharger")))) : null,
      player.gaps && !player.ended ? gapsView(player.gaps) : null,
    );
  }

  /** Handles a click in the page; true if it was the player's. */
  function click(target) {
    const patient = target.closest?.("[data-patient]");
    if (patient && player.game && !player.game.over) {
      choose(patient.dataset.patient);
      render();
      return true;
    }
    const action = target.closest?.("[data-player]")?.dataset.player;
    if (actions[action]) {
      actions[action]();
      render();
      return true;
    }
    const kept = target.closest?.("[data-kept]");
    if (kept) {
      const replay = load()[Number(kept.dataset.kept)];
      if (replay?.format !== REPLAY_FORMAT) return true;
      if (kept.dataset.do === "download") download(replay);
      else analyse(replay);
      return true;
    }
    return false;
  }
  function change(target) {
    if (!target.dataset?.playerMode) return false;
    player.mode = target.value;
    return true;
  }
  return { view, click, change, playing: () => Boolean(player.game && !player.game.over) || Boolean(player.ended) };
}
