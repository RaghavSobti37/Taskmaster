jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

const webpush = require('web-push');
const User = require('../models/User');
const { configureWebPush, sendPushToUser } = require('../services/pushNotificationService');

describe('pushNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'BPublicKey';
    process.env.VAPID_PRIVATE_KEY = 'privateKey';
    process.env.VAPID_SUBJECT = 'mailto:test@coreknot.app';
    configureWebPush();
  });

  test('sendPushToUser sends to deduped subscriptions', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    User.findById.mockResolvedValue({
      pushSubscriptions: [
        {
          endpoint: 'https://push.example/1',
          keys: { p256dh: 'k1', auth: 'a1' },
          userAgent: 'windows chrome',
          createdAt: new Date('2024-06-01'),
        },
        {
          endpoint: 'https://push.example/2',
          keys: { p256dh: 'k2', auth: 'a2' },
          userAgent: 'iphone safari',
          createdAt: new Date('2024-06-02'),
        },
      ],
      save,
    });
    webpush.sendNotification.mockResolvedValue(undefined);

    await sendPushToUser('user-1', { title: 'Hi', body: 'Test' });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();
  });

  test('sendPushToUser prunes dead subscriptions on 410', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      pushSubscriptions: [
        {
          endpoint: 'https://push.example/dead',
          keys: { p256dh: 'k1', auth: 'a1' },
          userAgent: 'windows chrome',
        },
        {
          endpoint: 'https://push.example/live',
          keys: { p256dh: 'k2', auth: 'a2' },
          userAgent: 'mac safari',
        },
      ],
      save,
    };
    User.findById.mockResolvedValue(user);

    webpush.sendNotification.mockImplementation((sub) => {
      if (sub.endpoint === 'https://push.example/dead') {
        const err = new Error('gone');
        err.statusCode = 410;
        return Promise.reject(err);
      }
      return Promise.resolve();
    });

    await sendPushToUser('user-1', { title: 'Hi', body: 'Test' });

    expect(save).toHaveBeenCalledTimes(1);
    expect(user.pushSubscriptions).toHaveLength(1);
    expect(user.pushSubscriptions[0].endpoint).toBe('https://push.example/live');
  });
});
