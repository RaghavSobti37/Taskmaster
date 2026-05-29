/**
 * Master RBAC + logic consistency audit.
 * Tests key endpoints across all role types found in DB.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');

const API = 'http://127.0.0.1:5000/api';
const LOG_PATH = path.join(__dirname, '../../debug-db3e17.log');
const SESSION = 'db3e17';

const ROLES = ['user', 'admin', 'sales', 'artist_management', 'ops', 'operations'];

function log(entry) {
  const line = JSON.stringify({ sessionId: SESSION, timestamp: Date.now(), ...entry }) + '\n';
  fs.appendFileSync(LOG_PATH, line);
}

async function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function call(method, url, token, data) {
  try {
    const res = await axios({
      method,
      url: `${API}${url}`,
      headers: { Authorization: `Bearer ${token}`, 'x-skip-toast': 'true' },
      data,
      validateStatus: () => true,
      timeout: 15000,
    });
    return { status: res.status, ok: res.status >= 200 && res.status < 300, body: res.data };
  } catch (err) {
    return { status: 0, ok: false, body: err.message };
  }
}

const ENDPOINTS = [
  { id: 'auth-me', method: 'GET', url: '/auth/me', expect: () => true },
  { id: 'crm-stats', method: 'GET', url: '/crm/stats', expect: () => true },
  { id: 'crm-leads', method: 'GET', url: '/crm/leads?page=1&limit=5', expect: () => true },
  { id: 'crm-export', method: 'GET', url: '/crm/export?format=csv', expect: (r) => r === 'admin' },
  { id: 'crm-purge-logs', method: 'GET', url: '/crm/purge-logs', expect: (r) => r === 'admin' },
  { id: 'finance-docs', method: 'GET', url: '/finance', expect: (r) => ['admin', 'ops', 'operations', 'Operations'].includes(r) },
  { id: 'finance-pending', method: 'GET', url: '/finance/pending', expect: (r) => ['admin', 'ops', 'operations', 'Operations'].includes(r) },
  { id: 'finance-submit', method: 'POST', url: '/finance/submit-invoice', expect: () => true, data: { title: 'audit-test', amount: 1 } },
  { id: 'artists-list', method: 'GET', url: '/artists', expect: () => true },
  { id: 'artists-create', method: 'POST', url: '/artists', expect: (r) => ['admin', 'artist_management'].includes(r), data: { name: '__audit_artist__' } },
  { id: 'users-directory', method: 'GET', url: '/users/directory', expect: () => true },
  { id: 'users-role-change', method: 'PUT', url: '/users/__ID__/role', expect: (r) => r === 'admin', data: { role: 'user' }, needsTargetUser: true },
  { id: 'announcements', method: 'GET', url: '/announcements', expect: () => true },
  { id: 'announcements-manage', method: 'POST', url: '/announcements', expect: (r) => ['admin', 'ops', 'operations', 'Operations'].includes(r), data: { title: 'audit', body: 'test', expiresAt: new Date(Date.now() + 86400000).toISOString() } },
  { id: 'attendance', method: 'GET', url: '/attendance', expect: () => true },
  { id: 'admin-logs', method: 'GET', url: '/logs', expect: () => true },
  { id: 'projects', method: 'GET', url: '/projects', expect: () => true },
  { id: 'tasks', method: 'GET', url: '/tasks', expect: () => true },
  { id: 'notifications', method: 'GET', url: '/notifications', expect: () => true },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  log({ runId: 'master-audit', hypothesisId: 'INIT', location: 'masterAudit.js', message: 'Audit started', data: {} });

  const usersByRole = {};
  for (const role of ROLES) {
    const u = await User.findOne({ role }).select('_id name email role');
    if (u) usersByRole[role] = u;
  }

  log({
    runId: 'master-audit',
    hypothesisId: 'H0',
    location: 'masterAudit.js',
    message: 'Users found per role',
    data: { roles: Object.keys(usersByRole), missing: ROLES.filter((r) => !usersByRole[r]) },
  });

  const violations = [];
  const results = [];

  for (const [role, user] of Object.entries(usersByRole)) {
    const token = await tokenFor(user);
    for (const ep of ENDPOINTS) {
      if (ep.dryRun) continue;
      let url = ep.url;
      if (ep.needsTargetUser) {
        const target = usersByRole.user || user;
        url = url.replace('__ID__', target._id.toString());
      }
      const res = await call(ep.method, url, token, ep.data);
      const shouldAllow = ep.expect(role);
      const allowed = res.ok;
      const consistent = shouldAllow === allowed;

      const row = { role, endpoint: ep.id, shouldAllow, allowed, status: res.status, consistent };
      results.push(row);

      log({
        runId: 'master-audit',
        hypothesisId: ep.id,
        location: 'masterAudit.js',
        message: `${role} → ${ep.id}`,
        data: row,
      });

      if (!consistent) {
        violations.push({ ...row, url: ep.url, error: res.body?.error || res.body?.message });
      }
    }
  }

  // H1: plain user can POST artist (UI blocks, API may not)
  if (usersByRole.user) {
    const token = await tokenFor(usersByRole.user);
    const create = await call('POST', '/artists', token, { name: '__rbac_probe__' });
    log({
      runId: 'master-audit',
      hypothesisId: 'H1',
      location: 'masterAudit.js',
      message: 'Artist create by plain user',
      data: { status: create.status, ok: create.ok, uiExpects403: true, apiAllows: create.ok },
    });
    if (create.ok) {
      violations.push({ role: 'user', endpoint: 'artists-create-bypass', shouldAllow: false, allowed: true, status: create.status });
      // cleanup
      const list = await call('GET', '/artists', token);
      const probe = Array.isArray(list.body) ? list.body.find((a) => a.name === '__rbac_probe__') : null;
      if (probe?._id) await call('DELETE', `/artists/${probe._id}`, token);
    }
  }

  // H4: ops role assignable via API?
  if (usersByRole.admin && usersByRole.user) {
    const adminToken = await tokenFor(usersByRole.admin);
    const tryOps = await call('PUT', `/users/${usersByRole.user._id}/role`, adminToken, { role: 'ops' });
    log({
      runId: 'master-audit',
      hypothesisId: 'H4',
      location: 'masterAudit.js',
      message: 'Admin assign ops role',
      data: { status: tryOps.status, ok: tryOps.ok, body: tryOps.body?.error || tryOps.body?.role },
    });
    if (!tryOps.ok && tryOps.body?.error?.includes('Invalid role')) {
      violations.push({ role: 'admin', endpoint: 'assign-ops-role', shouldAllow: true, allowed: false, status: tryOps.status, note: 'ops missing from validRoles' });
    }
    // restore
    await call('PUT', `/users/${usersByRole.user._id}/role`, adminToken, { role: 'user' });
  }

  // H5: sales user CRM reset access
  if (usersByRole.sales) {
    const salesToken = await tokenFor(usersByRole.sales);
    const resetProbe = await call('GET', '/crm/purge-logs', salesToken);
    log({
      runId: 'master-audit',
      hypothesisId: 'H5',
      location: 'masterAudit.js',
      message: 'Sales CRM purge-logs access',
      data: { status: resetProbe.status, ok: resetProbe.ok, uiRestricted: false, serverProtected: false },
    });
  }

  log({
    runId: 'master-audit',
    hypothesisId: 'SUMMARY',
    location: 'masterAudit.js',
    message: 'Audit complete',
    data: {
      totalChecks: results.length,
      violations: violations.length,
      violationDetails: violations.slice(0, 30),
    },
  });

  console.log(JSON.stringify({ violations: violations.length, details: violations }, null, 2));
  await mongoose.disconnect();
  process.exit(violations.length > 0 ? 1 : 0);
})().catch((e) => {
  log({ runId: 'master-audit', hypothesisId: 'FATAL', location: 'masterAudit.js', message: e.message, data: {} });
  console.error(e);
  process.exit(2);
});
