// Read-only views over the lab SQLite db for status and the GUI.
//
//   node src/status.js            # latest run summary
//   node src/status.js run-xxxx   # one run, cell by cell

import { DatabaseSync } from "node:sqlite";

const dbPath = process.env.CATCH22_DB ?? "scratch/lab.db";
const db = new DatabaseSync(dbPath, { readOnly: true });

const runId = process.argv[2];

const run = runId
  ? db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId)
  : db.prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT 1`).get();

if (!run) {
  console.error("no runs found (destroyed or empty db?) in", dbPath);
  process.exit(1);
}

const stats = db
  .prepare(`SELECT status, COUNT(*) AS n FROM cells WHERE run_id = ? GROUP BY status`)
  .all(run.id);

console.log(`run ${run.id} provider=${run.provider} family=${run.family} status=${run.status}`);
for (const s of stats) console.log(`  ${s.status}: ${s.n}`);

const table = db
  .prepare(
    `SELECT r.row_id, r.position,
            SUM(CASE WHEN c.status = 'done' THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) AS failed,
            COUNT(c.tag) AS planned
     FROM rows r LEFT JOIN cells c ON c.run_id = r.run_id AND c.row_id = r.row_id
     WHERE r.run_id = ?
     GROUP BY r.row_id ORDER BY r.position`
  )
  .all(run.id);

console.log("row_id | done/planned (failed)");
for (const t of table) {
  console.log(`  ${t.row_id} | ${t.done}/${t.planned} (${t.failed})`);
}

if (runId) {
  const cells = db
    .prepare(
      `SELECT mode, status, tokens, latency_ms FROM cells WHERE run_id = ? ORDER BY row_id, mode`
    )
    .all(run.id);
  console.log("mode | status | tokens | ms");
  for (const c of cells) {
    console.log(`  ${c.mode} | ${c.status} | ${c.tokens ?? "-"} | ${c.latency_ms ?? "-"}`);
  }
}
db.close();
