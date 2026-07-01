const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const adminRolesService = require('../services/adminRolesService');
const { seedDepartments } = require('../services/departmentService');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { PRESET_PAGES } = require('../utils/pagePermissions');

const TEST_EMAIL = `admin-roles-${Date.now()}@coreknot-test.local`;

async function loginAsAdmin(agent) {
  let adminDept = await Department.findOne({ slug: 'admin' });
  if (!adminDept) {
    adminDept = await Department.create({
      name: 'Admin',
      slug: 'admin',
      permissionPreset: 'admin',
      pagePermissions: PRESET_PAGES.admin,
    });
  }

  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Roles Admin',
      email: TEST_EMAIL,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);
  await User.findByIdAndUpdate(reg.body._id, { departmentId: adminDept._id });

  const login = await agent.post('/api/auth/login').send({
    email: TEST_EMAIL,
    password: DEV_DEFAULT_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
  return { adminDept, userId: reg.body._id };
}

describe('Admin roles API', () => {
  let agent;

  beforeEach(async () => {
    agent = request.agent(app);
    await loginAsAdmin(agent);
  });

  it('GET /api/admin/roles returns org + project roles', async () => {
    const res = await agent.get('/api/admin/roles');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.orgRoles)).toBe(true);
    expect(res.body.orgRoles.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.projectRoles)).toBe(true);
    expect(res.body.projectRoles.some((r) => r.key === 'viewer')).toBe(true);
    expect(res.body.pageRegistry).toHaveProperty('groups');
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/roles');
    expect(res.statusCode).toBe(401);
  });

  it('creates, renames, and deletes a custom org role', async () => {
    const createRes = await agent.post('/api/admin/roles').send({
      name: 'Custom QA Role',
      permissionPreset: 'standard',
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.name).toBe('Custom QA Role');
    expect(createRes.body.isSystem).toBe(false);

    const roleId = createRes.body.id;

    const patchRes = await agent.patch(`/api/admin/roles/${roleId}`).send({
      name: 'Renamed QA Role',
      pagePermissions: ['dashboard', 'projects', 'todo'],
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body.name).toBe('Renamed QA Role');
    expect(patchRes.body.pagePermissions).toEqual(expect.arrayContaining(['dashboard', 'projects']));

    const deleteRes = await agent.delete(`/api/admin/roles/${roleId}`);
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  it('blocks deleting system roles, admin roles, and roles with assigned users', async () => {
    await seedDepartments();

    const adminDept = await Department.findOne({ slug: 'admin' });
    const systemDelete = await agent.delete(`/api/admin/roles/${adminDept._id}`);
    expect(systemDelete.statusCode).toBe(403);
    expect(systemDelete.body.error).toMatch(/system role/i);

    const salesDept = await Department.findOne({ slug: 'sales' });
    const salesDelete = await agent.delete(`/api/admin/roles/${salesDept._id}`);
    expect(salesDelete.statusCode).toBe(403);
    expect(salesDelete.body.error).toMatch(/system role/i);

    const customAdmin = await adminRolesService.createOrgRole({
      name: 'Custom Admin Role',
      permissionPreset: 'admin',
    });
    const adminDelete = await agent.delete(`/api/admin/roles/${customAdmin.id}`);
    expect(adminDelete.statusCode).toBe(403);
    expect(adminDelete.body.error).toMatch(/admin role/i);

    const custom = await adminRolesService.createOrgRole({ name: 'Assigned Role Test' });
    const memberEmail = `roles-member-${Date.now()}@coreknot-test.local`;
    const memberReg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Role Member',
        email: memberEmail,
        password: DEV_DEFAULT_PASSWORD,
        gender: 'male',
      });
    expect(memberReg.statusCode).toBe(201);
    await User.findByIdAndUpdate(memberReg.body._id, { departmentId: custom.id });

    const blocked = await agent.delete(`/api/admin/roles/${custom.id}`);
    expect(blocked.statusCode).toBe(400);
    expect(blocked.body.error).toMatch(/assigned user/i);
  });
});
