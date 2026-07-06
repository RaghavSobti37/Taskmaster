const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { getApplicableOnboardingSteps, CHECKLIST_SNOOZE_MS } = require('../../shared/orgOnboardingChecklist.cjs');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');

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

describe('tenant onboarding checklist', () => {
  const stamp = Date.now();
  let tenant;
  let user;

  beforeAll(async () => {
    tenant = await Tenant.create({
      name: `Onboarding Checklist ${stamp}`,
      slug: `onboarding-checklist-${stamp}`,
      contactEmail: `onboarding-checklist-${stamp}@coreknot-test.local`,
      plan: 'free',
      onboardingProgress: {
        completedSteps: [],
        dismissedChecklist: false,
      },
    });

    const dept = await ensureOpsDept();
    const email = `onboarding-checklist-member-${stamp}@coreknot-test.local`;
    await User.deleteOne({ email });
    user = await User.create({
      name: 'Onboarding Checklist Member',
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
      departmentId: dept._id,
      tenantId: tenant._id,
      pagePermissions: ['dashboard'],
    });
    await TenantMembership.findOneAndUpdate(
      { tenantId: tenant._id, userId: user._id },
      { $set: { role: 'admin', status: 'active', joinedAt: new Date() } },
      { upsert: true },
    );
  });

  afterAll(async () => {
    if (tenant?._id) await Tenant.deleteOne({ _id: tenant._id });
  });

  async function authedAgent() {
    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id, { activeTenantId: String(tenant._id) });
    return agent;
  }

  it('serves dynamic checklist steps, 24h dismiss snooze, and completion hide', async () => {
    const agent = await authedAgent();

    const initial = await agent.get(`/api/tenants/${tenant._id}/unlocks`);
    expect(initial.statusCode).toBe(200);
    const expectedSteps = getApplicableOnboardingSteps(tenant);
    expect(initial.body.checklistSteps).toEqual(expectedSteps);
    expect(initial.body.totalCount).toBe(expectedSteps.length);
    expect(initial.body.checklistVisible).toBe(true);
    expect(initial.body.onboardingProgress.completedSteps).toEqual([]);

    const before = Date.now();
    const dismissed = await agent.patch(`/api/tenants/${tenant._id}/onboarding`).send({ dismissChecklist: true });
    expect(dismissed.statusCode).toBe(200);
    expect(dismissed.body.checklistVisible).toBe(false);

    const until = new Date(dismissed.body.onboardingProgress.checklistSnoozedUntil).getTime();
    expect(until).toBeGreaterThanOrEqual(before + CHECKLIST_SNOOZE_MS - 5000);
    expect(until).toBeLessThanOrEqual(Date.now() + CHECKLIST_SNOOZE_MS + 5000);

    const snoozed = await agent.get(`/api/tenants/${tenant._id}/unlocks`);
    expect(snoozed.body.checklistVisible).toBe(false);

    await Tenant.updateOne(
      { _id: tenant._id },
      { $set: { 'onboardingProgress.checklistSnoozedUntil': new Date(Date.now() - 60_000) } },
    );
    const revived = await agent.get(`/api/tenants/${tenant._id}/unlocks`);
    expect(revived.statusCode).toBe(200);
    expect(revived.body.checklistVisible).toBe(true);

    const stepIds = getApplicableOnboardingSteps(
      await Tenant.findById(tenant._id).setOptions({ bypassTenant: true }).lean(),
    ).map((s) => s.id);
    await Tenant.updateOne(
      { _id: tenant._id },
      {
        $set: {
          'onboardingProgress.completedSteps': stepIds,
          'onboardingProgress.checklistSnoozedUntil': null,
        },
      },
    );
    const complete = await agent.get(`/api/tenants/${tenant._id}/unlocks`);
    expect(complete.statusCode).toBe(200);
    expect(complete.body.checklistVisible).toBe(false);
  });

  it('auto-marks profile_complete on unlocks when profile is complete', async () => {
    await User.updateOne(
      { _id: user._id },
      { $set: { phone: '9876543210', dateOfBirth: new Date('1990-01-01') } },
    );
    const agent = await authedAgent();
    const res = await agent.get(`/api/tenants/${tenant._id}/unlocks`);
    expect(res.statusCode).toBe(200);
    expect(res.body.onboardingProgress.completedSteps).toContain('profile_complete');
  });
});
