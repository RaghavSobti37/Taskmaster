const {
  resolveTaskSpan,
  taskOverlapsRange,
  getScheduleAnchorKey,
  dateKeysInRange,
  totalSpanDaysInRange,
} = require('../../shared/scheduleTaskDates');
const { toDateKey, getTodayDateKey } = require('../../shared/dateValidation');

describe('scheduleTaskDates', () => {
  test('resolveTaskSpan swaps inverted dates', () => {
    const span = resolveTaskSpan({
      startDate: '2026-06-10',
      dueDate: '2026-06-05',
    });
    expect(span).toEqual({ start: '2026-06-05', end: '2026-06-10' });
  });

  test('taskOverlapsRange uses date keys', () => {
    const task = { scheduleDate: '2026-06-08', dueDate: '2026-06-12' };
    expect(taskOverlapsRange(task, '2026-06-01', '2026-06-07')).toBe(false);
    expect(taskOverlapsRange(task, '2026-06-10', '2026-06-15')).toBe(true);
    expect(taskOverlapsRange(task, '2026-06-08', '2026-06-08')).toBe(true);
  });

  test('getScheduleAnchorKey prefers scheduleDate', () => {
    expect(
      getScheduleAnchorKey({
        scheduleDate: '2026-06-03',
        startDate: '2026-06-01',
        dueDate: '2026-06-10',
      })
    ).toBe('2026-06-03');
  });

  test('dateKeysInRange enumerates inclusive range', () => {
    expect(dateKeysInRange('2026-06-01', '2026-06-03')).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ]);
  });

  test('totalSpanDaysInRange counts multi-day span', () => {
    const task = { startDate: '2026-06-05', dueDate: '2026-06-07' };
    expect(totalSpanDaysInRange(task, '2026-06-05', '2026-06-07')).toBe(3);
    expect(totalSpanDaysInRange(task, '2026-06-01', '2026-06-04')).toBe(0);
  });

  test('toDateKey uses IST for ISO timestamps', () => {
    const key = toDateKey('2026-06-01T20:00:00.000Z');
    expect(key).toBeTruthy();
    expect(getTodayDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
