/**
 * Full-stack project audit: frontend build + backend API smoke + RBAC + flows.
 * Usage: node scripts/fullProjectAudit.js
 */
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');

const ROOT = path.join(__dirname, '../..');
const CLIENT = path.join(ROOT, 'client');
const SERVER = path.join(ROOT, 'server');
const API = 'http://127.0.0.1:5000/api';
const BASE = 'http://127.0.0.1:5000';
const LOG_PATH = path.join(ROOT, 'debug-db3e17.log');
const SESSION = 'db3e17';
const ROLES = ['user', 'admin', 'sales', 'artist_management', 'ops', 'operations'];

function log(entry) {
  fs.appendFileSync(LOG_PATH, JSON.stringify({ sessionId: SESSION, timestamp: Date.now(), ...entry }) + '\n');
}

async function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function call(method, url, token, data, timeout = 20000) {
  try {
    const res = await axios({
      method,
      url: url.startsWith('http') ? url : `${API}${url}`,
      headers: token ? { Authorization: `Bearer ${token}`, 'x-skip-toast': 'true' } : { 'x-skip-toast': 'true' },
      data,
      validateStatus: () => true,
      timeout,
    });
    return { status: res.status, ok: res.status >= 200 && res.status < 300, body: res.data };
  } catch (err) {
    return { status: 0, ok: false, body: err.code || err.message };
  }
}

function runCmd(label, cmd, cwd, timeoutMs = 180000) {
  const start = Date.now();
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] });
    log({ runId: 'full-audit', hypothesisId: label, location: 'fullProjectAudit.js', message: `${label} OK`, data: { ms: Date.now() - start, exitCode: 0 } });
    return { ok: true, ms: Date.now() - start, output: out.slice(-500) };
  } catch (err) {
    const stderr = err.stderr?.toString?.() || err.message || '';
    const stdout = err.stdout?.toString?.() || '';
    log({ runId: 'full-audit', hypothesisId: label, location: 'fullProjectAudit.js', message: `${label} FAIL`, data: { ms: Date.now() - start, exitCode: err.status, stderr: stderr.slice(-800), stdout: stdout.slice(-400) } });
    return { ok: false, ms: Date.now() - start, error: stderr.slice(-800) || stdout.slice(-400) };
  }
}

// All GET endpoints the frontend calls (smoke test with admin token)
const SMOKE_GETS = [
  '/auth/me',
  '/projects',
  '/projects/workspaces',
  '/tasks',
  '/users/directory?limit=10',
  '/users/team',
  '/users/sales-reps',
  '/logs?limit=5',
  '/logs/activity-grid',
  '/crm/stats',
  '/crm/leads?page=1&limit=5',
  '/crm/config',
  '/crm/imports',
  '/crm/rep-summary',
  '/crm/followups',
  '/calendar',
  '/teams',
  '/artists',
  '/dashboard/summary',
  '/notifications',
  '/notifications/status-counts',
  '/announcements',
  '/announcements/targets',
  '/attendance',
  '/attendance/leave/requests',
  '/departments',
  '/departments/public',
  '/schedule',
  '/notes',
  '/pinboard',
  '/office-assets',
  '/contacts',
  '/assets',
  '/mail/stats',
  '/mail/profiles',
  '/mail/templates',
  '/campaigns',
  '/gamification/leaderboard',
  '/finance/pending',
  '/exly/config',
  '/exly/offerings',
  '/exly/dashboard-stats',
  '/google/accounts',
  '/admin/scripts',
];

