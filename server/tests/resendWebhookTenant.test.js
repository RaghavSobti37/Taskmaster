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

  it('defers PersonHub tag sync inside resolved tenant context', async () => {
    jest.resetModules();

    const setOptions = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const updateMany = jest.fn(() => ({ setOptions }));
    const updateEmailTags = jest.fn().mockResolvedValue();
    const runWithWorkerTenant = jest.fn((_tenantId, fn) => fn());
    let scheduled;
    const originalSetImmediate = global.setImmediate;
    global.setImmediate = jest.fn((fn) => {
      scheduled = fn;
      return 1;
    });

    jest.doMock('../models/Lead', () => ({ updateMany }));
    jest.doMock('../services/mailService', () => ({ updateEmailTags }));
    jest.doMock('../utils/workerTenantContext', () => ({ runWithWorkerTenant }));

    try {
      const handler = require('../domains/mail/webhooks/resendWebhookHandler');
      await handler.__private.safeUpdateEmailTags('User@Example.com', 'Active', 'Active', 'tenant-123');

      expect(updateMany).toHaveBeenCalledWith(
        { email: 'User@Example.com' },
        expect.objectContaining({
          $set: expect.objectContaining({ 'metadata.lastEmailAction': 'Active' }),
          $addToSet: { tags: 'Active' },
        }),
      );
      expect(updateEmailTags).not.toHaveBeenCalled();
      expect(global.setImmediate).toHaveBeenCalledTimes(1);

      await scheduled();

      expect(runWithWorkerTenant).toHaveBeenCalledWith('tenant-123', expect.any(Function));
      expect(updateEmailTags).toHaveBeenCalledWith('User@Example.com', 'Active', 'Active');
    } finally {
      global.setImmediate = originalSetImmediate;
      jest.dontMock('../models/Lead');
      jest.dontMock('../services/mailService');
      jest.dontMock('../utils/workerTenantContext');
    }
  });

  it('does not infer reader location from Gmail image proxy opens', async () => {
    const { __private } = require('../domains/mail/webhooks/resendWebhookHandler');
    const result = await __private.resolveResendEngagementGeo({
      data: {
        open: {
          ipAddress: '66.249.84.1',
          userAgent: 'Mozilla/5.0 GoogleImageProxy',
        },
      },
    }, 'email.opened');

    expect(result.ip).toBe('66.249.84.1');
    expect(result.userAgent).toContain('GoogleImageProxy');
    expect(result.locationObj).toBeNull();
  });

  it('does not geolocate security scanner clicks as recipient clicks', async () => {
    const { __private } = require('../domains/mail/webhooks/resendWebhookHandler');
    const result = await __private.resolveResendEngagementGeo({
      data: {
        click: {
          ip_address: '203.0.113.10',
          user_agent: 'Proofpoint URL Defense',
          link: 'https://example.com',
        },
      },
    }, 'email.clicked');

    expect(result.ip).toBe('203.0.113.10');
    expect(result.url).toBe('https://example.com');
    expect(result.locationObj).toBeNull();
  });

  it('does not write a second webhook response after Express has sent one', () => {
    const { __private } = require('../domains/mail/webhooks/resendWebhookHandler');
    const send = jest.fn();
    const status = jest.fn(() => ({ send }));

    expect(__private.sendWebhookResponse({ headersSent: true, writableEnded: false, status }, 500, 'Server Error'))
      .toBe(false);
    expect(status).not.toHaveBeenCalled();

    expect(__private.sendWebhookResponse({ headersSent: false, writableEnded: true, status }, 500, 'Server Error'))
      .toBe(false);
    expect(status).not.toHaveBeenCalled();
  });
});
