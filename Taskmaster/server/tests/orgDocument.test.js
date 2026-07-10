const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const OrgDocument = require('../models/OrgDocument');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');

async function createUserWithDept(preset, slugPrefix) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dept = await Department.create({
    name: `${slugPrefix} ${stamp}`,
    slug: `${slugPrefix}-${stamp}`,
    permissionPreset: preset,
    pagePermissions: PRESET_PAGES[preset],
  });

  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name: `${slugPrefix} User`,
      email: `${slugPrefix}-${stamp}@coreknot-test.local`,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);
  await User.findByIdAndUpdate(reg.body._id, { departmentId: dept._id });

  const agent = request.agent(app);
  await mintSessionAgent(agent, reg.body._id);
  return { agent, userId: reg.body._id };
}

describe('org documents API', () => {
  it('blocks standard users without org_documents access', async () => {
    const { agent } = await createUserWithDept('standard', 'std-doc');

    const res = await agent.get('/api/org-documents');
    expect(res.statusCode).toBe(403);
  });

  it('allows ops users to create link documents and list them', async () => {
    const { agent, userId } = await createUserWithDept('ops', 'ops-doc');

    const create = await agent.post('/api/org-documents').send({
      title: 'Ops Policy',
      sourceType: 'link',
      externalUrl: 'https://example.com/policy',
      category: 'Policies',
      tags: ['ops', 'policy'],
    });
    expect(create.statusCode).toBe(201);
    expect(create.body.data.title).toBe('Ops Policy');
    expect(create.body.data.sourceType).toBe('link');

    const list = await agent.get('/api/org-documents');
    expect(list.statusCode).toBe(200);
    expect(list.body.data.some((d) => d.title === 'Ops Policy')).toBe(true);

    const del = await agent.delete(`/api/org-documents/${create.body.data._id}`);
    expect(del.statusCode).toBe(200);

    const remaining = await OrgDocument.find({ uploadedBy: userId });
    expect(remaining).toHaveLength(0);
  });

  it('filters by category query param', async () => {
    const { agent } = await createUserWithDept('ops', 'ops-filter');

    await agent.post('/api/org-documents').send({
      title: 'HR Doc',
      sourceType: 'link',
      externalUrl: 'https://example.com/hr',
      category: 'HR',
    });
    await agent.post('/api/org-documents').send({
      title: 'Legal Doc',
      sourceType: 'link',
      externalUrl: 'https://example.com/legal',
      category: 'Legal',
    });

    const hrOnly = await agent.get('/api/org-documents?category=HR');
    expect(hrOnly.statusCode).toBe(200);
    expect(hrOnly.body.data.every((d) => d.category === 'HR')).toBe(true);
    expect(hrOnly.body.data.some((d) => d.title === 'HR Doc')).toBe(true);
  });
});
