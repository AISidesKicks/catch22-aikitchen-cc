// Node tests for the catch22 matrix walker:
// - mock run completes the full rows x modes matrix with zero failures
// - flaky provider gets one retry and records every attempt
// - resume continues without duplicating cells or attempts

import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { openDb, cellStats } from "../../src/db.js";
import { loadPool, walk } from "../../src/worker.js";

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const POOL = path.join(ROOT, "datasets", "bootstrap.jsonl");
const ROWS = loadPool(POOL);
assert.equal(ROWS.length, 4, "bootstrap pool ships 4 rows");

test("mock run completes the full pilot matrix", async () => {
  const db = openDb(":memory:");
  const runId = await walk(db, {
    provider: "mock",
    family: "reasoning",
    pool: "datasets/bootstrap.jsonl",
    model: "mock",
    rows: ROWS,
  });
  const stats = Object.fromEntries(cellStats(db, runId).map((s) => [s.status, s.n]));
  assert.equal(stats.done, 4 * 12);
  assert.equal(stats.failed, undefined);
  const attempts = db
    .prepare(`SELECT COUNT(*) AS n FROM attempts WHERE run_id = ?`)
    .get(runId).n;
  assert.equal(attempts, 4 * 12, "done cells with valid answers use one attempt each");
});

test("off family plans one no tag cell per row", async () => {
  const db = openDb(":memory:");
  let seen = [];
  const spy = {
    async generate(cfg, prompt) {
      seen.push(prompt);
      return { raw: "ok", thinking: null, answer: "ok", tokens: 1, latencyMs: 1 };
    },
  };
  const runId = await walk(db, {
    providerObj: spy,
    family: "off",
    pool: "datasets/bootstrap.jsonl",
    model: "spy",
    rows: ROWS,
  });
  const stats = Object.fromEntries(cellStats(db, runId).map((s) => [s.status, s.n]));
  assert.equal(stats.done, ROWS.length, "one cell per row");
  for (const prompt of seen) {
    assert.ok(!prompt.startsWith(" "), "no leading tag or space on off family");
  }
  const tags = db.prepare(`SELECT tag FROM cells WHERE run_id = ?`).all(runId);
  assert.ok(tags.every((t) => t.tag === ""), "off cells carry an empty tag");
});

test("invalid first answer gets exactly one retry", async () => {
  const db = openDb(":memory:");
  let calls = 0;
  const flaky = {
    async generate(cfg, prompt) {
      calls += 1;
      if (calls % 2 === 1) return { raw: "", thinking: null, answer: "", tokens: 0, latencyMs: 1 };
      return { raw: "ok", thinking: null, answer: "ok", tokens: 1, latencyMs: 2 };
    },
  };
  const runId = await walk(db, {
    providerObj: flaky,
    family: "instruct",
    pool: "datasets/bootstrap.jsonl",
    model: "flaky",
    rows: ROWS,
    modes: ["low", "medium"],
  });
  const stats = Object.fromEntries(cellStats(db, runId).map((s) => [s.status, s.n]));
  assert.equal(stats.done, 4 * 2, "every flaky cell lands done on attempt 2");
  assert.equal(stats.failed, undefined);
  const attempts = db
    .prepare(`SELECT COUNT(*) AS n FROM attempts WHERE run_id = ?`)
    .get(runId).n;
  assert.equal(attempts, 4 * 2 + 4 * 2, "each cell records one bad and one good attempt");
  const iTags = db
    .prepare(`SELECT tag FROM cells WHERE run_id = ? AND family = 'instruct' LIMIT 1`)
    .get(runId);
  assert.match(iTags.tag, /^\{REASON:i/, "instruct family carries the i prefix");
});

test("resume continues a run without duplicating anything", async () => {
  const db = openDb(":memory:");
  const runId = await walk(db, {
    provider: "mock",
    family: "reasoning",
    pool: "datasets/bootstrap.jsonl",
    model: "mock",
    rows: ROWS,
    modes: ["low"],
  });
  const first = Object.fromEntries(cellStats(db, runId).map((s) => [s.status, s.n]));
  assert.equal(first.done, 4, "first pass finishes the low column");

  await walk(db, {
    resume: runId,
    provider: "mock",
    family: "reasoning",
    pool: "datasets/bootstrap.jsonl",
    model: "mock",
    rows: ROWS,
    modes: ["low", "medium", "high"],
  });
  const stats = Object.fromEntries(cellStats(db, runId).map((s) => [s.status, s.n]));
  assert.equal(stats.done, 4 * 3, "resume finishes only the uncommitted cells");
  assert.equal(stats.failed, undefined);
  const duplicates = db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT run_id, row_id, family, tag, COUNT(*) AS c FROM cells
         GROUP BY run_id, row_id, family, tag HAVING c > 1
       )`
    )
    .get().n;
  assert.equal(duplicates, 0, "no duplicate cell keys");
  const attempts = db
    .prepare(`SELECT COUNT(*) AS n FROM attempts WHERE run_id = ?`)
    .get(runId).n;
  assert.equal(attempts, 4 * 3, "attempts match completed cells, no replay spam");
});
