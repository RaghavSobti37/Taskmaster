const request = require('supertest');
const app = require('../server');
const Project = require('../models/Project');
const FinanceDocument = require('../models/FinanceDocument');
const User = require('../models/User');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { PRESET_PAGES } = require('../utils/pagePermissions');

jest.mock('../utils/financeOcr', () => ({
  scheduleFinanceDocumentOcr: jest.fn(),
  shouldRunOcr: jest.fn(() => true),
  shouldRunImageOcr: jest.fn(() => false),
  getOcrMaxBytes: jest.fn(() => 8 * 1024 * 1024),
  runFinanceDocumentOcr: jest.fn(),
}));

const { scheduleFinanceDocumentOcr } = require('../utils/financeOcr');

async function loginOpsUser(agent, stamp) {
  let dept = await Department.findOne({ slug: 'ops' });
  if (!dept) {
    dept = await Department.create({
      name: 'Operations',
      slug: 'ops',
      permissionPreset: 'ops',
      pagePermissions: PRESET_PAGES.ops,
    });
  }

  const email = `finance-upload-${stamp}@coreknot-test.local`;
  await User.deleteOne({ email });
  const user = await User.create({
    name: 'Finance Ops',
    email,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
    departmentId: dept._id,
  });

  const login = await agent.post('/api/auth/login').send({ email, password: DEV_DEFAULT_PASSWORD });
  expect(login.statusCode).toBe(200);
  return user;
}

describe('Finance document upload', () => {
  const stamp = Date.now();

  it('POST /api/finance saves document without blocking on OCR', async () => {
    const agent = request.agent(app);
    const user = await loginOpsUser(agent, stamp);

    const project = await Project.create({
      name: `Finance test ${stamp}`,
      description: 'test',
      outletId: 'test-outlet',
      owner: user._id,
      status: 'active',
    });

    const res = await agent.post('/api/finance').send({
      title: 'Test invoice',
      project: project._id.toString(),
      fileUrl: 'https://example.com/test-invoice.pdf',
      fileName: 'test-invoice.pdf',
      fileType: 'application/pdf',
      fileSize: 1200,
      category: 'invoice',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Test invoice');
    expect(scheduleFinanceDocumentOcr).toHaveBeenCalled();

    const saved = await FinanceDocument.findById(res.body.data._id);
    expect(saved).toBeTruthy();
    expect(saved.fileUrl).toContain('example.com');

    await FinanceDocument.deleteMany({ project: project._id });
    await Project.deleteOne({ _id: project._id });
  });

  it('GET /api/customization/navbar does not 500 on first fetch', async () => {
    const agent = request.agent(app);
    await loginOpsUser(agent, `${stamp}-nav`);

    const results = await Promise.all([
      agent.get('/api/customization/navbar'),
      agent.get('/api/customization/navbar'),
    ]);

    for (const res of results) {
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.groups)).toBe(true);
    }
  });
});
