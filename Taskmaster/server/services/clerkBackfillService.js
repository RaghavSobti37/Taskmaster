const { clerkClient } = require('@clerk/clerk-sdk-node');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const User = require('../models/User');
const { isClerkConfigured } = require('../utils/clerkAuth');
const { mapTenantMembershipRoleToClerkRole } = require('../utils/clerkRoleMapping');
const { isAlreadyMemberError } = require('./clerkOrgService');
const logger = require('../utils/logger');

const BYPASS = { bypassTenant: true };

const slugify = (name) => String(name || 'org')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48) || `org-${Date.now()}`;

const missingClerkOrgIdFilter = {
  $or: [
    { clerkOrganizationId: null },
    { clerkOrganizationId: '' },
    { clerkOrganizationId: { $exists: false } },
  ],
};

const missingClerkIdFilter = {
  $or: [
    { clerkId: null },
    { clerkId: '' },
    { clerkId: { $exists: false } },
  ],
};

const resolveClerkSlugForTenant = (tenant) => {
  const fromSlug = String(tenant.slug || '').trim();
  if (fromSlug) return fromSlug;
  return slugify(tenant.name);
};

const dedupeClerkSlug = async (baseSlug) => {
  let slug = String(baseSlug || '').trim() || slugify('org');
  const taken = await Tenant.findOne({
    slug,
    clerkOrganizationId: { $nin: [null, ''] },
  }).setOptions(BYPASS).select('_id').lean();
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
};

const resolveCreatorClerkId = async (tenant) => {
  if (tenant.ownerId) {
    const owner = await User.findById(tenant.ownerId)
      .setOptions(BYPASS)
      .select('clerkId')
      .lean();
    if (owner?.clerkId) return owner.clerkId;
  }

  const adminMembership = await TenantMembership.findOne({
    tenantId: tenant._id,
    status: 'active',
    role: { $in: ['owner', 'admin'] },
  })
    .setOptions(BYPASS)
    .sort({ joinedAt: 1 })
    .lean();

  if (adminMembership?.userId) {
    const user = await User.findById(adminMembership.userId)
      .setOptions(BYPASS)
      .select('clerkId')
      .lean();
    if (user?.clerkId) return user.clerkId;
  }

  const anyMembership = await TenantMembership.findOne({
    tenantId: tenant._id,
    status: 'active',
  })
    .setOptions(BYPASS)
    .sort({ joinedAt: 1 })
    .lean();

  if (anyMembership?.userId) {
    const user = await User.findById(anyMembership.userId)
      .setOptions(BYPASS)
      .select('clerkId')
      .lean();
    if (user?.clerkId) return user.clerkId;
  }

  return null;
};

const createClerkOrgWithRetry = async ({ name, slug, createdBy }) => {
  const orgPayload = { name, createdBy };
  if (slug) orgPayload.slug = slug;

  try {
    return await clerkClient.organizations.createOrganization(orgPayload);
  } catch (err) {
    const msg = String(err?.errors?.[0]?.message || err?.message || '');
    if (/slug/i.test(msg) && slug) {
      const retrySlug = `${slug}-${Date.now().toString(36)}`;
      return clerkClient.organizations.createOrganization({
        name,
        slug: retrySlug,
        createdBy,
      });
    }
    throw err;
  }
};

/**
 * Read-only inventory for Clerk ↔ Mongo parity gaps.
 */
