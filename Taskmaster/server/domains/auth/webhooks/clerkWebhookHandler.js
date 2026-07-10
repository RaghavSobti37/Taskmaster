const crypto = require('crypto');
const { Webhook } = require('svix');
const User = require('../../../models/User');
const Tenant = require('../../../models/Tenant');
const TenantMembership = require('../../../models/TenantMembership');
const TenantInvite = require('../../../models/TenantInvite');
const ClerkSyncEvent = require('../../../models/ClerkSyncEvent');
const logger = require('../../../utils/logger');
const { revokeAllUserSessions } = require('../../../utils/sessionRegistry');
const { invalidateAuthUserCache } = require('../../../utils/authUserLookup');
const { recordAuditEvent } = require('../../../services/auditEventService');
const { mapClerkRoleToMembership } = require('../../../utils/clerkRoleMapping');

const BYPASS = { bypassTenant: true };
const OFFBOARD_GRACE_DAYS = 14;

const clerkInviteTokenHash = (clerkInvitationId) => crypto
  .createHash('sha256')
  .update(`clerk-inv:${clerkInvitationId}`)
  .digest('hex');

const slugify = (name) => String(name || 'org')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48) || `org-${Date.now()}`;

const verifyClerkWebhook = (req) => {
  const secret = String(process.env.CLERK_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    const err = new Error('CLERK_WEBHOOK_SECRET not configured');
    err.status = 503;
    throw err;
  }
  const wh = new Webhook(secret);
  const payload = req.rawBody
    ? (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody))
    : JSON.stringify(req.body || {});
  return wh.verify(payload, {
    'svix-id': req.headers['svix-id'],
    'svix-timestamp': req.headers['svix-timestamp'],
    'svix-signature': req.headers['svix-signature'],
  });
};

const primaryEmail = (clerkUser = {}) => {
  const addresses = clerkUser.data?.email_addresses || clerkUser.email_addresses || [];
  const primaryId = clerkUser.data?.primary_email_address_id || clerkUser.primary_email_address_id;
  const primary = addresses.find((e) => e.id === primaryId) || addresses[0];
  return primary?.email_address?.toLowerCase?.().trim() || null;
};

const displayName = (clerkUser = {}) => {
  const data = clerkUser.data || clerkUser;
  const parts = [data.first_name, data.last_name].filter(Boolean);
  if (parts.length) return parts.join(' ').trim();
  const email = primaryEmail(clerkUser);
  return email?.split('@')[0] || 'User';
};

const resolveUserByClerkId = async (clerkUserId, emailHint) => {
  if (!clerkUserId) return null;
  const byClerk = await User.findOne({ clerkId: clerkUserId }).setOptions(BYPASS);
  if (byClerk) return byClerk;
  if (emailHint) {
    return User.findOne({ email: emailHint }).setOptions(BYPASS);
  }
  return null;
};

const resolveTenantByClerkOrgId = async (clerkOrganizationId) => {
  if (!clerkOrganizationId) return null;
  return Tenant.findOne({ clerkOrganizationId }).setOptions(BYPASS);
};

const syncContactEmail = (orgData, creatorUser) => {
  if (creatorUser?.email) return creatorUser.email;
  const slug = String(orgData.slug || slugify(orgData.name)).trim();
  return `org-sync+${slug}@coreknot.internal`;
};

async function handleUserCreated(event) {
  const clerkUserId = event.data?.id;
  const email = primaryEmail(event);
  if (!email || !clerkUserId) return { action: 'skipped', reason: 'missing_email_or_id' };

  const user = await User.findOne({ email }).setOptions(BYPASS);
  if (!user) {
    return { action: 'skipped', reason: 'coreknot_user_not_provisioned' };
  }

  if (user.clerkId !== clerkUserId) {
    user.clerkId = clerkUserId;
    await user.save();
    await invalidateAuthUserCache(user._id);
  }
  return { action: 'linked', userId: user._id.toString() };
}

async function handleUserUpdated(event) {
  const clerkUserId = event.data?.id;
  const email = primaryEmail(event);
  if (!clerkUserId) return { action: 'skipped', reason: 'missing_id' };

  const user = await User.findOne({ clerkId: clerkUserId }).setOptions(BYPASS)
    || (email ? await User.findOne({ email }).setOptions(BYPASS) : null);
  if (!user) return { action: 'skipped', reason: 'user_not_found' };

  const patch = {};
  const name = displayName(event);
  if (name && user.name !== name) patch.name = name;
  if (email && user.email !== email) patch.email = email;
  if (!user.clerkId) patch.clerkId = clerkUserId;

  if (Object.keys(patch).length) {
    Object.assign(user, patch);
    await user.save();
    await invalidateAuthUserCache(user._id);
  }
  return { action: 'updated', userId: user._id.toString() };
}

