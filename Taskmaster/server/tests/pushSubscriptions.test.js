const {
  normalizeUserAgentBucket,
  dedupePushSubscriptions,
  prunePushSubscriptions,
  MAX_PUSH_SUBSCRIPTIONS,
} = require('../utils/pushSubscriptions');

describe('pushSubscriptions', () => {
  const sub = (endpoint, userAgent, createdAt) => ({
    endpoint,
    keys: { p256dh: 'a', auth: 'b' },
    userAgent,
    createdAt,
  });

  test('normalizeUserAgentBucket groups OS and browser', () => {
    expect(normalizeUserAgentBucket(
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    )).toBe('windows:chrome');
    expect(normalizeUserAgentBucket(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
    )).toBe('ios:safari');
    expect(normalizeUserAgentBucket(
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
    )).toBe('android:chrome');
  });

  test('dedupePushSubscriptions keeps every unique endpoint in same browser bucket', () => {
    const subs = [
      sub('https://a/1', 'windows chrome old', '2024-01-01'),
      sub('https://a/2', 'windows chrome new', '2024-06-01'),
      sub('https://b/1', 'iphone safari', '2024-05-01'),
    ];
    const kept = dedupePushSubscriptions(subs);
    expect(kept).toHaveLength(3);
    expect(kept.map((s) => s.endpoint)).toEqual(['https://a/2', 'https://b/1', 'https://a/1']);
  });

  test('dedupePushSubscriptions caps at MAX_PUSH_SUBSCRIPTIONS', () => {
    const subs = Array.from({ length: MAX_PUSH_SUBSCRIPTIONS + 3 }, (_, i) =>
      sub(`https://x/${i}`, 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0', `2024-01-${String(i + 1).padStart(2, '0')}`)
    );
    expect(dedupePushSubscriptions(subs)).toHaveLength(MAX_PUSH_SUBSCRIPTIONS);
  });

  test('prunePushSubscriptions replaces same endpoint and dedupes', () => {
    const existing = [
      sub('https://old/1', 'windows chrome', '2024-01-01'),
      sub('https://keep/1', 'mac safari', '2024-01-01'),
    ];
    const incoming = sub('https://old/1', 'windows chrome updated', '2024-06-01');
    const pruned = prunePushSubscriptions(existing, incoming);
    expect(pruned).toHaveLength(2);
    expect(pruned.find((s) => s.endpoint === 'https://old/1').userAgent).toBe('windows chrome updated');
  });

  test('prunePushSubscriptions keeps multiple devices with same user agent bucket', () => {
    const existing = [
      sub('https://desktop/1', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0', '2024-01-01'),
    ];
    const incoming = sub('https://desktop/2', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0', '2024-06-01');
    const pruned = prunePushSubscriptions(existing, incoming);
    expect(pruned.map((s) => s.endpoint)).toEqual(['https://desktop/2', 'https://desktop/1']);
  });
});
