#!/usr/bin/env node
/**
 * Benchmark GET /api/* smoke routes — reports slow endpoints.
 * Usage: node scripts/apiPerfAudit.js [--base http://127.0.0.1:5000] [--threshold 5000]
 * Requires running server + valid admin session cookie or JWT in env API_TOKEN.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Department = require('../models/Department');
const { PRESET_PAGES } = require('../utils/pagePermissions');

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const thresholdIdx = args.indexOf('--threshold');
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : 'http://127.0.0.1:5000';
const API = `${BASE}/api`;
const THRESHOLD_MS = thresholdIdx >= 0 ? Number(args[thresholdIdx + 1]) : 5000;

const ROUTES = [
  '/health',
  '/auth/me',
  '/projects',
  '/projects/workspaces',
  '/tasks?scope=dashboard',
  '/tasks?scope=todo&page=1&limit=10',
  '/tasks?scope=review',
  '/users/directory?limit=100',
  '/users/team',
  '/logs?limit=5',
  '/logs/activity-grid',
  '/crm/stats',
  '/crm/leads?page=1&limit=5',
  '/calendar',
  '/teams',
  '/artists',
  '/dashboard/summary',
  '/dashboard/summary?fields=calendar',
  '/dashboard/attendance-overview?timeframe=7d',
  '/notifications',
  '/notifications/status-counts',
  '/announcements?includeExpired=false',
  '/attendance?start=2026-07-01&end=2026-07-01&mine=true',
  '/attendance/leave/requests?status=pending',
  '/departments',
  '/notes',
  '/pinboard',
  '/office-assets',
  '/contacts',
  '/mail/stats',
  '/gamification/leaderboard',
  '/finance/my-invoices?submissionType=reimbursement',
  '/google/accounts',
  '/customization/shortcuts',
  '/data-hub/backups',
  '/data-hub/backup/progress',
  '/admin/system-health',
  '/admin/scripts',
];

async function resolveToken() {
  if (process.env.API_TOKEN) return process.env.API_TOKEN;

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskmaster_local';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  let adminDept = await Department.findOne({ slug: 'admin' });
  if (!adminDept) {
    adminDept = await Department.create({
      name: 'Admin',
      slug: 'admin',
      permissionPreset: 'admin',
      pagePermissions: PRESET_PAGES.admin,
    });
  }

  let user = await User.findOne({ departmentId: adminDept._id }).select('_id email');
  if (!user) {
    user = await User.findOne().select('_id email');
  }
  if (!user) {
    throw new Error('No user in DB — log in once or set API_TOKEN');
  }

  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function benchRoute(token, route) {
  const url = route === '/health' ? `${BASE}/api/health` : `${API}${route}`;
  const start = Date.now();
  try {
    const res = await axios.get(url, {
      headers: token && route !== '/health'
        ? { Authorization: `Bearer ${token}`, 'x-skip-toast': 'true' }
        : { 'x-skip-toast': 'true' },
      validateStatus: () => true,
      timeout: 120000,
    });
    return {
      route,
      ms: Date.now() - start,
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
    };
  } catch (err) {
    return {
      route,
      ms: Date.now() - start,
      status: 0,
      ok: false,
      error: err.code || err.message,
    };
  }
}

async function main() {
  console.log(`API perf audit — base ${BASE}, slow >= ${THRESHOLD_MS}ms\n`);

  let token = null;
  try {
    token = await resolveToken();
  } catch (err) {
    console.warn(`Token bootstrap failed: ${err.message}`);
  }

  const results = [];
  for (const route of ROUTES) {
    const warm = await benchRoute(token, route);
    const measured = await benchRoute(token, route);
    results.push({ ...measured, warmMs: warm.ms });
    const flag = measured.ms >= THRESHOLD_MS ? ' SLOW' : '';
    console.log(
      `${measured.ok ? 'OK' : 'FAIL'} ${String(measured.ms).padStart(5)}ms (warm ${warm.ms}ms) [${measured.status}] ${route}${flag}`,
    );
  }

  const slow = results.filter((r) => r.ms >= THRESHOLD_MS).sort((a, b) => b.ms - a.ms);
  console.log(`\n--- Summary: ${results.length} routes, ${slow.length} slow (>= ${THRESHOLD_MS}ms) ---`);
  for (const row of slow) {
    console.log(`  ${row.ms}ms  ${row.route}`);
  }

  await mongoose.disconnect().catch(() => {});
  process.exit(slow.some((r) => !r.ok) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
