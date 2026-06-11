const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

async function loginAsRestrictedUser() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dept = await Department.create({
    name: `Restricted ${stamp}`,
    slug: `restricted-${stamp}`,
    permissionPreset: 'standard',
    pagePermissions: ['dashboard', 'todo'],
  });

  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Template Submitter',
      email: `tpl-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);
  await User.findByIdAndUpdate(reg.body._id, { departmentId: dept._id });

  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({
    email: `tpl-${stamp}@coreknot-test.local`,
    password: DEV_DEFAULT_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
  return agent;
}

describe('mail template API access', () => {
  it('allows submit for user without emails in department pagePermissions', async () => {
    const agent = await loginAsRestrictedUser();

    const save = await agent.post('/api/mail/templates').send({
      name: `RBAC_TEST_${Date.now()}`,
      subject: 'Hello',
      content: '<p>Hi</p>',
      format: 'visual',
      dummyValues: {},
    });
    expect(save.statusCode).toBe(200);
    const templateId = save.body._id;

    const submit = await agent.post(`/api/mail/templates/${templateId}/submit`);
    expect(submit.statusCode).toBe(200);
    expect(submit.body.status).toBe('pending_approval');
  });
});
