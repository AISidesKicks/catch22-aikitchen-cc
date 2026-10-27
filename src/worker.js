// catch22 matrix walker. Durable: one cell commits before the next starts,
// resume picks up the first uncommitted cell.
//
//   node src/worker.js run --pool datasets/bootstrap.jsonl --provider mock
//   node src/worker.js run --resume run-xxxxxxxx

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  cellStats,
  commitCell,
  createRun,
  finishRun,
  loadRun,
  nextCell,
  openDb,
  planCells,
  recordAttempt,
} from "./db.js";
import { MODES, tagFor } from "./matrix.js";
import * as llama from "./providers/llama.js";
import * as mock from "./providers/mock.js";

const PROVIDERS = { llama, mock };
const MAX_ATTEMPTS = 2;

export function loadPool(poolPath) {
  return readFileSync(poolPath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function isAnswerValid(cell, result) {
  if (!result || result.error) return false;
  if (!result.answer || result.answer.trim().length === 0) return false;
  return true;
}

async function runCell(provider, providerOpts, cell) {
  // Mode tag first; if the pool row already carries a card tag it stays
  // part of the task text after our cell tag.
  const prompt = `${tagFor(cell.family, cell.mode)} ${cell.prompt}`;
  try {
    const result = await provider.generate(providerOpts, prompt);
    const ok = isAnswerValid(cell, result);
    return { ...result, ok, error: result.error ?? null };
  } catch (error) {
    return {
      ok: false,
      answer: null,
      tokens: null,
      latencyMs: null,
      error: String(error?.message ?? error),
    };
  }
}

export async function walk(db, opts) {
  const provider = opts.providerObj ?? PROVIDERS[opts.provider];
  const providerOpts = {
    baseUrl: opts.baseUrl,
    model: opts.model,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  };

  let runId = opts.resume;
  const providerName = opts.provider ?? (opts.providerObj ? "custom" : "mock");
  if (!runId) {
    runId = `run-${randomUUID().slice(0, 8)}`;
    createRun(db, {
      id: runId,
      provider: providerName,
      model: opts.model,
      family: opts.family,
      pool: opts.pool,
      rows: opts.rows,
    });
    planCells(db, runId, opts.family, opts.modes ?? MODES);
    console.log(`run ${runId} planned for ${opts.rows.length} rows x ${(opts.modes ?? MODES).length} modes`);
  } else {
    const existing = loadRun(db, runId);
    if (existing.family !== opts.family) {
      throw new Error(`family mismatch: run ${runId} is ${existing.family}`);
    }
    planCells(db, runId, existing.family, opts.modes ?? MODES);
    console.log(`resume ${runId} (${existing.rows.length} rows)`);
  }

  for (;;) {
    const cell = nextCell(db, runId);
    if (!cell) break;
    let seq = 0;
    let ok = false;
    let result = null;
    while (seq < MAX_ATTEMPTS) {
      seq += 1;
      result = await runCell(provider, providerOpts, cell);
      recordAttempt(
        db,
        cell,
        seq,
        result.ok,
        result.latencyMs,
        result.error ?? null
      );
      if (result.ok) {
        ok = true;
        break;
      }
      console.log(`retry ${seq}/${MAX_ATTEMPTS} cell ${cell.row_id}:${cell.mode} (${result.error ?? "empty reply"})`);
    }
    commitCell(db, cell, { ...result, ok });
    console.log(
      `[${cell.row_id}:${cell.mode}] ${ok ? "ok" : "FAILED"} ${result.latencyMs ?? "?"}ms tokens=${result.tokens ?? "?"}`
    );
  }

  finishRun(db, runId);
  const stats = cellStats(db, runId);
  console.log(`done ${runId}: ${JSON.stringify(stats)}`);
  return runId;
}

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        args.flags[key] = value;
        i += 1;
      } else {
        args.flags[key] = true;
      }
    } else {
      args.positional.push(arg);
    }
  }
  return args;
}

export function flagsToOpts(flags, positional) {
  const command = positional[0];
  if (command !== "run") {
    throw new Error(`usage: worker run --pool <jsonl> --provider mock|llama`);
  }
  const pool = flags.pool ?? "datasets/bootstrap.jsonl";
  const provider = flags.provider ?? "mock";
  const family = flags.family ?? "reasoning";
  const opts = {
    pool,
    provider,
    family,
    model: flags.model ?? (provider === "llama" ? "ctch-tb" : "mock"),
    baseUrl: flags.baseUrl ?? "http://127.0.0.1:8081",
    temperature: flags.temperature ? Number(flags.temperature) : 0.2,
    maxTokens: flags.maxTokens ? Number(flags.maxTokens) : 4096,
    resume: flags.resume ?? null,
    modes: flags.modes ? String(flags.modes).split(",") : undefined,
  };
  return opts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const opts = flagsToOpts(args.flags, args.positional);
  const dbPath = process.env.CATCH22_DB ?? "scratch/lab.db";
  const { mkdirSync } = await import("node:fs");
  mkdirSync("scratch", { recursive: true });
  const db = openDb(dbPath);
  opts.rows = loadPool(opts.pool);
  const runId = await walk(db, opts);
  console.log(runId);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
