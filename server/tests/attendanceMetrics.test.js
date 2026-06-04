const {
  getSystemMinutesFromTimes,
  sumDailyLogMinutes,
  computeExpectedLogMinutes,
  computeUnloggedMinutes,
  buildAttendanceMetrics,
  LUNCH_BREAK_MINUTES,
} = require('../utils/attendanceMetrics');

describe('attendanceMetrics', () => {
  test('getSystemMinutesFromTimes handles same-day and overnight spans', () => {
    expect(getSystemMinutesFromTimes('09:00', '18:00')).toBe(540);
    expect(getSystemMinutesFromTimes('22:00', '06:00')).toBe(480);
  });

  test('computeExpectedLogMinutes subtracts one hour lunch', () => {
    expect(computeExpectedLogMinutes(540)).toBe(480);
    expect(computeExpectedLogMinutes(45)).toBe(0);
    expect(LUNCH_BREAK_MINUTES).toBe(60);
  });

  test('sumDailyLogMinutes includes task completion and review logs', () => {
    const logs = [
      { details: { timeSpent: '1h', type: 'GENERAL' } },
      { details: { timeSpent: '30m', type: 'TASK_COMPLETION' } },
      { details: { timeSpent: '15m', type: 'TASK_REVIEW' } },
    ];
    expect(sumDailyLogMinutes(logs)).toBe(105);
  });

  test('computeUnloggedMinutes is shortfall only, not absolute gap', () => {
    expect(computeUnloggedMinutes(540, 105)).toBe(375);
    expect(computeUnloggedMinutes(540, 540)).toBe(0);
    expect(computeUnloggedMinutes(540, 500)).toBe(0);
  });

  test('buildAttendanceMetrics: 9–6 with 8h logged leaves 0 unlogged', () => {
    const metrics = buildAttendanceMetrics({
      inTime: '09:00',
      outTime: '18:00',
      logs: [{ details: { timeSpent: '8h' } }],
    });
    expect(metrics.workedMinutes).toBe(540);
    expect(metrics.loggedMinutes).toBe(480);
    expect(metrics.expectedLogMinutes).toBe(480);
    expect(metrics.unloggedMinutes).toBe(0);
    expect(metrics.overtimeMinutes).toBe(60);
  });

  test('buildAttendanceMetrics: 9–6 with 7h logged leaves 1h unlogged', () => {
    const metrics = buildAttendanceMetrics({
      inTime: '09:00',
      outTime: '18:00',
      logs: [{ details: { timeSpent: '7h' } }],
    });
    expect(metrics.unloggedMinutes).toBe(60);
    expect(metrics.discrepancyMinutes).toBe(60);
  });
});
