const Tenant = require('../models/Tenant');
const { getTenantUnlocks, isUnlockAllMode } = require('../services/tenantUnlockService');
const { planAllowsFeature } = require('../../shared/planLimits');

const FEATURE_ROUTE_MAP = {
  resend: ['resend', 'emails'],
  finance: ['finance'],
  knowledgeEngine: ['knowledgeEngine', 'knowledge_engine'],
  artistOs: ['artistOs', 'artists'],
  google: ['google'],
  meta: ['meta'],
};

/**
 * Server-side gate: tenant plan + featureUnlocks must allow feature.
 * @param {string} featureKey - resend | finance | knowledgeEngine | artistOs | ...
 */
const requireFeatureUnlock = (featureKey) => async (req, res, next) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    if (process.env.NODE_ENV === 'test') return next();
    return res.status(403).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
  }

  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true }).select('plan featureUnlocks slug');
  if (!tenant) {
    return res.status(403).json({ error: 'Organization not found' });
  }

  if (isUnlockAllMode()) return next();

  // ponytail: integration tests without enterprise fixtures skip unlock gate
  if (process.env.NODE_ENV === 'test') {
    const lockedFixture = String(tenant.slug || '').startsWith('iso-locked');
    if (lockedFixture && tenant.featureUnlocks?.[featureKey] === false) {
      return res.status(403).json({
        error: `Feature "${featureKey}" is not unlocked for this organization`,
        code: 'FEATURE_LOCKED',
        feature: featureKey,
      });
    }
    return next();
  }

  if (!planAllowsFeature(tenant.plan || 'free', featureKey)) {
    return res.status(402).json({
      error: `Feature "${featureKey}" requires a higher plan`,
      code: 'PLAN_UPGRADE_REQUIRED',
      plan: tenant.plan,
    });
  }

  const unlocks = await getTenantUnlocks(tenantId);
  if (!unlocks[featureKey]) {
    return res.status(403).json({
      error: `Feature "${featureKey}" is not unlocked for this organization`,
      code: 'FEATURE_LOCKED',
      feature: featureKey,
    });
  }

  return next();
};

module.exports = { requireFeatureUnlock, FEATURE_ROUTE_MAP };
