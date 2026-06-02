const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Department = require('../../models/Department');
const { ADMIN_SLUG, OPS_SLUG, SALES_SLUG } = require('../../utils/departmentPermissions');

const QA_API_BASE = () =>
  (process.env.QA_API_BASE_URL || process.env.API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

function authHeaders(user) {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

let cachedUsers = null;

async function resolveTestUsers() {
  if (cachedUsers) return cachedUsers;
  const populate = { path: 'departmentId', select: 'name slug' };
  const anyUser = await User.findOne().populate(populate);
  const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
  const opsDept = await Department.findOne({ slug: OPS_SLUG }).select('_id');
  const salesDept = await Department.findOne({ slug: SALES_SLUG }).select('_id');

  const adminUser = adminDept
    ? await User.findOne({ departmentId: adminDept._id }).populate(populate)
    : null;
  const opsUser = opsDept
    ? await User.findOne({ departmentId: opsDept._id }).populate(populate)
    : null;
  const salesUser = salesDept
    ? await User.findOne({ departmentId: salesDept._id }).populate(populate)
    : null;

  cachedUsers = {
    anyUser: anyUser || adminUser,
    adminUser: adminUser || anyUser,
    opsUser: opsUser || adminUser || anyUser,
    salesUser: salesUser || anyUser,
  };
  return cachedUsers;
}

async function isApiReachable() {
  try {
    await axios.get(`${QA_API_BASE()}/api/tasks`, { timeout: 4000, validateStatus: () => true });
    return true;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return false;
    return true;
  }
}

function skipProbeResult(def, reason) {
  return {
    passed: true,
    checkStatus: 'skip',
    checklistId: def.id,
    error: null,
    description: reason,
    evidence: QA_API_BASE(),
    category: def.category || 'input-validation',
    severity: 'low',
    message: `[SKIP] ${def.title}`,
  };
}

function probeFail(def, detail, evidence = '') {
  return {
    passed: false,
    checkStatus: 'fail',
    checklistId: def.id,
    error: detail,
    description: detail,
    evidence: String(evidence).slice(0, 2000),
    category: def.category || 'input-validation',
    severity: def.sev || 'high',
  };
}

function probePass(def, detail, evidence = '') {
  return {
    passed: true,
    checkStatus: 'pass',
    checklistId: def.id,
    error: null,
    description: detail,
    evidence: String(evidence).slice(0, 2000),
    category: def.category || 'input-validation',
    severity: 'low',
    message: def.title,
  };
}

async function request(def, { method, url, data, headers, user }) {
  const base = QA_API_BASE();
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`;
  const h = { ...authHeaders(user || (await resolveTestUsers()).anyUser), ...headers };
  return axios({
    method: method || 'GET',
    url: fullUrl,
    data,
    headers: h,
    validateStatus: () => true,
    timeout: def.timeout || 12000,
    maxRedirects: 0,
  });
}

module.exports = {
  QA_API_BASE,
  authHeaders,
  resolveTestUsers,
  isApiReachable,
  skipProbeResult,
  probeFail,
  probePass,
  request,
};