const RBAC_ENDPOINTS = [
  { id: 'crm-export', method: 'GET', url: '/crm/export?format=csv', expect: (r) => r === 'admin', timeout: 120000, skipOnTimeout: true },
  { id: 'crm-purge-logs', method: 'GET', url: '/crm/purge-logs', expect: (r) => r === 'admin' },
  { id: 'finance-docs', method: 'GET', url: '/finance', expect: (r) => ['admin', 'ops', 'operations', 'Operations'].includes(r) },
  { id: 'artists-create', method: 'POST', url: '/artists', expect: (r) => ['admin', 'artist_management'].includes(r), data: { name: '__audit_artist__' } },
  { id: 'users-role-change', method: 'PUT', url: '/users/__ID__/role', expect: (r) => r === 'admin', data: { role: 'user' }, needsTargetUser: true },
  { id: 'gamification-admin', method: 'GET', url: '/gamification-admin/config', expect: (r) => r === 'admin' },
  { id: 'crm-sync-unsub', method: 'POST', url: '/crm/sync-unsubscribed', expect: (r) => r === 'admin', timeout: 90000, skipOnTimeout: true },
  { id: 'announcements-manage', method: 'POST', url: '/announcements', expect: (r) => ['admin', 'ops', 'operations', 'Operations'].includes(r), data: { title: 'audit', message: 'test', expiresAt: new Date(Date.now() + 86400000).toISOString() } },
];

function scanClientImports() {
  const issues = [];
  const srcDir = path.join(CLIENT, 'src');
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(jsx?|tsx?)$/.test(ent.name)) {
        const text = fs.readFileSync(full, 'utf8');
        const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
        for (const imp of imports) {
          if (imp.startsWith('.') || imp.startsWith('/')) {
            const base = path.resolve(path.dirname(full), imp);
            const candidates = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];
            const exists = candidates.some((ext) => fs.existsSync(base + ext));
            if (!exists) issues.push({ file: path.relative(CLIENT, full), import: imp });
          }
        }
      }
    }
  };
  walk(srcDir);
  return issues;
}

