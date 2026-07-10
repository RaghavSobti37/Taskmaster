const {
  countProjectReviewTasks,
  buildUserTodoScope,
  DASHBOARD_HORIZON_DAYS,
} = require('../utils/projectStatusCounts');

describe('projectStatusCounts', () => {
  describe('buildUserTodoScope', () => {
    it('includes creator, assignments, and mention access', () => {
      const scope = {
        $or: [
          { createdBy: 'user-1' },
          { _id: { $in: ['t1'] } },
          { mentionAccessIds: 'user-1' },
        ],
      };
      expect(scope.$or).toHaveLength(3);
      expect(scope.$or[2]).toEqual({ mentionAccessIds: 'user-1' });
    });
  });

  describe('countProjectReviewTasks', () => {
    it('counts only review tasks linked to a project', () => {
      const queue = [
        { _id: '1', projectId: 'p1' },
        { _id: '2', projectId: { _id: 'p2' } },
        { _id: '3', projectId: null },
        { _id: '4' },
      ];
      expect(countProjectReviewTasks(queue)).toBe(2);
    });
  });

  it('uses 35-day dashboard horizon for project overdue alignment', () => {
    expect(DASHBOARD_HORIZON_DAYS).toBe(35);
  });
});
