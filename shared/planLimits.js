/** Plan tier limits — enforce server-side, not nav-only. */
const PLAN_LIMITS = {
  free: {
    seats: 5,
    emailSendsPerMonth: 500,
    storageMb: 1024,
    features: ['finance', 'artistOs', 'integrations'],
    enterpriseOnly: ['sso', 'scim', 'customRoles', 'auditExport', 'apiKeys', 'webhooks', 'ipAllowlist'],
  },
  pro: {
    seats: 25,
    emailSendsPerMonth: 10000,
    storageMb: 10240,
    features: ['resend', 'google', 'meta', 'knowledgeEngine', 'finance', 'artistOs', 'integrations'],
    enterpriseOnly: ['sso', 'scim', 'customRoles', 'auditExport', 'apiKeys', 'webhooks', 'ipAllowlist'],
  },
  enterprise: {
    seats: 500,
    emailSendsPerMonth: 250000,
    storageMb: 102400,
    features: ['resend', 'google', 'meta', 'knowledgeEngine', 'finance', 'artistOs', 'sso', 'scim', 'customRoles', 'auditExport', 'apiKeys', 'webhooks', 'ipAllowlist', 'integrations'],
    enterpriseOnly: [],
  },
};

function getPlanLimits(plan = 'free') {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

function isEnterpriseFeature(plan, featureKey) {
  const limits = getPlanLimits(plan);
  return !limits.enterpriseOnly.includes(featureKey);
}

function planAllowsFeature(plan, featureKey) {
  const limits = getPlanLimits(plan);
  if (limits.features.includes(featureKey)) return true;
  return limits.enterpriseOnly.includes(featureKey) && plan === 'enterprise';
}

module.exports = {
  PLAN_LIMITS,
  getPlanLimits,
  isEnterpriseFeature,
  planAllowsFeature,
};
