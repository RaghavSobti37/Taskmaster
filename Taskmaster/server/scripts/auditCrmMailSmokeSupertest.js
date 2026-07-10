/**
 * CRM/Mail API smoke via supertest (no listen). server/: node scripts/auditCrmMailSmokeSupertest.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../app/createApp');
const { registerRoutes } = require('../app/registerRoutes');

const USERS = [
  { role: 'admin', email: 'e2e-dept-admin@test.coreknot.local', password: '1Million#' },
  { role: 'sales', email: 'e2e-dept-sales@test.coreknot.local', password: '1Million#' },
];

const ENDPOINTS = [
  { group: 'crm', path: '/api/crm/config' },
  { group: 'crm', path: '/api/crm/stats' },
  { group: 'crm', path: '/api/crm/leads?limit=5' },
  { group: 'crm', path: '/api/crm/followups' },
  { group: 'crm', path: '/api/crm/leads/audit-logs', adminOnly: true },
  { group: 'contacts', path: '/api/contacts' },
  { group: 'mail', path: '/api/mail/stats' },
  { group: 'mail', path: '/api/mail/templates' },
  { group: 'mail', path: '/api/mail/templates/pending' },
  { group: 'mail', path: '/api/mail/profiles' },
  { group: 'mail', path: '/api/mail/holysheet/all', adminOnly: true },
  { group: 'campaigns', path: '/api/campaigns' },
  { group: 'newsletter', path: '/api/newsletter/categories' },
  { group: 'newsletter', path: '/api/newsletter/issues/current' },
  { group: 'data-hub', path: '/api/data-hub/folders', adminOnly: true },
];

async function loginAgent(app, email, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  return { agent, status: res.status, ok: res.status === 200, error: res.body?.error };
}

async function main() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  const SystemHealthService = require('../services/SystemHealthService');
  await SystemHealthService.checkDependencies();

  const app = createApp();
  registerRoutes(app);

  const results = [];
  let issueId = null;
  let adminCampaignCount = null;
  let salesCampaignCount = null;

  for (const user of USERS) {
    const { agent, status, ok, error } = await loginAgent(app, user.email, user.password);
    if (!ok) {
      results.push({ role: user.role, login: status, loginError: error, skipped: true });
      continue;
    }

    for (const ep of ENDPOINTS) {
      const res = await agent.get(ep.path);
      results.push({
        role: user.role,
        group: ep.group,
        path: ep.path,
        status: res.status,
        adminOnly: ep.adminOnly || false,
        error: res.status >= 400 ? res.body?.error : undefined,
      });
    }

    const campRes = await agent.get('/api/campaigns');
    const count = Array.isArray(campRes.body) ? campRes.body.length : null;
    if (user.role === 'admin') adminCampaignCount = count;
    if (user.role === 'sales') salesCampaignCount = count;

    if (user.role === 'admin') {
      const cur = await agent.get('/api/newsletter/issues/current');
      issueId = cur.body?.issue?._id;
      if (issueId) {
        const preview = await agent.get(`/api/newsletter/issues/${issueId}/preview`);
        results.push({
          role: user.role,
          group: 'newsletter',
          path: `/api/newsletter/issues/${issueId}/preview`,
          status: preview.status,
          adminOnly: true,
          error: preview.status >= 400 ? preview.body?.error : undefined,
        });
      }
    }

    if (user.role === 'sales' && issueId) {
      const preview = await agent.get(`/api/newsletter/issues/${issueId}/preview`);
      results.push({
        role: user.role,
        group: 'newsletter',
        path: `/api/newsletter/issues/${issueId}/preview`,
        status: preview.status,
        adminOnly: true,
        error: preview.status >= 400 ? preview.body?.error : undefined,
      });
      const sendProbe = await agent.post(`/api/newsletter/issues/${issueId}/send`).send({});
      results.push({
        role: user.role,
        group: 'newsletter',
        path: `/api/newsletter/issues/${issueId}/send`,
        status: sendProbe.status,
        adminOnly: true,
        error: sendProbe.status >= 400 ? sendProbe.body?.error : undefined,
      });
      const holysheet = await agent.get('/api/mail/holysheet/all');
      results.push({
        role: user.role,
        group: 'mail',
        path: '/api/mail/holysheet/all',
        status: holysheet.status,
        adminOnly: true,
        error: holysheet.status >= 400 ? holysheet.body?.error : undefined,
      });
    }

    if (user.role === 'sales') {
      const leadsRes = await agent.get('/api/crm/leads?limit=1');
      const total = leadsRes.body?.total;
      const scopedRes = await agent.get(`/api/crm/leads?limit=1&assignedRepId=${leadsRes.body?.leads?.[0]?.assignedRepId || 'all'}`);
      results.push({
        role: user.role,
        group: 'crm',
        path: 'scope-check',
        status: leadsRes.status,
        note: `leads total=${total}, filter probe status=${scopedRes.status}`,
      });
    }
  }

  results.push({
    role: 'compare',
    group: 'campaigns',
    path: '/api/campaigns count',
    adminCount: adminCampaignCount,
    salesCount: salesCampaignCount,
    note: 'Admin should see all org campaigns; list currently filters createdBy for all roles',
  });

  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
  });
