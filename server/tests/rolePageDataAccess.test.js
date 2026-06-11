const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const {
  PRESET_PAGES,
  hasPageAccess,
  hasCrmPageAccess,
  isOpsUser,
  CRM_PAGE_KEYS,
} = require('../utils/pagePermissions');

function deptUser(slug) {
  return {
    departmentId: {
      slug,
      permissionPreset: slug === 'operations' ? 'ops' : slug,
      pagePermissions: PRESET_PAGES[slug === 'operations' ? 'ops' : slug],
    },
  };
}

async function ensureDept(slug) {
  const preset = slug === 'operations' ? 'ops' : slug;
  let dept = await Department.findOne({ slug: preset === 'ops' ? 'ops' : slug });
  if (!dept) {
    dept = await Department.create({
      name: slug,
      slug: preset === 'ops' ? 'ops' : slug,
      permissionPreset: preset,
      pagePermissions: PRESET_PAGES[preset],
    });
  }
  return dept;
}

async function loginAsDept(agent, slug, stamp) {
  const dept = await ensureDept(slug);
  const email = `role-${slug}-${stamp}@coreknot-test.local`;
  await User.deleteOne({ email });
  await User.create({
    name: `${slug} user`,
    email,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
    departmentId: dept._id,
  });
  const login = await agent.post('/api/auth/login').send({ email, password: DEV_DEFAULT_PASSWORD });
  expect(login.statusCode).toBe(200);
}

describe('Role page + data access matrix', () => {
  const stamp = `${Date.now()}`;
  describe('page permission presets', () => {
    it('sales: CRM yes, finance no, admin_data no', () => {
      const user = deptUser('sales');
      expect(hasPageAccess(user, 'leads')).toBe(true);
      expect(hasPageAccess(user, 'finance')).toBe(false);
      expect(hasPageAccess(user, 'admin_data')).toBe(false);
      expect(hasCrmPageAccess(user)).toBe(true);
      expect(isOpsUser(user)).toBe(false);
    });

    it('ops: finance yes, CRM no', () => {
      const user = deptUser('ops');
      expect(hasPageAccess(user, 'finance')).toBe(true);
      expect(hasPageAccess(user, 'leads')).toBe(false);
      expect(hasCrmPageAccess(user)).toBe(false);
      expect(isOpsUser(user)).toBe(true);
    });

    it('artist-management: artists + CRM yes', () => {
      const user = deptUser('artist-management');
      expect(hasPageAccess(user, 'artists')).toBe(true);
      expect(hasPageAccess(user, 'leads')).toBe(true);
      expect(hasCrmPageAccess(user)).toBe(true);
    });

    it('creative: features/workflows yes, CRM no', () => {
      const user = deptUser('creative');
      expect(hasPageAccess(user, 'features')).toBe(true);
      expect(hasPageAccess(user, 'workflows')).toBe(true);
      expect(hasPageAccess(user, 'leads')).toBe(false);
      expect(hasCrmPageAccess(user)).toBe(false);
    });

    it('admin_artist_path falls back to admin_data', () => {
      const dataOnly = {
        departmentId: { slug: 'sales', permissionPreset: 'sales', pagePermissions: PRESET_PAGES.sales },
        pagePermissions: [...PRESET_PAGES.sales, 'admin_data'],
      };
      expect(hasPageAccess(dataOnly, 'admin_artist_path')).toBe(true);
    });

    it('CRM_PAGE_KEYS are the CRM hub children', () => {
      expect(CRM_PAGE_KEYS).toEqual(['leads', 'followups', 'bookings']);
    });
  });

  describe('API access gates', () => {
    let salesAgent;
    let opsAgent;
    let creativeAgent;
    let adminAgent;

    beforeEach(async () => {
      const runStamp = `${stamp}-${Date.now()}`;
      salesAgent = request.agent(app);
      opsAgent = request.agent(app);
      creativeAgent = request.agent(app);
      adminAgent = request.agent(app);
      await loginAsDept(salesAgent, 'sales', runStamp);
      await loginAsDept(opsAgent, 'ops', `${runStamp}-ops`);
      await loginAsDept(creativeAgent, 'creative', `${runStamp}-creative`);
      await loginAsDept(adminAgent, 'admin', `${runStamp}-admin`);
    });

    it('sales can list leads', async () => {
      const res = await salesAgent.get('/api/crm/leads');
      expect(res.statusCode).toBe(200);
    });

    it('ops cannot access CRM list without CRM pages', async () => {
      const res = await opsAgent.get('/api/crm/leads');
      expect(res.statusCode).toBe(403);
    });

    it('ops cannot access CRM followups', async () => {
      const res = await opsAgent.get('/api/crm/followups');
      expect(res.statusCode).toBe(403);
    });

    it('ops cannot access CRM stats', async () => {
      const res = await opsAgent.get('/api/crm/stats');
      expect(res.statusCode).toBe(403);
    });

    it('creative cannot access CRM', async () => {
      const res = await creativeAgent.get('/api/crm/leads');
      expect(res.statusCode).toBe(403);
    });

    it('sales can list office assets via equipment page', async () => {
      const res = await salesAgent.get('/api/office-assets');
      expect(res.statusCode).toBe(200);
    });

    it('creative can list office assets', async () => {
      const res = await creativeAgent.get('/api/office-assets');
      expect(res.statusCode).toBe(200);
    });

    it('sales cannot list data hub people', async () => {
      const res = await salesAgent.get('/api/data-hub/people');
      expect(res.statusCode).toBe(403);
    });

    it('admin can list data hub people', async () => {
      const res = await adminAgent.get('/api/data-hub/people');
      expect(res.statusCode).toBe(200);
    });
  });
});
