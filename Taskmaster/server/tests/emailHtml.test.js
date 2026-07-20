const { escapeHtml, safeHref, textToHtml } = require('../utils/emailHtml');
const { buildReminderHtml } = require('../services/subscriptionReminderService');
const { buildFailureHtml, buildSuccessHtml, formatOriginalDbSize } = require('../services/backupNotificationService');

describe('emailHtml utilities', () => {
  test('escapes html control characters in text nodes and attributes', () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
  });

  test('converts plain text to escaped html with line breaks', () => {
    expect(textToHtml('hello\n<img src=x>')).toBe('hello<br />&lt;img src=x&gt;');
  });

  test('allows http links and rejects script URLs', () => {
    expect(safeHref('https://coreknot.app/reset?a=1&b=2')).toBe('https://coreknot.app/reset?a=1&amp;b=2');
    expect(safeHref('javascript:alert(1)', 'https://coreknot.app')).toBe('https://coreknot.app');
  });
});

describe('transactional email html builders', () => {
  test('subscription reminders escape stored subscription fields', () => {
    const html = buildReminderHtml({
      name: '<img src=x onerror=alert(1)>',
      amount: 1000,
      dueDate: new Date('2026-07-20T00:00:00.000Z'),
      type: '<b>Annual</b>',
      periodicity: 'Monthly',
      paymentMode: 'UPI',
      notes: '<script>alert(1)</script>',
    }, '<em>Ada</em>');

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;Annual&lt;/b&gt;');
    expect(html).toContain('&lt;em&gt;Ada&lt;/em&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  test('backup notifications escape database names, collection names, and errors', () => {
    const successHtml = buildSuccessHtml({
      success: true,
      date: '<today>',
      sourceTotalSizeBytes: 2048,
      sourceDataSizeBytes: 1024,
      sourceIndexSizeBytes: 1024,
      sourceDatabase: '<prod>',
      backupDatabase: '<backup>',
      collectionCount: 1,
      totalBytes: 512,
      retentionCount: 2,
      collections: [{ collectionName: '<users>', documentCount: '<5>', compressedBytes: 256 }],
    });
    const failureHtml = buildFailureHtml({
      date: '<today>',
      backupDatabase: '<backup>',
      error: '<script>alert(1)</script>',
    });

    expect(formatOriginalDbSize({ sourceTotalSizeBytes: 1, sourceDatabase: '<prod>' })).toContain('&lt;prod&gt;');
    expect(successHtml).toContain('&lt;users&gt;');
    expect(successHtml).toContain('&lt;backup&gt;');
    expect(failureHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(failureHtml).not.toContain('<script>alert(1)</script>');
  });
});
