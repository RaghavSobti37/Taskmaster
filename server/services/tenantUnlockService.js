const Tenant = require('../models/Tenant');

const DEFAULT_UNLOCKS = {
  resend: false,
  google: false,
  meta: false,
  knowledgeEngine: false,
  finance: false,
  artistOs: false,
  integrations: false,
};

const ALL_UNLOCKED = Object.fromEntries(Object.keys(DEFAULT_UNLOCKS).map((k) => [k, true]));

function isBillingConfigured() {
  return Boolean(
    String(process.env.STRIPE_SECRET_KEY || '').trim()
    || String(process.env.STRIPE_WEBHOOK_SECRET || '').trim(),
  );
}

/** ponytail: open all features until Stripe billing is wired (or explicit env override). */
function isUnlockAllMode() {
  const flag = String(process.env.FEATURE_UNLOCK_ALL || '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  if (process.env.NODE_ENV === 'test') return false;
  return !isBillingConfigured();
}

const evaluateUnlocks = async (tenant) => {
  if (isUnlockAllMode()) return { ...ALL_UNLOCKED };
  const base = { ...DEFAULT_UNLOCKS, ...(tenant?.featureUnlocks || {}) };
  const progress = tenant?.onboardingProgress?.completedSteps || [];

  if (progress.includes('first_project')) base.finance = true;
  if (progress.includes('resend_domain')) base.resend = true;
  if (progress.includes('google_connected')) base.google = true;
  if (progress.includes('integrations_connected')) base.integrations = true;

  return base;
};

const getTenantUnlocks = async (tenantId) => {
  if (isUnlockAllMode()) return { ...ALL_UNLOCKED };
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
  if (!tenant) return DEFAULT_UNLOCKS;
  return evaluateUnlocks(tenant);
};

module.exports = {
  DEFAULT_UNLOCKS,
  ALL_UNLOCKED,
  isBillingConfigured,
  isUnlockAllMode,
  evaluateUnlocks,
  getTenantUnlocks,
};
