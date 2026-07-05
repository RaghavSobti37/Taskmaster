/**
 * Enterprise E2E smoke — requires Mongo:
 *   node server/scripts/enterpriseSmoke.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const request = require('supertest');

async function main() {
  const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO) {
    console.error('MONGO_URI required');
    process.exit(1);
  }

  const app = require('../server');
  const User = require('../models/User');
  const Tenant = require('../models/Tenant');
  const TenantMembership = require('../models/TenantMembership');
  const Department = require('../models/Department');
  const AuditEvent = require('../models/AuditEvent');
  const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
  const { mintSessionAgent, mockAuthReq, mockAuthRes } = require('../tests/helpers/mintTestSession');
  const { PRESET_PAGES } = require('../utils/pagePermissions');
  const { finishAuthSession } = require('../utils/sessionRegistry');
  const { COOKIE_NAME } = require('../utils/authCookie');

  const stamp = Date.now();
  const results = [];
  const log = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  await mongoose.connect(MONGO);

  let dept = await Department.findOne({ slug: 'admin' });
  if (!dept) {
    dept = await Department.create({
      name: 'Admin',
      slug: 'admin',
      permissionPreset: 'admin',
      pagePermissions: PRESET_PAGES.admin,
    });
  }

  const email = `enterprise-smoke-${stamp}@coreknot-test.local`;
  await User.deleteOne({ email });
  const tenant = await Tenant.create({
    name: `Smoke Org ${stamp}`,
    slug: `smoke-${stamp}`,
    contactEmail: email,
    plan: 'enterprise',
    featureUnlocks: { resend: true, finance: true, knowledgeEngine: true },
  });
  const user = await User.create({
    name: 'Enterprise Smoke',
    email,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
    departmentId: dept._id,
    tenantId: tenant._id,
  });
  await TenantMembership.create({
    tenantId: tenant._id,
    userId: user._id,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  });

  const agent = request.agent(app);
  const req = mockAuthReq();
  const res = mockAuthRes();
  await finishAuthSession(req, res, user._id, String(tenant._id));
  agent.set('Cookie', `${COOKIE_NAME}=${res.getCookie(COOKIE_NAME)}`);

  const usage = await agent.get('/api/enterprise/usage');
  log('GET /api/enterprise/usage', usage.status === 200, `plan=${usage.body?.plan}`);

  const audit = await agent.get('/api/enterprise/audit');
  log('GET /api/enterprise/audit', audit.status === 200);

  const secPatch = await agent.patch('/api/enterprise/security').send({
    security: { mfaRequired: true },
  });
  log('PATCH /api/enterprise/security', secPatch.status === 200);

  const scimTokenRes = await agent.post('/api/enterprise/scim/token');
  log('POST /api/enterprise/scim/token', scimTokenRes.status === 201 && !!scimTokenRes.body?.token);

  const scimBearer = scimTokenRes.body?.token;
  if (scimBearer) {
    const scimList = await request(app)
      .get('/api/scim/v2/Users')
      .set('Authorization', `Bearer ${scimBearer}`);
    log('GET /api/scim/v2/Users (auth)', scimList.status === 200);

    const scimEmail = `scim-${stamp}@coreknot-test.local`;
    const scimPost = await request(app)
      .post('/api/scim/v2/Users')
      .set('Authorization', `Bearer ${scimBearer}`)
      .send({ userName: scimEmail, emails: [{ value: scimEmail }] });
    log('POST /api/scim/v2/Users (provision)', scimPost.status === 201);
    await User.deleteOne({ email: scimEmail });
  } else {
    log('GET /api/scim/v2/Users (auth)', false, 'no token');
    log('POST /api/scim/v2/Users (provision)', false, 'no token');
  }

  const unauthScim = await request(app).get('/api/scim/v2/Users');
  log('GET /api/scim/v2/Users (401 without bearer)', unauthScim.status === 401);

  const auditAfter = await AuditEvent.countDocuments({ tenantId: tenant._id, action: 'tenant.security.updated' });
  log('Audit on security patch', auditAfter >= 1);

  const role = await agent.post('/api/enterprise/roles').send({
    name: 'Sales Scoped',
    pageKeys: ['crm'],
    resourceScopes: ['workspace:sales'],
  });
  log('POST /api/enterprise/roles', role.status === 201);

  const keyRes = await agent.post('/api/enterprise/api-keys').send({ name: 'smoke-key', scopes: ['read'] });
  log('POST /api/enterprise/api-keys', keyRes.status === 201 && !!keyRes.body?.key);

  if (keyRes.body?.key) {
    const apiHealth = await request(app)
      .get('/api/v1/health')
      .set('Authorization', `Bearer ${keyRes.body.key}`);
    log('GET /api/v1/health (API key)', apiHealth.status === 200);
  }

  const hookRes = await agent.post('/api/enterprise/webhooks').send({
    url: 'https://httpbin.org/post',
    events: ['lead.created'],
  });
  log('POST /api/enterprise/webhooks', hookRes.status === 201 && !!hookRes.body?.secret);

  const exportRes = await agent.post('/api/enterprise/export');
  log('POST /api/enterprise/export', exportRes.status === 202 && !!exportRes.body?.jobId);

  const statusRes = await agent.get('/api/enterprise/status');
  log('GET /api/enterprise/status', statusRes.status === 200);

  const auditCsv = await agent.get('/api/enterprise/audit/export');
  log('GET /api/enterprise/audit/export', auditCsv.status === 200 && String(auditCsv.text || '').includes('timestamp'));

  await Tenant.updateOne({ _id: tenant._id }, { plan: 'free' });
  const keyBlocked = await agent.post('/api/enterprise/api-keys').send({ name: 'blocked' });
  log('API keys blocked on free plan', keyBlocked.status === 402);

  await AuditEvent.deleteMany({ tenantId: tenant._id });
  await TenantMembership.deleteMany({ tenantId: tenant._id });
  await User.deleteOne({ _id: user._id });
  await Tenant.deleteOne({ _id: tenant._id });
  await mongoose.disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSmoke: ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
