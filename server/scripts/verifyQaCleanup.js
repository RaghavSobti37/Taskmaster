/**
 * Run a small QA category set, wait for completion, verify QA-pattern rows are purged.
 * Usage: node scripts/verifyQaCleanup.js
 * Env: QA_API_BASE_URL (default http://127.0.0.1:5000), MONGODB_URI, JWT / login via triggerQaHttp auth
 */
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const { countQaResiduals, purgeQaTestData } = require('../services/qa/qaTestData');
const { repairCorruptLeadPhones } = require('../services/leadPhoneRepair');

const BASE = (process.env.QA_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const DB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
const CATEGORIES = (process.env.QA_VERIFY_CATEGORIES || 'input-validation,business-logic')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!DB_URI) throw new Error('Set MONGODB_URI');

  await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 20000 });

  const before = await countQaResiduals();
  console.log('Residuals BEFORE:', before);

  await purgeQaTestData();
  await repairCorruptLeadPhones();

  const { default: authHeaders } = { default: null };
  const { getDefaultSeedPassword } = require('../utils/defaultPassword');
  const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'REDACTED_ADMIN@example.com';
  let headers = {};
  const loginRes = await axios.post(
    `${BASE}/api/auth/login`,
    { email: ADMIN_EMAIL, password: getDefaultSeedPassword() },
    { validateStatus: () => true, timeout: 8000 }
  );
  if (loginRes.status === 200 && loginRes.headers['set-cookie']) {
    headers = { Cookie: loginRes.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ') };
  } else {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const Department = require('../models/Department');
    const { ADMIN_SLUG } = require('../utils/departmentPermissions');
    const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
    const user = adminDept
      ? await User.findOne({ departmentId: adminDept._id }).select('_id')
      : await User.findOne().select('_id');
    headers = { Authorization: `Bearer ${jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret')}` };
  }

  const prog = await axios.get(`${BASE}/api/qa/progress`, { headers, validateStatus: () => true });
  if (prog.data?.testRunId && ['pending', 'in-progress'].includes(prog.data?.status)) {
    await axios.post(`${BASE}/api/qa/cancel/${prog.data.testRunId}`, {}, { headers, validateStatus: () => true });
    await sleep(4000);
  }

  const startRes = await axios.post(
    `${BASE}/api/qa/start`,
    { testAgentName: 'QA Cleanup Verify', categories: CATEGORIES },
    { headers, validateStatus: () => true, timeout: 20000 }
  );
  if (startRes.status !== 202) {
    throw new Error(`QA start failed (${startRes.status}): ${JSON.stringify(startRes.data)}`);
  }
  const testRunId = startRes.data.testRunId;
  console.log('Started QA run:', testRunId, 'categories:', CATEGORIES.join(', '));

  let status = 'in-progress';
  while (status === 'in-progress' || status === 'pending') {
    await sleep(3000);
    const p = await axios.get(`${BASE}/api/qa/progress?testRunId=${testRunId}`, { headers, validateStatus: () => true });
    status = p.data?.status || 'unknown';
    console.log(`  status=${status} progress=${p.data?.progress?.current ?? 0}%`);
  }

  console.log('Run finished:', status);

  const results = await axios.get(`${BASE}/api/qa/results/${testRunId}`, { headers, validateStatus: () => true });
  const cleanup = results.data?.cleanupResults;
  console.log('cleanupResults:', JSON.stringify(cleanup, null, 2));

  await sleep(2000);
  const afterRun = await countQaResiduals();
  console.log('Residuals AFTER run (post-finally cleanup):', afterRun);

  if (afterRun.total > 0) {
    console.log('⚠️  Leftover QA rows detected — running manual purge…');
    await purgeQaTestData();
    await repairCorruptLeadPhones();
    const afterPurge = await countQaResiduals();
    console.log('Residuals AFTER manual purge:', afterPurge);
    if (afterPurge.total > 0) {
      console.error('FAIL: QA data still present after purge');
      process.exitCode = 1;
    } else {
      console.log('PASS after manual purge (auto-cleanup missed some rows)');
    }
  } else {
    console.log('PASS: no QA-pattern residuals after test run');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
