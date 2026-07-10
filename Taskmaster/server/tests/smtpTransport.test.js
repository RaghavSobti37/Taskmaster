jest.mock('../services/mailDriver', () => ({
  resend: { emails: { send: jest.fn() } },
}));

const { resolveMailTransport } = require('../utils/smtpTransport');
const { resolveResendFromEmail } = require('../utils/resendFromEmails');

describe('smtpTransport Resend sender resolution', () => {
  const originalFrom = process.env.SYSTEM_VERIFIED_FROM_EMAIL;

  afterEach(() => {
    if (originalFrom === undefined) delete process.env.SYSTEM_VERIFIED_FROM_EMAIL;
    else process.env.SYSTEM_VERIFIED_FROM_EMAIL = originalFrom;
  });

  it('does not use unverified profile domains for system Resend', async () => {
    delete process.env.SYSTEM_VERIFIED_FROM_EMAIL;

    const transport = await resolveMailTransport({
      senderMode: 'system_resend',
      profile: { name: 'Team', email: 'team@team.theshakticollective.in' },
    });

    expect(transport.fromEmail).toBe('team@theshakticollective.in');
  });

  it('falls back to a verified production sender when env is missing or invalid', () => {
    delete process.env.SYSTEM_VERIFIED_FROM_EMAIL;

    expect(resolveResendFromEmail({ resendFromEmail: 'bad@example.com' }))
      .toBe('team@theshakticollective.in');
  });
});
