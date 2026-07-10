const mongoose = require('mongoose');
const { getTenantId } = require('./tenantContext');
const { allFeatureUnlocks } = require('../../shared/orgFeatures.cjs');

let cachedDefaultTenantId = null;

/**
 * Resolve tenant for inbound webhooks / workers (no request AsyncLocalStorage context).
 * Prefers WEBHOOK_TENANT_ID / DEFAULT_TENANT_ID env, then PLATFORM_TENANT_SLUG lookup,
 * then (non-production only) oldest active tenant.
 */
async function resolveDefaultTenantId() {
  const fromContext = getTenantId();
  if (fromContext) return fromContext;

  if (cachedDefaultTenantId) return cachedDefaultTenantId;

  const envId = (process.env.WEBHOOK_TENANT_ID || process.env.DEFAULT_TENANT_ID || '').trim();
  if (envId && mongoose.Types.ObjectId.isValid(envId)) {
    cachedDefaultTenantId = new mongoose.Types.ObjectId(envId);
    return cachedDefaultTenantId;
  }

  const Tenant = require('../models/Tenant');
  const tenantLookup = { bypassTenant: true };

  const platformSlug = (process.env.PLATFORM_TENANT_SLUG || '').trim();
  if (platformSlug) {
    let tenant = await Tenant.findOne({ slug: platformSlug, status: 'active' })
      .setOptions(tenantLookup)
      .lean();
    if (!tenant) {
      tenant = await Tenant.findOne({ slug: platformSlug }).setOptions(tenantLookup).lean();
    }
    if (tenant) {
      cachedDefaultTenantId = tenant._id;
      return cachedDefaultTenantId;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'WEBHOOK_TENANT_ID, DEFAULT_TENANT_ID, or PLATFORM_TENANT_SLUG required in production when tenant context is missing',
    );
  }

  let tenant = await Tenant.findOne({ status: 'active' }).sort({ createdAt: 1 }).setOptions(tenantLookup).lean();
  if (!tenant) tenant = await Tenant.findOne().sort({ createdAt: 1 }).setOptions(tenantLookup).lean();
  if (!tenant) {
    throw new Error('No tenant configured for webhook processing');
  }

  cachedDefaultTenantId = tenant._id;
  return cachedDefaultTenantId;
}

/**
 * Find or create the platform default tenant (Clerk first-user bootstrap).
 * Works in production when WEBHOOK_TENANT_ID is unset and no tenant row exists yet.
 */
async function ensurePlatformTenant() {
  try {
    return await resolveDefaultTenantId();
  } catch {
    /* fall through to find/create Default Tenant */
  }

  const Tenant = require('../models/Tenant');
  const tenantLookup = { bypassTenant: true };
  let tenant = await Tenant.findOne({ name: 'Default Tenant' }).setOptions(tenantLookup);
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: (process.env.ADMIN_EMAIL || 'helloworld@theshakticollective').trim(),
      status: 'active',
      featureUnlocks: allFeatureUnlocks(),
    });
  } else {
    const unlocks = allFeatureUnlocks();
    const current = tenant.featureUnlocks?.toObject?.() || tenant.featureUnlocks || {};
    const needsUnlockRepair = Object.entries(unlocks).some(([key, value]) => current[key] !== value);
    if (needsUnlockRepair) {
      tenant.featureUnlocks = unlocks;
      tenant.markModified('featureUnlocks');
      await tenant.save();
    }
  }
  cachedDefaultTenantId = tenant._id;
  return cachedDefaultTenantId;
}

/** Test helper — clear cached tenant between runs */
function resetDefaultTenantCache() {
  cachedDefaultTenantId = null;
}

module.exports = {
  resolveDefaultTenantId,
  ensurePlatformTenant,
  resetDefaultTenantCache,
};