const inventoryClerkSync = async () => {
  const [
    tenantsMissingOrgId,
    usersMissingClerkId,
    activeMemberships,
    tenantsWithOrgId,
  ] = await Promise.all([
    Tenant.find(missingClerkOrgIdFilter)
      .setOptions(BYPASS)
      .select('_id name slug ownerId contactEmail')
      .lean(),
    User.find(missingClerkIdFilter)
      .setOptions(BYPASS)
      .select('_id email name tenantId')
      .lean(),
    TenantMembership.find({ status: 'active' })
      .setOptions(BYPASS)
      .select('tenantId userId role')
      .lean(),
    Tenant.find({ clerkOrganizationId: { $nin: [null, ''] } })
      .setOptions(BYPASS)
      .select('_id clerkOrganizationId')
      .lean(),
  ]);

  const tenantOrgMap = new Map(
    tenantsWithOrgId.map((t) => [String(t._id), t.clerkOrganizationId]),
  );

  const userIds = [...new Set(activeMemberships.map((m) => String(m.userId)))];
  const users = await User.find({ _id: { $in: userIds } })
    .setOptions(BYPASS)
    .select('_id clerkId email')
    .lean();
  const userClerkMap = new Map(users.map((u) => [String(u._id), u.clerkId || null]));

  let membershipsTenantMissingOrg = 0;
  let membershipsUserMissingClerk = 0;
  let membershipsReadyToSync = 0;

  for (const row of activeMemberships) {
    const tenantId = String(row.tenantId);
    const userId = String(row.userId);
    const hasOrg = Boolean(tenantOrgMap.get(tenantId));
    const hasClerkUser = Boolean(userClerkMap.get(userId));

    if (!hasOrg) {
      membershipsTenantMissingOrg += 1;
    } else if (!hasClerkUser) {
      membershipsUserMissingClerk += 1;
    } else {
      membershipsReadyToSync += 1;
    }
  }

  return {
    tenantsMissingClerkOrganizationId: tenantsMissingOrgId.length,
    tenantsMissingClerkOrganizationIdRows: tenantsMissingOrgId,
    usersMissingClerkId: usersMissingClerkId.length,
    usersMissingClerkIdRows: usersMissingClerkId,
    activeMemberships: activeMemberships.length,
    membershipGaps: {
      tenantMissingClerkOrg: membershipsTenantMissingOrg,
      userMissingClerkId: membershipsUserMissingClerk,
      readyToSync: membershipsReadyToSync,
    },
  };
};

/**
 * Backfill Clerk organizations for tenants missing clerkOrganizationId.
 */
const backfillClerkOrganizations = async ({ dryRun = true } = {}) => {
  const tenants = await Tenant.find(missingClerkOrgIdFilter)
    .setOptions(BYPASS)
    .lean();

  const summary = {
    dryRun,
    scanned: tenants.length,
    created: 0,
    skipped: 0,
    failed: 0,
    rows: [],
  };

  if (!tenants.length) return summary;

  if (!dryRun && !isClerkConfigured()) {
    const err = new Error('CLERK_SECRET_KEY required for --execute');
    err.code = 'CLERK_NOT_CONFIGURED';
    throw err;
  }

  for (const tenant of tenants) {
    const row = {
      tenantId: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug || null,
    };

    const creatorClerkId = await resolveCreatorClerkId(tenant);
    if (!creatorClerkId) {
      row.action = 'skipped';
      row.reason = 'no_clerk_user';
      summary.skipped += 1;
      summary.rows.push(row);
      continue;
    }

    const clerkSlug = await dedupeClerkSlug(resolveClerkSlugForTenant(tenant));

    if (dryRun) {
      row.action = 'would_create';
      row.clerkSlug = clerkSlug;
      row.creatorClerkId = creatorClerkId;
      summary.created += 1;
      summary.rows.push(row);
      continue;
    }

    try {
      const org = await createClerkOrgWithRetry({
        name: String(tenant.name || '').trim() || 'Organization',
        slug: clerkSlug,
        createdBy: creatorClerkId,
      });

      const clerkOrganizationId = org?.id;
      if (!clerkOrganizationId) {
        row.action = 'failed';
        row.reason = 'no_org_id';
        summary.failed += 1;
        summary.rows.push(row);
        continue;
      }

      try {
        await clerkClient.organizations.createOrganizationMembership({
          organizationId: clerkOrganizationId,
          userId: creatorClerkId,
          role: mapTenantMembershipRoleToClerkRole('admin'),
        });
      } catch (membershipErr) {
        if (!isAlreadyMemberError(membershipErr)) throw membershipErr;
      }

      await Tenant.updateOne(
        { _id: tenant._id },
        { $set: { clerkOrganizationId, updatedAt: new Date() } },
      ).setOptions(BYPASS);

      row.action = 'created';
      row.clerkOrganizationId = clerkOrganizationId;
      summary.created += 1;
      summary.rows.push(row);
    } catch (err) {
      const message = String(err?.errors?.[0]?.message || err?.message || 'Clerk org create failed');
      logger.warn('clerkBackfillService', 'org backfill failed', {
        tenantId: row.tenantId,
        error: message,
      });
      row.action = 'failed';
      row.reason = message;
      summary.failed += 1;
      summary.rows.push(row);
    }
  }

  return summary;
};

