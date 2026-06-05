const { applyTodoFilters, getTodoSort } = require('../utils/todoQueryBuilder');

describe('todoQueryBuilder', () => {
  describe('applyTodoFilters', () => {
    it('passes through base filter when no query params', () => {
      const base = { assigneeId: 'abc' };
      expect(applyTodoFilters(base, {})).toEqual(base);
    });

    it('adds search regex on title and description', () => {
      const result = applyTodoFilters({}, { search: 'invoice' });
      expect(result.$and).toHaveLength(1);
      expect(result.$and[0].$or).toHaveLength(2);
      expect(result.$and[0].$or[0].title).toBeInstanceOf(RegExp);
      expect(result.$and[0].$or[0].title.test('Invoice #12')).toBe(true);
    });

    it('applies status, priority, and type when not "all"', () => {
      const result = applyTodoFilters({}, { status: 'open', priority: 'high', type: 'bug' });
      expect(result.status).toBe('open');
      expect(result.priority).toBe('high');
      expect(result.type).toBe('bug');
    });

    it('ignores "all" sentinel values', () => {
      const result = applyTodoFilters({ status: 'open' }, { status: 'all', priority: 'all' });
      expect(result.status).toBe('open');
      expect(result.priority).toBeUndefined();
    });

    it('maps statFilter open to non-done tasks', () => {
      const result = applyTodoFilters({}, { statFilter: 'open' });
      expect(result.status).toEqual({ $ne: 'done' });
    });

    it('maps statFilter in-review', () => {
      const result = applyTodoFilters({}, { statFilter: 'in-review' });
      expect(result.status).toBe('in-review');
    });
  });

  describe('getTodoSort', () => {
    it('defaults to dueDate ascending', () => {
      expect(getTodoSort(undefined, undefined)).toEqual({ dueDate: 1, _id: 1 });
    });

    it('respects allowed field and desc order', () => {
      expect(getTodoSort('priority', 'desc')).toEqual({ priority: -1, _id: 1 });
    });

    it('falls back to dueDate for unknown field', () => {
      expect(getTodoSort('unknown', 'asc')).toEqual({ dueDate: 1, _id: 1 });
    });
  });
});
