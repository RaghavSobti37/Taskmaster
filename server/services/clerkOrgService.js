const { clerkClient } = require('@clerk/clerk-sdk-node');
const { isClerkConfigured } = require('../utils/clerkAuth');
const { CLERK_ORG_ADMIN_ROLE } = require('../utils/clerkRoleMapping');
const logger = require('../utils/logger');

const isAlreadyMemberError = (err) => {
  const msg = String(err?.errors?.[0]?.message || err?.message || '');
  return /already/i.test(msg);
};

const isSlugDisabledError = (err) => {
  const msg = String(err?.errors?.[0]?.message || err?.message || '');
  return /organization\s+slugs?\s+not\s+enabled|slug.*not\s+enabled/i.test(msg);
};

/**
 * Create a Clerk Organization for a new CoreKnot tenant and add creator as org admin.
 * No-op when Clerk is not configured or creator has no clerkId — Mongo tenant create still succeeds.
 *
 * @returns {Promise<{ synced: boolean, clerkOrganizationId?: string, reason?: string }>}
 */
const syncTenantToClerkOrganization = async ({
  tenantName,
  slug,
  creatorClerkId,
  creatorUserId,
}) => {
  if (!isClerkConfigured()) {
    logger.info('clerkOrgService', 'Clerk not configured — skipping org sync');
    return { synced: false, reason: 'not_configured' };
  }

  if (!creatorClerkId) {
    logger.warn('clerkOrgService', 'Creator has no clerkId — skipping org sync', {
      creatorUserId: creatorUserId ? String(creatorUserId) : null,
    });
    return { synced: false, reason: 'no_clerk_user' };
  }

  const trimmedName = String(tenantName || '').trim();
  if (!trimmedName) {
    return { synced: false, reason: 'missing_name' };
  }

  try {
    const orgPayload = { name: trimmedName, createdBy: creatorClerkId };
    const normalizedSlug = String(slug || '').trim();
    if (normalizedSlug) orgPayload.slug = normalizedSlug;

    let org;
    try {
      org = await clerkClient.organizations.createOrganization(orgPayload);
    } catch (createErr) {
      if (orgPayload.slug && isSlugDisabledError(createErr)) {
        logger.warn('clerkOrgService', 'Clerk org slug disabled; retrying without slug', {
          creatorUserId: creatorUserId ? String(creatorUserId) : null,
        });
        const fallbackPayload = { name: trimmedName, createdBy: creatorClerkId };
        org = await clerkClient.organizations.createOrganization(fallbackPayload);
      } else {
        throw createErr;
      }
    }
    const clerkOrganizationId = org?.id;
    if (!clerkOrganizationId) {
      return { synced: false, reason: 'no_org_id' };
    }

    try {
      await clerkClient.organizations.createOrganizationMembership({
        organizationId: clerkOrganizationId,
        userId: creatorClerkId,
        role: CLERK_ORG_ADMIN_ROLE,
      });
    } catch (membershipErr) {
      if (!isAlreadyMemberError(membershipErr)) throw membershipErr;
    }

    return { synced: true, clerkOrganizationId };
  } catch (err) {
    const message = String(err?.errors?.[0]?.message || err?.message || 'Clerk org create failed');
    logger.warn('clerkOrgService', 'tenant Clerk org sync failed', {
      creatorUserId: creatorUserId ? String(creatorUserId) : null,
      error: message,
    });
    return { synced: false, reason: message };
  }
};

const deleteClerkOrganization = async (clerkOrganizationId) => {
  if (!isClerkConfigured() || !clerkOrganizationId) {
    return { deleted: false, reason: 'not_configured' };
  }
  try {
    await clerkClient.organizations.deleteOrganization(clerkOrganizationId);
    return { deleted: true };
  } catch (err) {
    const message = String(err?.errors?.[0]?.message || err?.message || 'Clerk org delete failed');
    logger.warn('clerkOrgService', 'Clerk org delete failed', { clerkOrganizationId, error: message });
    return { deleted: false, reason: message };
  }
};

module.exports = {
  CLERK_ORG_ADMIN_ROLE,
  isAlreadyMemberError,
  syncTenantToClerkOrganization,
  deleteClerkOrganization,
};
