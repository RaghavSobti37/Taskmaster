import { canUserReviewTask, normalizeId } from './projectRoles';
import { isAdminUser } from './departmentPermissions';

export { canUserReviewTask, normalizeId };

export function getTaskAssignedBy(task) {
  const raw = task?.assignments?.[0]?.assignedBy || task?.assignedBy;
  if (!raw) return null;
  if (typeof raw === 'object' && raw.name) return raw;
  return { _id: raw, name: null };
}

export function getTaskAssignee(task) {
  const assignees = task?.assignees || [];
  const first = assignees[0];
  if (!first) return null;
  if (typeof first === 'object' && first.name) return first;
  const fromAssignment = task?.assignments?.[0]?.user;
  if (fromAssignment?.name) return fromAssignment;
  return { _id: first?._id || first, name: null };
}

export function getTaskAssignerId(task) {
  return normalizeId(getTaskAssignedBy(task)?._id || getTaskAssignedBy(task));
}

export function canReviewTask(task, user, projects = []) {
  if (!task || task.status !== 'in-review' || !user) return false;
  const assignerId = getTaskAssignerId(task);
  const pid = task.projectId?._id || task.projectId;
  const project = pid ? projects.find((p) => String(p._id) === String(pid)) : null;
  return canUserReviewTask(user, assignerId, project, isAdminUser(user));
}

export function countReviewTasksByProject(reviewTasks = []) {
  const counts = {};
  for (const task of reviewTasks) {
    const pid = task.projectId?._id || task.projectId;
    if (!pid) continue;
    const key = String(pid);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function displayPersonName(person, fallback = 'Unknown') {
  if (!person) return fallback;
  if (typeof person === 'string') return fallback;
  return person.name || fallback;
}

/** approve = reviewer closes in-review task; complete = assignee submits with hours; awaiting_review = blocked */
export function resolveTaskFinishIntent(task, user, projects = []) {
  if (!task) return null;
  if (task.status === 'done') return 'done';
  if (task.status === 'in-review') {
    return canReviewTask(task, user, projects) ? 'approve' : 'awaiting_review';
  }
  return 'complete';
}