async function handleUserDeleted(event) {
  const clerkUserId = event.data?.id;
  if (!clerkUserId) return { action: 'skipped', reason: 'missing_id' };

  const user = await User.findOne({ clerkId: clerkUserId }).setOptions(BYPASS);
  if (!user) return { action: 'skipped', reason: 'user_not_found' };

  user.suspended = true;
  user.suspendedAt = user.suspendedAt || new Date();
  user.suspensionReason = user.suspensionReason || 'Clerk user deleted (webhook deprovision)';
  await user.save();
  await revokeAllUserSessions(user._id.toString());
  await invalidateAuthUserCache(user._id);
  return { action: 'suspended', userId: user._id.toString() };
}

async function upsertTenantFromClerkOrg(orgData, { isCreate = false } = {}) {
  const clerkOrganizationId = orgData?.id;
  if (!clerkOrganizationId) return { action: 'skipped', reason: 'missing_org_id' };

  let tenant = await resolveTenantByClerkOrgId(clerkOrganizationId);
  const name = String(orgData.name || '').trim() || 'Organization';
  let slug = orgData.slug ? slugify(orgData.slug) : slugify(name);

  if (!tenant && slug) {
    tenant = await Tenant.findOne({ slug }).setOptions(BYPASS);
  }

  const creatorClerkId = orgData.created_by || orgData.created_by_id;
  const creatorUser = creatorClerkId
    ? await User.findOne({ clerkId: creatorClerkId }).setOptions(BYPASS)
    : null;

  if (!tenant) {
    const taken = await Tenant.findOne({ slug }).setOptions(BYPASS);
    if (taken) slug = `${slug}-${Date.now().toString(36)}`;

    tenant = await Tenant.create({
      name,
      slug,
      clerkOrganizationId,
      contactEmail: syncContactEmail(orgData, creatorUser),
      ownerId: creatorUser?._id,
      status: 'trial',
      plan: 'free',
    });
    return {
      action: isCreate ? 'created' : 'upserted',
      tenantId: tenant._id.toString(),
    };
  }

  tenant.name = name;
  tenant.clerkOrganizationId = clerkOrganizationId;
  if (orgData.slug) tenant.slug = slug;
  if (!tenant.contactEmail) tenant.contactEmail = syncContactEmail(orgData, creatorUser);
  if (!tenant.ownerId && creatorUser?._id) tenant.ownerId = creatorUser._id;
  tenant.updatedAt = new Date();
  await tenant.save();

  return { action: 'upserted', tenantId: tenant._id.toString() };
}

async function handleOrganizationCreated(event) {
  return upsertTenantFromClerkOrg(event.data || {}, { isCreate: true });
}

async function handleOrganizationUpdated(event) {
  return upsertTenantFromClerkOrg(event.data || {}, { isCreate: false });
}

async function scheduleTenantOffboarding(tenant, reason = 'Clerk organization deleted') {
  tenant.offboarding = {
    scheduledDeletionAt: new Date(Date.now() + OFFBOARD_GRACE_DAYS * 86400000),
    requestedBy: tenant.ownerId || null,
  };
  tenant.status = 'suspended';
  tenant.updatedAt = new Date();
  await tenant.save();
  await recordAuditEvent({
    tenantId: tenant._id,
    action: 'tenant.offboard.scheduled',
    resourceType: 'tenant',
    resourceId: tenant._id,
    after: { reason, ...tenant.offboarding },
  });
}

async function handleOrganizationDeleted(event) {
  const clerkOrganizationId = event.data?.id;
  if (!clerkOrganizationId) return { action: 'skipped', reason: 'missing_org_id' };

  const tenant = await resolveTenantByClerkOrgId(clerkOrganizationId);
  if (!tenant) return { action: 'skipped', reason: 'tenant_not_found' };

  await scheduleTenantOffboarding(tenant);
  return { action: 'offboard_scheduled', tenantId: tenant._id.toString() };
}

