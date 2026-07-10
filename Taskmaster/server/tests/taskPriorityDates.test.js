const {
  PRIORITY_DAY_SPAN,
  getPriorityDaySpan,
  computeDueDateFromStart,
  applyPriorityDueDate,
} = require('../../shared/taskPriorityDates');

describe('taskPriorityDates', () => {
  it('maps priority to day span', () => {
    expect(getPriorityDaySpan('critical')).toBe(1);
    expect(getPriorityDaySpan('high')).toBe(2);
    expect(getPriorityDaySpan('medium')).toBe(3);
    expect(getPriorityDaySpan('low')).toBe(4);
    expect(getPriorityDaySpan(undefined)).toBe(PRIORITY_DAY_SPAN.medium);
  });

  it('computes due date from start + priority span', () => {
    expect(computeDueDateFromStart('2026-05-30', 'critical')).toBe('2026-05-31');
    expect(computeDueDateFromStart('2026-05-30', 'high')).toBe('2026-06-01');
    expect(computeDueDateFromStart('2026-05-30', 'medium')).toBe('2026-06-02');
    expect(computeDueDateFromStart('2026-05-30', 'low')).toBe('2026-06-03');
  });

  it('fills missing due date on create', () => {
    const coreData = { priority: 'high', scheduleDate: '2026-05-30' };
    applyPriorityDueDate(coreData);
    expect(coreData.dueDate).toBe('2026-06-01');
  });

  it('recalculates due date when priority changes on update', () => {
    const existing = { priority: 'low', scheduleDate: new Date('2026-05-30'), dueDate: new Date('2026-06-03') };
    const coreUpdates = { priority: 'critical' };
    applyPriorityDueDate(coreUpdates, existing);
    expect(coreUpdates.dueDate).toBe('2026-05-31');
  });

  it('keeps manual due date when only due date is updated', () => {
    const existing = { priority: 'medium', scheduleDate: new Date('2026-05-30'), dueDate: new Date('2026-06-02') };
    const coreUpdates = { dueDate: '2026-06-10' };
    applyPriorityDueDate(coreUpdates, existing);
    expect(coreUpdates.dueDate).toBe('2026-06-10');
  });
});
