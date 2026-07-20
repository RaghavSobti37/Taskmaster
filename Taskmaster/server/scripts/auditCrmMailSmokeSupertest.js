/**
 * CRM/Mail migration smoke via supertest (no listen).
 * server/: node scripts/auditCrmMailSmokeSupertest.js
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
  { group: 'mail', path: '/api/mail/stats', allowUnavailable: true },
  { group: 'mail-moved', path: '/api/mail/templates', moved: true },
  { group: 'mail-moved', path: '/api/mail/profiles', moved: true },
  { group: 'mail-moved', path: '/api/mail/holysheet/all', moved: true, adminOnly: true },
  { group: 'campaigns-moved', path: '/api/campaigns', moved: true },
  { group: 'newsletter-moved', path: '/api/newsletter/categories', moved: true },
  { group: 'newsletter-moved', path: '/api/newsletter/issues/current', moved: true },
  { group: 'data-hub-moved', path: '/api/data-hub/folders', moved: true, adminOnly: true },
];

function summarizeEndpoint(ep, res) {
  const entry = {
    group: ep.group,
    path: ep.path,
    status: res.status,
    adminOnly: ep.adminOnly || false,
  };
  if (ep.moved) {
    entry.expected = 410;
    entry.ok = res.status === 410 && res.body?.service === 'auto-mailer';
    entry.autoMailerUrl = res.body?.url;
    entry.error = entry.ok ? undefined : (res.body?.error || 'Expected Auto-Mailer moved contract');
    return entry;
  }
  if (ep.allowUnavailable && res.status === 503) {
    entry.ok = true;
    entry.note = 'Stats proxy is configured at runtime with AUTO_MAILER_API_URL';
    entry.error = res.body?.error;
    return entry;
  }
  entry.ok = res.status < 400;
  entry.error = res.status >= 400 ? res.body?.error : undefined;
  return entry;
}

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
        ...summarizeEndpoint(ep, res),
      });
    }

    if (user.role === 'admin') {
      const browserCampaign = await agent.get('/api/campaigns/smoke-deep-link').set('Accept', 'text/html');
      results.push({
        role: user.role,
        group: 'campaigns-moved',
        path: '/api/campaigns/smoke-deep-link',
        status: browserCampaign.status,
        expected: 308,
        ok: browserCampaign.status === 308 && /\/campaigns\/smoke-deep-link$/.test(browserCampaign.headers.location || ''),
        autoMailerUrl: browserCampaign.headers.location,
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

  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
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
}

module.exports = {
  ENDPOINTS,
  summarizeEndpoint,
};
