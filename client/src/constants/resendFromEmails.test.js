import { describe, it, expect } from 'vitest';
import { normalizeEmailStreams } from '../constants/resendFromEmails';

describe('normalizeEmailStreams', () => {
  it('maps catalog label to picker name and domain', () => {
    const [main] = normalizeEmailStreams([{
      slug: 'main',
      label: 'Main',
      fromEmails: ['team@theshakticollective.in'],
    }]);
    expect(main.name).toBe('Main');
    expect(main.domain).toBe('theshakticollective.in');
    expect(main.defaultFromEmail).toBe('team@theshakticollective.in');
  });

  it('falls back to default catalog when API returns empty', () => {
    const streams = normalizeEmailStreams([]);
    expect(streams.length).toBeGreaterThanOrEqual(4);
    expect(streams.some((s) => s.slug === 'events')).toBe(true);
  });
});
