/** Activity types shown in task history UI (no status/field edit noise). */
export const VISIBLE_TASK_ACTIVITY_TYPES = new Set(['created', 'assignment', 'message', 'rollback']);

function activityUserId(ref) {
  if (!ref) return null;
  const id = ref._id ?? ref;
  return id != null ? String(id) : null;
}

function isSelfAssignment(item) {
  if (item?.type !== 'assignment') return false;
  const assigneeId = activityUserId(item.assignee);
  const assignedById = activityUserId(item.assignedBy || item.actor);
  return Boolean(assigneeId && assignedById && assigneeId === assignedById);
}

export function filterTaskActivityForDisplay(items = []) {
  return (items || []).filter((item) => {
    if (!VISIBLE_TASK_ACTIVITY_TYPES.has(item?.type)) return false;
    if (isSelfAssignment(item)) return false;
    return true;
  });
}
