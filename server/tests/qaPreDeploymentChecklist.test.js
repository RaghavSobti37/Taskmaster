const { runAllPreDeploymentChecks } = require('../services/qaPreDeploymentChecklist');

describe('qaPreDeploymentChecklist', () => {
  it('runs all categories and returns structured checks', async () => {
    const checks = await runAllPreDeploymentChecks();
    expect(checks.length).toBeGreaterThan(50);
    const suite3 = checks.filter((c) => c.id.startsWith('val-') || c.id.startsWith('san-') || c.id.startsWith('auth-finance') || c.id.startsWith('auth-datahub') || c.id.startsWith('biz-'));
    expect(suite3.some((c) => c.id === 'val-lead-phone-unique')).toBe(true);

    const categories = new Set(checks.map((c) => c.category));
    expect(categories.has('authorization')).toBe(true);
    expect(categories.has('cors')).toBe(true);
    expect(categories.has('rate-limiting')).toBe(true);
    expect(categories.has('business-logic')).toBe(true);
    expect(categories.has('security-hardening')).toBe(true);

    for (const check of checks) {
      expect(check).toMatchObject({
        id: expect.any(String),
        category: expect.any(String),
        title: expect.any(String),
        status: expect.stringMatching(/^(pass|fail|warn|skip)$/),
        detail: expect.any(String),
        severity: expect.any(String),
      });
    }
  });

  it('login rate limit check passes with authLoginLimiter max 10', async () => {
    const checks = await runAllPreDeploymentChecks();
    const loginCheck = checks.find((c) => c.id === 'rate-login-10');
    expect(loginCheck).toBeDefined();
    expect(loginCheck.status).toBe('pass');
  });

  it('CORS wildcard check passes', async () => {
    const checks = await runAllPreDeploymentChecks();
    const corsCheck = checks.find((c) => c.id === 'cors-no-wildcard');
    expect(corsCheck.status).toBe('pass');
  });

  it('security hardening checks include webhook and cookie guards', async () => {
    const checks = await runAllPreDeploymentChecks();
    const ids = [
      'sec-webhook-hmac-module',
      'sec-book-call-webhook-signed',
      'sec-exly-webhook-signed',
      'sec-no-hardcoded-songstats',
      'sec-httponly-auth-cookie',
      'sec-artist-analytics-protected',
      'sec-subscriptions-ops-only',
      'sec-proxy-ops-only',
      'cors-vercel-previews-gated',
    ];
    for (const id of ids) {
      const check = checks.find((c) => c.id === id);
      expect(check).toBeDefined();
      expect(check.status).toBe('pass');
    }
  });
});
