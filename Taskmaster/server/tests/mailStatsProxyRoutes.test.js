const {
  resolveAutoMailerApiBase,
  normalizeMailStatsPayload,
} = require('../routes/mailStatsProxyRoutes');

describe('mailStatsProxyRoutes helpers', () => {
  const originalApi = process.env.AUTO_MAILER_API_URL;

  afterEach(() => {
    if (originalApi === undefined) delete process.env.AUTO_MAILER_API_URL;
    else process.env.AUTO_MAILER_API_URL = originalApi;
  });

  test('requires AUTO_MAILER_API_URL', () => {
    delete process.env.AUTO_MAILER_API_URL;
    expect(() => resolveAutoMailerApiBase()).toThrow(/AUTO_MAILER_API_URL is not configured/);
  });

  test('rejects Vercel UI hosts', () => {
    process.env.AUTO_MAILER_API_URL = 'https://auto-mailer-blue.vercel.app';
    expect(() => resolveAutoMailerApiBase()).toThrow(/API origin/);
  });

  test('accepts explicit API origin and strips trailing slash', () => {
    process.env.AUTO_MAILER_API_URL = 'https://YOUR-AUTO-MAILER-API.onrender.com/';
    expect(resolveAutoMailerApiBase()).toBe('https://YOUR-AUTO-MAILER-API.onrender.com');
  });

  test('normalizes totalClicked / totalClicks aliases for dashboard widgets', () => {
    expect(normalizeMailStatsPayload({
      totalCampaigns: 2,
      totalSent: 10,
      totalOpened: 4,
      totalClicked: 3,
      totalBounced: 1,
    })).toEqual(expect.objectContaining({
      totalClicked: 3,
      totalClicks: 3,
      source: 'auto-mailer',
    }));

    expect(normalizeMailStatsPayload({ totalClicks: 9 }).totalClicked).toBe(9);
  });
});
