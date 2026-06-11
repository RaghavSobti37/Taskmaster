const crypto = require('crypto');
const Artist = require('../../../models/Artist');
const ArtistMembership = require('../../../models/ArtistMembership');
const User = require('../../../models/User');
const { dispatchEmailPayload } = require('../../../domains/mail/services/mailDriver');

const isUserOnArtistTeam = (user, team = []) => {
  if (!user) return false;
  const uid = String(user._id || user.id);
  return team.some((member) => String(member?._id || member) === uid);
};

const {
  getDefaultPermissionsForRole,
  LEGACY_TEAM_PERMISSIONS,
  isValidRole,
  isValidPermission,
  membershipHasPermission,
  permissionsObjectFromKeys,
} = require('../constants/artistMembershipRoles');

const USER_FIELDS = 'name email profileImage';

async function findArtistWithTeam(artistId) {
  let artist = await Artist.findById(artistId).select('team name tenantId').populate('team', USER_FIELDS).lean();
  // Share/claim may cross tenant context — bypass only when tenant-scoped lookup misses.
  if (!artist) {
    artist = await Artist.findById(artistId)
      .select('team name tenantId')
      .populate('team', USER_FIELDS)
      .setOptions({ bypassTenant: true })
      .lean();
  }
  return artist;
}

async function getArtistMembershipDoc(userId, artistId) {
  return ArtistMembership.findOne({ artistId, userId, status: { $ne: 'revoked' } }).lean();
}

async function hasArtistMembership(user, artistId, permission) {
  if (!user || !artistId) return false;

  const member = await ArtistMembership.findOne({
    artistId,
    userId: user._id,
    status: 'accepted',
  }).lean();

  if (member) {
    if (!permission) return true;
    return membershipHasPermission(member, permission);
  }

  const artist = await findArtistWithTeam(artistId);
  if (!artist || !isUserOnArtistTeam(user, artist.team)) return false;

  if (!permission) return true;
  return Boolean(LEGACY_TEAM_PERMISSIONS[permission]);
}

async function hasArtistOwnerRole(user, artistId) {
  if (!user || !artistId) return false;
  const member = await ArtistMembership.findOne({
    artistId,
    userId: user._id,
    role: 'artist-owner',
    status: 'accepted',
  }).lean();
  if (member) return true;

  const artist = await findArtistWithTeam(artistId);
  if (!artist || !isUserOnArtistTeam(user, artist.team)) return false;
  const uid = String(user._id);
  const first = artist.team?.[0];
  return first && String(first?._id || first) === uid;
}

async function countAcceptedOwners(artistId) {
  const docCount = await ArtistMembership.countDocuments({
    artistId,
    role: 'artist-owner',
    status: 'accepted',
  });
  if (docCount > 0) return docCount;

  const artist = await findArtistWithTeam(artistId);
  return (artist?.team?.length > 0) ? 1 : 0;
}

function serializeMembership(member) {
  if (!member) return member;
  const user = member.userId && typeof member.userId === 'object' ? member.userId : null;
  return {
    ...member,
    user: user || (member.inviteEmail ? { email: member.inviteEmail, name: member.inviteEmail } : undefined),
    email: member.inviteEmail || user?.email,
  };
}

async function getArtistMembers(artistId) {
  const members = await ArtistMembership.find({ artistId, status: { $ne: 'revoked' } })
    .populate('userId', USER_FIELDS)
    .populate('invitedBy', 'name email')
    .sort({ createdAt: 1 })
    .lean();

  const memberUserIds = new Set(
    members.filter((m) => m.userId).map((m) => String(m.userId?._id || m.userId)),
  );

  const hasOwnerDoc = members.some((m) => m.role === 'artist-owner' && m.status === 'accepted');

  const artist = await findArtistWithTeam(artistId);
  const legacy = (artist?.team || [])
    .filter((u) => u && !memberUserIds.has(String(u._id)))
    .map((user, index) => {
      const role = !hasOwnerDoc && index === 0 ? 'artist-owner' : 'artist-assistant';
      return serializeMembership({
        artistId,
        userId: user,
        role,
        permissions: getDefaultPermissionsForRole(role),
        legacy: true,
        status: 'accepted',
        invitedAt: null,
        acceptedAt: null,
        invitedBy: null,
      });
    });

  return [...members.map(serializeMembership), ...legacy];
}

async function createArtistMembership({
  artistId,
  userId,
  inviteEmail,
  inviteToken,
  role,
  permissions,
  invitedBy,
  acceptedAt,
  status,
}) {
  const payload = {
    artistId,
    userId: userId || undefined,
    inviteEmail: inviteEmail || undefined,
    inviteToken: inviteToken || undefined,
    role,
    invitedBy,
    invitedAt: new Date(),
    acceptedAt: acceptedAt || null,
    status: status || (acceptedAt ? 'accepted' : 'pending'),
    permissions: permissions || getDefaultPermissionsForRole(role),
  };

  const query = userId
    ? { artistId, userId }
    : { artistId, inviteEmail: inviteEmail?.toLowerCase() };

  const existing = await ArtistMembership.findOne(query);
  if (existing) {
    existing.role = role;
    existing.permissions = payload.permissions;
    if (acceptedAt) {
      existing.acceptedAt = acceptedAt;
      existing.status = 'accepted';
    }
    if (invitedBy) existing.invitedBy = invitedBy;
    if (inviteToken) existing.inviteToken = inviteToken;
    await existing.save();
    return existing;
  }

  return ArtistMembership.create(payload);
}

