const crypto = require('crypto');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const { MEMBERSHIP_ROLES } = require('../models/TenantMembership');
const TenantInvite = require('../models/TenantInvite');
const User = require('../models/User');
const { establishSession } = require('../utils/authSession');
const { registerSession, decodeToken } = require('../utils/sessionRegistry');
const { assertSeatAvailable } = require('./planEnforcementService');
const { assertEmailDispatchSucceeded, dispatchEmailPayload } = require('./mailDriver');
const { syncTenantToClerkOrganization, deleteClerkOrganization } = require('./clerkOrgService');
const { bootstrapTenant } = require('./tenantBootstrapService');
const { escapeHtml, safeHref } = require('../utils/emailHtml');
const {
  isClerkIdentityWritePathEnabled,
  createClerkOrganizationInvitation,
} = require('./clerkInviteService');
const { isAdminUser } = require('../utils/departmentPermissions');
const { isClerkConfigured } = require('../utils/clerkAuth');
const { normalizeFeatureUnlocks } = require('../../shared/orgFeatures.cjs');

const BYPASS = { bypassTenant: true };
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const slugify = (name) => String(name || 'org')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48) || `org-${Date.now()}`;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const normalizeInviteRole = (role) => (role === 'admin' ? 'admin' : 'member');

async function sendTenantInviteEmails(invites = []) {
  const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  await Promise.all(invites.map((invite) => {
    const inviteUrl = `${base}/invites/${encodeURIComponent(invite.inviteToken)}/accept`;
    const safeTenantName = escapeHtml(invite.tenantName);
    const safeInviterName = escapeHtml(invite.inviterName || 'Your team');
    const safeRole = escapeHtml(invite.role);
    const safeInviteUrl = safeHref(inviteUrl, 'https://coreknot.app');
    return dispatchEmailPayload({
      to: invite.email,
      subject: `Join ${invite.tenantName} on CoreKnot`,
      html: `
        <p>Hi,</p>
        <p>${safeInviterName} invited you to join <strong>${safeTenantName}</strong> on CoreKnot as ${safeRole}.</p>
        <p><a href="${safeInviteUrl}">Accept invitation</a></p>
        <p>If you did not expect this email, you can ignore it.</p>
      `,
      from: process.env.SYSTEM_VERIFIED_FROM_EMAIL,
    }).then((result) => assertEmailDispatchSucceeded(result, 'Tenant invite email dispatch failed'));
  }));
}

const requireInviteRole = (role) => {
  const raw = String(role ?? '').trim().toLowerCase();
  if (!raw || !['admin', 'member'].includes(raw)) {
    const err = new Error('Invite role must be admin or member');
    err.status = 400;
    throw err;
  }
  return raw;
};

const resolveMembershipRoleFromExternal = (externalRole) => {
  const raw = String(externalRole || '').trim().toLowerCase();
  if (!raw || raw === 'standard') {
    return { role: 'member', needsRoleReview: false };
  }
  if (MEMBERSHIP_ROLES.includes(raw) && raw !== 'owner') {
    return { role: raw, needsRoleReview: false };
  }
  return { role: 'member', needsRoleReview: true };
};

