import { describe, expect, it } from 'vitest';
import {
  buildProjectRangeParams,
  formatProjectRangeSubtitle,
  isAllTimeRange,
} from './projectReportRange';

describe('projectReportRange', () => {
  it('defaults all-time preset params', () => {
    expect(buildProjectRangeParams('preset', 'all', '', '')).toEqual({ timeframe: 'all' });
    expect(isAllTimeRange('preset', 'all')).toBe(true);
    expect(isAllTimeRange('preset', '30d')).toBe(false);
  });

  it('formats all-time subtitle', () => {
    const subtitle = formatProjectRangeSubtitle('preset', 'all', {
      start: '2016-01-01',
      end: '2026-07-05',
    });
    expect(subtitle).toContain('All time');
  });
});
