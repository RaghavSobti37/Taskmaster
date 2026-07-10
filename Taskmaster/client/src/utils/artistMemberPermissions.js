/**
 * Mirror server/domains/artists/constants/artistMembershipRoles.js
 * Tab visibility maps backend permissions → workspace UI.
 */

export const ARTIST_MEMBERSHIP_PERMISSIONS = [
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

export const ARTIST_MEMBERSHIP_ROLES = [
  'artist-owner',
  'artist-manager',
  'artist-assistant',
  'artist-accountant',
  'artist-publicist',
];

export const DEFAULT_PERMISSION_KEYS_BY_ROLE = {
  'artist-owner': [...ARTIST_MEMBERSHIP_PERMISSIONS],
  'artist-manager': ['analytics', 'calendar', 'content', 'booking', 'socials', 'profile'],
  'artist-assistant': ['profile', 'content', 'calendar'],
  'artist-accountant': ['finance', 'contracts'],
  'artist-publicist': ['content', 'socials'],
};

export function permissionsObjectFromKeys(keys = []) {
  const permissions = Object.fromEntries(ARTIST_MEMBERSHIP_PERMISSIONS.map((key) => [key, false]));
  keys.forEach((key) => {
    if (ARTIST_MEMBERSHIP_PERMISSIONS.includes(key)) permissions[key] = true;
  });
  return permissions;
}

export const DEFAULT_PERMISSIONS_BY_ROLE = Object.fromEntries(
  Object.entries(DEFAULT_PERMISSION_KEYS_BY_ROLE).map(([role, keys]) => [
    role,
    permissionsObjectFromKeys(keys),
  ]),
);

export const LEGACY_TEAM_PERMISSIONS = Object.fromEntries(
  ARTIST_MEMBERSHIP_PERMISSIONS.map((key) => [key, true]),
);

/** Workspace tab → backend permission(s). */
export const WORKSPACE_TAB_ACCESS = {
  home: () => true,
  analytics: 'analytics',
  calendar: 'calendar',
  bookings: 'booking',
  finance: 'finance',
  content: 'content',
  connections: 'socials',
  releases: 'content',
  team: 'team',
  documents: ['calendar', 'contracts', 'finance'],
  contracts: 'contracts',
  settings: 'profile',
};

export function resolveMembershipPermissions(membership) {
  if (!membership) return permissionsObjectFromKeys();
  if (membership.legacy || membership.fallback) {
    return { ...LEGACY_TEAM_PERMISSIONS };
  }
  const perms = membership.permissions;
  if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
    return { ...permissionsObjectFromKeys(), ...perms };
  }
  if (Array.isArray(perms) && perms.length) {
    return permissionsObjectFromKeys(perms);
  }
  const role = membership.role || 'artist-assistant';
  return permissionsObjectFromKeys(DEFAULT_PERMISSION_KEYS_BY_ROLE[role] || []);
}

export function hasArtistPermission(membership, permission) {
  if (!membership || !permission) return false;
  const perms = resolveMembershipPermissions(membership);
  return Boolean(perms[permission]);
}

export function isMembershipAccepted(membership) {
  if (!membership) return false;
  if (membership.fallback || membership.legacy || membership.managerOverride) return true;
  if (membership.status === 'accepted' || membership.acceptedAt) return true;
  return false;
}

export function hasAnyArtistPermission(membership, permissions = []) {
  return permissions.some((p) => hasArtistPermission(membership, p));
}

export function canSeeWorkspaceTab(membership, tabId) {
  if (!membership) return false;
  const rule = WORKSPACE_TAB_ACCESS[tabId];
  if (!rule) return false;
  if (typeof rule === 'function') return rule(membership);
  if (Array.isArray(rule)) return hasAnyArtistPermission(membership, rule);
  return hasArtistPermission(membership, rule);
}

export function buildFallbackMembership(user, artist) {
  const team = artist?.team || [];
  const uid = String(user?._id || user?.id);
  const onTeam = team.some((m) => String(m?._id || m) === uid);
  if (!onTeam) return null;
  const index = team.findIndex((m) => String(m?._id || m) === uid);
  const role = index === 0 ? 'artist-owner' : 'artist-assistant';
  return {
    artistId: artist?._id,
    userId: uid,
    role,
    permissions: permissionsObjectFromKeys(DEFAULT_PERMISSION_KEYS_BY_ROLE[role]),
    legacy: true,
    fallback: true,
    status: 'accepted',
  };
}

export const SYNC_PERMISSION = 'socials';

export const ROLE_LABELS = {
  'artist-owner': 'Owner',
  'artist-manager': 'Manager',
  'artist-assistant': 'Assistant',
  'artist-accountant': 'Accountant',
  'artist-publicist': 'Publicist',
};
