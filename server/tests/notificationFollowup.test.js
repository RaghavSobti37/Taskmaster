jest.mock('../services/notificationDispatcher', () => ({
  createNotification: jest.fn().mockResolvedValue({ _id: 'notif-1' }),
}));

jest.mock('../models/Lead', () => ({
  find: jest.fn(),
}));

const Lead = require('../models/Lead');
const { createNotification } = require('../services/notificationDispatcher');
const { notifyRepForFollowup } = require('../services/notificationService');

describe('followup rep notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('notifyRepForFollowup sends in-app notification and email', async () => {
    const rep = { _id: 'rep-1', email: 'rep@example.com', name: 'Rep' };
    const lead = { _id: 'lead-1', name: 'Asha' };

    await notifyRepForFollowup(lead, rep, {
      title: 'Follow-up due: Asha',
      message: 'Call Asha now.',
    });

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: 'rep-1',
      title: 'Follow-up due: Asha',
      message: 'Call Asha now.',
      category: 'crm',
      type: 'reminder',
      relatedLeadId: 'lead-1',
      actionUrl: '/followups?highlight=lead-1',
      sendEmail: true,
    }));
  });

  test('notifyRepForFollowup still notifies when rep email missing on populated doc', async () => {
    const rep = { _id: 'rep-1', name: 'Rep' };
    const lead = { _id: 'lead-1', name: 'Asha' };

    await notifyRepForFollowup(lead, rep, {
      title: 'Follow-up due: Asha',
      message: 'Call Asha now.',
    });

    expect(createNotification).toHaveBeenCalled();
  });
});

describe('checkFollowups query filters', () => {
  test('due followup scan excludes converted leads', async () => {
    Lead.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });

    const { checkFollowups } = require('../services/notificationService');
    await checkFollowups();

    expect(Lead.find).toHaveBeenCalledWith(expect.objectContaining({
      leadStatus: { $ne: 'Converted' },
      reminderSent: false,
    }));
  });
});
