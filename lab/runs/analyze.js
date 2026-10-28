// Cross run analysis for benchmarks.md. Read only.
//   node lab/runs/analyze.js

import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("scratch/lab.db", { readOnly: true });

const R = {
  stock: "run-e54e73ea",
  tboff: "run-10d2392e",
  iq4: "run-af261f8a",
  q8: "run-0b5722d9",
  q6: "run-5ef5d628",
  mini: "run-f46398fe",
  big8i: "run-5e04ff01",
};

// 1. Control triangle: stock no-tag vs tb no-tag vs tb tagged average.
console.log("=== control: stock no-tag vs tb no-tag (21 rows) ===");
const ctl = db
  .prepare(
    `
SELECT r.row_id,
  (SELECT AVG(tokens) FROM cells WHERE run_id='run-e54e73ea' AND row_id=r.row_id) st,
  (SELECT AVG(tokens) FROM cells WHERE run_id='run-10d2392e' AND row_id=r.row_id) tb,
  (SELECT AVG(tokens) FROM cells WHERE run_id='run-5ef5d628' AND row_id=r.row_id) modes
FROM rows r WHERE r.run_id='run-e54e73ea' ORDER BY r.position`
  )
  .all();
let sT = 0, tT = 0, mSum = 0;
for (const c of ctl) {
  sT += c.st;
  tT += c.tb;
  mSum += c.modes;
  console.log(
    c.row_id.padEnd(24),
    "stock " + String(Math.round(c.st)).padStart(5),
    "tb-off " + String(Math.round(c.tb)).padStart(5),
    "tb-modes-avg " + String(Math.round(c.modes)).padStart(5)
  );
}
console.log(
  "TOTALS: stock", sT, "| tb-off", tT,
  "| tb 12-mode avg", Math.round(mSum / ctl.length)
);

// 2. Quant ladder on the same 10 subset rows (bench + topic families).
// The q6 run covered the full pool; filter it down to the subset for a
// fair comparison.
console.log("=== quant ladder (same 10 rows): avg tokens + ms + capped ===");
const subsetIds = db
  .prepare(
    `SELECT DISTINCT row_id FROM rows WHERE run_id = 'run-af261f8a'`
  )
  .all()
  .map((r) => r.row_id);
const runs = [["q6", R.q6], ["iq4", R.iq4], ["q8", R.q8]];
const perMode = {};
for (const [name, id] of runs) {
  const stats = db
    .prepare(
      `SELECT mode, AVG(tokens) t, AVG(latency_ms) ms,
              SUM(CASE WHEN tokens >= 3070 THEN 1 ELSE 0 END) cap, COUNT(*) n
       FROM cells WHERE run_id = ? AND row_id IN (SELECT row_id FROM rows WHERE run_id = 'run-af261f8a')
       GROUP BY mode`
    )
    .all(id);
  for (const s of stats) (perMode[s.mode] ??= {})[name] = s;
}
console.log(
  "mode".padEnd(11),
  "q6t".padStart(6), "iq4t".padStart(6), "q8t".padStart(6),
  "| q6ms".padStart(7), "iq4ms".padStart(7), "q8ms".padStart(7),
  "| capped q6/iq4/q8"
);
for (const [m, v] of Object.entries(perMode)) {
  console.log(
    m.padEnd(11),
    String(Math.round(v.q6.t)).padStart(6),
    String(Math.round(v.iq4.t)).padStart(6),
    String(Math.round(v.q8.t)).padStart(6),
    "|",
    String(Math.round(v.q6.ms)).padStart(6),
    String(Math.round(v.iq4.ms)).padStart(6),
    String(Math.round(v.q8.ms)).padStart(6),
    "|",
    `${v.q6.cap}/${v.iq4.cap}/${v.q8.cap}`
  );
}

// 3. Mini 2.6B instruct ladder and thinking share.
console.log("=== mini 2.6B instruct ladder (full pool) ===");
const mini = db
  .prepare(
    `SELECT mode, AVG(tokens) t, AVG(latency_ms) ms,
            SUM(CASE WHEN tokens >= 3070 THEN 1 ELSE 0 END) cap,
            SUM(CASE WHEN thinking IS NOT NULL THEN 1 ELSE 0 END) th
     FROM cells WHERE run_id = ? GROUP BY mode ORDER BY t`
  )
  .all(R.mini);
for (const s of mini) {
  console.log(
    s.mode.padEnd(11),
    String(Math.round(s.t)).padStart(5),
    String(Math.round(s.ms)).padStart(6),
    "capped:" + s.cap,
    "with-thinking:" + s.th
  );
}

// 5. MAX vs plain Q6 A/B on the same subset rows.
console.log("=== plain Q6_K vs MAX-Q6_K (same 10 rows) ===");
const q6sub = db
  .prepare(
    `SELECT mode, AVG(tokens) t, AVG(latency_ms) ms,
            SUM(CASE WHEN tokens >= 3070 THEN 1 ELSE 0 END) cap
     FROM cells
     WHERE run_id = 'run-5ef5d628'
       AND row_id IN (SELECT row_id FROM rows WHERE run_id = 'run-af261f8a')
     GROUP BY mode`
  )
  .all();
const max = db
  .prepare(
    `SELECT mode, AVG(tokens) t, AVG(latency_ms) ms,
            SUM(CASE WHEN tokens >= 3070 THEN 1 ELSE 0 END) cap
     FROM cells WHERE run_id = 'run-5d16ed4a' GROUP BY mode`
  )
  .all();
const q6map = Object.fromEntries(q6sub.map((s) => [s.mode, s]));
console.log(
  "mode".padEnd(11),
  "q6tok".padStart(7),
  "maxtok".padStart(7),
  "delta".padStart(7),
  "| q6ms".padStart(8),
  "maxms".padStart(7),
  "| capped q6/max"
);
let tq6 = 0, tmx = 0, cq6 = 0, cmx = 0;
for (const s of max) {
  const a = q6map[s.mode];
  if (!a) continue;
  tq6 += a.t;
  tmx += s.t;
  cq6 += a.cap;
  cmx += s.cap;
  console.log(
    s.mode.padEnd(11),
    String(Math.round(a.t)).padStart(7),
    String(Math.round(s.t)).padStart(7),
    String(Math.round(s.t - a.t)).padStart(7),
    " |",
    String(Math.round(a.ms)).padStart(7),
    String(Math.round(s.ms)).padStart(7),
    " |",
    `${a.cap}/${s.cap}`
  );
}
console.log("TOTALS: q6", Math.round(tq6), "max", Math.round(tmx), "| capped", cq6 + "/" + cmx);

console.log("=== 8B instruct vs mini instruct avg tokens per mode ===");
const big8i = db
  .prepare(
    `SELECT mode, AVG(tokens) t FROM cells WHERE run_id = ? GROUP BY mode`
  )
  .all(R.big8i);
for (const s of big8i) {
  const m = mini.find((x) => x.mode === s.mode);
  console.log(s.mode.padEnd(11), "8B", String(Math.round(s.t)).padStart(6), "mini", String(Math.round(m?.t ?? 0)).padStart(6));
}
