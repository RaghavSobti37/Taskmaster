/**
 * Deployment tier — separates strict production from staging/preview hosts.
 * Set COREKNOT_DEPLOY_TIER=production|staging|development, or infer from RENDER_SERVICE_NAME.
 */

const VALID_TIERS = new Set(['production', 'staging', 'development']);

function inferTierFromRenderService() {
  const name = String(process.env.RENDER_SERVICE_NAME || '').toLowerCase();
  if (!name) return null;
  if (name.includes('staging')) return 'staging';
  if (name.includes('coreknot') || name.includes('taskmaster')) return 'production';
  return null;
}

function getDeployTier() {
  const explicit = String(process.env.COREKNOT_DEPLOY_TIER || '').trim().toLowerCase();
  if (VALID_TIERS.has(explicit)) return explicit;

  const inferred = inferTierFromRenderService();
  if (inferred) return inferred;

  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
}

function isStrictProduction() {
  return getDeployTier() === 'production';
}

function isStagingDeploy() {
  return getDeployTier() === 'staging';
}

/** Mail templates need large HTML payloads on hosted tiers; keep local dev smaller. */
function getDefaultJsonBodyLimit() {
  return getDeployTier() === 'development' ? '10mb' : '50mb';
}

module.exports = {
  getDeployTier,
  isStrictProduction,
  isStagingDeploy,
  getDefaultJsonBodyLimit,
};
