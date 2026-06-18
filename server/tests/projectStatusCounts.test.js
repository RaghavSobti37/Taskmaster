const { countProjectReviewTasks } = require('../utils/projectStatusCounts');

describe('projectStatusCounts', () => {
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
});
