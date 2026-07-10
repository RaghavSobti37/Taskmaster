/**
 * Trigger QA scan via running local API.
 * Auth: login cookie, or JWT signed after brief Mongo lookup (admin dept user).
 */
require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getDefaultSeedPassword } = require('../utils/defaultPassword');
const { ADMIN_SLUG } = require('../utils/departmentPermissions');

const BASE = (process.env.QA_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'REDACTED_ADMIN@example.com';
const DB_URI = process.env.QA_SCAN_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;

function parseCookies(setCookie = []) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

async function authHeaders() {
  try {
    const res = await axios.post(
      `${BASE}/api/auth/login`,
      { email: ADMIN_EMAIL, password: getDefaultSeedPassword() },
      { validateStatus: () => true, timeout: 8000 }
    );
    if (res.status === 200) {
      const cookie = parseCookies(res.headers['set-cookie']);
      if (cookie) return { Cookie: cookie };
    }
  } catch {
    /* fall through to JWT */
  }

  const presetUserId = process.env.QA_ADMIN_USER_ID;
  if (presetUserId && mongoose.Types.ObjectId.isValid(presetUserId)) {
    const token = jwt.sign({ id: presetUserId }, process.env.JWT_SECRET || 'secret');
    console.log('Auth via JWT (QA_ADMIN_USER_ID)');
    return { Authorization: `Bearer ${token}` };
  }

  if (!DB_URI) throw new Error('Login failed — set QA_ADMIN_USER_ID in .env or fix credentials');

  await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 20000 });
  const User = require('../models/User');
  const Department = require('../models/Department');
  const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
  const user = adminDept
    ? await User.findOne({ departmentId: adminDept._id }).select('_id')
    : await User.findOne().select('_id');
  await mongoose.disconnect();
  if (!user) throw new Error('No user found for JWT auth');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
  console.log('Auth via JWT (user', user._id.toString(), ')');
  return { Authorization: `Bearer ${token}` };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`API base: ${BASE}`);
  const headers = await authHeaders();

  let startRes = await axios.post(
    `${BASE}/api/qa/start`,
    { testAgentName: 'QA HTTP Runner', testRole: 'admin', permissions: [] },
    { headers, validateStatus: () => true, timeout: 15000 }
  );

  if (startRes.status === 400 && String(startRes.data?.error || '').includes('already running')) {
    console.log('Cancelling existing run…');
    const prog = await axios.get(`${BASE}/api/qa/progress`, { headers, validateStatus: () => true });
    const id = prog.data?.testRunId;
    if (id) {
      await axios.post(`${BASE}/api/qa/cancel/${id}`, {}, { headers, validateStatus: () => true });
      await sleep(2000);
    }
    startRes = await axios.post(
      `${BASE}/api/qa/start`,
      { testAgentName: 'QA HTTP Runner', testRole: 'admin', permissions: [] },
      { headers, validateStatus: () => true, timeout: 15000 }
    );
  }

  if (startRes.status !== 202) {
    throw new Error(`Start failed (${startRes.status}): ${JSON.stringify(startRes.data)}`);
  }

  const testRunId = startRes.data.testRunId || startRes.data.data?.testRunId;
  if (!testRunId) throw new Error(`Start OK but missing testRunId: ${JSON.stringify(startRes.data)}`);
  console.log('QA run started:', testRunId);

  let status = 'in-progress';
  while (status === 'in-progress' || status === 'pending' || status === 'running') {
    await sleep(2500);
    const p = await axios.get(`${BASE}/api/qa/progress?testRunId=${testRunId}`, { headers, validateStatus: () => true });
    status = p.data?.status || 'unknown';
    const cur = p.data?.progress?.current ?? 0;
    const tested = p.data?.pagesTestedCount ?? 0;
    const total = p.data?.progress?.totalPages ?? '?';
    const page = p.data?.progress?.currentPage || '';
    console.log(`  ${status} ${cur}% (${tested}/${total}) ${page.slice(0, 90)}`);
  }

  console.log('Finished with status:', status);

  const results = await axios.get(`${BASE}/api/qa/results/${testRunId}`, { headers, validateStatus: () => true });
  const cases = results.data?.testCases || [];
  const failed = cases.filter((t) => t.status === 'failed' || t.checkStatus === 'fail');
  const warned = cases.filter((t) => t.status === 'warn' || t.checkStatus === 'warn');

  console.log('\n=== SUMMARY ===');
  console.log('Total cases:', cases.length);
  console.log('Failed:', failed.length);
  console.log('Warn:', warned.length);
  if (results.data?.checklistSummary) {
    const s = results.data.checklistSummary;
    console.log(`Checklist: ${s.pass} pass / ${s.fail} fail / ${s.warn} warn / ${s.skip} skip`);
  }

  if (failed.length) {
    console.log('\n=== FAILURES ===');
    failed.forEach((t, i) => {
      console.log(`\n${i + 1}. ${t.name}`);
      console.log(`   category: ${t.category}`);
      console.log(`   error: ${t.error || t.description || '(none)'}`);
      if (t.evidence) console.log(`   evidence: ${String(t.evidence).slice(0, 400)}`);
    });
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  mongoose.disconnect().finally(() => process.exit(1));
});