async function upsertMembershipFromClerk(eventData) {
  const clerkOrganizationId = eventData?.organization?.id || eventData?.organization_id;
  const clerkUserId = eventData?.public_user_data?.user_id || eventData?.user_id;
  if (!clerkOrganizationId || !clerkUserId) {
    return { action: 'skipped', reason: 'missing_org_or_user' };
  }

  const tenant = await resolveTenantByClerkOrgId(clerkOrganizationId);
  if (!tenant) return { action: 'skipped', reason: 'tenant_not_found' };

  const emailHint = eventData?.public_user_data?.identifier
    || eventData?.public_user_data?.email_address;
  const user = await resolveUserByClerkId(clerkUserId, emailHint?.toLowerCase?.());
  if (!user) return { action: 'skipped', reason: 'user_not_found' };

  const { role, needsRoleReview } = mapClerkRoleToMembership(eventData.role);

  const membership = await TenantMembership.findOneAndUpdate(
    { tenantId: tenant._id, userId: user._id },
    {
      $set: {
        role,
        needsRoleReview,
        status: 'active',
      },
      $setOnInsert: {
        tenantId: tenant._id,
        userId: user._id,
        joinedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).setOptions(BYPASS);

  return {
    action: 'upserted',
    tenantId: tenant._id.toString(),
    userId: user._id.toString(),
    membershipId: membership._id.toString(),
  };
}

async function handleOrganizationMembershipCreated(event) {
  return upsertMembershipFromClerk(event.data || {});
}

async function handleOrganizationMembershipUpdated(event) {
  return upsertMembershipFromClerk(event.data || {});
}

async function handleOrganizationMembershipDeleted(event) {
  const clerkOrganizationId = event.data?.organization?.id || event.data?.organization_id;
  const clerkUserId = event.data?.public_user_data?.user_id || event.data?.user_id;
  if (!clerkOrganizationId || !clerkUserId) {
    return { action: 'skipped', reason: 'missing_org_or_user' };
  }

  const tenant = await resolveTenantByClerkOrgId(clerkOrganizationId);
  const user = await resolveUserByClerkId(clerkUserId);
  if (!tenant || !user) return { action: 'skipped', reason: 'tenant_or_user_not_found' };

  const membership = await TenantMembership.findOneAndUpdate(
    { tenantId: tenant._id, userId: user._id },
    { status: 'suspended' },
    { returnDocument: 'after' },
  ).setOptions(BYPASS);

  if (!membership) return { action: 'skipped', reason: 'membership_not_found' };
  return {
    action: 'suspended',
    tenantId: tenant._id.toString(),
    userId: user._id.toString(),
  };
}

async function syncTenantInviteFromClerkInvitation(eventData, { status } = {}) {
  const clerkInvitationId = eventData?.id;
  const clerkOrganizationId = eventData?.organization_id || eventData?.organization?.id;
  const email = String(eventData?.email_address || '').trim().toLowerCase();
  if (!clerkInvitationId || !clerkOrganizationId || !email) {
    return { action: 'skipped', reason: 'missing_invite_fields' };
  }

  const tenant = await resolveTenantByClerkOrgId(clerkOrganizationId);
  if (!tenant) return { action: 'skipped', reason: 'tenant_not_found' };

  const { role } = mapClerkRoleToMembership(eventData.role);
  const tokenHash = clerkInviteTokenHash(clerkInvitationId);
  const expiresAt = eventData.expires_at
    ? new Date(eventData.expires_at)
    : new Date(Date.now() + 30 * 86400000);

  const inviteStatus = status || (eventData.status === 'accepted' ? 'accepted' : 'pending');
  const inviterClerkId = eventData.inviter_id || eventData.inviter_user_id;
  let invitedBy;
  if (inviterClerkId) {
    const inviter = await User.findOne({ clerkId: inviterClerkId }).setOptions(BYPASS).select('_id');
    invitedBy = inviter?._id;
  }

  const invite = await TenantInvite.findOneAndUpdate(
    { tokenHash },
    {
      $set: {
        tenantId: tenant._id,
        email,
        role,
        expiresAt,
        status: inviteStatus,
        ...(invitedBy ? { invitedBy } : {}),
      },
      $setOnInsert: {
        tokenHash,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).setOptions(BYPASS);

  return {
    action: 'upserted',
    tenantId: tenant._id.toString(),
    inviteId: invite._id.toString(),
  };
}

async function handleOrganizationInvitationCreated(event) {
  return syncTenantInviteFromClerkInvitation(event.data || {}, { status: 'pending' });
}

async function handleOrganizationInvitationAccepted(event) {
  const data = event.data || {};
  const inviteResult = await syncTenantInviteFromClerkInvitation(data, { status: 'accepted' });

  const clerkOrganizationId = data.organization_id || data.organization?.id;
  const clerkUserId = data.public_user_data?.user_id || data.user_id;
  if (!clerkOrganizationId || !clerkUserId) {
    return { ...inviteResult, membership: 'skipped' };
  }

  const membershipResult = await upsertMembershipFromClerk({
    organization_id: clerkOrganizationId,
    public_user_data: { user_id: clerkUserId },
    role: data.role,
  });

  return {
    ...inviteResult,
    ...membershipResult,
    userId: membershipResult.userId,
  };
}

async function handleOrganizationInvitationRevoked(event) {
  return syncTenantInviteFromClerkInvitation(event.data || {}, { status: 'revoked' });
}

const dispatchClerkEvent = async (event) => {
  const type = event?.type;
  switch (type) {
    case 'user.created':
      return { ...await handleUserCreated(event), type };
    case 'user.updated':
      return { ...await handleUserUpdated(event), type };
    case 'user.deleted':
      return { ...await handleUserDeleted(event), type };
    case 'organization.created':
      return { ...await handleOrganizationCreated(event), type };
    case 'organization.updated':
      return { ...await handleOrganizationUpdated(event), type };
    case 'organization.deleted':
      return { ...await handleOrganizationDeleted(event), type };
    case 'organizationMembership.created':
      return { ...await handleOrganizationMembershipCreated(event), type };
    case 'organizationMembership.updated':
      return { ...await handleOrganizationMembershipUpdated(event), type };
    case 'organizationMembership.deleted':
      return { ...await handleOrganizationMembershipDeleted(event), type };
    case 'organizationInvitation.created':
      return { ...await handleOrganizationInvitationCreated(event), type };
    case 'organizationInvitation.accepted':
      return { ...await handleOrganizationInvitationAccepted(event), type };
    case 'organizationInvitation.revoked':
      return { ...await handleOrganizationInvitationRevoked(event), type };
    default:
      logger.info('clerkWebhook', 'Unhandled event type', { type });
      return { action: 'ignored', type };
  }
};

const recordSyncEvent = async ({
  clerkEventId,
  eventType,
  payloadHash,
  success,
  error,
  tenantId,
  userId,
}) => {
  await ClerkSyncEvent.findOneAndUpdate(
    { clerkEventId },
    {
      clerkEventId,
      eventType,
      payloadHash,
      processedAt: new Date(),
      success,
      error: error || '',
      tenantId: tenantId || undefined,
      userId: userId || undefined,
    },
    { upsert: true, returnDocument: 'after' },
  ).setOptions(BYPASS);
};

async function handleClerkWebhook(req, res) {
  const clerkEventId = String(req.headers['svix-id'] || '').trim();
  let payloadStr = '';

  try {
    const event = verifyClerkWebhook(req);
    payloadStr = req.rawBody
      ? (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody))
      : JSON.stringify(req.body || {});
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
    const eventType = event?.type || 'unknown';

    if (clerkEventId) {
      const prior = await ClerkSyncEvent.findOne({ clerkEventId }).setOptions(BYPASS).lean();
      if (prior?.success) {
        return res.status(200).json({
          received: true,
          action: 'duplicate',
          clerkEventId,
          eventType: prior.eventType,
        });
      }
    }

    const result = await dispatchClerkEvent(event);
    const tenantId = result.tenantId || null;
    const userId = result.userId || null;

    if (clerkEventId) {
      await recordSyncEvent({
        clerkEventId,
        eventType,
        payloadHash,
        success: true,
        tenantId,
        userId,
      });
    }

    return res.status(200).json({ received: true, clerkEventId: clerkEventId || null, ...result });
  } catch (error) {
    const status = error.status || 400;
    logger.warn('clerkWebhook', 'Webhook failed', { error: error.message, status });

    if (clerkEventId && payloadStr) {
      try {
        await recordSyncEvent({
          clerkEventId,
          eventType: 'unknown',
          payloadHash: crypto.createHash('sha256').update(payloadStr).digest('hex'),
          success: false,
          error: error.message || 'Webhook failed',
        });
      } catch (recordErr) {
        logger.warn('clerkWebhook', 'Failed to record sync error', { error: recordErr.message });
      }
    }

    return res.status(status).json({ error: error.message || 'Webhook verification failed' });
  }
}

module.exports = {
  handleClerkWebhook,
  verifyClerkWebhook,
  handleUserCreated,
  handleUserUpdated,
  handleUserDeleted,
  handleOrganizationCreated,
  handleOrganizationUpdated,
  handleOrganizationDeleted,
  handleOrganizationMembershipCreated,
  handleOrganizationMembershipUpdated,
  handleOrganizationMembershipDeleted,
  handleOrganizationInvitationCreated,
  handleOrganizationInvitationAccepted,
  handleOrganizationInvitationRevoked,
  mapClerkRoleToMembership,
  clerkInviteTokenHash,
};
