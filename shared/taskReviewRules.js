const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value._id || value);
};

const assignmentUserId = (assignment) =>
  normalizeId(assignment?.userId?._id || assignment?.userId);

const assignmentAssignerId = (assignment) =>
  normalizeId(assignment?.assignedBy?._id || assignment?.assignedBy);

const isDelegatedAssignment = (assignment) => {
  const assigneeId = assignmentUserId(assignment);
  const assignerId = assignmentAssignerId(assignment);
  return Boolean(assigneeId && assignerId && assigneeId !== assignerId);
};

const getAssignmentForUser = (assignments, userId) => {
  const uid = normalizeId(userId);
  if (!uid || !assignments?.length) return null;
  return assignments.find((a) => assignmentUserId(a) === uid) || null;
};

/** True when this user's completion must go through review (assigned by someone else). */
const requiresReviewForUser = (assignments, userId) => {
  const mine = getAssignmentForUser(assignments, userId);
  if (!mine) return false;
  const assigneeId = assignmentUserId(mine);
  const assignerId = assignmentAssignerId(mine);
  return Boolean(assignerId && assigneeId && assignerId !== assigneeId);
};

const getDelegatedAssignments = (assignments) =>
  (assignments || []).filter(isDelegatedAssignment);

const getReviewQueueAssignmentFilter = (userId) => {
  const uid = normalizeId(userId);
  return {
    assignedBy: uid,
    $expr: { $ne: ['$userId', '$assignedBy'] },
  };
};

/** Drop self-review rows and tasks the viewer cannot approve. */
const filterReviewQueueTasks = (tasks, user, getAssignments = (t) => t?.assignments || t?.assignees || []) =>
  (tasks || []).filter((task) => {
    const assignments = getAssignments(task);
    return canUserApproveReview(user, assignments);
  });

/** Reviewer may approve if they assigned at least one delegated assignee on an in-review task. */
const canUserApproveReview = (user, assignments) => {
  const uid = normalizeId(user?._id || user);
  if (!uid) return false;
  return getDelegatedAssignments(assignments).some(
    (a) => assignmentAssignerId(a) === uid
  );
};

/** Task has no delegated assignees — self-work only; should never stay in-review. */
const isSelfWorkOnlyTask = (assignments) =>
  (assignments || []).length > 0 && getDelegatedAssignments(assignments).length === 0;

/** Default daily-log hours credited to reviewer when assignee submits for review. */
const REVIEW_DEFAULT_HOURS = 0.25;

const mergeAssigneeIdsWithCreator = (assigneeIds, creatorId) => {
  const creator = normalizeId(creatorId);
  const ids = [...new Set((assigneeIds || []).map((id) => normalizeId(id)).filter(Boolean))];
  if (creator && !ids.includes(creator)) ids.unshift(creator);
  if (!ids.length && creator) return [creator];
  return ids;
};

module.exports = {
  normalizeId,
  assignmentUserId,
  assignmentAssignerId,
  isDelegatedAssignment,
  getAssignmentForUser,
  requiresReviewForUser,
  getDelegatedAssignments,
  getReviewQueueAssignmentFilter,
  filterReviewQueueTasks,
  canUserApproveReview,
  isSelfWorkOnlyTask,
  mergeAssigneeIdsWithCreator,
  REVIEW_DEFAULT_HOURS,
};
