const { isUnlockAllMode, getTenantUnlocks } = require('../services/tenantUnlockService');

const FEATURE_ROUTE_MAP = {
  resend: ['resend', 'emails'],
  finance: ['finance'],
  knowledgeEngine: ['knowledgeEngine', 'knowledge_engine'],
  artistOs: ['artistOs', 'artists'],
  google: ['google'],
  meta: ['meta'],
  integrations: ['integrations'],
  opsHub: ['opsHub'],
  dataHub: ['dataHub'],
  enterpriseApi: ['enterpriseApi'],
};

const requireFeatureUnlock = (featureKey) => async (req, res, next) => {
  if (isUnlockAllMode()) return next();
  if (!featureKey) return next();

  const tenantId = req.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Organization required', code: 'TENANT_REQUIRED' });
  }

  try {
    const unlocks = await getTenantUnlocks(tenantId);
    if (unlocks[featureKey]) return next();
    return res.status(403).json({
      error: 'Feature not enabled for this organization',
      code: 'FEATURE_LOCKED',
      feature: featureKey,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { requireFeatureUnlock, FEATURE_ROUTE_MAP };
