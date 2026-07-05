const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Department = require('../models/Department');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
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

  it('campaign create blocked when resend feature locked', async () => {
    const lockedTenant = await Tenant.create({
      name: `ISO locked ${stamp}`,
      slug: `iso-locked-${stamp}`,
      contactEmail: `iso-locked-${stamp}@coreknot-test.local`,
      plan: 'pro',
      featureUnlocks: { resend: false },
    });
    const { agent } = await seedTenantUser({ stamp, tenantId: lockedTenant._id, emailSuffix: 'locked' });
    const res = await agent.get('/api/campaigns');
    expect([403, 402]).toContain(res.statusCode);
    await Tenant.deleteOne({ _id: lockedTenant._id });
  });
});
