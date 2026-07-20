describe('mailDriver Auto-Mailer bridge', () => {
  const originalEnv = { ...process.env };
  let originalFetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test('requires Auto-Mailer API URL instead of sending directly from CoreKnot', async () => {
    delete process.env.AUTO_MAILER_API_URL;
    process.env.AUTO_MAILER_INTERNAL_TOKEN = 'shared-secret';
    const { dispatchEmailPayload } = require('../services/mailDriver');

    await expect(dispatchEmailPayload({
      to: 'person@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
    })).resolves.toEqual({ error: 'AUTO_MAILER_API_URL is not configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('rejects Auto-Mailer UI URLs before making a send request', async () => {
    process.env.AUTO_MAILER_API_URL = 'https://auto-mailer-blue.vercel.app';
    process.env.AUTO_MAILER_INTERNAL_TOKEN = 'shared-secret';
    const { dispatchEmailPayload } = require('../services/mailDriver');

    await expect(dispatchEmailPayload({
      to: 'person@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
    })).resolves.toEqual({
      error: 'AUTO_MAILER_API_URL must be the Auto-Mailer API origin, not the Vercel UI',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('requires a shared Auto-Mailer bridge token before making a send request', async () => {
    process.env.AUTO_MAILER_API_URL = 'https://mailer-api.example.com';
    delete process.env.AUTO_MAILER_INTERNAL_TOKEN;
    delete process.env.COREKNOT_MAIL_BRIDGE_SECRET;
    const { dispatchEmailPayload } = require('../services/mailDriver');

    await expect(dispatchEmailPayload({
      to: 'person@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
    })).resolves.toEqual({
      error: 'AUTO_MAILER_INTERNAL_TOKEN or COREKNOT_MAIL_BRIDGE_SECRET is not configured',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('rejects oversized transactional recipient lists before bridge forwarding', async () => {
    process.env.AUTO_MAILER_API_URL = 'https://mailer-api.example.com';
    process.env.AUTO_MAILER_INTERNAL_TOKEN = 'shared-secret';
    const { dispatchEmailPayload, limits } = require('../services/mailDriver');

    const recipients = Array.from(
      { length: limits.MAX_TRANSACTIONAL_RECIPIENTS + 1 },
      (_, index) => `person-${index}@example.com`,
    );

    await expect(dispatchEmailPayload({
      to: recipients,
      subject: 'Hello',
      html: '<p>Hello</p>',
    })).resolves.toEqual({
      error: `Transactional email is limited to ${limits.MAX_TRANSACTIONAL_RECIPIENTS} recipients`,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('assertEmailDispatchSucceeded throws on bridge error result', () => {
    const { assertEmailDispatchSucceeded } = require('../services/mailDriver');

    expect(() => assertEmailDispatchSucceeded({
      error: 'AUTO_MAILER_API_URL is not configured',
      status: 503,
    }, 'Invite dispatch failed')).toThrow('Invite dispatch failed: AUTO_MAILER_API_URL is not configured');
    expect(assertEmailDispatchSucceeded({ queued: true, id: 'email_123' })).toEqual({
      queued: true,
      id: 'email_123',
    });
  });

  test('forwards transactional payloads to Auto-Mailer internal send endpoint', async () => {
    process.env.AUTO_MAILER_API_URL = 'https://mailer-api.example.com/';
    process.env.AUTO_MAILER_INTERNAL_TOKEN = 'shared-secret';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ queued: true, provider: 'resend', id: 'email_123' }),
    });

    const { dispatchEmailPayload } = require('../services/mailDriver');
    const result = await dispatchEmailPayload({
      to: ['Person@Example.com', 'person@example.com', 'other@example.com'],
      subject: 'Hello',
      html: '<p>Hello</p>',
      from: 'team@example.com',
      cc: 'copy@example.com',
    });

    expect(result).toEqual({ queued: true, provider: 'resend', id: 'email_123' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mailer-api.example.com/api/transactional/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer shared-secret',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      to: ['person@example.com', 'other@example.com'],
      cc: ['copy@example.com'],
      subject: 'Hello',
      html: '<p>Hello</p>',
      from: 'team@example.com',
      source: 'coreknot',
    });
  });
});
