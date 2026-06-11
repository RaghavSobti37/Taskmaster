const ARTIST_MEMBERSHIP_PERMISSIONS = [
  'analytics',
  'finance',
  'contracts',
  'content',
  'calendar',
  'socials',
  'booking',
  'profile',
  'team',
];

const ARTIST_MEMBERSHIP_ROLES = [
  'artist-owner',
  'artist-manager',
  'artist-assistant',
  'artist-accountant',
  'artist-publicist',
];

const ARTIST_MEMBERSHIP_STATUSES = ['pending', 'accepted', 'revoked'];

/** Role → enabled permission keys (boolean map built from this). */
const DEFAULT_PERMISSION_KEYS_BY_ROLE = {
  'artist-owner': [...ARTIST_MEMBERSHIP_PERMISSIONS],
  'artist-manager': ['analytics', 'calendar', 'content', 'booking', 'socials', 'profile'],
  'artist-assistant': ['profile', 'content', 'calendar'],
  'artist-accountant': ['finance', 'contracts'],
  'artist-publicist': ['content', 'socials'],
};

/** Legacy team[] users without ArtistMembership doc — full access during migration. */
const LEGACY_TEAM_PERMISSIONS = Object.fromEntries(
  ARTIST_MEMBERSHIP_PERMISSIONS.map((key) => [key, true]),
);

function emptyPermissions() {
  return Object.fromEntries(ARTIST_MEMBERSHIP_PERMISSIONS.map((key) => [key, false]));
}

function permissionsObjectFromKeys(keys = []) {
  const permissions = emptyPermissions();
  keys.forEach((key) => {
    if (ARTIST_MEMBERSHIP_PERMISSIONS.includes(key)) permissions[key] = true;
  });
  return permissions;
}

function getDefaultPermissionsForRole(role) {
  return permissionsObjectFromKeys(
    DEFAULT_PERMISSION_KEYS_BY_ROLE[role] || DEFAULT_PERMISSION_KEYS_BY_ROLE['artist-assistant'],
  );
}

function isValidRole(role) {
  return ARTIST_MEMBERSHIP_ROLES.includes(role);
}

function isValidPermission(permission) {
  return ARTIST_MEMBERSHIP_PERMISSIONS.includes(permission);
}

function isValidStatus(status) {
  return ARTIST_MEMBERSHIP_STATUSES.includes(status);
}

function membershipHasPermission(membership, permission) {
  if (!membership || !permission) return false;
  const perms = membership.permissions;
  if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
    return Boolean(perms[permission]);
  }
  if (Array.isArray(perms)) {
    return perms.includes(permission);
  }
  return false;
}

module.exports = {
  ARTIST_MEMBERSHIP_PERMISSIONS,
  ARTIST_MEMBERSHIP_ROLES,
  ARTIST_MEMBERSHIP_STATUSES,
  DEFAULT_PERMISSION_KEYS_BY_ROLE,
  LEGACY_TEAM_PERMISSIONS,
  emptyPermissions,
  permissionsObjectFromKeys,
  getDefaultPermissionsForRole,
  isValidRole,
  isValidPermission,
  isValidStatus,
  membershipHasPermission,
};
