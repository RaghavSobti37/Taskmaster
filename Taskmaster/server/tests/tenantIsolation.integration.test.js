const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Department = require('../models/Department');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const Lead = require('../domains/crm/models/Lead');
const GamificationConfig = require('../models/GamificationConfig');
const LeaveRequest = require('../models/LeaveRequest');
const { bootstrapTenant } = require('../services/tenantBootstrapService');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
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

async function seedTenantUser({ stamp, tenantId, emailSuffix }) {
  const dept = await ensureOpsDept();
  const email = `tenant-iso-${stamp}-${emailSuffix}@coreknot-test.local`;
  await User.deleteOne({ email });
  const user = await User.create({
    name: `Tenant ISO ${emailSuffix}`,
    email,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
    departmentId: dept._id,
    tenantId,
  });
  await TenantMembership.findOneAndUpdate(
    { tenantId, userId: user._id },
    { $set: { role: 'admin', status: 'active', joinedAt: new Date() } },
    { upsert: true },
  );
  const agent = request.agent(app);
  await mintSessionAgent(agent, user._id, { activeTenantId: String(tenantId) });
  return { agent, user };
}

describe('tenant isolation (required CI gate)', () => {
  const stamp = Date.now();
  let tenantA;
  let tenantB;

  beforeAll(async () => {
    tenantA = await Tenant.create({
      name: `ISO A ${stamp}`,
      slug: `iso-a-${stamp}`,
      contactEmail: `iso-a-${stamp}@coreknot-test.local`,
      plan: 'pro',
      featureUnlocks: { finance: true, resend: true },
    });
    tenantB = await Tenant.create({
      name: `ISO B ${stamp}`,
      slug: `iso-b-${stamp}`,
      contactEmail: `iso-b-${stamp}@coreknot-test.local`,
      plan: 'pro',
      featureUnlocks: { finance: true },
    });
  });

  afterAll(async () => {
    await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
  });

  it('finance approve rejects cross-tenant spoof payload', async () => {
    const { agent, user } = await seedTenantUser({ stamp, tenantId: tenantA._id, emailSuffix: 'a1' });
    const otherTenant = tenantB._id;

    const project = await Project.create({
      name: `Tenant ISO ${stamp}`,
      outletId: 'test-outlet',
      owner: user._id,
      status: 'active',
      tenantId: tenantA._id,
    });

    const doc = await FinanceDocument.create({
      title: 'ISO doc',
      project: project._id,
      tenantId: tenantA._id,
      uploadedBy: user._id,
      fileUrl: 'https://example.com/iso.pdf',
      fileName: 'iso.pdf',
      fileType: 'application/pdf',
      category: 'invoice',
      approvalStatus: 'pending',
    });

    const res = await agent
      .patch(`/api/finance/${doc._id}/approve`)
      .send({ tenantId: String(otherTenant) });

    expect(res.statusCode).toBe(403);

    await FinanceDocument.deleteOne({ _id: doc._id });
    await Project.deleteOne({ _id: project._id });
  });

  it('cannot fetch project detail from another tenant', async () => {
    const { agent: agentA, user: userA } = await seedTenantUser({ stamp, tenantId: tenantA._id, emailSuffix: 'a3' });
    await seedTenantUser({ stamp, tenantId: tenantB._id, emailSuffix: 'b2' });

    const projectB = await Project.create({
      name: `Tenant B project ${stamp}`,
      outletId: 'test-outlet',
      owner: userA._id,
      status: 'active',
      tenantId: tenantB._id,
      members: [userA._id],
    });

    const res = await agentA.get(`/api/projects/${projectB._id}`);
    expect([403, 404]).toContain(res.statusCode);

    await Project.deleteOne({ _id: projectB._id });
  });

  it('campaign API returns Auto-Mailer migration response when resend feature locked', async () => {
    const lockedTenant = await Tenant.create({
      name: `ISO locked ${stamp}`,
      slug: `iso-locked-${stamp}`,
      contactEmail: `iso-locked-${stamp}@coreknot-test.local`,
      plan: 'pro',
      featureUnlocks: { resend: false },
    });
    const { agent } = await seedTenantUser({ stamp, tenantId: lockedTenant._id, emailSuffix: 'locked' });
    const res = await agent.get('/api/campaigns');
    expect(res.statusCode).toBe(410);
    expect(res.body.service).toBe('auto-mailer');
    await Tenant.deleteOne({ _id: lockedTenant._id });
  });

  it('POST /api/tenants/select switches active tenant for multi-org member', async () => {
    const dept = await ensureOpsDept();
    const email = `tenant-select-${stamp}@coreknot-test.local`;
    await User.deleteOne({ email });
    const user = await User.create({
      name: 'Tenant Select User',
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
      departmentId: dept._id,
      tenantId: tenantA._id,
    });
    await TenantMembership.findOneAndUpdate(
      { tenantId: tenantA._id, userId: user._id },
      { $set: { role: 'admin', status: 'active', joinedAt: new Date() } },
      { upsert: true },
    );
    await TenantMembership.findOneAndUpdate(
      { tenantId: tenantB._id, userId: user._id },
      { $set: { role: 'member', status: 'active', joinedAt: new Date() } },
      { upsert: true },
    );

    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id, { activeTenantId: String(tenantA._id) });

    const res = await agent
      .post('/api/tenants/select')
      .send({ tenantId: String(tenantB._id) });

    expect(res.statusCode).toBe(200);
    expect(res.body.activeTenantId).toBe(String(tenantB._id));

    const membershipsRes = await agent.get('/api/tenants/memberships');
    expect(membershipsRes.statusCode).toBe(200);
    expect(membershipsRes.body.activeTenantId).toBe(String(tenantB._id));
  });

  it('GET /departments/public requires tenantSlug', async () => {
    const res = await request(app).get('/api/departments/public');
    expect(res.statusCode).toBe(400);
  });

  it('GET /departments/public returns only requested tenant departments', async () => {
    const slug = `iso-public-${stamp}`;
    let tenant = await Tenant.findOne({ slug }).setOptions({ bypassTenant: true });
    if (!tenant) {
      tenant = await Tenant.create({
        name: `ISO Public ${stamp}`,
        slug,
        contactEmail: `iso-public-${stamp}@coreknot-test.local`,
        plan: 'pro',
      });
    }
    await bootstrapTenant(tenant._id);

    const res = await request(app).get(`/api/departments/public?tenantSlug=${encodeURIComponent(tenant.slug)}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const slugs = res.body.map((d) => d.slug);
    expect(slugs).toContain('ops');

    await Tenant.deleteOne({ _id: tenant._id });
  });

  it('gamification config is isolated per tenant', async () => {
    await bootstrapTenant(tenantA._id);
    await bootstrapTenant(tenantB._id);

    const cfgA = await GamificationConfig.findOne({ tenantId: tenantA._id }).setOptions({ bypassTenant: true });
    const cfgB = await GamificationConfig.findOne({ tenantId: tenantB._id }).setOptions({ bypassTenant: true });
    expect(cfgA).toBeTruthy();
    expect(cfgB).toBeTruthy();
    expect(String(cfgA._id)).not.toBe(String(cfgB._id));

    cfgA.taskCompletion = 99;
    await cfgA.save();

    const cfgBReload = await GamificationConfig.findOne({ tenantId: tenantB._id }).setOptions({ bypassTenant: true });
    expect(cfgBReload.taskCompletion).not.toBe(99);
  });

  it('leave requests do not leak across tenants', async () => {
    const { user: userA } = await seedTenantUser({ stamp, tenantId: tenantA._id, emailSuffix: 'leave-a' });
    const { user: userB } = await seedTenantUser({ stamp, tenantId: tenantB._id, emailSuffix: 'leave-b' });

    await LeaveRequest.create({
      userId: userA._id,
      tenantId: tenantA._id,
      fromDate: new Date(),
      toDate: new Date(),
      status: 'approved',
    });
    await LeaveRequest.create({
      userId: userB._id,
      tenantId: tenantB._id,
      fromDate: new Date(),
      toDate: new Date(),
      status: 'approved',
    });

    const tenantALeaves = await LeaveRequest.find({ tenantId: tenantA._id }).setOptions({ bypassTenant: true });
    const tenantBLeaves = await LeaveRequest.find({ tenantId: tenantB._id }).setOptions({ bypassTenant: true });
    expect(tenantALeaves).toHaveLength(1);
    expect(tenantBLeaves).toHaveLength(1);
    expect(String(tenantALeaves[0].userId)).toBe(String(userA._id));

    await LeaveRequest.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }).setOptions({ bypassTenant: true });
  });

  it('new tenant bootstrap has zero leads', async () => {
    await bootstrapTenant(tenantB._id);
    const leads = await Lead.find({ tenantId: tenantB._id }).setOptions({ bypassTenant: true });
    expect(leads).toHaveLength(0);
  });
});
