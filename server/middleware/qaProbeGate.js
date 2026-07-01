const { optionalAuthenticate } = require('./authMiddleware');
const { isOpsUser } = require('../utils/departmentPermissions');
const { qaProbeStorage } = require('../utils/qaProbeContext');
const { isStrictProduction } = require('../utils/deployTier');

/**
 * x-qa-integration-probe toggles QA gamification sync.
 * Dev + staging: open. Strict production: ops/admin only when QA_INTEGRATION_PROBE_ENABLED=true.
 */
function qaProbeGate(req, res, next) {
  if (req.headers['x-qa-integration-probe'] !== 'true') return next();

  if (!isStrictProduction()) {
    return qaProbeStorage.run({ syncGamification: true }, next);
  }

  if (process.env.QA_INTEGRATION_PROBE_ENABLED !== 'true') return next();

  return optionalAuthenticate(req, res, () => {
    if (!req.user || !isOpsUser(req.user)) return next();
    return qaProbeStorage.run({ syncGamification: true }, next);
  });
}

module.exports = { qaProbeGate };
