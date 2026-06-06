import { normalizeId } from './taskReviewRules';

function resolveUserId(ref) {
  if (ref == null) return null;
  if (typeof ref === 'string') return ref;
  const id = ref._id || ref.userId?._id || ref.userId;
  return id != null ? String(id) : null;
}

function buildAssignmentsFromAssignees(task) {
  const assignees = task?.assignees || [];
  return assignees
    .map((a) => {
      if (typeof a === 'object' && (a.userId != null || a.assignedBy != null)) {
        return {
          userId: a.userId?._id || a.userId || a._id,
          assignedBy: a.assignedBy || task?.assignedBy || task?.createdBy,
          assignedAt: a.assignedAt,
        };
      }
      return {
        userId: a?._id || a,
        assignedBy: task?.assignedBy || task?.createdBy,
        assignedAt: a?.assignedAt,
      };
    })
    .filter((row) => row.userId != null);
}

/** Stable assignment rows + assignee id list for filters. */
export function normalizeTask(task) {
  if (!task) return task;
  const assignments = task.assignments?.length
    ? task.assignments
    : buildAssignmentsFromAssignees(task);
  const assigneeIds = [
    ...new Set(assignments.map((a) => resolveUserId(a.userId)).filter(Boolean)),
  ];
  return {
    ...task,
    assignments,
    assigneeIds,
    assignees: task.assignees?.length ? task.assignees : assigneeIds,
  };
}

export function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  return tasks.map(normalizeTask);
}

export function normalizeSchedulePayload(data) {
  if (!data || typeof data !== 'object') return data;
  if (!Array.isArray(data.tasks)) return data;
  return { ...data, tasks: normalizeTasks(data.tasks) };
}

function taskAssignedToUserId(task, userId) {
  const uid = normalizeId(userId);
  if (!uid || !task) return false;
  const normalized = normalizeTask(task);
  if (normalized.assigneeIds?.includes(uid)) return true;
  return (normalized.assignments || []).some((a) => resolveUserId(a.userId) === uid);
}
