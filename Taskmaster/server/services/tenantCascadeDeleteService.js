const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const TenantInvite = require('../models/TenantInvite');
const { deleteClerkOrganization } = require('./clerkOrgService');

const BYPASS = { bypassTenant: true };

async function deleteTenantData(tenantId, { dryRun = false } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const summary = [];

  for (const { name } of collections) {
    if (['tenants', 'tenantmemberships', 'tenantinvites'].includes(name)) continue;
    const coll = db.collection(name);
    const count = await coll.countDocuments({ tenantId: tid });
    if (!count) continue;
    if (!dryRun) {
      await coll.deleteMany({ tenantId: tid });
    }
    summary.push({ collection: name, deleted: count });
  }

  const membershipCount = await TenantMembership.countDocuments({ tenantId: tid }).setOptions(BYPASS);
  const inviteCount = await TenantInvite.countDocuments({ tenantId: tid }).setOptions(BYPASS);
  if (!dryRun) {
    await TenantMembership.deleteMany({ tenantId: tid }).setOptions(BYPASS);
    await TenantInvite.deleteMany({ tenantId: tid }).setOptions(BYPASS);
  }

  return { summary, membershipCount, inviteCount };
}

/**
 * Hard-delete tenant row + all tenantId-scoped documents (+ optional Clerk org).
 */
async function executeTenantCascadeDelete(tenantId, { dryRun = false, deleteClerk = true } = {}) {
  const tenant = await Tenant.findById(tenantId).setOptions(BYPASS);
  if (!tenant) {
    const err = new Error('Tenant not found');
    err.status = 404;
    throw err;
  }

  const data = await deleteTenantData(tenant._id, { dryRun });

  if (!dryRun) {
    if (deleteClerk && tenant.clerkOrganizationId) {
      await deleteClerkOrganization(tenant.clerkOrganizationId);
    }
    await Tenant.deleteOne({ _id: tenant._id }).setOptions(BYPASS);
  }

  return {
    tenantId: String(tenant._id),
    slug: tenant.slug,
    name: tenant.name,
    ...data,
  };
}

module.exports = {
  deleteTenantData,
  executeTenantCascadeDelete,
};
