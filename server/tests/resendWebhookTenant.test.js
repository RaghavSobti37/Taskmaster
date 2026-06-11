/**
 * Resend webhook tenant resolution — no DB; validates bypass + fallback contract.
 */
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

describe('Resend webhook tenant helpers', () => {
  it('uses RESEND_WEBHOOK bypass reason', () => {
    expect(bypassOptions('RESEND_WEBHOOK')).toEqual({
      bypassTenant: true,
      _bypassReason: 'RESEND_WEBHOOK',
    });
  });

  it('allows resendWebhookHandler in service bypass allowlist', () => {
    const { isServiceBypassAllowed } = require('../infrastructure/database/bypassTenantPolicy');
    expect(isServiceBypassAllowed('resendWebhookHandler.js')).toBe(true);
  });
});
