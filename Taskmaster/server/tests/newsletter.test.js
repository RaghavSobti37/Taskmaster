const { compileNewsletterHtml } = require('../services/newsletterCompileService');
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
  it('renders grouped article cards with placeholders', () => {
    const html = compileNewsletterHtml({
      issue: {
        weekKey: '2026-W23',
        introTitle: 'Weekly picks',
        introBlurb: 'Curated by the team.',
      },
      articles: [
        {
          category: 'industry',
          title: 'Story A',
          description: 'Desc A',
          url: 'https://example.com/a',
          siteName: 'Example',
        },
        {
          category: 'tsc',
          title: 'Story B',
          description: 'Desc B',
          url: 'https://example.com/b',
          imageUrl: 'https://example.com/a.jpg',
        },
      ],
    });

    expect(html).toContain('SHAKTI DIGEST');
    expect(html).toContain('Story A');
    expect(html).toContain('Story B');
    expect(html).toContain('{{name}}');
    expect(html).toContain('{{unsubscribe_url}}');
    expect(html).toContain('Read article');
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
