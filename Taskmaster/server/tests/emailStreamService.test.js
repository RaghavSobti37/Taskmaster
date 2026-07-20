const { validateFromEmailForStream } = require('../services/emailStreamService');

describe('emailStreamService', () => {
  it('rejects from-addresses outside Auto-Mailer verified sender domains', async () => {
    const result = await validateFromEmailForStream('team@team.theshakticollective.in', 'team');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Auto-Mailer verified sender domain/i);
  });

  it('accepts catalog senders for their stream', async () => {
    const result = await validateFromEmailForStream('team@theshakticollective.in', 'team');

    expect(result.ok).toBe(true);
    expect(result.streamSlug).toBe('team');
  });
});
