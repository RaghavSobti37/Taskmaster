const {
  dedupeDailyLogs,
  aggregateProjectEffort,
  buildAnalyticsContext,
  resolveLogProjectId,
  logMatchesProject,
  buildEffortSummaryRow,
} = require('../../shared/projectAnalyticsCore.cjs');

const getDateKey = (d) => {
  const v = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(v);
};

const inRollingWindow = (day, window) => day >= window.startKey && day <= window.endKey;

describe('projectAnalyticsCore', () => {
  const project = { _id: '507f1f77bcf86cd799439011', name: 'TSC ACADEMY' };
  const window = { startKey: '2026-06-01', endKey: '2026-06-30', days: 30, timeframe: '30d' };
  const rangeStart = new Date('2026-06-01T00:00:00+05:30');
  const rangeEnd = new Date('2026-06-30T23:59:59+05:30');

  test('logMatchesProject links task logs via details.projectId', () => {
    const ctx = buildAnalyticsContext([project], []);
    const log = {
      targetType: 'Task',
      targetId: 'task123',
      details: { projectId: project._id, project: 'OTHER NAME', type: 'TASK_COMPLETION' },
    };
    expect(logMatchesProject(log, project, ctx)).toBe(true);
  });

  test('task logs without projectId resolve via task.projectId', () => {
    const ctx = buildAnalyticsContext([project], [{ _id: 't1', projectId: project._id }]);
    const log = {
      targetType: 'Task',
      targetId: 't1',
      details: { type: 'TASK_COMPLETION', timeSpent: '2h', project: 'Wrong Label' },
    };
    expect(resolveLogProjectId(log, ctx)).toBe(project._id);
  });

  test('dedupeDailyLogs collapses duplicate task completion logs same day', () => {
    const logs = [
      { _id: '1', createdAt: '2026-06-10T10:00:00Z', targetType: 'Task', targetId: 't1', userId: 'u1', details: { type: 'TASK_COMPLETION', timeSpent: '30m' } },
      { _id: '2', createdAt: '2026-06-10T11:00:00Z', targetType: 'Task', targetId: 't1', userId: 'u1', details: { type: 'TASK_COMPLETION', timeSpent: '30m' } },
    ];
    const { logs: kept, collapsed } = dedupeDailyLogs(logs, getDateKey);
    expect(kept).toHaveLength(1);
    expect(collapsed).toBe(1);
  });

  test('summary and detail effort totals match for same inputs', () => {
    const logs = [
      { _id: 'a', createdAt: '2026-06-10T10:00:00Z', userId: 'u1', details: { type: 'MANUAL', timeSpent: '2h', projectId: project._id } },
      { _id: 'b', createdAt: '2026-06-11T10:00:00Z', userId: 'u1', targetType: 'Task', targetId: 't1', details: { type: 'TASK_COMPLETION', timeSpent: '1h', projectId: project._id } },
      { _id: 'c', createdAt: '2026-06-11T11:00:00Z', userId: 'u1', targetType: 'Task', targetId: 't1', details: { type: 'TASK_COMPLETION', timeSpent: '30m', projectId: project._id } },
    ];
    const filtered = logs.filter((l) => logMatchesProject(l, project, buildAnalyticsContext([project], [{ _id: 't1', projectId: project._id }])));
    const { logs: deduped } = dedupeDailyLogs(filtered, getDateKey);

    const effort = aggregateProjectEffort({
      logs: deduped,
      window,
      getDateKey,
      inRollingWindow,
      tasks: [{ _id: 't1', status: 'done', completedAt: '2026-06-11', priority: 'high', plannedHours: 2 }],
      assigneesByTask: new Map([['t1', ['u1']]]),
      projectMemberIds: new Set(['u1']),
      memberProfileById: new Map([['u1', { name: 'Test', avatar: '' }]]),
      rangeStart,
      rangeEnd,
    });

    const summaryRow = buildEffortSummaryRow(effort);
    expect(summaryRow.totalHours).toBe(2.5);
    expect(summaryRow.manualLogHours).toBe(2);
    expect(summaryRow.taskCompletionHours).toBe(0.5);
    expect(summaryRow.logCount).toBe(2);
  });

  test('one assignment and one completion yields tasksCompleted 1', () => {
    const logs = [
      {
        _id: 'b',
        createdAt: '2026-06-11T10:00:00Z',
        userId: 'u1',
        targetType: 'Task',
        targetId: 't1',
        details: { type: 'TASK_COMPLETION', timeSpent: '1h', projectId: project._id },
      },
    ];
    const filtered = logs.filter((l) => logMatchesProject(l, project, buildAnalyticsContext([project], [{ _id: 't1', projectId: project._id }])));
    const { logs: deduped } = dedupeDailyLogs(filtered, getDateKey);

    const effort = aggregateProjectEffort({
      logs: deduped,
      window,
      getDateKey,
      inRollingWindow,
      tasks: [{ _id: 't1', status: 'done', completedAt: '2026-06-11', priority: 'high', plannedHours: 1 }],
      assigneesByTask: new Map([['t1', ['u1']]]),
      projectMemberIds: new Set(['u1']),
      memberProfileById: new Map([['u1', { name: 'Test', avatar: '' }]]),
      rangeStart,
      rangeEnd,
    });

    expect(effort.summary.tasksCompleted).toBe(1);
    expect(effort.byMember.find((m) => m.userId === 'u1')?.tasksCompleted).toBe(1);
  });
});
