import { describe, it, expect } from 'vitest';
import { getNavCountsForPath } from './navStatusCounts';

const baseCounts = {
  tasks: { overdue: 0, today: 0, inReview: 0 },
  followups: { overdue: 0, today: 0 },
  calendar: { today: 0 },
  notifications: { unread: 0, byCategory: {} },
  review: { pending: 0 },
  projects: { overdue: 0, review: 0 },
};

describe('getNavCountsForPath /todo', () => {
  it('shows overdue count with rose variant when overdue tasks exist', () => {
    const counts = {
      ...baseCounts,
      tasks: { overdue: 4, today: 2, inReview: 1 },
      review: { pending: 3 },
    };
    expect(getNavCountsForPath('/todo', counts)).toEqual({
      count: 4,
      todayCount: 0,
      badgeCount: 4,
      badgeVariant: 'rose',
    });
  });

  it('uses review.pending (review queue) not tasks.inReview for amber badge', () => {
    const counts = {
      ...baseCounts,
      tasks: { overdue: 0, today: 1, inReview: 5 },
      review: { pending: 2 },
    };
    expect(getNavCountsForPath('/todo', counts)).toEqual({
      count: 0,
      todayCount: 2,
      badgeCount: 2,
      badgeVariant: 'amber',
    });
  });

  it('shows today count when no overdue or review queue items', () => {
    const counts = {
      ...baseCounts,
      tasks: { overdue: 0, today: 3, inReview: 0 },
      review: { pending: 0 },
    };
    expect(getNavCountsForPath('/todo', counts)).toEqual({
      count: 0,
      todayCount: 3,
      badgeCount: 3,
      badgeVariant: 'amber',
    });
  });
});
