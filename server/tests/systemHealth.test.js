jest.mock('../services/systemHealthProbeService', () => ({
  getAdminSystemHealth: jest.fn(),
}));

const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const { getAdminSystemHealth } = require('../services/systemHealthProbeService');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { PRESET_PAGES } = require('../utils/pagePermissions');

const TEST_EMAIL = `system-health-${Date.now()}@coreknot-test.local`;

async function loginAsAdmin(agent) {
  let adminDept = await Department.findOne({ slug: 'admin' });
  if (!adminDept) {
    adminDept = await Department.create({
      name: 'Admin',
      slug: 'admin',
      permissionPreset: 'admin',
      pagePermissions: PRESET_PAGES.admin,
    });
  }

  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Health Admin',
      email: TEST_EMAIL,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);
  await User.findByIdAndUpdate(reg.body._id, { departmentId: adminDept._id });

  const login = await agent.post('/api/auth/login').send({
    email: TEST_EMAIL,
    password: DEV_DEFAULT_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
}

describe('System health admin API', () => {
  let agent;

  beforeEach(async () => {
    agent = request.agent(app);
    getAdminSystemHealth.mockReset();
    getAdminSystemHealth.mockResolvedValue({
      status: 'ok',
      checkedAt: new Date().toISOString(),
      services: [{ id: 'mongodb', status: 'ok' }],
    });
    await loginAsAdmin(agent);
  });

  it('GET /api/admin/system-health returns probe report for admins', async () => {
    const res = await agent.get('/api/admin/system-health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(getAdminSystemHealth).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/system-health');
    expect(res.statusCode).toBe(401);
  });
});
