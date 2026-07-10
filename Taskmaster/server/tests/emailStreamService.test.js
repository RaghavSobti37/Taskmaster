const { validateFromEmailForStream } = require('../services/emailStreamService');

describe('emailStreamService', () => {
  it('rejects from-addresses outside verified Resend domains', async () => {
    const result = await validateFromEmailForStream('team@team.theshakticollective.in', 'team');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/verified Resend domain/i);
  });

  it('accepts catalog senders for their stream', async () => {
    const result = await validateFromEmailForStream('team@theshakticollective.in', 'team');

    expect(result.ok).toBe(true);
    expect(result.streamSlug).toBe('team');
  });
});
