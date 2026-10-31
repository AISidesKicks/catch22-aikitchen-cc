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
  <h2>${esc(run.id)} <span class="tag">${esc(run.family)}, ${esc(run.status)}</span></h2>
  <p class="meta">${esc(run.model)} - ${doneCells} of ${run.planned} cells committed.</p>
  <div class="scroll">
    <table class="matrix">
      <tr><th>row</th>${modes.map((m) => `<th>${m}</th>`).join("")}</tr>
      ${grids}
    </table>
  </div>
</section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>catch22 lab results</title>
<meta name="description" content="Every committed cell from the catch22 lab: rows by prompt, columns by reasoning mode, one local model on one GPU.">
<meta name="theme-color" content="#f6f1e8">
<meta name="color-scheme" content="light">
<style>
  :root {
    --paper: #f6f1e8;
    --ink: #1f1b16;
    --muted: #6b6257;
    --rust: #b43a1f;
    --line: #d9cfc0;
    --panel: #fffaf2;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.6;
  }

  .wrap {
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 20px 64px;
  }

  header {
    padding: 24px 0 8px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--rust);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 5.6vw, 3.2rem);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .lede {
    max-width: 720px;
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 1.1rem;
  }

  .status {
    display: inline-block;
    margin: 18px 0 0;
    padding: 6px 10px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .hint {
    display: none;
  }

  @media (max-width: 1240px) {
    .hint {
      display: block;
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 0.85rem;
    }
  }

  section {
    padding: 32px 0;
    border-top: 1px solid var(--line);
  }

  h2 {
    margin: 0 0 8px;
    font-size: 1.35rem;
    letter-spacing: -0.02em;
  }

  .tag {
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .meta {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 0.9rem;
  }

  a {
    color: var(--rust);
  }

  .scroll {
    overflow-x: auto;
  }

  .matrix {
    width: 100%;
    min-width: 1180px;
    border-collapse: collapse;
    font-size: 12px;
  }

  .matrix th,
  .matrix td {
    padding: 9px 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
    max-width: 260px;
  }

  .matrix th {
    color: var(--muted);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .matrix th:first-child {
    min-width: 130px;
  }

  .matrix td b {
    color: var(--rust);
    font-size: 0.78rem;
  }

  .gh {
    display: inline-block;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    color: var(--rust);
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    padding: 0.2rem 0.6rem;
    background: var(--panel);
  }

  .gh:hover {
    border-color: var(--rust);
  }

  footer {
    padding-top: 24px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.9rem;
  }
</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="eyebrow">catch22 - the raw matrix</p>
  <h1>Lab results</h1>
  <p class="lede">Every committed cell from the lab SQLite: one section per run, rows by prompt, columns by mode. Answers are inline, cut at 900 characters. Modes are prompt priming fine tuned into the model, not search algorithms.</p>
  <p class="status">Generated ${payload.generated} from the lab SQLite by src/exports.js. Chain truncated means the cell hit the worker token cap.</p>
  <p class="hint">On a narrow screen, scroll each table sideways to see every mode.</p>
</header>
<main>
${sections}
</main>
<footer>
  <p>catch22 - the raw matrix behind the guide. Same prompts, every mode, one GPU.</p>
  <p><a class="gh" href="modes.html">the guide</a> <a class="gh" href="index.html">project page</a></p>
</footer>
</div>
</body>
</html>
`;
  writeFileSync("docs/results.html", html);
  console.log(`wrote docs/results.html`);
}

if (process.argv[2] === "docs") renderResultsPage();
