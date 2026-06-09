const { eachDayInclusive } = require('../utils/leaveApprovalSync');
const { getDateKey } = require('../utils/attendanceDate');

describe('leaveApprovalSync', () => {
  test('eachDayInclusive returns every day in range', () => {
    const days = eachDayInclusive('2026-06-10', '2026-06-12');
    expect(days).toHaveLength(3);
    expect(getDateKey(days[0])).toBe('2026-06-10');
    expect(getDateKey(days[2])).toBe('2026-06-12');
  });

  test('eachDayInclusive handles single-day leave', () => {
    const days = eachDayInclusive('2026-06-09', '2026-06-09');
    expect(days).toHaveLength(1);
  });
});
