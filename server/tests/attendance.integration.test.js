const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { PRESET_PAGES } = require('../utils/pagePermissions');

async function registerAndLogin(agent, email, name) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);

  const login = await agent.post('/api/auth/login').send({
    email,
    password: DEV_DEFAULT_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
  return reg.body._id;
}

describe('Attendance API integration', () => {
  let userAgent;
  let opsAgent;

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    userAgent = request.agent(app);
    opsAgent = request.agent(app);

    await registerAndLogin(
      userAgent,
      `att-user-${stamp}@coreknot-test.local`,
      'Attendance User'
    );

    const opsDept = await Department.findOne({ slug: 'ops' })
      || await Department.create({
        name: 'Operations',
        slug: 'ops',
        permissionPreset: 'ops',
        pagePermissions: PRESET_PAGES.ops,
      });
    const opsId = await registerAndLogin(
      opsAgent,
      `att-ops-${stamp}@coreknot-test.local`,
      'Attendance Ops'
    );
    await User.findByIdAndUpdate(opsId, { departmentId: opsDept._id });
  });

  it('records check-in and check-out for authenticated user', async () => {
    const checkIn = await userAgent.post('/api/attendance/check').send({
      type: 'in',
      manualTime: '09:00',
      workMode: 'office',
    });
    expect(checkIn.statusCode).toBe(200);
    expect(checkIn.body.inTimeRecord?.manualTimestamp).toBe('09:00');
    expect(checkIn.body.inTimeRecord?.isApproved).toBe(false);

    const checkOut = await userAgent.post('/api/attendance/check').send({
      type: 'out',
      manualTime: '18:00',
      workMode: 'office',
    });
    expect(checkOut.statusCode).toBe(200);
    expect(checkOut.body.outTimeRecord?.manualTimestamp).toBe('18:00');

    const listRes = await userAgent.get('/api/attendance?mine=true');
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThan(0);
    expect(listRes.body[0].inTimeRecord?.manualTimestamp).toBe('09:00');
    expect(listRes.body[0].outTimeRecord?.manualTimestamp).toBe('18:00');
  });

  it('rejects duplicate check-in for the same day', async () => {
    const first = await userAgent.post('/api/attendance/check').send({ type: 'in' });
    expect(first.statusCode).toBe(200);

    const second = await userAgent.post('/api/attendance/check').send({ type: 'in' });
    expect(second.statusCode).toBe(400);
    expect(second.body.error).toMatch(/Already marked in/i);
  });

  it('rejects unauthenticated attendance list', async () => {
    const res = await request(app).get('/api/attendance');
    expect(res.statusCode).toBe(401);
  });

  it('allows ops user to list roster users', async () => {
    const res = await opsAgent.get('/api/attendance/roster-users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('blocks non-ops user from roster-users endpoint', async () => {
    const res = await userAgent.get('/api/attendance/roster-users');
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Operations access required/i);
  });
});