const withOptionalTransaction = async (work) => {
  // ponytail: memory Mongo in Jest lacks replica set / retryable writes
  if (process.env.NODE_ENV === 'test') {
    return work(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const resolveSessionTenantId = (decoded, user) => {
  if (decoded?.activeTenantId) return decoded.activeTenantId;
  // ponytail: org-centric — authenticated session without activeTenantId must not scope via stale user.tenantId
  if (decoded) return null;
  if (user?.tenantId) return user.tenantId;
  return null;
};

const listActiveMemberships = async (userId) => TenantMembership.find({
  userId,
  status: 'active',
})
  .setOptions(BYPASS)
  .populate('tenantId', 'name slug plan status branding')
  .lean();

const getMembership = async (userId, tenantId) => TenantMembership.findOne({
  userId,
  tenantId,
  status: 'active',
}).setOptions(BYPASS).lean();

const resolveBackfillRole = (user, tenant) => {
  if (tenant?.ownerId && String(tenant.ownerId) === String(user._id)) return 'owner';
  if (isAdminUser(user)) return 'admin';
  return 'member';
};

const ensureMembershipForTenant = async (userId, tenantId, { role } = {}) => {
  if (!userId || !tenantId) return null;

  const filter = { userId, tenantId };
  const existing = await TenantMembership.findOne(filter).setOptions(BYPASS);
  if (existing) return existing;

  const [tenant, user] = await Promise.all([
    Tenant.findById(tenantId).setOptions(BYPASS).select('ownerId'),
    User.findById(userId).setOptions(BYPASS),
  ]);
  const resolvedRole = role || resolveBackfillRole(user, tenant);

  try {
    return await TenantMembership.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          userId,
          tenantId,
          role: resolvedRole,
          needsRoleReview: false,
          status: 'active',
          joinedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).setOptions(BYPASS);
  } catch (err) {
    if (err?.code === 11000) {
      const row = await TenantMembership.findOne(filter).setOptions(BYPASS);
      if (row) return row;
    }
    throw err;
  }
};

const backfillMembershipFromUser = async (user) => {
  if (!user?.tenantId) return null;

  const filter = { userId: user._id, tenantId: user.tenantId };
  const existing = await TenantMembership.findOne(filter).setOptions(BYPASS);
  if (existing) return existing;

  const tenant = await Tenant.findById(user.tenantId).setOptions(BYPASS).select('ownerId');
  const role = resolveBackfillRole(user, tenant);

  // ponytail: upsert — parallel auth middleware calls must not race TenantMembership.create
  try {
    return await TenantMembership.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          userId: user._id,
          tenantId: user.tenantId,
          role,
          needsRoleReview: false,
          status: 'active',
          joinedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).setOptions(BYPASS);
  } catch (err) {
    if (err?.code === 11000) {
      const row = await TenantMembership.findOne(filter).setOptions(BYPASS);
      if (row) return row;
    }
    throw err;
  }
};

/** Self-heal: promote tenant.ownerId from member → owner on login. */
const reconcileMembershipRole = async (user, tenantId) => {
  if (!user?._id || !tenantId) return;
  const tenant = await Tenant.findById(tenantId).setOptions(BYPASS).select('ownerId');
  if (!tenant?.ownerId || String(tenant.ownerId) !== String(user._id)) return;

  const membership = await TenantMembership.findOne({
    userId: user._id,
    tenantId,
    status: 'active',
  }).setOptions(BYPASS);
  if (!membership || membership.role === 'owner') return;

  membership.role = 'owner';
  membership.needsRoleReview = false;
  await membership.save();
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
  needsRoleReview: Boolean(row.needsRoleReview),
  status: row.status,
  tenant: row.tenantId && typeof row.tenantId === 'object'
    ? {
      _id: row.tenantId._id,
      name: row.tenantId.name,
      slug: row.tenantId.slug,
      plan: row.tenantId.plan,
      logoUrl: row.tenantId.branding?.logoUrl || null,
    }
    : { _id: row.tenantId },
});

