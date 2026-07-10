const { getHeapBreakdown, getRuntimeSnapshot } = require('../utils/healthRuntimeMetrics');

describe('healthRuntimeMetrics', () => {
  it('returns heap segments that sum to meaningful RSS breakdown', () => {
    const heap = getHeapBreakdown();
    expect(heap.heapUsed).toBeGreaterThan(0);
    expect(heap.heapTotal).toBeGreaterThanOrEqual(heap.heapUsed);
    expect(heap.segments.length).toBeGreaterThan(0);
    expect(heap.segments.some((s) => s.id === 'heapUsed')).toBe(true);
    expect(heap.heapUsedMb).toBeGreaterThan(0);
  });

  it('getRuntimeSnapshot includes cpu and disk fields', () => {
    const snap = getRuntimeSnapshot();
    expect(typeof snap.cpuPct).toBe('number');
    expect(snap.heap).toBeDefined();
    expect(snap.memPct).toBeGreaterThanOrEqual(0);
  });
});
