import { describe, it, expect } from 'vitest';
import { normalizeTask, normalizeTasks } from './normalizeTask';

describe('normalizeTask', () => {
  it('builds assigneeIds from string assignees', () => {
    const task = normalizeTask({
      _id: 'task1',
      title: 'Test',
      assignees: ['user-a', 'user-b'],
      createdBy: 'creator',
    });
    expect(task.assigneeIds).toEqual(['user-a', 'user-b']);
    expect(task.assignments).toHaveLength(2);
  });

  it('preserves existing assignments', () => {
    const assignments = [{ userId: 'u1', assignedBy: 'admin' }];
    const task = normalizeTask({ _id: 't2', assignments });
    expect(task.assignments).toEqual(assignments);
  });

  it('normalizeTasks maps arrays', () => {
    const out = normalizeTasks([{ assignees: ['x'] }, { assignees: ['y'] }]);
    expect(out[0].assigneeIds).toEqual(['x']);
    expect(out[1].assigneeIds).toEqual(['y']);
  });
});
