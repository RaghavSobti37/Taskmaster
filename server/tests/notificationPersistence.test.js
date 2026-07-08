jest.mock('../config/realtime', () => ({
  broadcastRealtimeEvent: jest.fn(),
}));

jest.mock('../services/pushNotificationService', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
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

const User = require('../models/User');
const Notification = require('../models/Notification');
const { createNotification } = require('../services/notificationDispatcher');
const { broadcastRealtimeEvent } = require('../config/realtime');

describe('createNotification persistence (BUG-T11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.create = jest.fn().mockResolvedValue({ _id: 'notif-uuid-1' });
    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        setOptions: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ tenantId: '507f1f77bcf86cd799439099' }),
        }),
      }),
    });
  });

  test('persists assign notification to Notification collection', async () => {
    const recipientId = '507f1f77bcf86cd799439011';
    const actorId = '507f1f77bcf86cd799439012';
    const taskId = '507f1f77bcf86cd799439013';

    const result = await createNotification({
      recipientId,
      title: 'New Task Assigned',
      message: 'Alex assigned you: "Fix login"',
      category: 'task',
      relatedTaskId: taskId,
      actionUrl: '/todo?highlight=abc',
      actorId,
      iconType: 'user',
    });

    expect(result).toMatchObject({
      title: 'New Task Assigned',
      category: 'task',
      read: false,
    });
    expect(broadcastRealtimeEvent).toHaveBeenCalledWith(
      `user-${recipientId}`,
      'notification',
      expect.objectContaining({ title: 'New Task Assigned' }),
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: recipientId,
        title: 'New Task Assigned',
        category: 'task',
        relatedTaskId: taskId,
        actorId,
        read: false,
      }),
    );
  });
});
