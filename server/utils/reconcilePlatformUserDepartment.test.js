const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Department = require('../models/Department');
const PlatformSettings = require('../models/PlatformSettings');
const { reconcilePlatformUserDepartment } = require('./reconcilePlatformUserDepartment');
const { resetDefaultTenantCache } = require('./defaultTenant');

describe('reconcilePlatformUserDepartment', () => {
  let tenant;
  let adminDept;

  beforeAll(async () => {
    process.env.ADMIN_EMAIL = 'reconcile-platform@test.com';
    tenant = await Tenant.create({
      name: 'Reconcile Tenant',
      slug: 'reconcile-test-tenant',
      contactEmail: 'reconcile@test.com',
      status: 'active',
    });
    adminDept = await Department.create({
      name: 'Admin',
      slug: 'admin',
      tenantId: tenant._id,
      permissionPreset: 'admin',
    });
    process.env.PLATFORM_TENANT_SLUG = 'reconcile-test-tenant';
    resetDefaultTenantCache();
  });

  afterAll(async () => {
    delete process.env.PLATFORM_TENANT_SLUG;
    delete process.env.ADMIN_EMAIL;
    await User.deleteMany({ email: /reconcile-platform@test\.com/ });
    await Department.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await PlatformSettings.deleteMany({ singletonKey: 'global-reconcile-test' });
  });

  it('assigns admin department to platform admin email without departmentId', async () => {
    const user = await User.create({
      name: 'Platform Admin',
      email: 'reconcile-platform@test.com',
      password: 'x',
      tenantId: tenant._id,
    });

    const result = await reconcilePlatformUserDepartment(user);
    expect(result.changed).toBe(true);

    const refreshed = await User.findById(user._id)
      .setOptions({ bypassTenant: true })
      .populate('departmentId', 'slug name');
    expect(String(refreshed.departmentId._id)).toBe(String(adminDept._id));
    expect(refreshed.departmentId.slug).toBe('admin');
  });

  it('no-ops when department already assigned', async () => {
    const user = await User.findOne({ email: 'reconcile-platform@test.com' })
      .setOptions({ bypassTenant: true })
      .populate('departmentId', 'slug name');
    const result = await reconcilePlatformUserDepartment(user);
    expect(result.changed).toBe(false);
  });
});