/**
 * Backfill Clerk org memberships for active TenantMembership rows.
 */
const backfillClerkMemberships = async ({ dryRun = true } = {}) => {
  const memberships = await TenantMembership.find({ status: 'active' })
    .setOptions(BYPASS)
    .lean();

  const summary = {
    dryRun,
    scanned: memberships.length,
    created: 0,
    skipped: 0,
    failed: 0,
    rows: [],
  };

  if (!memberships.length) return summary;

  if (!dryRun && !isClerkConfigured()) {
    const err = new Error('CLERK_SECRET_KEY required for --execute');
    err.code = 'CLERK_NOT_CONFIGURED';
    throw err;
  }

  for (const membership of memberships) {
    const row = {
      membershipId: String(membership._id),
      tenantId: String(membership.tenantId),
      userId: String(membership.userId),
      role: membership.role,
    };

    const [tenant, user] = await Promise.all([
      Tenant.findById(membership.tenantId)
        .setOptions(BYPASS)
        .select('clerkOrganizationId name')
        .lean(),
      User.findById(membership.userId)
        .setOptions(BYPASS)
        .select('clerkId email')
        .lean(),
    ]);

    if (!tenant?.clerkOrganizationId) {
      row.action = 'skipped';
      row.reason = 'tenant_missing_clerk_org';
      summary.skipped += 1;
      summary.rows.push(row);
      continue;
    }

    if (!user?.clerkId) {
      row.action = 'skipped';
      row.reason = 'user_missing_clerk_id';
      summary.skipped += 1;
      summary.rows.push(row);
      continue;
    }

    const clerkRole = mapTenantMembershipRoleToClerkRole(membership.role);
    row.clerkRole = clerkRole;
    row.clerkOrganizationId = tenant.clerkOrganizationId;
    row.clerkUserId = user.clerkId;

    if (dryRun) {
      row.action = 'would_create';
      summary.created += 1;
      summary.rows.push(row);
      continue;
    }

    try {
      await clerkClient.organizations.createOrganizationMembership({
        organizationId: tenant.clerkOrganizationId,
        userId: user.clerkId,
        role: clerkRole,
      });
      row.action = 'created';
      summary.created += 1;
      summary.rows.push(row);
    } catch (err) {
      if (isAlreadyMemberError(err)) {
        row.action = 'skipped';
        row.reason = 'already_member';
        summary.skipped += 1;
        summary.rows.push(row);
        continue;
      }
      const message = String(err?.errors?.[0]?.message || err?.message || 'membership create failed');
      logger.warn('clerkBackfillService', 'membership backfill failed', {
        membershipId: row.membershipId,
        error: message,
      });
      row.action = 'failed';
      row.reason = message;
      summary.failed += 1;
      summary.rows.push(row);
    }
  }

  return summary;
};

module.exports = {
  inventoryClerkSync,
  backfillClerkOrganizations,
  backfillClerkMemberships,
  resolveCreatorClerkId,
  resolveClerkSlugForTenant,
  dedupeClerkSlug,
};