async function ensureUserOnArtistTeam(artistId, userId) {
  const artist = await Artist.findById(artistId);
  if (!artist) return null;
  if (!artist.team) artist.team = [];
  if (!artist.team.some((id) => String(id) === String(userId))) {
    artist.team.push(userId);
    await artist.save();
  }
  return artist;
}

async function removeUserFromArtistTeam(artistId, userId) {
  const artist = await Artist.findById(artistId);
  if (!artist) return null;
  artist.team = (artist.team || []).filter((id) => String(id) !== String(userId));
  await artist.save();
  return artist;
}

async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return User.findOne({ email: normalized }).setOptions({ bypassTenant: true }).select(USER_FIELDS);
}

function normalizeMembershipUpdate({ role, permissions, status }) {
  const update = {};
  if (role !== undefined) {
    if (!isValidRole(role)) throw new Error('Invalid role');
    update.role = role;
    update.permissions = getDefaultPermissionsForRole(role);
  }
  if (permissions !== undefined) {
    if (typeof permissions !== 'object' || Array.isArray(permissions)) {
      throw new Error('Invalid permissions');
    }
    const keys = Object.keys(permissions);
    if (keys.some((p) => !isValidPermission(p))) throw new Error('Invalid permissions');
    update.permissions = permissionsObjectFromKeys(keys.filter((k) => permissions[k]));
  }
  if (status !== undefined) {
    update.status = status;
    if (status === 'accepted') update.acceptedAt = new Date();
  }
  return update;
}

function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendWorkspaceInviteEmail({ to, artistName, inviteUrl, inviterName }) {
  const subject = `Join ${artistName} on CoreKnot Artist Workspace`;
  const html = `
    <p>Hi,</p>
    <p>${inviterName || 'Your team'} invited you to join <strong>${artistName}</strong> on CoreKnot Artist Workspace.</p>
    <p><a href="${inviteUrl}">Accept invitation</a></p>
    <p>If you did not expect this email, you can ignore it.</p>
  `;
  await dispatchEmailPayload({
    to,
    subject,
    html,
    from: process.env.SYSTEM_VERIFIED_FROM_EMAIL,
  });
}

async function inviteArtistMember({ artistId, email, role, invitedBy }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email required');
  if (!isValidRole(role)) throw new Error('Invalid role');

  const artist = await findArtistWithTeam(artistId);
  if (!artist) throw new Error('Artist not found');

  const user = await findUserByEmail(normalizedEmail);
  const inviteToken = generateInviteToken();
  const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').trim();

  if (user) {
    const existing = await ArtistMembership.findOne({
      artistId,
      userId: user._id,
      status: { $ne: 'revoked' },
    });
    if (existing?.status === 'accepted') {
      const err = new Error('User is already a member');
      err.statusCode = 409;
      throw err;
    }

    const membership = await createArtistMembership({
      artistId,
      userId: user._id,
      role,
      invitedBy,
      inviteToken,
      status: 'pending',
    });

    const inviteUrl = `${base}/artist-workspace/${artistId}/accept?token=${inviteToken}`;
    await sendWorkspaceInviteEmail({
      to: normalizedEmail,
      artistName: artist.name,
      inviteUrl,
      inviterName: invitedBy?.name,
    });

    return serializeMembership(membership.toObject());
  }

  const existingEmail = await ArtistMembership.findOne({
    artistId,
    inviteEmail: normalizedEmail,
    status: { $ne: 'revoked' },
  });
  if (existingEmail) {
    const err = new Error('Invitation already pending for this email');
    err.statusCode = 409;
    throw err;
  }

  const membership = await createArtistMembership({
    artistId,
    inviteEmail: normalizedEmail,
    inviteToken,
    role,
    invitedBy,
    status: 'pending',
  });

  const inviteUrl = `${base}/login?redirect=${encodeURIComponent(`/artist-workspace/${artistId}/accept?token=${inviteToken}`)}`;
  await sendWorkspaceInviteEmail({
    to: normalizedEmail,
    artistName: artist.name,
    inviteUrl,
    inviterName: invitedBy?.name,
  });

  return serializeMembership(membership.toObject());
}

async function acceptArtistMembership({ token, membershipId, user }) {
  if (!user) throw new Error('Authentication required');

  let membership;
  if (token) {
    membership = await ArtistMembership.findOne({ inviteToken: token, status: 'pending' });
  } else if (membershipId) {
    membership = await ArtistMembership.findOne({ _id: membershipId, status: 'pending' });
  } else {
    throw new Error('Token or membershipId required');
  }

  if (!membership) throw new Error('Invitation not found or already accepted');

  const userEmail = String(user.email || '').toLowerCase();
  if (membership.userId && String(membership.userId) !== String(user._id)) {
    throw new Error('Invitation belongs to another user');
  }
  if (membership.inviteEmail && membership.inviteEmail !== userEmail) {
    throw new Error('Invitation email does not match your account');
  }

  membership.userId = user._id;
  membership.status = 'accepted';
  membership.acceptedAt = new Date();
  membership.inviteToken = undefined;
  await membership.save();

  await ensureUserOnArtistTeam(membership.artistId, user._id);

  const redirectUrl = `/artist-workspace/${membership.artistId}`;
  return { membership: serializeMembership(membership.toObject()), redirectUrl };
}

module.exports = {
  findArtistWithTeam,
  getArtistMembershipDoc,
  hasArtistMembership,
  hasArtistOwnerRole,
  countAcceptedOwners,
  getArtistMembers,
  createArtistMembership,
  ensureUserOnArtistTeam,
  removeUserFromArtistTeam,
  findUserByEmail,
  normalizeMembershipUpdate,
  inviteArtistMember,
  acceptArtistMembership,
  serializeMembership,
  membershipHasPermission,
};
