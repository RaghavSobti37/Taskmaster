import { describe, expect, it } from 'vitest';
import { chartTicksForTimeframe, mapDashboardSeriesToChart } from './chartTimeSeries';

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

  it('returns fewer x ticks for shorter windows', () => {
    expect(chartTicksForTimeframe('1d')).toBe(2);
    expect(chartTicksForTimeframe('7d')).toBe(4);
    expect(chartTicksForTimeframe('30d')).toBe(5);
  });
});
