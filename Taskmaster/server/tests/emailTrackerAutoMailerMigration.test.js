const { injectOpenPixel, prepareCampaignHTML } = require('../utils/emailTracker');

describe('emailTracker Auto-Mailer migration guard', () => {
  const originalUrl = process.env.AUTO_MAILER_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.AUTO_MAILER_URL;
    else process.env.AUTO_MAILER_URL = originalUrl;
  });

  test('does not inject CoreKnot open pixels or click tracking links', async () => {
    process.env.AUTO_MAILER_URL = 'https://mailer.example.com';
    const html = '<a href="https://example.com">Read</a>';

    await expect(prepareCampaignHTML(html, 'campaign-1', 'person@example.com')).resolves.toEqual({
      processedHtml: html,
      pixelId: null,
      clickId: null,
      moved: true,
      service: 'auto-mailer',
      url: 'https://mailer.example.com/analytics',
      message: 'Campaign tracking moved to Auto-Mailer',
    });
  });

  test('open pixel helper is a no-op compatibility shim', () => {
    expect(injectOpenPixel('<body>Hello</body>', '<img src="/api/track/open/x.gif" />')).toBe('<body>Hello</body>');
  });
});
