const {
  DEFAULT_EMAIL_STREAMS,
  RESEND_VERIFIED_DOMAINS,
  isVerifiedResendEmail,
} = require('../../shared/emailStreams.cjs');

describe('Auto-Mailer from-address catalog compatibility', () => {
  it('keeps every default sender on an Auto-Mailer verified sender domain', () => {
    const verified = new Set(RESEND_VERIFIED_DOMAINS);
    const senders = DEFAULT_EMAIL_STREAMS.flatMap((stream) => stream.fromEmails || []);

    expect(senders.length).toBeGreaterThan(0);
    for (const sender of senders) {
      const domain = sender.split('@')[1];
      expect(verified.has(domain)).toBe(true);
      expect(isVerifiedResendEmail(sender)).toBe(true);
    }
  });

  it('rejects unverified TSC subdomains that production sending will refuse', () => {
    expect(isVerifiedResendEmail('team@team.theshakticollective.in')).toBe(false);
    expect(isVerifiedResendEmail('artist@artist.theshakticollective.in')).toBe(false);
    expect(isVerifiedResendEmail('hello@events.theshakticollective.in')).toBe(false);
  });
});
