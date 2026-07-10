import { describe, it, expect } from 'vitest';
import { tasksForScheduleDay } from './scheduleLayout';

describe('tasksForScheduleDay', () => {
  const tasks = [
    { _id: 'a', title: 'Single', scheduleDate: '2026-06-08' },
    { _id: 'b', title: 'Span', startDate: '2026-06-06', dueDate: '2026-06-10' },
    { _id: 'c', title: 'Other', dueDate: '2026-06-15' },
  ];

  it('includes tasks whose span covers the day', () => {
    expect(tasksForScheduleDay(tasks, '2026-06-08').map((t) => t._id)).toEqual(['a', 'b']);
  });

  it('includes multi-day tasks on start and end days', () => {
    expect(tasksForScheduleDay(tasks, '2026-06-06').map((t) => t._id)).toEqual(['b']);
    expect(tasksForScheduleDay(tasks, '2026-06-10').map((t) => t._id)).toEqual(['b']);
  });

  it('dedupes by task id', () => {
    const duped = [...tasks, { _id: 'a', title: 'Dup' }];
    expect(tasksForScheduleDay(duped, '2026-06-08')).toHaveLength(2);
  });
});
