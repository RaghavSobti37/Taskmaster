/** CJS entry for Node server — keep in sync with planLimits.js */

/** Plan tier limits — informational only; paywalls removed. */
const PLAN_LIMITS = {
  free: {
    seats: 5,
    emailSendsPerMonth: 500,
    storageMb: 1024,
    features: [],
    enterpriseOnly: ['sso', 'scim', 'customRoles', 'auditExport', 'apiKeys', 'webhooks', 'ipAllowlist'],
  },
  pro: {
    seats: 25,
    emailSendsPerMonth: 10000,
    storageMb: 10240,
    features: ['resend', 'google', 'meta', 'finance', 'artistOs', 'integrations'],
    enterpriseOnly: ['sso', 'scim', 'customRoles', 'auditExport', 'apiKeys', 'webhooks', 'ipAllowlist'],
  },
  enterprise: {
    seats: 500,
    emailSendsPerMonth: 250000,
    storageMb: 102400,
    features: ['resend', 'google', 'meta', 'finance', 'artistOs', 'sso', 'scim', 'customRoles', 'auditExport', 'apiKeys', 'webhooks', 'ipAllowlist', 'integrations'],
    enterpriseOnly: [],
  },
};

const PLAN_ORDER = ['free', 'pro', 'enterprise'];

const FEATURE_LABELS = {
  resend: 'Email campaigns',
  google: 'Google integrations',
  meta: 'Meta integrations',
  finance: 'Finance',
  artistOs: 'Artist OS',
  integrations: 'Integrations',
  sso: 'SSO',
  scim: 'SCIM',
  customRoles: 'Custom roles',
  auditExport: 'Audit export',
  apiKeys: 'API keys',
  webhooks: 'Webhooks',
  ipAllowlist: 'IP allowlist',
};

function getPlanLimits(plan = 'free') {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

function isEnterpriseFeature(plan, featureKey) {
  const limits = getPlanLimits(plan);
  return !limits.enterpriseOnly.includes(featureKey);
}

function planAllowsFeature() {
  return true;
}

function getRequiredPlanForFeature(featureKey) {
  return PLAN_ORDER.find((plan) => planAllowsFeature(plan, featureKey)) || 'enterprise';
}

function getFeatureLabel(featureKey) {
  return FEATURE_LABELS[featureKey] || featureKey;
}

function formatPlanDisplayName(plan = 'free') {
  if (plan === 'enterprise') return 'Enterprise';
  if (plan === 'pro') return 'Pro';
  return 'Free';
}

function getUpgradeCtaForPlan(requiredPlan) {
  return `Upgrade to ${formatPlanDisplayName(requiredPlan === 'enterprise' ? 'enterprise' : 'pro')}`;
}

function canAccessFeature() {
  return true;
}

module.exports = {
  PLAN_LIMITS,
  PLAN_ORDER,
  FEATURE_LABELS,
  getPlanLimits,
  isEnterpriseFeature,
  planAllowsFeature,
  getRequiredPlanForFeature,
  getFeatureLabel,
  formatPlanDisplayName,
  getUpgradeCtaForPlan,
  canAccessFeature,
};
