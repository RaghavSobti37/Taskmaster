const mongoose = require('mongoose');
const { getTenantId } = require('./tenantContext');

let cachedDefaultTenantId = null;

/**
 * Resolve tenant for inbound webhooks / workers (no request AsyncLocalStorage context).
 * Prefers WEBHOOK_TENANT_ID env, then oldest active tenant, then any tenant.
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
  let tenant = await Tenant.findOne({ status: 'active' }).sort({ createdAt: 1 }).lean();
  if (!tenant) tenant = await Tenant.findOne().sort({ createdAt: 1 }).lean();
  if (!tenant) {
    throw new Error('No tenant configured for webhook processing');
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
  resetDefaultTenantCache,
};
