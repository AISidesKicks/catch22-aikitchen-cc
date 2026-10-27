// Export a static snapshot of runs for the GUI fallback and for the
// docs results page build.
//
//   node src/exports.js            # all runs -> gui/data.json
//   node src/exports.js docs       # + docs/results.html render
//
// No server needed after this; the pages also work from file:// or GH pages.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.CATCH22_DB ?? "scratch/lab.db";
const db = new DatabaseSync(DB_PATH, { readOnly: true });

const runs = db
  .prepare(
    `SELECT r.id, r.created_at, r.provider, r.model, r.family, r.status,
            SUM(CASE WHEN c.status = 'done' THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) AS failed,
            COUNT(c.tag) AS planned
     FROM runs r LEFT JOIN cells c ON c.run_id = r.id
     GROUP BY r.id ORDER BY r.created_at`
  )
  .all();

const modes = ["omni", "deeptree", "hyper", "socrates", "logic", "einstein", "spoon", "ultra", "high", "medium", "medium-low", "low"];

const payload = { generated: new Date().toISOString(), modes, runs: [] };
for (const r of runs) {
  const rows = db
    .prepare(`SELECT row_id, position, prompt, expected FROM rows WHERE run_id = ? ORDER BY position`)
    .all(r.id);
  const cells = db
    .prepare(`SELECT row_id, mode, status, reply, thinking, tokens, latency_ms FROM cells WHERE run_id = ?`)
    .all(r.id);
  const byKey = {};
  for (const c of cells) {
    byKey[`${c.row_id}:${c.mode}`] = {
      status: c.status,
      reply: c.reply,
      thinking: c.thinking,
      tokens: c.tokens,
      latency_ms: c.latency_ms,
    };
  }
  payload.runs.push({ run: r, rows, cells: byKey });
}

mkdirSync("gui", { recursive: true });
writeFileSync("gui/data.json", JSON.stringify(payload, null, 1));
console.log(`exported ${runs.length} runs -> gui/data.json`);

// ---- docs results page ------------------------------------------------
// Kept dead simple: one section per run, tables per row x mode with the
// final answers inline, thinking collapsed. Plain hyphens only.

function esc(s) {
  return String(s ?? "")
    .replace(/[\u2014\u2013\u2212]/g, "-") // em, en, math minus -> plain hyphen per repo rule
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderResultsPage() {
  const sections = payload.runs
    .map(({ run, rows, cells }) => {
      const doneCells = Object.values(cells).filter((c) => c.status === "done").length;
      const grids = rows
        .map((row) => {
          const cellsHtml = modes
            .map((mode) => {
              const c = cells[`${row.row_id}:${mode}`];
              if (!c || c.status !== "done") {
                return `<td>${esc(c?.status ?? "planned")}</td>`;
              }
              const at = c.tokens != null ? `${c.tokens} tok` : "";
              const capped = c.tokens >= 3070 ? " (truncated)" : "";
              const answer = esc(String(c.reply ?? "").slice(0, 900));
              return `<td><b>${at}${capped}</b><br>${answer}</td>`;
            })
            .join("");
          return `<tr><th>${esc(row.row_id)}</th>${cellsHtml}</tr>`;
        })
        .join("");
      return `
<section>
  <h2>${esc(run.id)} (${esc(run.family)}, ${esc(run.status)})</h2>
  <p>${run.model} - ${doneCells} of ${run.planned} cells committed.</p>
  <table border="1">
    <tr><th>row</th>${modes.map((m) => `<th>${m}</th>`).join("")}</tr>
    ${grids}
  </table>
</section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>catch22 lab results</title>
<style>
body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; background: #f7f7f5; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
th, td { border: 1px solid #bbb; padding: 6px; text-align: left; vertical-align: top; max-width: 260px; }
h1, h2 { font-weight: 600; }
.dim { color: #666; }
</style>
</head>
<body>
<h1>catch22 lab results</h1>
<p class="dim">Generated ${payload.generated} from the lab SQLite by src/exports.js. Modes are prompt priming fine tuned into the model, not search algorithms. Chain truncated means the cell hit the worker token cap.</p>
${sections}
</body>
</html>
`;
  writeFileSync("docs/results.html", html);
  console.log(`wrote docs/results.html`);
}

if (process.argv[2] === "docs") renderResultsPage();
