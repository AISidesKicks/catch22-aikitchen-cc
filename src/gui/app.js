// catch22 matrix gui. No framework: fetch, render, poll.
// Served by src/server.js (ctch-lab on 3030) which reads SQLite.

const $ = (sel) => document.querySelector(sel);
const MODES = [];
const state = { runs: [], current: null, grid: null };

async function jsonFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function loadStatus() {
  try {
    return await jsonFetch("/api/status");
  } catch {
    // Fallback for static serving: last exported snapshot.
    return jsonFetch("./data.json");
  }
}

async function loadRun(runId) {
  try {
    return await jsonFetch(`/api/run/${runId}`);
  } catch {
    return jsonFetch(`./runs/${runId}.json`);
  }
}

function fmtMs(ms) {
  if (ms == null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function isAtCap(cell) {
  // cap windows used across the pilot; treat >=3070 tokens as likely truncated
  return cell.tokens != null && cell.tokens >= 3070;
}

function renderRuns() {
  const nav = $("#runs");
  nav.innerHTML = "";
  for (const r of state.runs) {
    const btn = document.createElement("button");
    btn.textContent = `${r.id} (${r.family})`;
    const small = document.createElement("small");
    small.textContent = ` ${r.done}/${r.planned}${r.status === "running" ? " - running" : ""}`;
    btn.append(small);
    if (r.id === state.current) btn.classList.add("active");
    btn.onclick = () => selectRun(r.id);
    nav.append(btn);
  }
}

function renderMatrix() {
  const g = state.grid;
  if (!g) return;
  const thead = $("#matrix thead");
  const tbody = $("#matrix tbody");
  thead.innerHTML = "";
  const hr = document.createElement("tr");
  hr.append(Object.assign(document.createElement("th"), { textContent: "row" }));
  for (const m of MODES) hr.append(Object.assign(document.createElement("th"), { textContent: m }));
  thead.append(hr);

  tbody.innerHTML = "";
  for (const row of g.rows) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = row.row_id;
    tr.append(th);
    for (const m of MODES) {
      const td = document.createElement("td");
      const cell = g.cells[`${row.row_id}:${m}`];
      td.className = "cell";
      if (cell) {
        const dot = document.createElement("i");
        const capped = cell.status === "done" && isAtCap(cell);
        dot.className = `p ${capped ? "cap" : cell.status}`;
        td.append(dot);
        const meta = document.createElement("small");
        meta.textContent = [cell.tokens != null ? `${cell.tokens}t` : "", fmtMs(cell.latency_ms)].filter(Boolean).join(" ");
        td.append(meta);
        td.onclick = () => showDetail(row, m, cell, capped);
      } else {
        const dot = document.createElement("i");
        dot.className = "p pending";
        td.append(dot);
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
}

function showDetail(row, mode, cell, capped) {
  const d = $("#detail");
  d.hidden = false;
  $("#detail-title").textContent = `${row.row_id} - {REASON:${mode}}`;
  $("#detail-meta").textContent = [
    `tokens: ${cell.tokens ?? "?"}`,
    `latency: ${fmtMs(cell.latency_ms)}`,
    capped ? "chain truncated at the token cap" : "",
  ].filter(Boolean).join(" | ");
  $("#detail-expected").textContent = row.expected ? `expected: ${row.expected}` : "";
  $("#detail-thinking").textContent = cell.thinking ?? "(no separate thinking in this mode output)";
  $("#detail-answer").textContent = cell.reply ?? "(empty)";
}

function closeDetail() {
  $("#detail").hidden = true;
}

async function selectRun(runId) {
  state.current = runId;
  state.grid = await loadRun(runId);
  renderRuns();
  renderMatrix();
  $("#foot").textContent = `run ${runId} (${state.grid.run.family}, ${state.grid.run.status})`;
}

async function refresh() {
  const status = await loadStatus();
  state.runs = status.runs;
  if (MODES.length === 0) MODES.push(...status.modes);
  renderRuns();
  if (!state.current && state.runs.length > 0) {
    await selectRun(state.runs[0].id);
  } else if (state.current) {
    // keep the matrix fresh while a run is filling in
    const cur = state.runs.find((r) => r.id === state.current);
    if (cur) {
      state.grid = await loadRun(state.current);
      renderMatrix();
      $("#foot").textContent = `run ${state.current} (${state.grid.run.family}, ${state.grid.run.status})`;
    }
  }
}

$("#detail-close").onclick = closeDetail;

refresh();
setInterval(refresh, 2000);
