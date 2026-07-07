const Tenant = require('../models/Tenant');
const { getPlanLimits, getFeatureLabel } = require('../../shared/planLimits.cjs');
const {
  ORG_FEATURE_KEYS,
  defaultFeatureUnlocks,
} = require('../../shared/orgFeatures.cjs');

const ALL_UNLOCKED = Object.fromEntries(ORG_FEATURE_KEYS.map((key) => [key, true]));

function isUnlockAllMode() {
  return process.env.FEATURE_UNLOCK_ALL === 'true';
}

function isBillingConfigured() {
  return false;
}

function readUnlocksFromTenant(tenant) {
  const base = defaultFeatureUnlocks();
  if (!tenant?.featureUnlocks) return base;
  for (const key of ORG_FEATURE_KEYS) {
    if (tenant.featureUnlocks[key] !== undefined) {
      base[key] = Boolean(tenant.featureUnlocks[key]);
    }
  }
  return base;
}

const evaluateUnlocks = async (tenantId) => {
  if (isUnlockAllMode()) return { ...ALL_UNLOCKED };
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
  return readUnlocksFromTenant(tenant);
};

function buildFeatureLocks(unlocks) {
  if (isUnlockAllMode()) return {};
  const locks = {};
  for (const key of ORG_FEATURE_KEYS) {
    if (!unlocks[key]) {
      locks[key] = {
        featureKey: key,
        label: getFeatureLabel(key),
        reason: 'disabled',
        message: `${getFeatureLabel(key)} is not enabled for this organization.`,
      };
    }
  }
  return locks;
}

async function getTenantUnlocks(tenantId) {
  return evaluateUnlocks(tenantId);
}

async function getTenantUnlockState(tenantId) {
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
  const plan = tenant?.plan || 'free';
  const unlocks = await evaluateUnlocks(tenantId);
  return {
    plan,
    limits: getPlanLimits(plan),
    unlocks,
    locks: buildFeatureLocks(unlocks),
  };
}

module.exports = {
  DEFAULT_UNLOCKS: defaultFeatureUnlocks(),
  ALL_UNLOCKED,
  isBillingConfigured,
  isUnlockAllMode,
  evaluateUnlocks,
  buildFeatureLocks,
  getTenantUnlockState,
  getTenantUnlocks,
  readUnlocksFromTenant,
};
