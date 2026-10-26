import { el } from "./dom.js";

/**
 * The games kept in this browser (the last `kept`, under `name` in localStorage) and in the project's replays/
 * folder through the page server (out of git; nothing if no server takes it); a replay downloads as a file.
 */
export function createReplayStore(name, kept = 20) {
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(name) ?? "[]");
    } catch {
      return [];
    }
  };
  const keep = (replay) => {
    fetch("/api/replays", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(replay) }).catch(() => {});
    try {
      localStorage.setItem(name, JSON.stringify([replay, ...load()].slice(0, kept)));
    } catch {
      // Storage refused: the replay can still be downloaded.
    }
  };
  return { load, keep };
}

/** The file name of a replay: `prefix`, the hospital, the shift, when it was saved. */
export const replayName = (prefix, replay) => `${prefix}-${replay.hospital}-garde${replay.seed}-${replay.savedAt.slice(0, 16).replace(/[:T]/g, "-")}.json`;

export function download(fileName, json) {
  const link = el("a", { href: URL.createObjectURL(new Blob([json], { type: "application/json" })), download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
}
