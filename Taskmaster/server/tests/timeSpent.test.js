const {
  parseTimeSpentToMinutes,
  parseTimeSpentToHours,
  formatTimeSpent,
  hoursMinutesToDecimal,
  isValidCompletionMinutes,
} = require('../../shared/timeSpent');

describe('timeSpent', () => {
  test('parseTimeSpentToMinutes handles mixed formats', () => {
    expect(parseTimeSpentToMinutes('1h 30m')).toBe(90);
    expect(parseTimeSpentToMinutes('1.5h')).toBe(90);
    expect(parseTimeSpentToMinutes('30m')).toBe(30);
    expect(parseTimeSpentToMinutes('15m')).toBe(15);
    expect(parseTimeSpentToMinutes('2h')).toBe(120);
  });

  test('formatTimeSpent renders human-readable strings', () => {
    expect(formatTimeSpent(1)).toBe('1h');
    expect(formatTimeSpent(0.5)).toBe('30m');
    expect(formatTimeSpent(1.5)).toBe('1h 30m');
    expect(formatTimeSpent(0.25)).toBe('15m');
  });

  test('hoursMinutesToDecimal converts inputs', () => {
    expect(hoursMinutesToDecimal(1, 30)).toBe(1.5);
    expect(hoursMinutesToDecimal(0, 45)).toBe(0.75);
    expect(hoursMinutesToDecimal('', '30')).toBe(0.5);
  });

  test('isValidCompletionMinutes rejects zero-only input', () => {
    expect(isValidCompletionMinutes(0, 0)).toBe(false);
    expect(isValidCompletionMinutes(0, 15)).toBe(true);
    expect(isValidCompletionMinutes(0, 1)).toBe(true);
    expect(isValidCompletionMinutes(1, 0)).toBe(true);
    expect(isValidCompletionMinutes(2, 30)).toBe(true);
  });

  test('parseTimeSpentToHours round-trips with formatTimeSpent', () => {
    const decimal = hoursMinutesToDecimal(2, 15);
    expect(parseTimeSpentToHours(formatTimeSpent(decimal))).toBeCloseTo(2.25, 5);
  });
});
