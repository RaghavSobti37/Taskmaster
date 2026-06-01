/** Higher rank = more authority on a project. Mirror of shared/projectRoles.js for Vite ESM. */
export const PROJECT_ROLE_RANK = {
  admin: 100,
  owner: 100,
  manager: 80,
  artist_management: 60,
  member: 40,
  viewer: 20,
};

export const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value._id || value);
};

export const normalizeStoredProjectRole = (role) => {
  const r = String(role || 'member').toLowerCase();
  if (r === 'owner') return 'admin';
  if (r === 'artist_management') return 'manager';
  if (['admin', 'manager', 'member'].includes(r)) return r;
  return 'member';
};

export const projectRoleRank = (role) =>
  PROJECT_ROLE_RANK[normalizeStoredProjectRole(role)] ?? PROJECT_ROLE_RANK.member;

export const getProjectRoleForUser = (project, userId) => {
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

export const canUserReviewTask = (user, assignerId, _project = null, _isAdmin = false) => {
  if (!user?._id || !assignerId) return false;
  return normalizeId(user._id) === normalizeId(assignerId);
};
