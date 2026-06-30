jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

jest.mock('../models/User', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

const webpush = require('web-push');
const User = require('../models/User');
const { configureWebPush, broadcastTestPush } = require('../services/pushNotificationService');

describe('broadcastTestPush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'BPublicKey';
    process.env.VAPID_PRIVATE_KEY = 'privateKey';
    process.env.VAPID_SUBJECT = 'mailto:test@coreknot.app';
    configureWebPush();
  });

  test('returns disabled when VAPID missing', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const result = await broadcastTestPush();

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/VAPID/i);
    expect(User.find).not.toHaveBeenCalled();
  });

  test('sends test payload to every subscribed user device', async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'user-1',
            pushSubscriptions: [
              {
                endpoint: 'https://push.example/1',
                keys: { p256dh: 'k1', auth: 'a1' },
                userAgent: 'windows chrome',
              },
            ],
          },
          {
            _id: 'user-2',
            pushSubscriptions: [
              {
                endpoint: 'https://push.example/2',
                keys: { p256dh: 'k2', auth: 'a2' },
                userAgent: 'iphone safari',
              },
            ],
          },
        ]),
      }),
    });

    User.findById.mockImplementation(async (id) => {
      const rows = {
        'user-1': {
          pushSubscriptions: [
            {
              endpoint: 'https://push.example/1',
              keys: { p256dh: 'k1', auth: 'a1' },
              userAgent: 'windows chrome',
            },
          ],
          save: jest.fn(),
        },
        'user-2': {
          pushSubscriptions: [
            {
              endpoint: 'https://push.example/2',
              keys: { p256dh: 'k2', auth: 'a2' },
              userAgent: 'iphone safari',
            },
          ],
          save: jest.fn(),
        },
      };
      return rows[id];
    });

    webpush.sendNotification.mockResolvedValue(undefined);

    const result = await broadcastTestPush({ body: 'Hello devices' });

    expect(result.ok).toBe(true);
    expect(result.users).toBe(2);
    expect(result.devices).toBe(2);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/1' }),
      expect.stringContaining('Hello devices'),
    );
  });
});
