const crypto = require('crypto');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const TenantInvite = require('../models/TenantInvite');
const User = require('../models/User');
const { establishSession } = require('../utils/authSession');
const { registerSession, decodeToken } = require('../utils/sessionRegistry');
const { assertSeatAvailable } = require('./planEnforcementService');

const BYPASS = { bypassTenant: true };
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const slugify = (name) => String(name || 'org')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48) || `org-${Date.now()}`;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const resolveSessionTenantId = (decoded, user) => {
  if (decoded?.activeTenantId) return decoded.activeTenantId;
  if (user?.tenantId) return user.tenantId;
  return null;
};

const listActiveMemberships = async (userId) => TenantMembership.find({
  userId,
  status: 'active',
})
  .setOptions(BYPASS)
  .populate('tenantId', 'name slug plan status')
  .lean();

const getMembership = async (userId, tenantId) => TenantMembership.findOne({
  userId,
  tenantId,
  status: 'active',
}).setOptions(BYPASS).lean();

const backfillMembershipFromUser = async (user) => {
  if (!user?.tenantId) return null;
  const existing = await TenantMembership.findOne({
    userId: user._id,
    tenantId: user.tenantId,
  }).setOptions(BYPASS);
  if (existing) return existing;
  return TenantMembership.create({
    userId: user._id,
    tenantId: user.tenantId,
    role: 'member',
    status: 'active',
    joinedAt: new Date(),
  });
};

const resolveInitialActiveTenantId = async (userId) => {
  const memberships = await listActiveMemberships(userId);
  if (memberships.length === 1) {
    return memberships[0].tenantId?._id || memberships[0].tenantId;
  }
  const user = await User.findById(userId).setOptions(BYPASS).select('tenantId');
  if (user?.tenantId) {
    const m = await getMembership(userId, user.tenantId);
    if (m) return user.tenantId;
  }
  if (memberships.length === 1) return memberships[0].tenantId?._id || memberships[0].tenantId;
  return null;
};

const formatMembershipRow = (row) => ({
  id: String(row._id),
  role: row.role,
  status: row.status,
  tenant: row.tenantId && typeof row.tenantId === 'object'
    ? { _id: row.tenantId._id, name: row.tenantId.name, slug: row.tenantId.slug, plan: row.tenantId.plan }
    : { _id: row.tenantId },
});

const createTenantForUser = async (userId, { name, contactEmail }) => {
  const user = await User.findById(userId).setOptions(BYPASS);
  if (!user) throw new Error('User not found');

  let slug = slugify(name);
  const taken = await Tenant.findOne({ slug }).setOptions(BYPASS);
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;

  const tenant = await Tenant.create({
    name: String(name).trim(),
    slug,
    contactEmail: contactEmail || user.email,
    ownerId: user._id,
    plan: 'free',
    status: 'trial',
  });

  await TenantMembership.create({
    tenantId: tenant._id,
    userId: user._id,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  });

  if (!user.tenantId) {
    user.tenantId = tenant._id;
    await user.save();
  }

  return tenant;
};

const reissueSessionWithTenant = async (req, res, userId, tenantId) => {
  const token = establishSession(res, userId, req, tenantId ? String(tenantId) : null);
  const decoded = decodeToken(token);
  if (decoded) await registerSession(req, userId, decoded);
  return token;
};

const selectTenant = async (req, res, userId, tenantId) => {
  const membership = await getMembership(userId, tenantId);
  if (!membership) {
    const err = new Error('Not a member of this organization');
    err.status = 403;
    throw err;
  }
  await User.updateOne({ _id: userId }, { tenantId }).setOptions(BYPASS);
  await reissueSessionWithTenant(req, res, userId, tenantId);
  return tenantId;
};

const createInvite = async ({ tenantId, email, role, invitedBy }) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw new Error('Email required');

  await assertSeatAvailable(tenantId);
  await TenantInvite.updateMany(
    { tenantId, email: normalized, status: 'pending' },
    { status: 'revoked' },
  ).setOptions(BYPASS);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const invite = await TenantInvite.create({
    tenantId,
    email: normalized,
    role: role === 'admin' ? 'admin' : 'member',
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    status: 'pending',
    invitedBy,
  });

  return { invite, token: rawToken };
};

const getInviteByToken = async (token) => {
  const invite = await TenantInvite.findOne({ tokenHash: hashToken(token) })
    .setOptions(BYPASS)
    .populate('tenantId', 'name slug');
  if (!invite || invite.status !== 'pending') return null;
  if (invite.expiresAt < new Date()) {
    invite.status = 'expired';
    await invite.save();
    return null;
  }
  return invite;
};

const acceptInvite = async (token, userId) => {
  const invite = await getInviteByToken(token);
  if (!invite) {
    const err = new Error('Invite invalid or expired');
    err.status = 400;
    throw err;
  }

  const user = await User.findById(userId).setOptions(BYPASS);
  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }
  if (user.email.toLowerCase() !== invite.email) {
    const err = new Error('Invite email does not match your account');
    err.status = 403;
    throw err;
  }

  const tenantId = invite.tenantId?._id || invite.tenantId;
  await assertSeatAvailable(tenantId);
  await TenantMembership.findOneAndUpdate(
    { tenantId, userId },
    {
      $setOnInsert: {
        role: invite.role,
        status: 'active',
        invitedBy: invite.invitedBy,
        joinedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  invite.status = 'accepted';
  await invite.save();
  return tenantId;
};

const migrateAllUsersToMemberships = async () => {
  const users = await User.find({ tenantId: { $ne: null } }).setOptions(BYPASS).select('_id tenantId');
  let created = 0;
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    const row = await backfillMembershipFromUser(user);
    if (row?.isNew !== false) created += 1;
  }
  return { scanned: users.length, created };
};

module.exports = {
  resolveSessionTenantId,
  listActiveMemberships,
  getMembership,
  backfillMembershipFromUser,
  resolveInitialActiveTenantId,
  formatMembershipRow,
  createTenantForUser,
  reissueSessionWithTenant,
  selectTenant,
  createInvite,
  getInviteByToken,
  acceptInvite,
  migrateAllUsersToMemberships,
  hashToken,
};
