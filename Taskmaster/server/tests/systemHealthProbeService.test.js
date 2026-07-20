jest.mock('mongoose', () => ({
  connection: {
    readyState: 1,
    db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
  },
}));

jest.mock('../services/backgroundQueue', () => ({ isRedisAvailable: jest.fn(() => true) }));
jest.mock('../utils/sharedRedis', () => ({ pingSharedRedis: jest.fn().mockResolvedValue('PONG') }));
jest.mock('../services/supabase/client', () => ({
  pingSupabase: jest.fn().mockResolvedValue({
    ok: true,
    checks: { rest: { ok: true }, storage: { ok: true }, postgres: { ok: true } },
  }),
  closeSupabaseClients: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../config/supabase', () => ({
  isSupabaseConfigured: jest.fn(() => false),
  isSupabaseEnabled: jest.fn(() => false),
}));
jest.mock('../services/queueAdminService', () => ({
  getQueueAdminSnapshot: jest.fn().mockResolvedValue({ queues: [] }),
}));

describe('systemHealthProbeService Auto-Mailer bridge probe', () => {
  const originalEnv = { ...process.env };
  let originalFetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'production', REDIS_URL: 'redis://example.com:6379' };
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test('reports Auto-Mailer bridge status instead of direct provider status', async () => {
    process.env.AUTO_MAILER_API_URL = 'https://mailer-api.example.com';
    process.env.AUTO_MAILER_INTERNAL_TOKEN = 'shared-secret';
    const { getAdminSystemHealth } = require('../services/systemHealthProbeService');

    const report = await getAdminSystemHealth({ forceFullProbes: true, bypassCache: true });
    const mail = report.services.find((service) => service.id === 'auto-mailer');

    expect(mail).toMatchObject({
      label: 'Auto-Mailer Bridge',
      status: 'ok',
      state: 'connected',
      detail: 'https://mailer-api.example.com',
    });
    expect(report.services.some((service) => service.id === 'resend')).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mailer-api.example.com/health',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer shared-secret' },
      }),
    );
  });

  test('flags Auto-Mailer UI origin as invalid for the bridge', async () => {
    process.env.AUTO_MAILER_API_URL = 'https://auto-mailer-blue.vercel.app';
    process.env.AUTO_MAILER_INTERNAL_TOKEN = 'shared-secret';
    const { getAdminSystemHealth } = require('../services/systemHealthProbeService');

    const report = await getAdminSystemHealth({ forceFullProbes: true, bypassCache: true });
    const mail = report.services.find((service) => service.id === 'auto-mailer');

    expect(mail).toMatchObject({
      status: 'degraded',
      state: 'invalid_origin',
      error: 'AUTO_MAILER_API_URL must be the Auto-Mailer API origin, not the Vercel UI',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
