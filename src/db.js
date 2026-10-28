// SQLite state for the matrix walker. Node 24 built in node:sqlite.
// Cell key: (run_id, row_id, family, tag). One cell commits before the
// next starts, so a kill mid run costs at most one cell.

import { DatabaseSync } from "node:sqlite";
import { tagFor } from "./matrix.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  family TEXT NOT NULL,
  pool TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS rows (
  run_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  row_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  expected TEXT,
  PRIMARY KEY (run_id, row_id),
  FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS cells (
  run_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  family TEXT NOT NULL,
  tag TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reply TEXT,
  thinking TEXT,
  tokens INTEGER,
  latency_ms INTEGER,
  PRIMARY KEY (run_id, row_id, family, tag),
  FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS attempts (
  run_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  family TEXT NOT NULL,
  tag TEXT NOT NULL,
  seq INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  latency_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, row_id, family, tag, seq),
  FOREIGN KEY (run_id) REFERENCES runs(id)
);
`;

export function openDb(path) {
  const db = new DatabaseSync(path);
  if (path !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec(SCHEMA);
  // Migration: v1 pilot tables predate the thinking column. The thinking
  // text is the valuable part for a mode-contrast demo, so keep it.
  const cols = db.prepare(`PRAGMA table_info(cells)`).all().map((c) => c.name);
  if (!cols.includes("thinking")) {
    db.exec(`ALTER TABLE cells ADD COLUMN thinking TEXT;`);
  }
  return db;
}

export function createRun(db, { id, provider, model, family, pool, rows }) {
  db.prepare(
    `INSERT INTO runs (id, created_at, provider, model, family, pool, status)
     VALUES (?, ?, ?, ?, ?, ?, 'running')`
  ).run(id, new Date().toISOString(), provider, model, family, pool);
  const insertRow = db.prepare(
    `INSERT INTO rows (run_id, position, row_id, prompt, expected)
     VALUES (?, ?, ?, ?, ?)`
  );
  rows.forEach((row, position) => {
    insertRow.run(id, position, row.id, row.prompt, row.expected ?? null);
  });
  return id;
}

// Plans the cells for a run. Idempotent: OR IGNORE keeps committed state
// safe when resuming with the same pool and family. The off family plans
// one cell per row (no tag); tag lives empty in the db.
export function planCells(db, runId, family, modes) {
  const effective = family === "off" ? ["off"] : modes;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO cells (run_id, row_id, family, tag, mode)
     VALUES (?, ?, ?, ?, ?)`
  );
  const rows = db
    .prepare(`SELECT row_id FROM rows WHERE run_id = ? ORDER BY position`)
    .all(runId);
  for (const { row_id } of rows) {
    for (const mode of effective) {
      insert.run(runId, row_id, family, tagFor(family, mode), mode);
    }
  }
}

export function loadRun(db, runId) {
  const run = db
    .prepare(
      `SELECT id, provider, model, family, pool, status FROM runs WHERE id = ?`
    )
    .get(runId);
  if (!run) throw new Error(`unknown run: ${runId}`);
  const rows = db
    .prepare(
      `SELECT row_id, prompt, expected FROM rows WHERE run_id = ? ORDER BY position`
    )
    .all(runId);
  return { ...run, rows };
}

export function nextCell(db, runId) {
  return db
    .prepare(
      `SELECT c.run_id, c.row_id, c.family, c.tag, c.mode, r.prompt, r.expected
       FROM cells c JOIN rows r ON r.run_id = c.run_id AND r.row_id = c.row_id
       WHERE c.run_id = ? AND c.status = 'pending'
       ORDER BY c.row_id, c.mode
       LIMIT 1`
    )
    .get(runId);
}

export function recordAttempt(db, cell, seq, ok, latencyMs, error) {
  db.prepare(
    `INSERT INTO attempts (run_id, row_id, family, tag, seq, ok, latency_ms, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    cell.run_id,
    cell.row_id,
    cell.family,
    cell.tag,
    seq,
    ok ? 1 : 0,
    latencyMs ?? null,
    error ?? null,
    new Date().toISOString()
  );
}

export function commitCell(db, cell, result) {
  db.prepare(
    `UPDATE cells SET status = ?, reply = ?, thinking = ?, tokens = ?, latency_ms = ?
     WHERE run_id = ? AND row_id = ? AND family = ? AND tag = ?`
  ).run(
    result.ok ? "done" : "failed",
    result.answer ?? null,
    result.thinking ?? null,
    result.tokens ?? null,
    result.latencyMs ?? null,
    cell.run_id,
    cell.row_id,
    cell.family,
    cell.tag
  );
}

export function cellStats(db, runId) {
  return db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM cells WHERE run_id = ? GROUP BY status`
    )
    .all(runId);
}

export function finishRun(db, runId) {
  db.prepare(`UPDATE runs SET status = 'done' WHERE id = ?`).run(runId);
}
