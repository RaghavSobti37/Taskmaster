/**
 * Run QA upgrade layers (skip lighthouse for speed).
 * Usage: node scripts/runQaUpgradeSubset.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { getDefaultSeedPassword } = require('../utils/defaultPassword');
const { ADMIN_SLUG } = require('../utils/departmentPermissions');
const { countQaResiduals } = require('../services/qa/qaTestData');

const BASE = (process.env.QA_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const DB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
const CATEGORIES = (process.env.QA_UPGRADE_CATEGORIES || 'ui-discovery,permission,workflow,integration,visual-regression')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function authHeaders() {
  const presetUserId = process.env.QA_ADMIN_USER_ID;
  if (presetUserId && mongoose.Types.ObjectId.isValid(presetUserId)) {
    return { Authorization: `Bearer ${jwt.sign({ id: presetUserId }, process.env.JWT_SECRET || 'secret')}` };
  }
  if (!DB_URI) throw new Error('Set MONGODB_URI for JWT auth');
  const needsConnect = mongoose.connection.readyState !== 1;
  if (needsConnect) await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 15000 });
  const User = require('../models/User');
  const Department = require('../models/Department');
  const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
  const user = adminDept
    ? await User.findOne({ departmentId: adminDept._id }).select('_id')
    : await User.findOne().select('_id');
  if (needsConnect) await mongoose.disconnect();
  if (!user) throw new Error('No admin user for JWT');
  return { Authorization: `Bearer ${jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret')}` };
}

async function main() {
  console.log('QA Upgrade Subset — categories:', CATEGORIES.join(', '));
  if (DB_URI) await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 15000 });
  const before = DB_URI ? await countQaResiduals() : null;
  if (before) console.log('Residuals BEFORE:', before);
  const headers = await authHeaders();

  const prog = await axios.get(`${BASE}/api/qa/progress`, { headers, validateStatus: () => true });
  if (prog.data?.testRunId && ['pending', 'in-progress'].includes(prog.data?.status)) {
    await axios.post(`${BASE}/api/qa/cancel/${prog.data.testRunId}`, {}, { headers, validateStatus: () => true });
    await sleep(3000);
  }

  const startRes = await axios.post(
    `${BASE}/api/qa/start`,
    { testAgentName: 'QA Upgrade Runner', categories: CATEGORIES },
    { headers, validateStatus: () => true, timeout: 20000 }
  );
  if (startRes.status !== 202) {
    throw new Error(`Start failed (${startRes.status}): ${JSON.stringify(startRes.data)}`);
  }
  const testRunId = startRes.data.testRunId;
  console.log('Started:', testRunId);

  let status = 'in-progress';
  while (status === 'in-progress' || status === 'pending') {
    await sleep(2500);
    const p = await axios.get(`${BASE}/api/qa/progress?testRunId=${testRunId}`, { headers, validateStatus: () => true });
    status = p.data?.status || 'unknown';
    console.log(`  ${status} ${p.data?.progress?.current ?? 0}% — ${(p.data?.progress?.currentPage || '').slice(0, 70)}`);
  }

  const results = await axios.get(`${BASE}/api/qa/results/${testRunId}`, { headers, validateStatus: () => true });
  const data = results.data || {};
  console.log('\n=== EXECUTIVE SUMMARY ===');
  console.log(JSON.stringify(data.executiveSummary, null, 2));
  console.log('\n=== CLEANUP ===');
  console.log(JSON.stringify(data.cleanupVerification, null, 2));

  if (DB_URI && mongoose.connection.readyState === 1) {
    const after = await countQaResiduals();
    console.log('\nResiduals AFTER:', after);
    if (after.total > 0) process.exitCode = 1;
    await mongoose.disconnect();
  }

  const failed = (data.testCases || []).filter((t) => t.status === 'failed');
  console.log(`\nTotal: ${data.totalTests} | Failed: ${failed.length}`);
  failed.slice(0, 15).forEach((t, i) => console.log(`${i + 1}. ${t.name}: ${t.error || t.description}`));
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
