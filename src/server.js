// ctch-lab: zero dependency HTTP server for the matrix GUI.
//   node src/server.js
// Serves gui/ statically and /api/status from SQLite (read only).
// Port 3030 per INTENT.md infrastructure plan.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";

const PORT = Number(process.env.PORT ?? 3030);
const GUI_DIR = process.env.GUI_DIR ?? "gui";const DB_PATH = process.env.CATCH22_DB ?? "scratch/lab.db";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function withDb(fn) {
  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
    return fn(db);
  } finally {
    try {
      db?.close();
    } catch {}
  }
}

function statusPayload() {
  return withDb((db) => {
    const runs = db
      .prepare(
        `SELECT r.id, r.created_at, r.provider, r.model, r.family, r.status,
                SUM(CASE WHEN c.status = 'done' THEN 1 ELSE 0 END) AS done,
                SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) AS failed,
                COUNT(c.tag) AS planned
         FROM runs r LEFT JOIN cells c ON c.run_id = r.id
         GROUP BY r.id ORDER BY r.created_at DESC LIMIT 20`
      )
      .all();
    return {
      runs,
      modes: ["omni", "deeptree", "hyper", "socrates", "logic", "einstein", "spoon", "ultra", "high", "medium", "medium-low", "low"],
    };
  });
}

function runPayload(runId) {
  return withDb((db) => {
    const run = db
      .prepare(`SELECT id, created_at, provider, model, family, status FROM runs WHERE id = ?`)
      .get(runId);
    if (!run) return null;
    const rows = db
      .prepare(`SELECT row_id, position, prompt, expected FROM rows WHERE run_id = ? ORDER BY position`)
      .all(runId);
    const cells = db
      .prepare(
        `SELECT row_id, mode, status, reply, thinking, tokens, latency_ms
         FROM cells WHERE run_id = ?`
      )
      .all(runId);
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
    return { run, rows, cells: byKey };
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname === "/api/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(statusPayload()));
      return;
    }
    if (url.pathname.startsWith("/api/run/")) {
      const runId = url.pathname.split("/").pop();
      const payload = runPayload(runId);
      if (!payload) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unknown run" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }
    // Static files from gui/. Normalize blocks traversal above gui/.
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    path = normalize(path).replace(/^(\.\.[/\\])+/, "");
    const file = join(GUI_DIR, path);
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
});

server.listen(PORT, () => {
  console.log(`ctch-lab gui on http://127.0.0.1:${PORT} (db: ${DB_PATH})`);
});
