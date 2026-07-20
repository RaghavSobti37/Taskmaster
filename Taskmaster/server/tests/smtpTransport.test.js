const {
  buildEnvTransporter,
  buildProfileTransporter,
  isValidSmtpHost,
  resolveMailTransport,
  sendViaTransport,
} = require('../utils/smtpTransport');

describe('smtpTransport Auto-Mailer migration guard', () => {
  const originalUrl = process.env.AUTO_MAILER_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.AUTO_MAILER_URL;
    else process.env.AUTO_MAILER_URL = originalUrl;
  });

  test('does not construct CoreKnot SMTP transports', () => {
    expect(buildProfileTransporter({ smtpHost: 'smtp.example.com', smtpUser: 'u', smtpPass: 'p' })).toBeNull();
    expect(buildEnvTransporter()).toBeNull();
  });

  test('returns Auto-Mailer moved contract for transport resolution and send', async () => {
    process.env.AUTO_MAILER_URL = 'https://mailer.example.com';

    await expect(resolveMailTransport({ senderMode: 'system_smtp' })).resolves.toEqual(expect.objectContaining({
      success: false,
      service: 'auto-mailer',
      url: 'https://mailer.example.com/campaigns',
    }));
    await expect(sendViaTransport({})).resolves.toEqual(expect.objectContaining({
      success: false,
      service: 'auto-mailer',
      url: 'https://mailer.example.com/campaigns',
    }));
  });

  test('keeps host validation for legacy profile display checks only', () => {
    expect(isValidSmtpHost('smtp.example.com')).toBe(true);
    expect(isValidSmtpHost('localhost')).toBe(false);
  });
});
