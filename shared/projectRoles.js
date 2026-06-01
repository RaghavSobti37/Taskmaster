/** Higher rank = more authority on a project. */
const PROJECT_ROLE_RANK = {
  admin: 100,
  owner: 100, // legacy stored value
  manager: 80,
  artist_management: 60,
  member: 40,
  viewer: 20,
};

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value._id || value);
};

/** Canonical project role values: admin | manager | member */
const normalizeStoredProjectRole = (role) => {
  const r = String(role || 'member').toLowerCase();
  if (r === 'owner') return 'admin';
  if (r === 'artist_management') return 'manager';
  if (['admin', 'manager', 'member'].includes(r)) return r;
  return 'member';
};

const projectRoleRank = (role) =>
  PROJECT_ROLE_RANK[normalizeStoredProjectRole(role)] ?? PROJECT_ROLE_RANK.member;

const getProjectRoleForUser = (project, userId) => {
  if (!project || !userId) return null;
  const uid = normalizeId(userId);
  const ownerId = normalizeId(project.owner);
  if (ownerId && ownerId === uid) return 'admin';

  const entry = (project.memberRoles || []).find((r) => {
    const roleUserId = normalizeId(r.user?._id || r.user);
    return roleUserId === uid;
  });
  return normalizeStoredProjectRole(entry?.role);
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
  normalizeStoredProjectRole,
  canUserReviewTask,
  normalizeId,
};
