/** Higher rank = more authority on a project. Mirror of shared/projectRoles.js for Vite ESM. */
export const PROJECT_ROLE_RANK = {
  owner: 100,
  manager: 80,
  admin: 70,
  artist_management: 60,
  member: 40,
  viewer: 20,
};

export const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value._id || value);
};

export const projectRoleRank = (role) =>
  PROJECT_ROLE_RANK[String(role || 'member').toLowerCase()] ?? PROJECT_ROLE_RANK.member;

export const getProjectRoleForUser = (project, userId) => {
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

export const canUserReviewTask = (user, assignerId, _project = null, _isAdmin = false) => {
  if (!user?._id || !assignerId) return false;
  return normalizeId(user._id) === normalizeId(assignerId);
};
