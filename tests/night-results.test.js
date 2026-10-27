import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addResult, gatherResults, startResults } from "../scripts/night-results.js";

/** A slice's file: its header, then a line per seed. */
function slice(folder, name, header, seeds) {
  const file = path.join(folder, name);
  startResults(file, header);
  for (const seed of seeds) addResult(file, { seed, cost: seed * 10 });
  return file;
}

describe("the night's results files (scripts/night-results.js)", () => {
  it("gather the slices in seed order, a slice stopped while writing counted short", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "urgences-nuit-"));
    try {
      const settings = { hospital: "moyen", budget: 100 };
      const second = slice(folder, "b.jsonl", { ...settings, first: 4, days: 3 }, [5, 4, 6]);
      const first = slice(folder, "a.jsonl", { ...settings, first: 1, days: 3 }, [2, 1]);
      appendFileSync(first, '{"seed": 3, "co');
      const { header, units, expected } = gatherResults([second, first]);
      assert.equal(header.hospital, "moyen");
      assert.deepEqual(units.map((unit) => unit.seed), [1, 2, 4, 5, 6]);
      assert.equal(expected, 6);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("refuse slices of other settings, a seed found twice, a file that is not theirs", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "urgences-nuit-"));
    try {
      const one = slice(folder, "a.jsonl", { budget: 100, first: 1, days: 2 }, [1, 2]);
      assert.throws(() => gatherResults([one, slice(folder, "b.jsonl", { budget: 50, first: 3, days: 2 }, [3, 4])]), /pas les mêmes réglages/);
      assert.throws(() => gatherResults([one, one]), /présent deux fois/);
      const other = path.join(folder, "c.jsonl");
      appendFileSync(other, '{"seed": 1}\n');
      assert.throws(() => gatherResults([other]), /pas d'en-tête/);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
