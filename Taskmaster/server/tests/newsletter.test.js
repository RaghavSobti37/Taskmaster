const {
  compileNewsletterHtml,
  createNewsletterMovedError,
  resolveAutoMailerNewsletterUrl,
} = require('../services/newsletterCompileService');
const { getCurrentWeekKey, getWeekBounds, parseWeekKey } = require('../utils/newsletterWeek');
const { previewLink, normalizeUrl } = require('../services/newsletterLinkPreviewService');

describe('newsletterWeek', () => {
  it('formats ISO week keys', () => {
    const key = getCurrentWeekKey(new Date('2026-06-06T12:00:00Z'));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
    const bounds = getWeekBounds(key);
    expect(bounds.weekStart).toBeInstanceOf(Date);
    expect(bounds.weekEnd.getTime()).toBeGreaterThan(bounds.weekStart.getTime());
    expect(parseWeekKey(key)).toEqual(expect.objectContaining({ year: expect.any(Number), week: expect.any(Number) }));
  });
});

describe('newsletterCompileService', () => {
  it('blocks newsletter composition in CoreKnot and points to Auto-Mailer', () => {
    expect(() => compileNewsletterHtml({ issue: {}, articles: [] })).toThrow('Newsletter email composition moved to Auto-Mailer');

    const err = createNewsletterMovedError();
    expect(err).toMatchObject({
      status: 410,
      service: 'auto-mailer',
      url: 'https://auto-mailer-blue.vercel.app/campaigns',
    });
    expect(resolveAutoMailerNewsletterUrl()).toBe('https://auto-mailer-blue.vercel.app/campaigns');
  });
});

describe('newsletterLinkPreviewService', () => {
  it('normalizes bare domains to https URLs', () => {
    const url = normalizeUrl('example.com/path');
    expect(url.href).toBe('https://example.com/path');
  });

  it('returns failed preview for invalid URLs without throwing', async () => {
    const result = await previewLink('not-a-url');
    expect(result.fetchStatus).toBe('failed');
  });
});
