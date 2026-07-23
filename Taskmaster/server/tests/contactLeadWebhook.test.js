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

jest.mock('../utils/tenantContext', () => ({
  getTenantId: jest.fn(() => 'tenant-a'),
}));

jest.mock('../models/User', () => ({
  findOne: jest.fn(() => ({
    setOptions: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue({ _id: 'user-a', tenantId: 'tenant-a' }),
  })),
  findById: jest.fn(),
}));

jest.mock('../domains/crm/services/leadWriteService', () => ({
  createLeadFromForm: jest.fn().mockResolvedValue({
    created: true,
    lead: { _id: 'lead-a' },
  }),
}));

jest.mock('../models/Lead', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

const { createLeadFromForm } = require('../domains/crm/services/leadWriteService');
const {
  handleContactLead,
  normalizeContactLeadPayload,
} = require('../controllers/webhookController');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('contact lead webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ARTIST_ENQUIRY_WEBHOOK_SECRET = 'shared-secret';
  });

  it('normalizes website contact payload into CRM form lead fields', () => {
    const lead = normalizeContactLeadPayload({
      userType: 'Brand',
      name: ' Riya ',
      email: ' RIYA@example.COM ',
      phone: '+919876543210',
      company: 'Acme',
      message: 'Need a campaign',
      budget: '100k-500k',
    });

    expect(lead).toMatchObject({
      name: 'Riya',
      email: 'riya@example.com',
      phone: '+919876543210',
      company: 'Acme',
      source: 'TSC Website Contact',
      crmType: 'sales',
      tags: ['tsc-website', 'contact-form', 'brand'],
    });
    expect(lead.remarks).toContain('Message: Need a campaign');
    expect(lead.remarks).toContain('Budget: 100k-500k');
  });

  it('writes authorized contact leads through createLeadFromForm', async () => {
    const req = {
      headers: { 'x-webhook-secret': 'shared-secret' },
      body: {
        userType: 'artist',
        name: 'Mira',
        email: 'mira@example.com',
        phone: '+919876543210',
        message: 'Interested',
      },
    };
    const res = mockRes();

    await handleContactLead(req, res);

    expect(createLeadFromForm).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'user-a' }),
      expect.objectContaining({
        name: 'Mira',
        email: 'mira@example.com',
        phone: '+919876543210',
        source: 'TSC Website Contact',
      }),
      expect.objectContaining({ defaultSource: 'TSC Website Contact' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, leadId: 'lead-a' }));
  });

  it('rejects unsigned contact leads', async () => {
    const res = mockRes();
    await handleContactLead({ headers: {}, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(createLeadFromForm).not.toHaveBeenCalled();
  });
});
