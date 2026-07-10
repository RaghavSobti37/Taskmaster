const {
  resolveSafeTrackedRedirectUrl,
  escapeHtmlAttr,
} = require('../routes/track').__private;

describe('email tracking click redirect safety', () => {
  test('keeps normal https campaign links intact', () => {
    expect(resolveSafeTrackedRedirectUrl(
      encodeURIComponent('https://example.com/path?utm=email'),
      'https://app.coreknot.test',
    )).toBe('https://example.com/path?utm=email');
  });

  test('resolves relative links against the configured frontend', () => {
    expect(resolveSafeTrackedRedirectUrl('/artist-os', 'https://app.coreknot.test'))
      .toBe('https://app.coreknot.test/artist-os');
  });

  test('rejects javascript redirects back to the frontend', () => {
    expect(resolveSafeTrackedRedirectUrl(
      encodeURIComponent('javascript:alert(document.domain)'),
      'https://app.coreknot.test',
    )).toBe('https://app.coreknot.test/');
  });

  test('escapes redirect URLs before inserting into HTML attributes', () => {
    expect(escapeHtmlAttr('https://example.com/?q="><script>alert(1)</script>'))
      .toBe('https://example.com/?q=&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
