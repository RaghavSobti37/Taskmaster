const {
  getCurrentMonthRange,
  getPreviousMonthRange,
  getFirstDayOfMonthDateKey,
  getLastDayOfMonthDateKey,
} = require('../utils/attendanceDate');

describe('attendanceDate month ranges', () => {
  test('getFirstDayOfMonthDateKey returns first calendar day', () => {
    expect(getFirstDayOfMonthDateKey('2026-06-15')).toBe('2026-06-01');
    expect(getFirstDayOfMonthDateKey('2026-01-31')).toBe('2026-01-01');
  });

  test('getLastDayOfMonthDateKey returns last calendar day', () => {
    expect(getLastDayOfMonthDateKey('2026-06-15')).toBe('2026-06-30');
    expect(getLastDayOfMonthDateKey('2026-02-10')).toBe('2026-02-28');
    expect(getLastDayOfMonthDateKey('2024-02-10')).toBe('2024-02-29');
  });

  test('getCurrentMonthRange spans full month in IST keys', () => {
    const range = getCurrentMonthRange('2026-06-15');
    expect(range.monthStartKey).toBe('2026-06-01');
    expect(range.monthEndKey).toBe('2026-06-30');
    expect(range.monthStart.getTime()).toBeLessThan(range.monthEnd.getTime());
  });

  test('getPreviousMonthRange returns prior month', () => {
    const prev = getPreviousMonthRange();
    const current = getCurrentMonthRange();
    expect(prev.monthEndKey < current.monthStartKey).toBe(true);
  });
});
