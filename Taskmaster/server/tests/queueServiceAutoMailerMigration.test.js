describe('queueService Auto-Mailer migration', () => {
  const originalUrl = process.env.AUTO_MAILER_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.AUTO_MAILER_URL;
    else process.env.AUTO_MAILER_URL = originalUrl;
    jest.resetModules();
  });

  test('dispatchCampaignJobs never starts CoreKnot campaign sending', async () => {
    process.env.AUTO_MAILER_URL = 'https://mailer.example.com';
    const { dispatchCampaignJobs } = require('../services/queueService');

    await expect(dispatchCampaignJobs('campaign-1')).resolves.toEqual(expect.objectContaining({
      success: false,
      queuedCount: 0,
      service: 'auto-mailer',
      url: 'https://mailer.example.com/campaigns',
      message: 'Campaign email dispatch moved to Auto-Mailer',
    }));
  });

  test('startup resume does not revive stuck campaign sends in CoreKnot', async () => {
    const { resumeStuckCampaigns } = require('../services/queueService');

    await expect(resumeStuckCampaigns()).resolves.toEqual({
      resumed: 0,
      rateLimitRecovered: 0,
      service: 'auto-mailer',
    });
  });

  test('legacy domain mail service does not send campaigns or test messages', async () => {
    process.env.AUTO_MAILER_URL = 'https://mailer.example.com';
    const { sendCampaign, sendTestEmail } = require('../domains/mail/services/mailService');

    await expect(sendCampaign('campaign-1')).resolves.toEqual(expect.objectContaining({
      success: false,
      service: 'auto-mailer',
      url: 'https://mailer.example.com/campaigns',
    }));
    await expect(sendTestEmail({
      to: 'person@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })).resolves.toEqual(expect.objectContaining({
      success: false,
      service: 'auto-mailer',
      url: 'https://mailer.example.com/campaigns',
    }));
  });

  test('legacy email processor refuses direct campaign jobs', async () => {
    const { processEmailJob } = require('../domains/mail/services/emailProcessor');

    await expect(processEmailJob({ campaignId: 'campaign-1', recipientId: 'recipient-1' }))
      .resolves.toEqual(expect.objectContaining({
        success: false,
        service: 'auto-mailer',
        message: 'Campaign email processing moved to Auto-Mailer',
      }));
  });
});
