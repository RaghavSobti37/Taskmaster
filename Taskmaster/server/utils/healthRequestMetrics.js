/** Rolling request metrics for /api/health dashboard — ponytail: in-memory only. */
const WINDOW_MS = 60_000;
const MAX_SAMPLES = 500;
const samples = [];

function prune(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  while (samples.length && samples[0].t < cutoff) samples.shift();
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}

function recordRequest(durationMs, statusCode) {
  const now = Date.now();
  samples.push({ t: now, ms: durationMs, ok: statusCode < 400 });
  prune(now);
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function getSnapshot() {
  prune();
  const ms = samples.map((s) => s.ms);
  const total = samples.length;
  const errors = samples.filter((s) => !s.ok).length;
  return {
    requestsPerMin: total,
    errorRatePct: total ? (errors / total) * 100 : 0,
    avgLatencyMs: total ? Math.round(ms.reduce((a, b) => a + b, 0) / total) : null,
    p95LatencyMs: percentile(ms, 95) != null ? Math.round(percentile(ms, 95)) : null,
    latencySeries: ms.slice(-32),
  };
}

module.exports = { recordRequest, getSnapshot };
