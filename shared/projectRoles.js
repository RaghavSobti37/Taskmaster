/** Higher rank = more authority on a project. */
const PROJECT_ROLE_RANK = {
  owner: 100,
  manager: 80,
  admin: 70,
  artist_management: 60,
  member: 40,
  viewer: 20,
};

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value._id || value);
};

const projectRoleRank = (role) => PROJECT_ROLE_RANK[String(role || 'member').toLowerCase()] ?? PROJECT_ROLE_RANK.member;

const getProjectRoleForUser = (project, userId) => {
  if (!project || !userId) return null;
  const uid = normalizeId(userId);
  const ownerId = normalizeId(project.owner);
  if (ownerId && ownerId === uid) return 'owner';

  const entry = (project.memberRoles || []).find((r) => {
    const roleUserId = normalizeId(r.user?._id || r.user);
    return roleUserId === uid;
  });
  return entry?.role || 'member';
};

/**
 * User may review only if they assigned the task (strict assigner = reviewer).
 */
const canUserReviewTask = (user, assignerId, _project = null, _isAdmin = false) => {
  if (!user?._id || !assignerId) return false;
  return normalizeId(user._id) === normalizeId(assignerId);
};

module.exports = {
  PROJECT_ROLE_RANK,
  projectRoleRank,
  getProjectRoleForUser,
  canUserReviewTask,
  normalizeId,
};
