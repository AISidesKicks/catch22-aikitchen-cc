// Minimal OTLP/HTTP protobuf trace export for Phoenix, zero dependencies.
// One span per committed cell. Best effort: a down or broken Phoenix
// must never block or fail a walk (mds/durable-execution.md item 8).
//
// Phoenix 20.x serves OTLP on the UI port: POST /v1/traces with
// application/x-protobuf (it rejects JSON with 415, so we hand encode
// the ExportTraceServiceRequest below).

const TRACE_URL = process.env.CATCH22_TRACE_URL ?? "http://127.0.0.1:6006/v1/traces";
const TRACE_ON = (process.env.CATCH22_TRACE ?? "on") !== "off";
const SERVICE_MODEL = process.env.CATCH22_TRACE_MODEL ?? "lfm2.5-8b-a1b-tb";

let warned = false;

// protobuf wire helpers ------------------------------------------------

const pbTag = (field, wire) => (field << 3) | wire;

function pbVarint(value) {
  let n = typeof value === "bigint" ? value : BigInt(value);
  const out = [];
  do {
    let byte = Number(n & 0x7fn);
    n >>= 7n;
    if (n > 0n) byte |= 0x80;
    out.push(byte);
  } while (n > 0n);
  return new Uint8Array(out);
}

function pbLen(data) {
  return new Uint8Array([...pbVarint(data.length), ...data]);
}

function pbFixed64(value) {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, typeof value === "bigint" ? value : BigInt(value), true);
  return new Uint8Array(buf);
}

function pbFixed64Field(field, value) {
  const tag = new Uint8Array([pbTag(field, 1)]);
  return new Uint8Array([...tag, ...pbFixed64(value)]);
}

function pbString(field, str) {
  return new Uint8Array([...new Uint8Array([pbTag(field, 2)]), ...pbLen(new TextEncoder().encode(str))]);
}

function pbMessage(field, bytes) {
  return new Uint8Array([...new Uint8Array([pbTag(field, 2)]), ...pbLen(bytes)]);
}

function pbBytes(field, data) {
  return new Uint8Array([...new Uint8Array([pbTag(field, 2)]), ...pbLen(data)]);
}

function pbVarintField(field, value) {
  return new Uint8Array([...new Uint8Array([pbTag(field, 0)]), ...pbVarint(value)]);
}

// OTLP v1 shapes --------------------------------------------------------

function keyValue(parentField, key, value) {
  // AnyValue: string_value = 1, int_value = 3 (int64 varint)
  const any =
    typeof value === "number"
      ? pbMessage(2, pbVarintField(3, value))
      : pbMessage(2, pbString(1, String(value)));
  const parts = [pbString(1, key), any];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  // The tag is the parent's field number: Resource.attributes = 1,
  // Span.attributes = 9. Repeated field, so one tag per element.
  return pbMessage(parentField, out);
}

function attributeList(attrs) {
  // Repeated field 1 on Resource: one tag per KeyValue, no extra wrap.
  return concat(attrs.map(([k, v]) => keyValue(1, k, v)));
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function randomHex(bytes) {
  const array = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function spanMessage(runId, cell, result) {
  const startedMs = Date.now() - (result.latencyMs ?? 0);
  const traceId = hexToBytes(randomHex(16));
  const spanId = hexToBytes(randomHex(8));
  const parts = [
    pbBytes(1, traceId),
    pbBytes(2, spanId),
    pbString(5, `cell ${cell.row_id}:${cell.mode}`),
    pbVarintField(6, 1), // kind: internal
    pbFixed64Field(7, startedMs * 1e6), // start_time_unix_nano
    pbFixed64Field(8, Date.now() * 1e6), // end_time_unix_nano
  ];
  const attrs = [
    ["catch22.run_id", runId],
    ["catch22.row_id", cell.row_id],
    ["catch22.family", cell.family],
    ["catch22.mode", cell.mode],
    ["catch22.tag", cell.tag],
    ["catch22.status", result.ok ? "ok" : "failed"],
    ["catch22.tokens", result.tokens ?? 0],
    ["gen_ai.usage.completion_tokens", result.tokens ?? 0],
    ["catch22.latency_ms", result.latencyMs ?? 0],
  ];
  for (const [k, v] of attrs) parts.push(keyValue(9, k, v)); // Span.attributes = 9
  parts.push(pbMessage(15, pbVarintField(3, result.ok ? 1 : 2))); // status.code
  return concat(parts);
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
}

export function buildTraceRequest(runId, cell, result) {
  // ResourceSpans: resource = 1, scope_spans = 2.
  const resource = pbMessage(1, attributeList([["service.name", "catch22-worker"], ["catch22.model", SERVICE_MODEL]]));
  const scope = pbMessage(1, pbString(1, "catch22.cell"));
  const scopeSpans = pbMessage(2, concat([scope, pbMessage(2, spanMessage(runId, cell, result))]));
  const resourceSpans = concat([resource, scopeSpans]);
  // ExportTraceServiceRequest.resource_spans = field 1.
  return pbMessage(1, resourceSpans);
}

// Fire and forget. No retry queue by design: tracing is a window, not a
// commit path. The cell durability lives in SQLite.
export async function sendCellSpan(runId, cell, result) {
  if (!TRACE_ON) return;
  try {
    const res = await fetch(TRACE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-protobuf" },
      body: buildTraceRequest(runId, cell, result),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok && !warned) {
      warned = true;
      console.warn(`trace: phoenix responded HTTP ${res.status}, continuing without spans`);
    }
  } catch {
    if (!warned) {
      warned = true;
      console.warn("trace: phoenix unreachable, continuing without spans");
    }
  }
}
