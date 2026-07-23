const {
  buildLogsSummary,
  buildTaskSummary,
  getReportLogFilter,
} = require('../services/monthlyReportService');

describe('monthlyReportService report math', () => {
  test('buildLogsSummary uses workDate ownership data and all supported time fields', () => {
    const logs = [
      {
        userId: 'user-1',
        actorId: 'user-2',
        createdAt: new Date('2026-07-20T09:00:00.000Z'),
        details: { workDate: '2026-07-05', timeSpent: '1h 30m', title: 'Manual' },
      },
      {
        userId: 'user-1',
        actorId: 'user-1',
        createdAt: new Date('2026-07-20T10:00:00.000Z'),
        details: { workDate: '2026-07-05', startTime: '10:00', endTime: '12:15', title: 'Interval' },
      },
      {
        userId: 'user-1',
        actorId: 'user-1',
        createdAt: new Date('2026-07-06T10:00:00.000Z'),
        details: { hours: 2, title: 'Numeric' },
      },
    ];

    const summary = buildLogsSummary(logs, 'Riya');

    expect(summary.totalEntries).toBe(3);
    expect(summary.totalHours).toBe(5.75);
    expect(summary.byDay).toEqual([
      { date: '2026-07-05', hours: 3.75, count: 2 },
      { date: '2026-07-06', hours: 2, count: 1 },
    ]);
    expect(summary.entries[0]).toMatchObject({
      userId: 'user-1',
      userName: 'Riya',
      date: '2026-07-05',
      timeSpent: '1h 30m',
    });
  });

  test('buildTaskSummary counts only tasks active in the report period', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-31T23:59:59.999Z');
    const tasks = [
      { title: 'Done in July', status: 'done', priority: 'high', completedAt: new Date('2026-07-10T00:00:00.000Z') },
      { title: 'Due in July', status: 'in-progress', priority: 'medium', dueDate: new Date('2026-07-20T00:00:00.000Z') },
      { title: 'Old task', status: 'todo', priority: 'low', createdAt: new Date('2026-06-10T00:00:00.000Z') },
    ];

    const summary = buildTaskSummary(tasks, start, end);

    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.todo).toBe(0);
    expect(summary.byPriority).toEqual({ critical: 0, high: 1, medium: 1, low: 0 });
  });

  test('getReportLogFilter scopes daily logs by owner and work date', () => {
    const userIds = ['u1', 'u2'];
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-07-31T23:59:59.999Z');

    const filter = getReportLogFilter(userIds, startDate, endDate);

    expect(filter).toMatchObject({
      action: 'DAILY_LOG',
      userId: { $in: userIds },
    });
    expect(JSON.stringify(filter)).toContain('details.workDate');
    expect(JSON.stringify(filter)).not.toContain('actorId');
  });
});
