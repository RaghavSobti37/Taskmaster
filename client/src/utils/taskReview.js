import {
  canUserApproveReview,
  requiresReviewForUser,
  getDelegatedAssignments,
  getAssignmentForUser,
  assignmentUserId,
  assignmentAssignerId,
  normalizeId,
  mergeAssigneeIdsWithCreator,
} from './taskReviewRules';
import { extractUserMentionLabels, resolveUserByLabel } from './mentionTokens';
import { isAdminUser } from './departmentPermissions';

export {
  canUserApproveReview,
  requiresReviewForUser,
  getDelegatedAssignments,
  mergeAssigneeIdsWithCreator,
  normalizeId,
};

export function getTaskAssignments(task) {
  if (task?.assignments?.length) return task.assignments;
  const assignees = task?.assignees || [];
  return assignees.map((a) => {
    if (typeof a === 'object' && a.userId) return a;
    return { userId: a, assignedBy: task?.assignedBy || task?.createdBy };
  });
}

export function getDelegatedAssignmentForTask(task) {
  return getDelegatedAssignments(getTaskAssignments(task))[0] || null;
}

export function getTaskAssignedBy(task) {
  const delegated = getDelegatedAssignmentForTask(task);
  const raw = delegated?.assignedBy || task?.assignments?.[0]?.assignedBy || task?.assignedBy;
  if (!raw) return null;
  if (typeof raw === 'object' && raw.name) return raw;
  return { _id: raw, name: null };
}

export function getTaskAssignee(task) {
  const delegated = getDelegatedAssignmentForTask(task);
  const raw = delegated?.user || delegated?.userId;
  if (raw) {
    if (typeof raw === 'object' && raw.name) return raw;
    return { _id: raw, name: null };
  }
  const assignees = task?.assignees || [];
  const first = assignees[0];
  if (!first) return null;
  if (typeof first === 'object' && first.name) return first;
  return { _id: first?._id || first, name: null };
}

export function getTaskAssignerId(task) {
  return assignmentAssignerId(getDelegatedAssignmentForTask(task) || getAssignmentForUser(getTaskAssignments(task), getTaskAssignee(task)?._id));
}

export function isUserMentionedInTask(task, user, users = []) {
  const uid = normalizeId(user?._id || user);
  if (!uid || !task) return false;

  const labels = [
    ...extractUserMentionLabels(task.title || ''),
    ...extractUserMentionLabels(task.description || ''),
  ];

  for (const label of labels) {
    const mentioned = resolveUserByLabel(label, users);
    if (mentioned && normalizeId(mentioned._id) === uid) return true;
  }
  return false;
}

/** @mentioned in title/description but not an assignee — may submit for review only. */
export function isMentionOnlyOnTask(task, user, users = []) {
  if (!isUserMentionedInTask(task, user, users)) return false;
  const uid = normalizeId(user?._id || user);
  return !getAssignmentForUser(getTaskAssignments(task), uid);
}

export function userMustSubmitForReview(task, user, users = []) {
  const uid = normalizeId(user?._id || user);
  if (!uid || !task) return false;
  if (isAdminUser(user)) return false;
  if (canUserApproveReview(user, getTaskAssignments(task))) return false;
  return requiresReviewForUser(getTaskAssignments(task), uid)
    || isMentionOnlyOnTask(task, user, users);
}

export function canReviewTask(task, user) {
  if (!task || task.status !== 'in-review' || !user) return false;
  return canUserApproveReview(user, getTaskAssignments(task));
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

export function resolveTaskFinishIntent(task, user, projects = [], users = []) {
  void projects;
  if (!task) return null;
  if (task.status === 'done') return 'done';
  if (task.status === 'in-review') {
    return canReviewTask(task, user) ? 'approve' : 'awaiting_review';
  }
  if (userMustSubmitForReview(task, user, users)) {
    return 'submit_review';
  }
  return 'complete';
}

export function userRequiresReviewOnComplete(task, user, users = []) {
  return userMustSubmitForReview(task, user, users);
}
