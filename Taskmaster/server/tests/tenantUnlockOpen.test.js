const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');
const { isUnlockAllMode } = require('../services/tenantUnlockService');

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

describe('tenant unlock open (pre-billing)', () => {
  const stamp = Date.now();
  let tenant;
  let prevUnlockAll;

  beforeAll(async () => {
    prevUnlockAll = process.env.FEATURE_UNLOCK_ALL;
    process.env.FEATURE_UNLOCK_ALL = 'true';
    expect(isUnlockAllMode()).toBe(true);

    tenant = await Tenant.create({
      name: `Unlock Open ${stamp}`,
      slug: `unlock-open-${stamp}`,
      contactEmail: `unlock-open-${stamp}@coreknot-test.local`,
      plan: 'free',
      featureUnlocks: {
        resend: false,
        finance: false,
        artistOs: false,
      },
    });
  });

  afterAll(async () => {
    if (prevUnlockAll === undefined) delete process.env.FEATURE_UNLOCK_ALL;
    else process.env.FEATURE_UNLOCK_ALL = prevUnlockAll;
    if (tenant?._id) await Tenant.deleteOne({ _id: tenant._id });
  });

  async function seedMemberAgent() {
    const dept = await ensureOpsDept();
    const email = `unlock-open-member-${stamp}@coreknot-test.local`;
    await User.deleteOne({ email });
    const user = await User.create({
      name: 'Unlock Open Member',
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
      departmentId: dept._id,
      tenantId: tenant._id,
      pagePermissions: ['finance', 'emails'],
    });
    await TenantMembership.findOneAndUpdate(
      { tenantId: tenant._id, userId: user._id },
      { $set: { role: 'member', status: 'active', joinedAt: new Date() } },
      { upsert: true },
    );
    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id, { activeTenantId: String(tenant._id) });
    return { agent, user };
  }

  it('GET /api/campaigns is not plan/feature locked for active tenant member', async () => {
    const { agent } = await seedMemberAgent();
    const res = await agent.get('/api/campaigns');
    expect(res.statusCode).not.toBe(402);
    expect(res.body?.code).not.toBe('FEATURE_LOCKED');
    expect(res.body?.code).not.toBe('PLAN_UPGRADE_REQUIRED');
  });

  it('GET /api/finance/stats is not plan/feature locked for tenant member with finance access', async () => {
    const { agent } = await seedMemberAgent();
    const res = await agent.get('/api/finance/stats');
    expect(res.statusCode).not.toBe(402);
    expect(res.body?.code).not.toBe('FEATURE_LOCKED');
    expect(res.body?.code).not.toBe('PLAN_UPGRADE_REQUIRED');
  });
});
