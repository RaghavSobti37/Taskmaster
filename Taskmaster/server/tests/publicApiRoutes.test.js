const express = require('express');
const request = require('supertest');

let mockScopes = [];

jest.mock('../middleware/apiKeyAuth', () => ({
  apiKeyAuth: (req, res, next) => {
    req.tenantId = 'tenant-a';
    req.apiKeyScopes = mockScopes;
    next();
  },
}));

jest.mock('../services/planEnforcementService', () => ({
  incrementUsage: jest.fn(),
}));

jest.mock('../models/Lead', () => ({
  findOne: jest.fn(() => ({
    setOptions: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({ _id: 'lead-a', tenantId: 'tenant-a' }),
  })),
}));

jest.mock('../domains/crm/services/leadWriteService', () => ({
  createLead: jest.fn().mockResolvedValue({ lead: { _id: 'lead-a' } }),
}));

jest.mock('../models/User', () => ({
  findOne: jest.fn(() => ({
    setOptions: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue({ _id: 'user-a' }),
  })),
}));

const router = require('../routes/publicApiRoutes');

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/public-api', router);
  return testApp;
}

describe('publicApiRoutes scope enforcement', () => {
  beforeEach(() => {
    mockScopes = [];
  });

  it('rejects lead reads without read scope', async () => {
    mockScopes = ['write'];
    const res = await request(app()).get('/public-api/leads/lead-a');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('API_KEY_SCOPE_DENIED');
  });

  it('rejects lead writes without write scope', async () => {
    mockScopes = ['read'];
    const res = await request(app()).post('/public-api/leads').send({ email: 'artist@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('API_KEY_SCOPE_DENIED');
  });
});
