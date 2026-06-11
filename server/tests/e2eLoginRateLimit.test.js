const { isE2eTestUser } = require('../utils/e2eTestUsers');

/** Mirrors authLoginLimiter.skip in domains/auth/routes.js */
function shouldSkipLoginRateLimit(isProduction, email) {
  return !isProduction && isE2eTestUser(email);
}

describe('E2E login rate-limit skip (dev-only)', () => {
  it('matches only e2e-*@test.coreknot.local seeded users', () => {
    expect(isE2eTestUser('e2e-dept-admin@test.coreknot.local')).toBe(true);
    expect(isE2eTestUser('e2e-pw-gate@test.coreknot.local')).toBe(true);
    expect(isE2eTestUser('admin@test.coreknot.local')).toBe(false);
    expect(isE2eTestUser('e2e-dept-admin@theshakticollective.in')).toBe(false);
    expect(isE2eTestUser('')).toBe(false);
  });

  it('never skips in production', () => {
    expect(shouldSkipLoginRateLimit(true, 'e2e-dept-admin@test.coreknot.local')).toBe(false);
    expect(shouldSkipLoginRateLimit(true, 'test@example.com')).toBe(false);
  });

  it('skips only seeded e2e users in non-production', () => {
    expect(shouldSkipLoginRateLimit(false, 'e2e-dept-admin@test.coreknot.local')).toBe(true);
    expect(shouldSkipLoginRateLimit(false, 'test@example.com')).toBe(false);
  });
});
