const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const {
  hasPageAccess,
  getUserPagePermissions,
  PRESET_PAGES,
} = require('../utils/pagePermissions');

describe('Wave 3 page permissions', () => {
  it('gates new tool pages via page keys', () => {
    const salesUser = {
      departmentId: { slug: 'sales', permissionPreset: 'sales', pagePermissions: PRESET_PAGES.sales },
    };
    expect(hasPageAccess(salesUser, 'settings')).toBe(true);
    expect(hasPageAccess(salesUser, 'features')).toBe(false);
    expect(hasPageAccess(salesUser, 'workflows')).toBe(false);
    expect(hasPageAccess(salesUser, 'office_assets')).toBe(false);

    const creativeUser = {
      departmentId: { slug: 'creative', permissionPreset: 'creative', pagePermissions: PRESET_PAGES.creative },
    };
    expect(hasPageAccess(creativeUser, 'features')).toBe(true);
    expect(hasPageAccess(creativeUser, 'workflows')).toBe(true);
  });

  it('uses per-user pagePermissions override when set', () => {
    const user = {
      departmentId: { slug: 'sales', permissionPreset: 'sales', pagePermissions: PRESET_PAGES.sales },
      pagePermissions: ['dashboard', 'settings', 'features'],
    };
    expect(getUserPagePermissions(user)).toEqual(['dashboard', 'settings', 'features']);
    expect(hasPageAccess(user, 'features')).toBe(true);
    expect(hasPageAccess(user, 'leads')).toBe(false);
  });

  it('blocks non-admin departmentId change on profile API', async () => {
    const email = `wave3-profile-${Date.now()}@coreknot-test.local`;
    const salesDept = await Department.findOne({ slug: 'sales' })
      || await Department.create({
        name: 'Sales',
        slug: 'sales',
        permissionPreset: 'sales',
        pagePermissions: PRESET_PAGES.sales,
      });

    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sales User',
        email,
        password: DEV_DEFAULT_PASSWORD,
        gender: 'male',
      });
    expect(reg.statusCode).toBe(201);
    await User.findByIdAndUpdate(reg.body._id, { departmentId: salesDept._id });

    const agent = request.agent(app);
  await mintSessionAgent(agent, reg.body._id);

    const opsDept = await Department.findOne({ slug: 'ops' })
      || await Department.create({
        name: 'Operations',
        slug: 'ops',
        permissionPreset: 'ops',
        pagePermissions: PRESET_PAGES.ops,
      });

    const blocked = await agent.put('/api/users/profile').send({
      departmentId: opsDept._id.toString(),
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.body.error).toMatch(/administrator/i);

    const updated = await User.findById(reg.body._id);
    expect(updated.departmentId.toString()).toBe(salesDept._id.toString());
  });
});