const createTenantForUser = async (userId, payload = {}) => {
  const {
    name,
    contactEmail,
    slug: requestedSlug,
    logo,
    industry,
    teamSize,
    settings = {},
    invites = [],
    featureUnlocks: requestedFeatureUnlocks,
  } = payload;

  const user = await User.findById(userId).setOptions(BYPASS);
  if (!user) throw new Error('User not found');
  if (!name || !String(name).trim()) throw new Error('Organization name required');

  if (isClerkConfigured() && !user.clerkId) {
    const err = new Error('Clerk account required to create an organization. Sign in with Clerk first.');
    err.status = 400;
    err.code = 'CLERK_USER_REQUIRED';
    throw err;
  }

  const trimmedName = String(name).trim();
  let slug = requestedSlug ? slugify(requestedSlug) : slugify(trimmedName);
  const taken = await Tenant.findOne({ slug }).setOptions(BYPASS);
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;

  const normalizedInvites = (Array.isArray(invites) ? invites : [])
    .map((row) => {
      const email = String(row?.email || '').trim().toLowerCase();
      if (!email) return null;
      return { email, role: requireInviteRole(row?.role) };
    })
    .filter(Boolean);

  const completedSteps = normalizedInvites.length > 0 ? ['invite_teammate'] : [];

  const tenantSettings = {
    timezone: settings.timezone || 'Asia/Kolkata',
    defaultCurrency: settings.currency || settings.defaultCurrency || 'INR',
    dateFormat: 'DD/MM/YYYY',
  };

  const tenantPayload = {
    name: trimmedName,
    slug,
    contactEmail: contactEmail || user.email,
    ownerId: user._id,
    plan: 'free',
    status: 'trial',
    industry: industry ? String(industry).trim() : undefined,
    teamSize: teamSize ? String(teamSize).trim() : undefined,
    settings: tenantSettings,
    featureUnlocks: normalizeFeatureUnlocks(requestedFeatureUnlocks),
    branding: logo ? { logoUrl: String(logo).trim() } : undefined,
    onboardingProgress: {
      completedSteps,
      dismissedChecklist: false,
      checklistSnoozedUntil: null,
    },
  };

  const rollbackTenantCreate = async (tenantId, clerkOrganizationId) => {
    if (clerkOrganizationId) {
      await deleteClerkOrganization(clerkOrganizationId);
    }
    if (!tenantId) return;
    await TenantInvite.deleteMany({ tenantId }).setOptions(BYPASS);
    await TenantMembership.deleteMany({ tenantId }).setOptions(BYPASS);
    await Tenant.deleteOne({ _id: tenantId }).setOptions(BYPASS);
  };

  const { tenant, inviteRows } = await withOptionalTransaction(async (session) => {
    const createOpts = session ? { session } : {};
    const [createdTenant] = await Tenant.create([tenantPayload], createOpts);

    await TenantMembership.create([{
      tenantId: createdTenant._id,
      userId: user._id,
      role: 'admin',
      needsRoleReview: false,
      status: 'active',
      joinedAt: new Date(),
    }], createOpts);

    const createdInvites = [];
    for (const inviteRow of normalizedInvites) {
      // eslint-disable-next-line no-await-in-loop
      await assertSeatAvailable(createdTenant._id);
      const rawToken = crypto.randomBytes(32).toString('hex');
      // eslint-disable-next-line no-await-in-loop
      const [invite] = await TenantInvite.create([{
        tenantId: createdTenant._id,
        email: inviteRow.email,
        role: inviteRow.role,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        status: 'pending',
        invitedBy: user._id,
      }], createOpts);
      createdInvites.push({ invite, rawToken });
    }

    return { tenant: createdTenant, inviteRows: createdInvites };
  });

  if (!user.tenantId) {
    user.tenantId = tenant._id;
    await user.save();
  }

  if (inviteRows.length > 0) {
    await sendTenantInviteEmails(inviteRows.map(({ invite, rawToken }) => ({
      inviteId: String(invite._id),
      tenantId: String(tenant._id),
      tenantName: tenant.name,
      email: invite.email,
      role: invite.role,
      inviteToken: rawToken,
      inviterName: user.name,
    })));
  }

  const clerkSync = await syncTenantToClerkOrganization({
    tenantName: tenant.name,
    slug: tenant.slug,
    creatorClerkId: user.clerkId,
    creatorUserId: user._id,
  });

  if (isClerkConfigured() && user.clerkId) {
    if (!clerkSync.synced || !clerkSync.clerkOrganizationId) {
      await rollbackTenantCreate(tenant._id, null);
      const err = new Error(clerkSync.reason || 'Failed to create organization in Clerk');
      err.status = 502;
      err.code = 'CLERK_SYNC_FAILED';
      throw err;
    }
    tenant.clerkOrganizationId = clerkSync.clerkOrganizationId;
    tenant.updatedAt = new Date();
    await tenant.save();
  } else if (clerkSync.synced && clerkSync.clerkOrganizationId) {
    tenant.clerkOrganizationId = clerkSync.clerkOrganizationId;
    tenant.updatedAt = new Date();
    await tenant.save();
  }

  try {
    await bootstrapTenant(tenant._id, { creatorUserId: user._id });
  } catch (bootstrapErr) {
    await rollbackTenantCreate(tenant._id, tenant.clerkOrganizationId);
    throw bootstrapErr;
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
  if (isClerkIdentityWritePathEnabled()) {
    return createClerkOrganizationInvitation({ tenantId, email, role, invitedBy });
  }

  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw new Error('Email required');
  const inviteRole = requireInviteRole(role);

  await assertSeatAvailable(tenantId);
  await TenantInvite.updateMany(
    { tenantId, email: normalized, status: 'pending' },
    { status: 'revoked' },
  ).setOptions(BYPASS);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const invite = await TenantInvite.create({
    tenantId,
    email: normalized,
    role: inviteRole,
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
      $set: {
        role: normalizeInviteRole(invite.role),
        status: 'active',
        invitedBy: invite.invitedBy,
        needsRoleReview: false,
      },
      $setOnInsert: {
        joinedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).setOptions(BYPASS);

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
  ensureMembershipForTenant,
  reconcileMembershipRole,
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
  normalizeInviteRole,
  resolveMembershipRoleFromExternal,
};
