const {
  buildActiveOrRecentCompletedClause,
  mergeTaskListFilter,
  getCompletedTasksCutoff,
} = require('../utils/taskListFilter');

describe('taskListFilter', () => {
  test('mergeTaskListFilter hides stale done tasks by default', () => {
    const merged = mergeTaskListFilter({ projectId: 'abc' });
    expect(merged.$and).toHaveLength(2);
    expect(merged.$and[0]).toEqual({ projectId: 'abc' });
    expect(merged.$and[1]).toEqual(buildActiveOrRecentCompletedClause());
  });

  test('mergeTaskListFilter skips visibility when includeOldCompleted', () => {
    expect(mergeTaskListFilter({ projectId: 'abc' }, { includeOldCompleted: true })).toEqual({
      projectId: 'abc',
    });
  });

  test('getCompletedTasksCutoff is a Date', () => {
    expect(getCompletedTasksCutoff()).toBeInstanceOf(Date);
  });
});
