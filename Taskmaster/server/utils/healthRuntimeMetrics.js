const fs = require('fs');
const os = require('os');

let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();
let lastCpuPct = 0;

function mb(bytes) {
  return Math.round(bytes / 1048576);
}

function getCpuPercent() {
  const now = Date.now();
  const elapsedSec = (now - lastCpuAt) / 1000;
  if (elapsedSec < 0.25) return lastCpuPct;

  const delta = process.cpuUsage(lastCpu);
  lastCpu = process.cpuUsage();
  lastCpuAt = now;

  const cpuUs = delta.user + delta.system;
  const pct = Math.min(
    100,
    Math.round((cpuUs / 1000 / elapsedSec / Math.max(os.cpus().length, 1)) * 100),
  );
  lastCpuPct = pct;
  return pct;
}

function getDiskSnapshot() {
  try {
    const stat = fs.statfsSync(process.cwd());
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bfree) * Number(stat.bsize);
    if (!total) return null;
    const used = total - free;
    return {
      usedPct: Math.round((used / total) * 100),
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      path: process.cwd(),
    };
  } catch {
    return null;
  }
}

/** Node process.memoryUsage() with heap segment breakdown for dashboard. */
function getHeapBreakdown() {
  const m = process.memoryUsage();
  const heapFree = Math.max(0, m.heapTotal - m.heapUsed);
  const arrayBuffers = m.arrayBuffers ?? 0;
  const external = Math.max(0, m.external - arrayBuffers);
  const nonHeapRss = Math.max(0, m.rss - m.heapUsed - m.external);

  const segments = [
    { id: 'heapUsed', label: 'Heap Used (V8 objects)', bytes: m.heapUsed, color: '#126d5e' },
    { id: 'heapFree', label: 'Heap Free (reserved)', bytes: heapFree, color: '#3d4450' },
    { id: 'external', label: 'External (native bindings)', bytes: external, color: '#08525f' },
    { id: 'arrayBuffers', label: 'Array Buffers', bytes: arrayBuffers, color: '#7ab8aa' },
    { id: 'rssOverhead', label: 'RSS overhead (stacks, code)', bytes: nonHeapRss, color: '#252830' },
  ].filter((s) => s.bytes > 0);

  const rss = m.rss || 1;
  const withPct = segments.map((s) => ({
    ...s,
    mb: mb(s.bytes),
    pctOfRss: Math.round((s.bytes / rss) * 1000) / 10,
    pctOfHeap: s.id === 'heapUsed' || s.id === 'heapFree'
      ? Math.round((s.bytes / Math.max(m.heapTotal, 1)) * 1000) / 10
      : null,
  }));

  return {
    rss: m.rss,
    heapTotal: m.heapTotal,
    heapUsed: m.heapUsed,
    heapFree,
    external: m.external,
    arrayBuffers,
    heapUsedPct: m.heapTotal ? Math.round((m.heapUsed / m.heapTotal) * 100) : 0,
    rssPct: Math.round((m.rss / os.totalmem()) * 100),
    rssMb: mb(m.rss),
    heapTotalMb: mb(m.heapTotal),
    heapUsedMb: mb(m.heapUsed),
    heapFreeMb: mb(heapFree),
    externalMb: mb(m.external),
    arrayBuffersMb: mb(arrayBuffers),
    systemTotalMb: mb(os.totalmem()),
    systemFreeMb: mb(os.freemem()),
    segments: withPct,
  };
}

function getRuntimeSnapshot() {
  const heap = getHeapBreakdown();
  const disk = getDiskSnapshot();
  return {
    cpuPct: getCpuPercent(),
    load1m: Math.round((os.loadavg()[0] || 0) * 100) / 100,
    cpuCount: os.cpus().length,
    heap,
    disk,
    memPct: heap.rssPct,
    heapPct: heap.heapUsedPct,
    diskPct: disk?.usedPct ?? null,
  };
}

module.exports = {
  getCpuPercent,
  getDiskSnapshot,
  getHeapBreakdown,
  getRuntimeSnapshot,
  mb,
};
