jest.mock('../services/clerkOrgService', () => ({
  syncTenantToClerkOrganization: jest.fn().mockImplementation(async ({ creatorClerkId } = {}) => {
    if (!creatorClerkId) {
      return { synced: false, reason: 'not_configured' };
    }
    return {
      synced: true,
      clerkOrganizationId: `org_mock_${Date.now()}`,
    };
  }),
}));

const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');
const { defaultFeatureUnlocks } = require('../../shared/orgFeatures.cjs');

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

async function seedOrgContextUser(stamp) {
  const tenant = await Tenant.create({
    name: `Org Ctx ${stamp}`,
    slug: `org-ctx-${stamp}`,
    contactEmail: `org-ctx-${stamp}@coreknot-test.local`,
    plan: 'pro',
    featureUnlocks: { ...defaultFeatureUnlocks(), finance: true, resend: false },
  });

  const dept = await ensureOpsDept();
  const email = `org-ctx-user-${stamp}@coreknot-test.local`;
  await User.deleteOne({ email });
  const user = await User.create({
    name: 'Org Ctx User',
    email,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
    departmentId: dept._id,
    tenantId: tenant._id,
    pagePermissions: PRESET_PAGES.ops,
  });
  await TenantMembership.findOneAndUpdate(
    { tenantId: tenant._id, userId: user._id },
    { $set: { role: 'admin', status: 'active', joinedAt: new Date() } },
    { upsert: true },
  );

  const agent = request.agent(app);
  await mintSessionAgent(agent, user._id, { activeTenantId: String(tenant._id) });
  return { tenant, user, agent };
}

describe('org context API', () => {
  it('GET /api/orgs/:slug/context returns tenant, features, membership', async () => {
    const stamp = `${Date.now()}-get`;
    const { tenant, agent } = await seedOrgContextUser(stamp);

    const res = await agent.get(`/api/orgs/${tenant.slug}/context`).query({ includeAllMemberships: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.tenant.slug).toBe(tenant.slug);
    expect(res.body.membership.role).toBe('admin');
    expect(res.body.featureUnlocks.finance).toBe(true);
    expect(res.body.featureUnlocks.resend).toBe(false);
    expect(Array.isArray(res.body.memberships)).toBe(true);

    await Tenant.deleteOne({ _id: tenant._id });
  });

  it('PATCH /api/tenants/:id/features updates featureUnlocks', async () => {
    const stamp = `${Date.now()}-patch`;
    const { tenant, agent } = await seedOrgContextUser(stamp);

    const res = await agent.patch(`/api/tenants/${tenant._id}/features`).send({
      featureUnlocks: { resend: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.featureUnlocks.resend).toBe(true);

    const saved = await Tenant.findById(tenant._id).setOptions({ bypassTenant: true });
    expect(saved.featureUnlocks.resend).toBe(true);

    await Tenant.deleteOne({ _id: tenant._id });
  });
});

describe('tenant create with featureUnlocks', () => {
  const stamp = Date.now();

  it('POST /api/tenants/create persists featureUnlocks', async () => {
    const dept = await ensureOpsDept();
    const email = `org-create-features-${stamp}@coreknot-test.local`;
    await User.deleteOne({ email });
    const user = await User.create({
      name: 'Org Create Features',
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
      departmentId: dept._id,
      pagePermissions: PRESET_PAGES.ops,
      clerkId: `user_clerk_create_${stamp}`,
    });
    const createAgent = request.agent(app);
    await mintSessionAgent(createAgent, user._id, {});

    const res = await createAgent.post('/api/tenants/create').send({
      name: `Feature Org ${stamp}`,
      slug: `feature-org-${stamp}`,
      industry: 'technology',
      teamSize: '1-5',
      settings: { timezone: 'UTC', defaultCurrency: 'USD', dateFormat: 'YYYY-MM-DD' },
      featureUnlocks: { finance: true, resend: false },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.tenant.featureUnlocks.finance).toBe(true);
    expect(res.body.tenant.featureUnlocks.resend).toBe(false);

    if (res.body.tenant?._id) {
      await Tenant.deleteOne({ _id: res.body.tenant._id });
    }
    await User.deleteOne({ _id: user._id });
  });
});
