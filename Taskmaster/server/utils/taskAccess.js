const Project = require('../models/Project');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { getProjectRoleForUser } = require('../../shared/projectRoles');
const { normalizeId } = require('../../shared/taskReviewRules');
const { resolveMentionedUserIds } = require('./mentionNotifications');
const { isAdminUser } = require('./pagePermissions');

const getProjectRole = (project, userId) => {
  if (!project || !userId) return null;
  const uid = userId.toString();
  const ownerId = (project.owner?._id || project.owner)?.toString?.();
  if (ownerId && ownerId === uid) return 'admin';
  const isMember = project.members?.some((m) => (m?._id || m)?.toString() === uid);
  const hasRoleEntry = (project.memberRoles || []).some(
    (entry) => (entry?.user?._id || entry?.user)?.toString() === uid
  );
  if (!isMember && !hasRoleEntry) return null;
  return getProjectRoleForUser(project, userId);
};

const userHasProjectAccess = (project, userId) => Boolean(getProjectRole(project, userId));

/** Assignees only — creator stays on task.createdBy, never in TaskAssignment. */
const normalizeAssigneeIds = (assigneeIds, creatorId) => {
  const creator = normalizeId(creatorId);
  return [...new Set((assigneeIds || []).map((id) => normalizeId(id)).filter(Boolean))]
    .filter((id) => !creator || id !== creator);
};

const userHasTaskScopeAccess = async (task, userId, session = null) => {
  const uid = normalizeId(userId);
  if (!uid || !task) return false;

  const projectId = task.projectId?._id || task.projectId;
  if (projectId) {
    const q = Project.findById(projectId).select('owner members memberRoles workspace');
    const project = session ? await q.session(session).lean() : await q.lean();
    return userHasProjectAccess(project, uid);
  }

  const wsName = String(task.workspace || 'General').trim().toUpperCase();
  const wq = Workspace.findOne({ name: wsName }).select('defaultMembers');
  const workspace = session ? await wq.session(session).lean() : await wq.lean();
  if (workspace?.defaultMembers?.some((m) => normalizeId(m.user) === uid)) {
    return true;
  }

  const pq = Project.findOne({
    workspace: wsName,
    $or: [{ owner: uid }, { members: uid }],
  }).select('_id');
  const anyProject = session ? await pq.session(session).lean() : await pq.lean();
  return Boolean(anyProject);
};

const filterUserIdsByTaskScope = async (task, userIds, session = null) => {
  const out = [];
  for (const id of userIds || []) {
    const uid = normalizeId(id);
    if (!uid) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await userHasTaskScopeAccess(task, uid, session)) out.push(uid);
  }
  return [...new Set(out)];
};

/** Assignees must exist as users in the current tenant (directory-scoped). */
const assertAssigneesAreTenantUsers = async ({ assigneeIds, session = null }) => {
  const ids = [...new Set((assigneeIds || []).map(normalizeId).filter(Boolean))];
  if (!ids.length) return;

  const q = User.find({ _id: { $in: ids } }).select('_id').lean();
  const found = session ? await q.session(session) : await q;
  if (found.length !== ids.length) {
    throw new Error('Invalid assignee: user not found');
  }
};

/**
 * Assignees must be project/workspace members unless a platform admin who is not on
 * the project assigns (explicit admin bypass for cross-team delegation).
 * @deprecated Prefer assertAssigneesAreTenantUsers for task assignment.
 */
const assertAssigneesInTaskScope = async ({
  taskScope,
  assigneeIds,
  actingUser,
  project = null,
  session = null,
}) => {
  const ids = [...new Set((assigneeIds || []).map(normalizeId).filter(Boolean))];
  if (!ids.length || !actingUser?._id) return;

  let projectDoc = project;
  if (!projectDoc && taskScope?.projectId) {
    const projectId = taskScope.projectId?._id || taskScope.projectId;
    const q = Project.findById(projectId).select('owner members memberRoles workspace').lean();
    projectDoc = session ? await q.session(session) : await q;
  }

  if (projectDoc) {
    const actorOnProject = userHasProjectAccess(projectDoc, actingUser._id);
    const canBypass = isAdminUser(actingUser) && !actorOnProject;
    if (canBypass) return;

    for (const id of ids) {
      if (!userHasProjectAccess(projectDoc, id)) {
        throw new Error('Not authorized: assignee must be a project member');
      }
    }
    return;
  }

  const actorInScope = await userHasTaskScopeAccess(taskScope, actingUser._id, session);
  const canBypass = isAdminUser(actingUser) && !actorInScope;
  if (canBypass) return;

  const scoped = await filterUserIdsByTaskScope(taskScope, ids, session);
  if (scoped.length !== ids.length) {
    throw new Error('Not authorized: assignee must have access to this task workspace');
  }
};

const syncMentionAccessIds = async (task, session = null) => {
  if (!task?._id) return [];
  const mentioned = await resolveMentionedUserIds(task.title, task.description);
  const scoped = await filterUserIdsByTaskScope(
    task,
    [...mentioned],
    session
  );
  const Task = require('../models/Task');
  const q = Task.updateOne(
    { _id: task._id },
    { $set: { mentionAccessIds: scoped } }
  );
  if (session) await q.session(session);
  else await q;
  task.mentionAccessIds = scoped;
  return scoped;
};

module.exports = {
  normalizeAssigneeIds,
  userHasTaskScopeAccess,
  userHasProjectAccess,
  filterUserIdsByTaskScope,
  assertAssigneesAreTenantUsers,
  assertAssigneesInTaskScope,
  syncMentionAccessIds,
  getProjectRole,
};
