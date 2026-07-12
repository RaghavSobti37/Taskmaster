jest.mock('../services/mailDriver', () => ({
  dispatchEmailPayload: jest.fn().mockResolvedValue({ id: 'email-mock' }),
}));

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

jest.mock('../utils/clerkAuth', () => {
  const actual = jest.requireActual('../utils/clerkAuth');
  return {
    ...actual,
    isClerkConfigured: jest.fn(() => false),
  };
});

const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const TenantInvite = require('../models/TenantInvite');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const GamificationConfig = require('../models/GamificationConfig');
const CRMConfig = require('../domains/crm/models/CRMConfig');
const Lead = require('../domains/crm/models/Lead');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { dispatchEmailPayload } = require('../services/mailDriver');
const { syncTenantToClerkOrganization } = require('../services/clerkOrgService');

async function registerUser(stamp) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name: `Wizard User ${stamp}`,
      email: `wizard-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);
  return reg.body;
}

describe('tenant create wizard API', () => {
  beforeEach(() => {
    dispatchEmailPayload.mockClear();
    syncTenantToClerkOrganization.mockClear();
    syncTenantToClerkOrganization.mockImplementation(async ({ creatorClerkId } = {}) => {
      if (!creatorClerkId) {
        return { synced: false, reason: 'not_configured' };
      }
      return {
        synced: true,
        clerkOrganizationId: `org_mock_${Date.now()}`,
      };
    });
  });

  it('creates tenant with settings, branding, invites, and onboarding seed in one request', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await registerUser(stamp);
    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id);

    const payload = {
      name: `Acme ${stamp}`,
      slug: `acme-${stamp}`,
      logo: 'https://cdn.example.com/logo.png',
      industry: 'Music',
      teamSize: '11-50',
      settings: {
        timezone: 'America/New_York',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
      },
      invites: [
        { email: `teammate-a-${stamp}@coreknot-test.local`, role: 'admin' },
        { email: `teammate-b-${stamp}@coreknot-test.local`, role: 'member' },
      ],
    };

    const res = await agent.post('/api/tenants/create').send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.tenant.name).toBe(payload.name);
    expect(res.body.tenant.slug).toBe(payload.slug);
    expect(res.body.tenant.industry).toBe('Music');
    expect(res.body.tenant.teamSize).toBe('11-50');
    expect(res.body.tenant.settings.timezone).toBe('America/New_York');
    expect(res.body.tenant.settings.defaultCurrency).toBe('USD');
    expect(res.body.tenant.settings.dateFormat).toBe('MM/DD/YYYY');
    expect(res.body.tenant.branding.logoUrl).toBe(payload.logo);
    expect(res.body.tenant.onboardingProgress.completedSteps).toContain('invite_teammate');

    const tenant = await Tenant.findById(res.body.tenant._id).setOptions({ bypassTenant: true });
    expect(tenant).toBeTruthy();

    const ownerMembership = await TenantMembership.findOne({
      tenantId: tenant._id,
      userId: user._id,
    }).setOptions({ bypassTenant: true });
    expect(ownerMembership.role).toBe('admin');
    expect(ownerMembership.needsRoleReview).toBe(false);

    const invites = await TenantInvite.find({ tenantId: tenant._id }).setOptions({ bypassTenant: true });
    expect(invites).toHaveLength(2);
    expect(invites.map((i) => i.email).sort()).toEqual(
      payload.invites.map((i) => i.email.toLowerCase()).sort(),
    );

    expect(dispatchEmailPayload).toHaveBeenCalledTimes(2);

    const depts = await Department.find({ tenantId: tenant._id }).setOptions({ bypassTenant: true });
    expect(depts.length).toBeGreaterThan(0);
    const workspaces = await Workspace.find({ tenantId: tenant._id }).setOptions({ bypassTenant: true });
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toBe('MAIN');
    const gamification = await GamificationConfig.findOne({ tenantId: tenant._id }).setOptions({ bypassTenant: true });
    expect(gamification).toBeTruthy();
    const crmConfig = await CRMConfig.findOne({ tenantId: tenant._id, configKey: 'default' }).setOptions({ bypassTenant: true });
    expect(crmConfig).toBeTruthy();
    const leads = await Lead.find({ tenantId: tenant._id }).setOptions({ bypassTenant: true });
    expect(leads).toHaveLength(0);
  });

  it('persists clerkOrganizationId when Clerk org sync succeeds', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await registerUser(`clerk-${stamp}`);
    await User.findByIdAndUpdate(user._id, { clerkId: `user_clerk_${stamp}` }).setOptions({ bypassTenant: true });
    syncTenantToClerkOrganization.mockResolvedValue({
      synced: true,
      clerkOrganizationId: `org_${stamp}`,
    });

    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id);

    const res = await agent.post('/api/tenants/create').send({
      name: `Clerk Org ${stamp}`,
      slug: `clerk-org-${stamp}`,
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.tenant.clerkOrganizationId).toBe(`org_${stamp}`);

    const tenant = await Tenant.findById(res.body.tenant._id).setOptions({ bypassTenant: true });
    expect(tenant.clerkOrganizationId).toBe(`org_${stamp}`);
    expect(syncTenantToClerkOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantName: `Clerk Org ${stamp}`,
        slug: `clerk-org-${stamp}`,
        creatorClerkId: `user_clerk_${stamp}`,
      }),
    );
  });

  it('creates tenant without invites and skips invite_teammate onboarding step', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await registerUser(`solo-${stamp}`);
    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id);

    const res = await agent.post('/api/tenants/create').send({
      name: `Solo Org ${stamp}`,
      settings: { timezone: 'UTC', currency: 'EUR', dateFormat: 'YYYY-MM-DD' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.tenant.onboardingProgress.completedSteps).not.toContain('invite_teammate');
    expect(dispatchEmailPayload).not.toHaveBeenCalled();
  });

  it('rejects create without organization name', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await registerUser(`noname-${stamp}`);
    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id);

    const res = await agent.post('/api/tenants/create').send({ invites: [] });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/name required/i);
  });
});
