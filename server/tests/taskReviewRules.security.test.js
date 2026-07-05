const {
  needsReviewOnComplete,
  canUserRollbackTask,
  getDelegatedAssignments,
} = require('../../shared/taskReviewRules');

describe('taskReviewRules security', () => {
  const creator = 'creator-id';
  const assignee = 'assignee-id';
  const other = 'other-id';

  test('mixed self-assigned and delegated forces review for self-assigned user', () => {
    const assignments = [
      { userId: assignee, assignedBy: assignee },
      { userId: other, assignedBy: creator },
    ];
    expect(needsReviewOnComplete(assignments, assignee)).toBe(true);
  });

  test('pure self-assigned work skips review', () => {
    const assignments = [{ userId: assignee, assignedBy: assignee }];
    expect(needsReviewOnComplete(assignments, assignee)).toBe(false);
  });

  test('delegated assignee requires review', () => {
    const assignments = [{ userId: assignee, assignedBy: creator }];
    expect(needsReviewOnComplete(assignments, assignee)).toBe(true);
  });

  test('assignee cannot rollback done task', () => {
    const assignments = [{ userId: assignee, assignedBy: creator }];
    expect(
      canUserRollbackTask(
        { _id: assignee },
        { status: 'done' },
        assignments,
        { taskCreatedBy: creator }
      )
    ).toBe(false);
  });

  test('creator can rollback done task', () => {
    const assignments = [{ userId: assignee, assignedBy: creator }];
    expect(
      canUserRollbackTask(
        { _id: creator },
        { status: 'done' },
        assignments,
        { taskCreatedBy: creator }
      )
    ).toBe(true);
  });

  test('delegated assigner can rollback in-review task', () => {
    const assignments = [{ userId: assignee, assignedBy: creator }];
    expect(
      canUserRollbackTask(
        { _id: creator },
        { status: 'in-review' },
        assignments,
        { taskCreatedBy: creator }
      )
    ).toBe(true);
  });

  test('getDelegatedAssignments ignores self-assigned rows', () => {
    const assignments = [
      { userId: assignee, assignedBy: assignee },
      { userId: other, assignedBy: creator },
    ];
    expect(getDelegatedAssignments(assignments)).toHaveLength(1);
  });
});
