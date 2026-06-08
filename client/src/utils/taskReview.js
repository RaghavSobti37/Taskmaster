/**
 * UI helpers for task review. Authoritative approve/review rules: shared/taskReviewRules.js
 * (enforced server-side in TaskService). Do not duplicate business logic here.
 */
import {
  canUserApproveReview,
  canUserApproveOrRollback,
  canUserRollbackTask,
  needsReviewOnComplete,
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
import { normalizeTask } from './normalizeTask';

const PLATFORM_OWNER_EMAILS = new Set(
  [
    import.meta.env.VITE_PLATFORM_OWNER_EMAIL,
    'REDACTED_ADMIN@example.com',
  ]
    .filter(Boolean)
    .map((email) => String(email).toLowerCase().trim())
);

export const isPlatformOwnerUser = (user) =>
  PLATFORM_OWNER_EMAILS.has(String(user?.email || '').toLowerCase().trim());

export function getTaskAssignments(task) {
  if (!task) return [];
  return normalizeTask(task).assignments || [];
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

function getTaskAssignerId(task) {
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
  return needsReviewOnComplete(getTaskAssignments(task), uid, {
    mentionOnly: isMentionOnlyOnTask(task, user, users),
    taskCreatedBy: task?.createdBy,
  });
}

export function canReviewTask(task, user) {
  if (!task || task.status !== 'in-review' || !user) return false;
  if (isPlatformOwnerUser(user)) return true;
  return canUserApproveOrRollback(user, getTaskAssignments(task), {
    taskCreatedBy: task?.createdBy,
  });
}

export function canRollbackTask(task, user) {
  if (!task || !user) return false;
  if (isPlatformOwnerUser(user)) {
    const status = String(task.status || '').toLowerCase();
    return status === 'in-review' || status === 'done';
  }
  return canUserRollbackTask(user, task, getTaskAssignments(task), {
    taskCreatedBy: task?.createdBy,
  });
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
  const uid = normalizeId(user?._id || user);
  const creatorId = normalizeId(task?.createdBy?._id || task?.createdBy);
  const isCreator = uid && creatorId && uid === creatorId;
  if (userMustSubmitForReview(task, user, users)) {
    return 'submit_review';
  }
  if (!isCreator && canUserApproveReview(user, getTaskAssignments(task))) {
    return 'awaiting_assignee';
  }
  return 'complete';
}

function userRequiresReviewOnComplete(task, user, users = []) {
  return userMustSubmitForReview(task, user, users);
}

export { canUserApproveReview };