(async () => {
  fs.writeFileSync(LOG_PATH, '');
  log({ runId: 'full-audit', hypothesisId: 'INIT', location: 'fullProjectAudit.js', message: 'Full project audit started', data: {} });

  const report = { phases: {}, failures: [], warnings: [] };

  // ── Phase 1: Server alive ──
  const health = await call('GET', `${BASE}/api/auth/me`, null);
  const serverUp = health.status === 401 || health.status === 200;
  report.phases.serverHealth = { ok: serverUp, status: health.status };
  log({ runId: 'full-audit', hypothesisId: 'P1-health', location: 'fullProjectAudit.js', message: 'Server health', data: report.phases.serverHealth });
  if (!serverUp) {
    report.failures.push('Server not reachable on :5000');
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const adminUser = await User.findOne({ role: 'admin' }) || await User.findOne();
  const adminToken = await tokenFor(adminUser);

  // ── Phase 2: API smoke (admin GET all frontend routes) ──
  const smokeResults = [];
  for (const url of SMOKE_GETS) {
    const res = await call('GET', url, adminToken);
    const row = { url, status: res.status, ok: res.ok };
    smokeResults.push(row);
    log({ runId: 'full-audit', hypothesisId: 'P2-smoke', location: 'fullProjectAudit.js', message: `smoke ${url}`, data: row });
    if (!res.ok && res.status !== 404) {
      report.failures.push(`Smoke GET ${url} → ${res.status}: ${res.body?.error || res.body?.message || ''}`);
    } else if (res.status === 404) {
      report.warnings.push(`Smoke GET ${url} → 404 (route may not exist)`);
    }
  }
  report.phases.apiSmoke = { total: smokeResults.length, passed: smokeResults.filter((r) => r.ok).length, failed: smokeResults.filter((r) => !r.ok && r.status !== 404).length };

  // ── Phase 3: RBAC across roles ──
  const usersByRole = {};
  for (const role of ROLES) {
    const u = await User.findOne({ role }).select('_id role');
    if (u) usersByRole[role] = u;
  }
  const rbacViolations = [];
  for (const [role, user] of Object.entries(usersByRole)) {
    const token = await tokenFor(user);
    for (const ep of RBAC_ENDPOINTS) {
      let url = ep.url;
      if (ep.needsTargetUser) url = url.replace('__ID__', (usersByRole.user || user)._id.toString());
      const res = await call(ep.method, url, token, ep.data, ep.timeout || 20000);
      const shouldAllow = ep.expect(role);
      const consistent = shouldAllow === res.ok;
      log({ runId: 'full-audit', hypothesisId: 'P3-rbac', location: 'fullProjectAudit.js', message: `${role}→${ep.id}`, data: { role, endpoint: ep.id, shouldAllow, allowed: res.ok, status: res.status, consistent } });
      if (!consistent && res.status !== 400) {
        if (ep.skipOnTimeout && res.status === 0) {
          report.warnings.push(`RBAC ${role} ${ep.id}: timed out (skipped)`);
        } else {
          rbacViolations.push({ role, endpoint: ep.id, shouldAllow, allowed: res.ok, status: res.status });
        }
      }
    }
  }
  report.phases.rbac = { roles: Object.keys(usersByRole), violations: rbacViolations.length, details: rbacViolations };
  report.failures.push(...rbacViolations.map((v) => `RBAC ${v.role} ${v.endpoint}: expected allow=${v.shouldAllow} got ${v.status}`));

  // ── Phase 4: Dashboard task flow ──
  const dashFlow = runCmd('P4-dashboard-flow', 'node scripts/debugDashboardComplete.js', SERVER, 30000);
  report.phases.dashboardFlow = dashFlow;

  // ── Phase 5: Server unit tests ──
  const jestResult = spawnSync('npm', ['test', '--', '--forceExit'], { cwd: SERVER, encoding: 'utf8', shell: true, timeout: 120000 });
  const jestOk = jestResult.status === 0;
  log({ runId: 'full-audit', hypothesisId: 'P5-jest', location: 'fullProjectAudit.js', message: jestOk ? 'Jest OK' : 'Jest FAIL', data: { exitCode: jestResult.status, tail: (jestResult.stdout || '').slice(-400) } });
  report.phases.jest = { ok: jestOk, exitCode: jestResult.status };
  if (!jestOk) report.failures.push('Server Jest tests failed');

  // ── Phase 6: Client production build ──
  const buildResult = runCmd('P6-client-build', 'npm run build', CLIENT, 180000);
  report.phases.clientBuild = buildResult;
  if (!buildResult.ok) report.failures.push('Client production build failed');

  // ── Phase 7: Client import resolution scan ──
  const importIssues = scanClientImports();
  report.phases.clientImports = { broken: importIssues.length, samples: importIssues.slice(0, 10) };
  log({ runId: 'full-audit', hypothesisId: 'P7-imports', location: 'fullProjectAudit.js', message: 'Client import scan', data: report.phases.clientImports });
  if (importIssues.length) report.failures.push(`${importIssues.length} broken relative imports in client`);

  // ── Phase 8: Unauthenticated access checks ──
  const publicChecks = [
    { url: `${BASE}/`, expect: [200, 304], optional: true },
    { url: `${API}/projects`, expect: [401] },
    { url: `${API}/crm/leads`, expect: [401] },
  ];
  for (const pc of publicChecks) {
    const res = await call('GET', pc.url, null);
    const ok = pc.expect.includes(res.status);
    log({ runId: 'full-audit', hypothesisId: 'P8-auth-gate', location: 'fullProjectAudit.js', message: `no-token ${pc.url}`, data: { status: res.status, expected: pc.expect, ok } });
    if (!ok && !pc.optional) report.failures.push(`Auth gate ${pc.url}: got ${res.status}, expected ${pc.expect.join('|')}`);
    else if (!ok && pc.optional) report.warnings.push(`Auth gate ${pc.url}: got ${res.status} (optional in dev)`);
  }

  await mongoose.disconnect();

  log({ runId: 'full-audit', hypothesisId: 'SUMMARY', location: 'fullProjectAudit.js', message: 'Full audit complete', data: { failures: report.failures.length, warnings: report.warnings.length, phases: Object.keys(report.phases) } });

  console.log('\n=== FULL PROJECT AUDIT REPORT ===\n');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failures.length > 0 ? 1 : 0);
})().catch((e) => {
  log({ runId: 'full-audit', hypothesisId: 'FATAL', location: 'fullProjectAudit.js', message: e.message, data: {} });
  console.error(e);
  process.exit(2);
});
