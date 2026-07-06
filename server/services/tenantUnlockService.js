const Tenant = require('../models/Tenant');
const { getPlanLimits } = require('../../shared/planLimits.cjs');

const DEFAULT_UNLOCKS = {
  resend: true,
  google: true,
  meta: true,
  knowledgeEngine: true,
  finance: true,
  artistOs: true,
  integrations: true,
};

const ALL_UNLOCKED = { ...DEFAULT_UNLOCKS };

function isBillingConfigured() {
  return false;
}

function isUnlockAllMode() {
  return true;
}

const evaluateUnlocks = async () => ({ ...ALL_UNLOCKED });

function buildFeatureLocks() {
  return {};
}

async function getTenantUnlockState(tenantId) {
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
  const plan = tenant?.plan || 'free';
  return {
    plan,
    limits: getPlanLimits(plan),
    unlocks: { ...ALL_UNLOCKED },
    locks: {},
  };
}

const getTenantUnlocks = async () => ({ ...ALL_UNLOCKED });

module.exports = {
  DEFAULT_UNLOCKS,
  ALL_UNLOCKED,
  isBillingConfigured,
  isUnlockAllMode,
  evaluateUnlocks,
  buildFeatureLocks,
  getTenantUnlockState,
  getTenantUnlocks,
};
