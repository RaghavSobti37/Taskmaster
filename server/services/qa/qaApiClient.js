const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Department = require('../../models/Department');
const { ADMIN_SLUG, OPS_SLUG, SALES_SLUG } = require('../../utils/departmentPermissions');
const { getDefaultSeedPassword } = require('../../utils/defaultPassword');
const { buildQaUserFilter, qaUniqueEmail } = require('./qaTestData');
const { reportQaActivity, sanitizePayload } = require('./qaActivity');

const BYPASS = { bypassTenant: true };

const QA_API_BASE = () =>
  (process.env.QA_API_BASE_URL || process.env.API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

function authHeaders(user) {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

let cachedUsers = null;

function clearResolveTestUsersCache() {
  cachedUsers = null;
}

/** Only QA-pattern probe accounts — never real staff (purged after each run). */
async function ensureQaProbeUser({ departmentId, roleLabel = 'any' } = {}) {
  const populate = { path: 'departmentId', select: 'name slug' };
  const label = String(roleLabel || 'any').replace(/[^a-z0-9]+/gi, ' ').trim() || 'any';
  const created = await User.create({
    name: `QA ${label.charAt(0).toUpperCase()}${label.slice(1)} Probe`,
    email: qaUniqueEmail(`qa-${label.toLowerCase().replace(/\s+/g, '-')}`),
    password: getDefaultSeedPassword(),
    gender: 'male',
    ...(departmentId ? { departmentId } : {}),
  });
  return User.findById(created._id).setOptions(BYPASS).populate(populate).lean();
}

async function findProbeUser(filter = {}, roleLabel = 'any') {
  const populate = { path: 'departmentId', select: 'name slug' };
  const deptClause = filter.departmentId ? { departmentId: filter.departmentId } : {};
  const candidates = await User.find({ $and: [buildQaUserFilter(), deptClause] })
    .setOptions(BYPASS)
    .populate(populate)
    .limit(12)
    .lean();
  if (candidates[0]) return candidates[0];
  return ensureQaProbeUser({ departmentId: filter.departmentId, roleLabel });
}

async function resolveTestUsers() {
  if (cachedUsers) return cachedUsers;

  const anyUser = await findProbeUser({}, 'any');
  const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
  const opsDept = await Department.findOne({ slug: OPS_SLUG }).select('_id');
  const salesDept = await Department.findOne({ slug: SALES_SLUG }).select('_id');

  const adminUser = adminDept
    ? await findProbeUser({ departmentId: adminDept._id }, 'admin')
    : null;
  const opsUser = opsDept
    ? await findProbeUser({ departmentId: opsDept._id }, 'ops')
    : null;
  const salesUser = salesDept
    ? await findProbeUser({ departmentId: salesDept._id }, 'sales')
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractId(res, field = '_id') {
  const body = res?.data;
  return body?.[field] || body?.data?.[field] || body?.data?._id || body?._id;
}

async function request(def, { method, url, data, headers, user, skipAuth = false }) {
  const base = QA_API_BASE();
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`;
  const httpMethod = (method || 'GET').toUpperCase();
  const h = skipAuth
    ? { 'Content-Type': 'application/json', ...(headers || {}) }
    : { ...authHeaders(user || (await resolveTestUsers()).anyUser), ...(headers || {}) };
  if (def.category === 'business-logic' || def.category === 'permission') {
    h['x-qa-integration-probe'] = 'true';
  }

  reportQaActivity({
    method: httpMethod,
    url: fullUrl,
    requestBody: sanitizePayload(data),
    phase: 'http',
  });

  const started = Date.now();
  const res = await axios({
    method: httpMethod,
    url: fullUrl,
    data,
    headers: h,
    validateStatus: () => true,
    timeout: def.timeout || (def.category === 'business-logic' ? 45000 : 12000),
    maxRedirects: 0,
  });

  reportQaActivity({
    httpStatus: res.status,
    message: `${httpMethod} ${url} → ${res.status} (${Date.now() - started}ms)`,
    elapsedMs: Date.now() - started,
  });

  return res;
}

module.exports = {
  QA_API_BASE,
  authHeaders,
  resolveTestUsers,
  clearResolveTestUsersCache,
  isApiReachable,
  skipProbeResult,
  probeFail,
  probePass,
  request,
  sleep,
  extractId,
};
