jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ on: jest.fn(), add: jest.fn() })),
}));

jest.mock('../utils/wslRedis', () => ({
  createRedisClient: jest.fn(() => ({ status: 'closed' })),
  getRedisUrl: jest.fn(() => null),
}));

jest.mock('../utils/webhookTenantContext', () => ({
  runWithDefaultWebhookTenant: (fn) => fn(),
}));

jest.mock('../services/notificationDispatcher', () => ({
  createNotification: jest.fn(),
}));

jest.mock('../utils/notificationActionUrl', () => ({
  buildLeadActionUrl: jest.fn(() => '/leads/lead-a'),
}));

jest.mock('../utils/bookedCallRepAssignment', () => ({
  assignNextBookedCallRep: jest.fn(),
  resolveBookedCallRepPhone: jest.fn(),
}));

jest.mock('../utils/aisensyClient', () => ({
  sendAiSensyMessage: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/Lead', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../domains/crm/crmFacade', () => ({
  assignLeadToRep: jest.fn(),
  leadService: {
    createLead: jest.fn(),
    updateLead: jest.fn(),
  },
}));

const Lead = require('../models/Lead');
const User = require('../models/User');
const { leadService: LeadService } = require('../domains/crm/crmFacade');
const {
  handleBookedCall,
  processBookedCallLogic,
} = require('../controllers/webhookController');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const validPayload = {
  name: 'Repeat Caller',
  email: 'new-email@example.com',
  phone: '+918591499393',
  whatsapp: '+918591499393',
  course: 'The heART of Composition',
  date: '2099-08-10',
  time: '02:00 PM',
  timezone: 'Asia/Kolkata',
};

describe('book-call duplicate phone handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockReturnValue({
      setOptions: jest.fn().mockResolvedValue({ _id: 'rep-a', name: 'Sales Rep' }),
    });
  });

  it('keeps repeat same-phone booking input without changing existing lead email', async () => {
    Lead.findOne.mockReturnValue({
      setOptions: jest.fn().mockResolvedValue({
        _id: 'lead-a',
        email: 'old-email@example.com',
        phone: '+918591499393',
        assignedRepId: 'rep-a',
      }),
    });
    Lead.findById.mockResolvedValue({
      _id: 'lead-a',
      email: 'old-email@example.com',
      phone: '+918591499393',
    });
    LeadService.updateLead.mockResolvedValue({});

    await processBookedCallLogic(validPayload, {
      skipNotifications: true,
      skipSlotValidation: true,
    });

    expect(LeadService.updateLead).toHaveBeenCalledWith(
      { _id: 'lead-a' },
      expect.objectContaining({
        $set: expect.not.objectContaining({ email: 'new-email@example.com' }),
        $push: {
          notes: expect.objectContaining({
            text: expect.stringContaining('new-email@example.com'),
            author: 'Website Booking',
          }),
        },
      }),
    );
  });

  it('returns friendly message for duplicate key database errors', async () => {
    const duplicate = new Error(
      'E11000 duplicate key error collection: taskmaster_production.leads index: tenantId_1_phone_1 dup key',
    );
    duplicate.code = 11000;
    jest.spyOn(require('../controllers/webhookController'), 'processBookedCallLogic')
      .mockRejectedValueOnce(duplicate);

    const res = mockRes();
    await handleBookedCall({ body: validPayload }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('already have this phone number'),
    });
    expect(res.json.mock.calls[0][0].error).not.toMatch(/E11000|duplicate key|ObjectId/i);
  });

  it('falls back to updating existing lead when create hits duplicate phone index', async () => {
    Lead.findOne
      .mockReturnValueOnce({
        setOptions: jest.fn().mockResolvedValue(null),
      })
      .mockReturnValueOnce({
        setOptions: jest.fn().mockResolvedValue({
          _id: 'lead-dup',
          email: 'old-email@example.com',
          phone: '+918591499393',
          assignedRepId: 'rep-a',
        }),
      });
    Lead.findById.mockResolvedValue({
      _id: 'lead-dup',
      email: 'old-email@example.com',
      phone: '+918591499393',
    });
    const duplicate = new Error('E11000 duplicate key error collection: taskmaster_production.leads index: tenantId_1_phone_1 dup key');
    duplicate.code = 11000;
    LeadService.createLead.mockRejectedValueOnce(duplicate);
    LeadService.updateLead.mockResolvedValue({});

    const result = await processBookedCallLogic(validPayload, {
      skipNotifications: true,
      skipSlotValidation: true,
      forceRepId: 'rep-a',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-dup');
    expect(LeadService.updateLead).toHaveBeenCalledWith(
      { _id: 'lead-dup' },
      expect.objectContaining({
        $set: expect.not.objectContaining({ email: 'new-email@example.com' }),
        $push: {
          notes: expect.objectContaining({
            text: expect.stringContaining('new-email@example.com'),
            author: 'Website Booking',
          }),
        },
      }),
    );
  });
});
