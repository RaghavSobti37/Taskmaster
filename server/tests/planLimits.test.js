const { getPlanLimits, planAllowsFeature, getUpgradeCtaForPlan } = require('../../shared/planLimits.cjs');

describe('planLimits', () => {
  it('names upgrade CTAs per plan tier', () => {
    expect(getUpgradeCtaForPlan('pro')).toBe('Upgrade to Pro');
    expect(getUpgradeCtaForPlan('enterprise')).toBe('Upgrade to Enterprise');
  });

  it('paywalls removed — all features allowed', () => {
    expect(planAllowsFeature('free', 'sso')).toBe(true);
    expect(planAllowsFeature('free', 'auditExport')).toBe(true);
    expect(planAllowsFeature('free', 'finance')).toBe(true);
  });

  it('pro plan includes resend in features', () => {
    expect(getPlanLimits('pro').features).toContain('resend');
  });
});
