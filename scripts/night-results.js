import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { progress } from "mcts-commun/trace.js";

/**
 * What the scripts the night's queue runs share (Sami, 27/10/2026, mcts-commun's docs/backlog.md, « Recommandations
 * aux projets »): say how far they are, write each unit's results as it ends, and gather the slices of a job cut in
 * parts. A results file is JSON lines: the run's settings first (`header`), then one line per unit (a day, a shift).
 */

/** Starts a results file: its folder made, the file emptied (a rerun starts afresh), the run's settings first. */
export function startResults(file, header) {
  if (!file) return;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ header }) + "\n");
}

/** Adds one unit's results to the file, when there is one. */
export function addResult(file, line) {
  if (file) appendFileSync(file, JSON.stringify(line) + "\n");
}

/** One file's lines parsed; a broken last line (a job stopped while writing it) left out. */
function linesOf(file) {
  const texts = readFileSync(file, "utf8").split("\n").filter(Boolean);
  return texts.flatMap((text, i) => {
    try {
      return [JSON.parse(text)];
    } catch (error) {
      if (i === texts.length - 1) return [];
      throw new Error(`${file}, ligne ${i + 1} : ${error.message}`);
    }
  });
}

/**
 * The units of several results files (the slices of one job), by `key` (the seed). Each file's header must say the
 * same settings once `sliced` (the slice's own fields) is left out; a unit found twice is an error. `expected` is
 * the units the headers announce: fewer found, a slice stopped before its end.
 */
export function gatherResults(files, sliced = ["first", "days", "threads"], key = "seed") {
  const read = files.map((file) => ({ file, lines: linesOf(file) }));
  const headers = read.map(({ file, lines }) => {
    if (!lines[0]?.header) throw new Error(`${file} : pas d'en-tête, ce n'est pas un fichier de résultats`);
    return lines[0].header;
  });
  const same = (header) => JSON.stringify(Object.fromEntries(Object.entries(header).filter(([name]) => !sliced.includes(name))));
  const odd = headers.findIndex((header) => same(header) !== same(headers[0]));
  if (odd >= 0) throw new Error(`${files[odd]} : pas les mêmes réglages que ${files[0]}`);
  const units = read.flatMap(({ lines }) => lines.slice(1)).sort((a, b) => a[key] - b[key]);
  const twice = units.find((unit, i) => i > 0 && unit[key] === units[i - 1][key]);
  if (twice) throw new Error(`${key} ${twice[key]} présent deux fois`);
  return { header: headers[0], units, expected: headers.reduce((sum, header) => sum + (header.days ?? 0), 0) };
}

/**
 * Says `done` of `of` units: to the backlog's views (`progress`, which keeps the trace beating), and a short line on
 * the error output every tenth, which leaves the final table alone on the standard output.
 */
export function progressReporter(unit, of) {
  let shown = 0;
  return (done) => {
    progress("compare", done, of, { unit });
    if (done === of || done - shown >= Math.ceil(of / 10)) {
      shown = done;
      console.error(`${unit} ${done}/${of}`);
    }
  };
}

/** The value after `name` in `args`, else `fallback`. */
export const optionOf = (args, name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
