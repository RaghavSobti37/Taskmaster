const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');
const {
  backfillMembershipFromUser,
  reconcileMembershipRole,
} = require('../services/tenantMembershipService');

const BYPASS = { bypassTenant: true };

async function ensureAdminDept() {
  let dept = await Department.findOne({ slug: 'admin' });
  if (!dept) {
    dept = await Department.create({
      name: 'Admin',
      slug: 'admin',
      permissionPreset: 'admin',
      pagePermissions: PRESET_PAGES.admin,
    });
  }
  return dept;
}

async function createTestTenant(label) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return Tenant.create({
    name: `Org Settings ${label} ${stamp}`,
    slug: `org-settings-${label}-${stamp}`,
    contactEmail: `org-settings-${label}-${stamp}@coreknot-test.local`,
  });
}

describe('tenant org settings permissions', () => {
  let adminDept;

  beforeAll(async () => {
    adminDept = await ensureAdminDept();
  });

  it('PATCH settings allows department admin with member membership', async () => {
    const tenant = await createTestTenant('patch');
    const stamp = tenant.slug;
    const email = `dept-admin-org-${stamp}@coreknot-test.local`;
    const user = await User.create({
      name: 'Dept Admin',
      email,
      password: DEV_DEFAULT_PASSWORD,
      departmentId: adminDept._id,
      tenantId: tenant._id,
    });
    await TenantMembership.create({
      tenantId: tenant._id,
      userId: user._id,
      role: 'member',
      status: 'active',
    });

    const agent = request.agent(app);
    await mintSessionAgent(agent, user._id, { activeTenantId: String(tenant._id) });

    const getRes = await agent.get(`/api/tenants/${tenant._id}/settings`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.permissions.canEditSettings).toBe(true);

    const patchRes = await agent.patch(`/api/tenants/${tenant._id}/settings`).send({
      name: `Org Settings Updated ${stamp}`,
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.tenant.name).toBe(`Org Settings Updated ${stamp}`);

    await TenantMembership.deleteMany({ tenantId: tenant._id });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteOne({ _id: tenant._id });
  });

  it('backfillMembershipFromUser assigns owner when user is tenant.ownerId', async () => {
    const tenant = await createTestTenant('backfill');
    const email = `owner-backfill-${tenant.slug}@coreknot-test.local`;
    const user = await User.create({
      name: 'Owner Backfill',
      email,
      password: DEV_DEFAULT_PASSWORD,
      departmentId: adminDept._id,
      tenantId: tenant._id,
    });
    await Tenant.findByIdAndUpdate(tenant._id, { ownerId: user._id }).setOptions(BYPASS);

    await TenantMembership.deleteMany({ tenantId: tenant._id, userId: user._id });
    const row = await backfillMembershipFromUser(user);
    expect(row.role).toBe('owner');

    await TenantMembership.deleteMany({ tenantId: tenant._id });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteOne({ _id: tenant._id });
  });

  it('reconcileMembershipRole promotes member to owner for tenant.ownerId', async () => {
    const tenant = await createTestTenant('reconcile');
    const email = `owner-reconcile-${tenant.slug}@coreknot-test.local`;
    const user = await User.create({
      name: 'Owner Reconcile',
      email,
      password: DEV_DEFAULT_PASSWORD,
      departmentId: adminDept._id,
      tenantId: tenant._id,
    });
    await Tenant.findByIdAndUpdate(tenant._id, { ownerId: user._id }).setOptions(BYPASS);

    await TenantMembership.findOneAndUpdate(
      { tenantId: tenant._id, userId: user._id },
      { $set: { role: 'member', status: 'active', joinedAt: new Date() } },
      { upsert: true },
    );

    await reconcileMembershipRole(user, tenant._id);
    const membership = await TenantMembership.findOne({
      tenantId: tenant._id,
      userId: user._id,
    }).setOptions(BYPASS);
    expect(membership.role).toBe('owner');

    await TenantMembership.deleteMany({ tenantId: tenant._id });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteOne({ _id: tenant._id });
  });

  it('backfillMembershipFromUser is idempotent when membership already exists', async () => {
    const tenant = await createTestTenant('idempotent');
    const email = `owner-idempotent-${tenant.slug}@coreknot-test.local`;
    const user = await User.create({
      name: 'Owner Idempotent',
      email,
      password: DEV_DEFAULT_PASSWORD,
      departmentId: adminDept._id,
      tenantId: tenant._id,
    });
    await Tenant.findByIdAndUpdate(tenant._id, { ownerId: user._id }).setOptions(BYPASS);

    await TenantMembership.deleteMany({ tenantId: tenant._id, userId: user._id });
    const first = await backfillMembershipFromUser(user);
    const second = await backfillMembershipFromUser(user);
    expect(first.role).toBe('owner');
    expect(String(second._id)).toBe(String(first._id));

    const count = await TenantMembership.countDocuments({
      tenantId: tenant._id,
      userId: user._id,
    }).setOptions(BYPASS);
    expect(count).toBe(1);

    await TenantMembership.deleteMany({ tenantId: tenant._id });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteOne({ _id: tenant._id });
  });
});
