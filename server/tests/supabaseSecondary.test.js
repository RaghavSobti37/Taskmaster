const { mergeTagMetrics } = require('../services/supabase/mailRollupStore');

describe('supabase secondary store', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('is disabled without credentials', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_DB_URL;
    const { isSupabaseEnabled, isSupabaseConfigured } = require('../config/supabase');
    expect(isSupabaseConfigured()).toBe(false);
    expect(isSupabaseEnabled()).toBe(false);
  });

  it('is enabled when url + service role + flag are set', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    process.env.SUPABASE_SECONDARY_ENABLED = 'true';
    const { isSupabaseEnabled } = require('../config/supabase');
    expect(isSupabaseEnabled()).toBe(true);
  });

  it('mergeTagMetrics combines core and mail campaign rows', () => {
    const merged = mergeTagMetrics(
      [{ _id: 'Launch', totalSent: 10, totalOpens: 4, totalClicks: 2 }],
      [{ _id: 'Launch', totalSent: 5, totalOpens: 1, totalClicks: 1 }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      eventTag: 'Launch',
      totalSent: 15,
      totalOpens: 5,
      totalClicks: 3,
      openRate: 33,
      ctr: 20,
    });
  });
});
