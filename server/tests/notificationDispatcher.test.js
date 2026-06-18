jest.mock('../domains/mail/services/mailDriver', () => ({
  dispatchEmailPayload: jest.fn().mockResolvedValue({ id: 'email-1' }),
}));

const { dispatchEmailPayload } = require('../domains/mail/services/mailDriver');
const { sendNotificationEmail } = require('../services/notificationDispatcher');

describe('sendNotificationEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SYSTEM_VERIFIED_FROM_EMAIL = 'noreply@theshakticollective.in';
  });

  test('uses Resend mail driver instead of legacy Gmail transport', async () => {
    const sent = await sendNotificationEmail(
      { email: 'rep@example.com', name: 'Rep' },
      {
        title: 'Follow-up due: Asha',
        message: 'Call Asha at 2 PM.',
        category: 'crm',
        actionUrl: '/followups?highlight=lead-1',
      },
    );

    expect(sent).toBe(true);
    expect(dispatchEmailPayload).toHaveBeenCalledWith(expect.objectContaining({
      to: 'rep@example.com',
      subject: 'Follow-up due: Asha',
      from: 'noreply@theshakticollective.in',
    }));
  });
});
