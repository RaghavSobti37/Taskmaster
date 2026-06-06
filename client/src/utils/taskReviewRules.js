/** Client ESM mirror of shared/taskReviewRules.js — keep in sync */

export const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value._id || value);
};

export const assignmentUserId = (assignment) =>
  normalizeId(assignment?.userId?._id || assignment?.userId);

export const assignmentAssignerId = (assignment) =>
  normalizeId(assignment?.assignedBy?._id || assignment?.assignedBy);

export const isDelegatedAssignment = (assignment) => {
  const assigneeId = assignmentUserId(assignment);
  const assignerId = assignmentAssignerId(assignment);
  return Boolean(assigneeId && assignerId && assigneeId !== assignerId);
};

export const getAssignmentForUser = (assignments, userId) => {
  const uid = normalizeId(userId);
  if (!uid || !assignments?.length) return null;
  return assignments.find((a) => assignmentUserId(a) === uid) || null;
};

export const requiresReviewForUser = (assignments, userId) => {
  const mine = getAssignmentForUser(assignments, userId);
  if (!mine) return false;
  const assigneeId = assignmentUserId(mine);
  const assignerId = assignmentAssignerId(mine);
  return Boolean(assignerId && assigneeId && assignerId !== assignerId);
};

export const getDelegatedAssignments = (assignments) =>
  (assignments || []).filter(isDelegatedAssignment);

export const canUserApproveReview = (user, assignments) => {
  const uid = normalizeId(user?._id || user);
  if (!uid) return false;
  return getDelegatedAssignments(assignments).some(
    (a) => assignmentAssignerId(a) === uid
  );
};

export const canUserApproveOrRollback = (user, assignments, { platformOwnerId, taskCreatedBy } = {}) => {
  const uid = normalizeId(user?._id || user);
  if (!uid) return false;
  if (platformOwnerId && uid === normalizeId(platformOwnerId)) return true;
  if (taskCreatedBy && uid === normalizeId(taskCreatedBy)) return true;
  return canUserApproveReview(user, assignments);
};

export const canUserRollbackTask = (user, task, assignments, { platformOwnerId, taskCreatedBy } = {}) => {
  const uid = normalizeId(user?._id || user);
  if (!uid) return false;
  const status = String(task?.status || '').toLowerCase();
  if (status !== 'in-review' && status !== 'done') return false;
  if (platformOwnerId && uid === normalizeId(platformOwnerId)) return true;
  if (taskCreatedBy && uid === normalizeId(taskCreatedBy)) return true;
  if (canUserApproveReview(user, assignments)) return true;
  return (assignments || []).some((a) => assignmentUserId(a) === uid);
};

export const needsReviewOnComplete = (assignments, userId, { mentionOnly = false, taskCreatedBy = null } = {}) => {
  if (mentionOnly) return true;
  const uid = normalizeId(userId);
  if (!uid) return false;
  const mine = getAssignmentForUser(assignments, uid);
  if (!mine) return false;
  if (assignmentAssignerId(mine) === uid) return false;
  if (requiresReviewForUser(assignments, uid)) return true;
  const delegated = getDelegatedAssignments(assignments);
  if (delegated.length > 0 && !canUserApproveReview({ _id: uid }, assignments)) return true;
  if (taskCreatedBy && normalizeId(taskCreatedBy) !== uid) return true;
  return false;
};

export const normalizeAssigneeIds = (assigneeIds, creatorId) => {
  const creator = normalizeId(creatorId);
  return [...new Set((assigneeIds || []).map((id) => normalizeId(id)).filter(Boolean))]
    .filter((id) => !creator || id !== creator);
};

/** @deprecated Use normalizeAssigneeIds */
export const mergeAssigneeIdsWithCreator = (assigneeIds, creatorId) => normalizeAssigneeIds(assigneeIds, creatorId);

const filterReviewQueueTasks = (tasks, user, getAssignments, { platformOwnerId } = {}) => {
  const uid = normalizeId(user?._id || user);
  if (!uid) return [];
  return (tasks || []).filter((task) => {
    const raw = getAssignments ? getAssignments(task) : (task?.assignments || task?.assignees || []);
    const assignments = Array.isArray(raw)
      ? raw.map((a) => (typeof a === 'object' && a?.userId ? a : { userId: a, assignedBy: task?.assignedBy || task?.createdBy }))
      : [];
    return canUserApproveOrRollback(user, assignments, { platformOwnerId });
  });
};
