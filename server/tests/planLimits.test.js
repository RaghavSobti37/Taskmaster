const { getPlanLimits, planAllowsFeature } = require('../../shared/planLimits');

describe('planLimits', () => {
  it('enterprise plan allows SSO', () => {
    expect(planAllowsFeature('enterprise', 'sso')).toBe(true);
  });

  it('free plan blocks audit export', () => {
    expect(planAllowsFeature('free', 'auditExport')).toBe(false);
  });

  it('pro plan includes resend in features', () => {
    expect(getPlanLimits('pro').features).toContain('resend');
  });
});
