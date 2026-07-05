const Tenant = require('../models/Tenant');

const DEFAULT_UNLOCKS = {
  resend: false,
  google: false,
  meta: false,
  knowledgeEngine: false,
  finance: false,
  artistOs: false,
};

const evaluateUnlocks = async (tenant) => {
  const base = { ...DEFAULT_UNLOCKS, ...(tenant?.featureUnlocks || {}) };
  const progress = tenant?.onboardingProgress?.completedSteps || [];

  if (progress.includes('first_project')) base.finance = true;
  if (progress.includes('resend_domain')) base.resend = true;
  if (progress.includes('google_connected')) base.google = true;

  return base;
};

const getTenantUnlocks = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
  if (!tenant) return DEFAULT_UNLOCKS;
  return evaluateUnlocks(tenant);
};

module.exports = {
  DEFAULT_UNLOCKS,
  evaluateUnlocks,
  getTenantUnlocks,
};
