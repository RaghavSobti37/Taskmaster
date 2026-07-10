import { describe, expect, it } from 'vitest';
import {
  chartTicksForTimeframe,
  mapDashboardSeriesToChart,
  mapDashboardSeriesWithDate,
} from './chartTimeSeries';

describe('chartTimeSeries', () => {
  it('maps ISO dashboard series to Date x values', () => {
    const rows = mapDashboardSeriesToChart([
      { date: '2025-06-25', label: '25/06', count: 3 },
      { date: '2025-06-26', label: '26/06', count: 0 },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].date).toBeInstanceOf(Date);
    expect(rows[0].value).toBe(3);
    expect(rows[1].value).toBe(0);
  });

  it('preserves multi-metric rows for attendance-style charts', () => {
    const rows = mapDashboardSeriesWithDate([
      { date: '2026-06-27', label: '27/06', marked: 2, present: 1 },
      { date: '2026-07-03', label: '03/07', marked: 4, present: 4 },
    ]);

    expect(rows[0].marked).toBe(2);
    expect(rows[1].present).toBe(4);
    expect(rows[1].date.getTime()).toBeGreaterThan(rows[0].date.getTime());
  });

  it('returns fewer x ticks for shorter windows', () => {
    expect(chartTicksForTimeframe('1d')).toBe(2);
    expect(chartTicksForTimeframe('7d')).toBe(4);
    expect(chartTicksForTimeframe('30d')).toBe(5);
  });
});
