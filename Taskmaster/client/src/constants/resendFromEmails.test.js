import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EMAIL_STREAMS,
  isVerifiedResendEmail,
  normalizeEmailStreams,
} from '../constants/resendFromEmails';

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

  it('keeps default senders on Auto-Mailer verified sender domains only', () => {
    const senders = DEFAULT_EMAIL_STREAMS.flatMap((stream) => stream.fromEmails || []);

    expect(senders.length).toBeGreaterThan(0);
    expect(senders.every(isVerifiedResendEmail)).toBe(true);
    expect(isVerifiedResendEmail('team@team.theshakticollective.in')).toBe(false);
  });
});
