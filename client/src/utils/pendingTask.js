/** Client-side pending task placeholders (optimistic create / in-flight complete). */

export const PENDING_TASK_PREFIX = 'pending-task-';

export const isPendingTask = (taskOrId) => {
  if (taskOrId?._pending) return true;
  const id = typeof taskOrId === 'string' ? taskOrId : taskOrId?._id;
  return typeof id === 'string' && id.startsWith(PENDING_TASK_PREFIX);
};

export const makePendingTask = (payload, tempId = `${PENDING_TASK_PREFIX}${Date.now()}`) => ({
  _id: tempId,
  _pending: true,
  status: payload.status || 'todo',
  priority: payload.priority || 'medium',
  createdAt: new Date().toISOString(),
  ...payload,
});
