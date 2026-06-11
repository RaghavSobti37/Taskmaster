const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const Lead = require('../domains/crm/models/Lead');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { PRESET_PAGES } = require('../utils/pagePermissions');

async function ensureSalesDept() {
  let dept = await Department.findOne({ slug: 'sales' });
  if (!dept) {
    dept = await Department.create({
      name: 'Sales',
      slug: 'sales',
      permissionPreset: 'sales',
      pagePermissions: PRESET_PAGES.sales,
    });
  }
  return dept;
}

async function registerAndLogin(agent, email, name) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);

  const login = await agent.post('/api/auth/login').send({
    email,
    password: DEV_DEFAULT_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
  return reg.body._id;
}

describe('CRM API integration', () => {
  let salesAgent;
  let outsiderAgent;
  let stamp;

  beforeEach(async () => {
    stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const salesDept = await ensureSalesDept();
    salesAgent = request.agent(app);
    outsiderAgent = request.agent(app);

    const salesUserId = await registerAndLogin(
      salesAgent,
      `crm-sales-${stamp}@coreknot-test.local`,
      'CRM Sales Rep'
    );
    await User.findByIdAndUpdate(salesUserId, { departmentId: salesDept._id });

    const outsiderId = await registerAndLogin(
      outsiderAgent,
      `crm-outsider-${stamp}@coreknot-test.local`,
      'CRM Outsider'
    );
    const creativeDept = await Department.findOne({ slug: 'creative' })
      || await Department.create({
        name: 'Creative',
        slug: 'creative',
        permissionPreset: 'creative',
        pagePermissions: PRESET_PAGES.creative,
      });
    await User.findByIdAndUpdate(outsiderId, { departmentId: creativeDept._id });
  });

  it('creates lead, converts status, and lists followups', async () => {
    const leadPhone = `+9198765${String(Date.now()).slice(-5)}`;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const followupDate = tomorrow.toISOString().slice(0, 10);

    const createRes = await salesAgent.post('/api/crm/leads').send({
      name: 'Integration Lead',
      phone: leadPhone,
      email: `lead-${stamp}@coreknot-test.local`,
      leadStatus: 'New',
      nextFollowupDate: followupDate,
      nextFollowupTime: '10:00',
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.name).toBe('Integration Lead');
    expect(createRes.body.leadStatus).toBe('New');

    const leadId = createRes.body._id;

    const listRes = await salesAgent.get('/api/crm/leads');
    expect(listRes.statusCode).toBe(200);
    const leads = listRes.body.data || listRes.body.leads || listRes.body;
    const rows = Array.isArray(leads) ? leads : leads?.data || [];
    expect(rows.some((l) => String(l._id) === String(leadId))).toBe(true);

    const convertRes = await salesAgent.put(`/api/crm/leads/${leadId}`).send({
      leadStatus: 'Converted',
      callStatus: 'Connected',
    });
    expect(convertRes.statusCode).toBe(200);
    expect(convertRes.body.leadStatus).toBe('Converted');

    const followupsRes = await salesAgent.get('/api/crm/followups');
    expect(followupsRes.statusCode).toBe(200);
    const followups = followupsRes.body.data || followupsRes.body;
    const match = (Array.isArray(followups) ? followups : []).find(
      (f) => String(f._id) === String(leadId)
    );
    expect(match).toBeDefined();
    expect(match.status).toBe('Completed');
  });

  it('rejects unauthenticated CRM lead list', async () => {
    const res = await request(app).get('/api/crm/leads');
    expect(res.statusCode).toBe(401);
  });

  it('blocks CRM access for users without CRM page permission', async () => {
    const res = await outsiderAgent.get('/api/crm/leads');
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/CRM access required/i);
  });

  it('sales rep can delete own scoped lead', async () => {
    const leadPhone = `+9198765${String(Date.now()).slice(-5)}`;
    const createRes = await salesAgent.post('/api/crm/leads').send({
      name: 'Delete Own Lead',
      phone: leadPhone,
      email: `delete-own-${stamp}@coreknot-test.local`,
      leadStatus: 'New',
    });
    expect(createRes.statusCode).toBe(201);

    const salesUser = await User.findOne({ email: `crm-sales-${stamp}@coreknot-test.local` });
    await Lead.findByIdAndUpdate(createRes.body._id, { assignedRepId: salesUser._id });

    const deleteRes = await salesAgent.delete(`/api/crm/leads/${createRes.body._id}`);
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body.message).toMatch(/permanently deleted/i);

    const getRes = await salesAgent.get(`/api/crm/leads/${createRes.body._id}`);
    expect(getRes.statusCode).toBe(404);
  });

  it('sales rep cannot delete another rep scoped lead', async () => {
    const salesUser = await User.findOne({ email: `crm-sales-${stamp}@coreknot-test.local` });
    const otherRep = await User.create({
      name: 'Other Sales Rep',
      email: `crm-other-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
      departmentId: salesUser.departmentId,
    });

    const lead = await Lead.create({
      name: 'Other Rep Lead',
      phone: `+9198765${String(Date.now() + 1).slice(-5)}`,
      email: `other-rep-${stamp}@coreknot-test.local`,
      leadStatus: 'New',
      assignedRepId: otherRep._id,
      crmType: 'sales',
    });

    const deleteRes = await salesAgent.delete(`/api/crm/leads/${lead._id}`);
    expect(deleteRes.statusCode).toBe(404);
    expect(deleteRes.body.error).toMatch(/not found/i);

    await Lead.deleteOne({ _id: lead._id });
    await User.deleteOne({ _id: otherRep._id });
  });

  it('blocks lead delete for users without CRM page permission', async () => {
    const lead = await Lead.create({
      name: 'Protected Lead',
      phone: `+9198765${String(Date.now() + 2).slice(-5)}`,
      leadStatus: 'New',
      crmType: 'sales',
    });

    const deleteRes = await outsiderAgent.delete(`/api/crm/leads/${lead._id}`);
    expect(deleteRes.statusCode).toBe(403);
    expect(deleteRes.body.error).toMatch(/CRM access required/i);

    await Lead.deleteOne({ _id: lead._id });
  });

  it('schedules followup and returns pending status before conversion', async () => {
    const leadPhone = `+9198765${String(Date.now()).slice(-5)}`;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const followupDate = tomorrow.toISOString().slice(0, 10);

    const createRes = await salesAgent.post('/api/crm/leads').send({
      name: 'Followup Lead',
      phone: leadPhone,
      nextFollowupDate: followupDate,
      nextFollowupTime: '14:30',
    });
    expect(createRes.statusCode).toBe(201);

    const followupsRes = await salesAgent.get('/api/crm/followups');
    expect(followupsRes.statusCode).toBe(200);
    const followups = followupsRes.body.data || followupsRes.body;
    const match = (Array.isArray(followups) ? followups : []).find(
      (f) => String(f._id) === String(createRes.body._id)
    );
    expect(match).toBeDefined();
    expect(match.status).toBe('Pending');
    expect(match.date).toBe(followupDate);
  });
});
