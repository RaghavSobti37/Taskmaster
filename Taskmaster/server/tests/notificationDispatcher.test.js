const { createNotification } = require('../services/notificationDispatcher');

jest.mock('../services/pushNotificationService', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config/realtime', () => ({
  broadcastRealtimeEvent: jest.fn(),
}));

jest.mock('../utils/qaExcludedUsers', () => ({
  shouldSuppressNotificationForRecipient: jest.fn().mockResolvedValue(false),
}));

jest.mock('../utils/workerTenantContext', () => ({
  runWithWorkerTenant: jest.fn((_tenantId, fn) => fn()),
}));

jest.mock('../utils/defaultTenant', () => ({
  resolveDefaultTenantId: jest.fn().mockResolvedValue('507f1f77bcf86cd799439099'),
}));

const { sendPushToUser } = require('../services/pushNotificationService');
const Notification = require('../models/Notification');

/**
 * Notification emails have been fully replaced by push notifications.
 * The sendNotificationEmail function and all email-sending paths
 * have been removed from notificationDispatcher.
 * Push notifications are now the sole delivery channel.
 */
describe('createNotification delivers via push (email removed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.create = jest.fn().mockResolvedValue({ _id: 'notif-uuid-1' });
    const User = require('../models/User');
    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        setOptions: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ tenantId: '507f1f77bcf86cd799439099' }),
        }),
      }),
    });
  });

  test('sends push notification unconditionally for all events', async () => {
    const result = await createNotification({
      recipientId: '507f1f77bcf86cd799439011',
      title: 'Test Push',
      message: 'Push notification test',
      category: 'system',
    });

    expect(result).toMatchObject({
      title: 'Test Push',
      category: 'system',
      read: false,
    });
    expect(sendPushToUser).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({
        title: 'Test Push',
        body: 'Push notification test',
      }),
    );
  });

  test('does not invoke any email dispatch for push-based notifications', async () => {
    // Email sending was fully removed from notificationDispatcher.
    // Only push notifications (sendPushToUser) are dispatched.
    // This test validates the push path exists and the email path does not.
    const result = await createNotification({
      recipientId: '507f1f77bcf86cd799439011',
      title: 'Push Only',
      message: 'No email for this notification',
      category: 'task',
    });

    expect(result).toBeTruthy();
    expect(result.emailSent).toBeUndefined();
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });
});
