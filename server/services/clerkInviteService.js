const { clerkClient } = require('@clerk/clerk-sdk-node');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { isClerkConfigured } = require('../utils/clerkAuth');
const {
  mapTenantMembershipRoleToClerkRole,
} = require('../utils/clerkRoleMapping');
const { assertSeatAvailable } = require('./planEnforcementService');
const logger = require('../utils/logger');

const normalizeInviteRole = (role) => (role === 'admin' ? 'admin' : 'member');

const BYPASS = { bypassTenant: true };
const INVITE_EXPIRES_DAYS = 7;

const isClerkIdentityWritePathEnabled = () => (
  String(process.env.CLERK_IDENTITY_WRITE_PATH || '').trim().toLowerCase() === 'true'
);

const inviteRedirectUrl = () => {
  const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  return `${base.replace(/\/$/, '')}/orgs`;
};

/**
 * Create org invite via Clerk API. Mongo TenantInvite row is projected by webhook only.
 *
 * @returns {Promise<{ source: 'clerk', clerkInvitationId: string, email: string, role: string, expiresAt: Date }>}
 */
const createClerkOrganizationInvitation = async ({
  tenantId,
  email,
  role,
  invitedBy,
}) => {
  if (!isClerkIdentityWritePathEnabled()) {
    const err = new Error('Clerk identity write path is not enabled');
    err.status = 503;
    throw err;
  }
  if (!isClerkConfigured()) {
    const err = new Error('Clerk is not configured');
    err.status = 503;
    throw err;
  }

  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    const err = new Error('Email required');
    err.status = 400;
    throw err;
  }

  const tenant = await Tenant.findById(tenantId).setOptions(BYPASS);
  if (!tenant) {
    const err = new Error('Organization not found');
    err.status = 404;
    throw err;
  }
  if (!tenant.clerkOrganizationId) {
    const err = new Error('Organization is not linked to Clerk');
    err.status = 409;
    throw err;
  }

  const inviter = invitedBy
    ? await User.findById(invitedBy).setOptions(BYPASS).select('clerkId')
    : null;

  await assertSeatAvailable(tenantId);

  const membershipRole = normalizeInviteRole(role);
  const clerkRole = mapTenantMembershipRoleToClerkRole(membershipRole);

  try {
    const invitation = await clerkClient.organizations.createOrganizationInvitation({
      organizationId: tenant.clerkOrganizationId,
      emailAddress: normalized,
      role: clerkRole,
      inviterUserId: inviter?.clerkId || undefined,
      redirectUrl: inviteRedirectUrl(),
      expiresInDays: INVITE_EXPIRES_DAYS,
      publicMetadata: {
        coreknotTenantId: String(tenantId),
        coreknotRole: membershipRole,
      },
    });

    const clerkInvitationId = invitation?.id;
    if (!clerkInvitationId) {
      const err = new Error('Clerk invitation missing id');
      err.status = 502;
      throw err;
    }

    const expiresAt = invitation.expiresAt
      ? new Date(invitation.expiresAt)
      : new Date(Date.now() + INVITE_EXPIRES_DAYS * 86400000);

    return {
      source: 'clerk',
      clerkInvitationId,
      email: normalized,
      role: membershipRole,
      expiresAt,
    };
  } catch (err) {
    const message = String(err?.errors?.[0]?.message || err?.message || 'Clerk invite failed');
    logger.warn('clerkInviteService', 'createOrganizationInvitation failed', {
      tenantId: String(tenantId),
      email: normalized,
      error: message,
    });
    const wrapped = new Error(message);
    wrapped.status = err?.status || 502;
    throw wrapped;
  }
};

module.exports = {
  INVITE_EXPIRES_DAYS,
  isClerkIdentityWritePathEnabled,
  createClerkOrganizationInvitation,
  inviteRedirectUrl,
};
