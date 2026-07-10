const crypto = require('crypto');
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Log = require('../models/Log');
const Department = require('../models/Department');
const { setRuntimePlatformSettings } = require('../../shared/platformUserIds');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');
const { createInvite } = require('../services/tenantMembershipService');
const { registerSession, _resetForTests } = require('../utils/sessionRegistry');

async function ensureOpsDept() {
  let dept = await Department.findOne({ slug: 'ops' });
  if (!dept) {
    dept = await Department.create({
      name: 'Operations',
      slug: 'ops',
      permissionPreset: 'ops',
      pagePermissions: PRESET_PAGES.ops,
    });
  }
  return dept;
}

describe('production readiness gates', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  afterEach(() => {
    setRuntimePlatformSettings({});
    _resetForTests();
  });

  it('log POST returns existing row for duplicate clientRequestId', async () => {
    const dept = await ensureOpsDept();
    const tenant = await Tenant.create({
      name: `Log Idem ${stamp}`,
      slug: `log-idem-${stamp}`,
      contactEmail: `log-idem-${stamp}@coreknot-test.local`,
      plan: 'pro',
    });
    const user = await User.create({
      name: 'Logger',
      email: `log-idem-user-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      departmentId: dept._id,
      tenantId: tenant._id,
    });
    await TenantMembership.create({
      tenantId: tenant._id,
      userId: user._id,
      role: 'admin',
      status: 'active',
    });

    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id, { activeTenantId: String(tenant._id) });

    const clientRequestId = `idem-${stamp}`;
    const payload = {
      action: 'DAILY_LOG',
      details: { type: 'MANUAL', timeSpent: '1h', project: 'Gate Test' },
      clientRequestId,
    };

    const first = await agent.post('/api/logs').send(payload);
    expect([200, 201]).toContain(first.status);
    expect(first.body._id).toBeTruthy();

    const second = await agent.post('/api/logs').send(payload);
    expect(second.status).toBe(200);
    expect(second.body._id).toBe(first.body._id);

    const count = await Log.countDocuments({ clientRequestId, tenantId: tenant._id });
    expect(count).toBe(1);
  });

  it('org admin cannot list platform admin scripts', async () => {
    const dept = await ensureOpsDept();
    const tenant = await Tenant.create({
      name: `Platform Gate ${stamp}`,
      slug: `platform-gate-${stamp}`,
      contactEmail: `platform-gate-${stamp}@coreknot-test.local`,
    });
    const orgAdmin = await User.create({
      name: 'Org Admin',
      email: `org-admin-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      departmentId: dept._id,
      tenantId: tenant._id,
    });
    await TenantMembership.create({
      tenantId: tenant._id,
      userId: orgAdmin._id,
      role: 'admin',
      status: 'active',
    });

    const platformAdmin = await User.create({
      name: 'Platform Admin',
      email: `platform-admin-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      departmentId: dept._id,
    });
    setRuntimePlatformSettings({ rootAdminUserIds: [String(platformAdmin._id)] });

    const orgAgent = request.agent(app);
    await mintSessionAgent(orgAgent, orgAdmin._id, { activeTenantId: String(tenant._id) });
    const denied = await orgAgent.get('/api/admin/scripts');
    expect(denied.status).toBe(403);

    const rootAgent = request.agent(app);
    await mintSessionAgent(rootAgent, platformAdmin._id, { activeTenantId: String(tenant._id) });
    const allowed = await rootAgent.get('/api/admin/scripts');
    expect(allowed.status).toBe(200);
    expect(allowed.body.success).toBe(true);
  });

  it('reset password rejects expired token and clears token after success', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      name: 'Reset User',
      email: `reset-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
    });
    user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() - 1000);
    await user.save();

    const expired = await request(app).post('/api/auth/reset-password').send({
      token: rawToken,
      newPassword: 'NewSecure9!',
      confirmPassword: 'NewSecure9!',
    });
    expect(expired.status).toBe(400);

    const freshToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(freshToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 3600000);
    await user.save();

    const ok = await request(app).post('/api/auth/reset-password').send({
      token: freshToken,
      newPassword: 'NewSecure9!',
      confirmPassword: 'NewSecure9!',
    });
    expect(ok.status).toBe(200);

    const reuse = await request(app).post('/api/auth/reset-password').send({
      token: freshToken,
      newPassword: 'AnotherSecure9!',
      confirmPassword: 'AnotherSecure9!',
    });
    expect(reuse.status).toBe(400);
  });

  it('createInvite enforces seat limit on free plan', async () => {
    const tenant = await Tenant.create({
      name: `Seat Gate ${stamp}`,
      slug: `seat-gate-${stamp}`,
      contactEmail: `seat-owner-${stamp}@coreknot-test.local`,
      plan: 'free',
    });
    const owner = await User.create({
      name: 'Owner',
      email: `seat-owner-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      tenantId: tenant._id,
    });
    await TenantMembership.create({
      tenantId: tenant._id,
      userId: owner._id,
      role: 'admin',
      status: 'active',
    });

    for (let i = 0; i < 4; i += 1) {
      const member = await User.create({
        name: `Member ${i}`,
        email: `seat-member-${stamp}-${i}@coreknot-test.local`,
        password: DEV_DEFAULT_PASSWORD,
      });
      // eslint-disable-next-line no-await-in-loop
      await TenantMembership.create({
        tenantId: tenant._id,
        userId: member._id,
        role: 'member',
        status: 'active',
      });
    }

    await expect(createInvite({
      tenantId: tenant._id,
      email: `over-${stamp}@coreknot-test.local`,
      role: 'member',
      invitedBy: owner._id,
    })).rejects.toMatchObject({ code: 'SEAT_LIMIT', status: 402 });
  });

  it('password change revokes other sessions but keeps current device', async () => {
    const user = await User.create({
      name: 'Session User',
      email: `session-pw-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      mustChangePassword: true,
    });

    const otherReq = {
      headers: { 'user-agent': 'other-device', host: 'localhost:5000' },
      ip: '127.0.0.1',
      get(name) {
        if (String(name).toLowerCase() === 'host') return 'localhost:5000';
        return '';
      },
    };
    await registerSession(otherReq, user._id.toString(), {
      jti: `other-${stamp}`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      email: user.email,
      password: DEV_DEFAULT_PASSWORD,
    });

    const before = await agent.get('/api/auth/sessions');
    expect(before.status).toBe(200);
    expect(before.body.sessions.length).toBeGreaterThanOrEqual(2);

    const change = await agent.post('/api/auth/change-required-password').send({
      newPassword: 'SecurePass9!',
      confirmPassword: 'SecurePass9!',
    });
    expect(change.status).toBe(200);

    const after = await agent.get('/api/auth/sessions');
    expect(after.status).toBe(200);
    expect(after.body.sessions).toHaveLength(1);
    expect(after.body.sessions[0].current).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
  });
});
