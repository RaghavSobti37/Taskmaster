const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const { hashSecret } = require('../utils/credentialEncryption');

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.ip || '';
}

function ipInCidr(ip, cidr) {
  if (!cidr || !ip) return false;
  if (!cidr.includes('/')) return ip === cidr.trim();
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!Number.isFinite(bits)) return false;
  const toNum = (addr) => addr.split('.').reduce((n, o) => (n << 8) + Number(o), 0);
  try {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toNum(ip) & mask) === (toNum(range) & mask);
  } catch {
    return false;
  }
}

async function resolvePrimaryTenantForUser(userId) {
  const membership = await TenantMembership.findOne({ userId, status: 'active' })
    .setOptions({ bypassTenant: true })
    .sort({ joinedAt: 1 });
  return membership?.tenantId || null;
}

async function assertLoginAllowed({ req, user, authMethod }) {
  const tenantId = user.tenantId || await resolvePrimaryTenantForUser(user._id);
  if (!tenantId) return null;

  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true })
    .select('security sso allowedEmailDomain domain');
  if (!tenant) return null;

  if (tenant.security?.ssoOnly && authMethod === 'email_password') {
    const err = new Error('Password login disabled — use your organization SSO');
    err.status = 403;
    err.code = 'SSO_ONLY';
    throw err;
  }

  const allowlist = tenant.security?.ipAllowlist || [];
  if (allowlist.length) {
    const ip = clientIp(req);
    const ok = allowlist.some((cidr) => ipInCidr(ip, cidr));
    if (!ok) {
      const err = new Error('Login blocked — IP not on organization allowlist');
      err.status = 403;
      err.code = 'IP_BLOCKED';
      throw err;
    }
  }

  if (tenant.security?.mfaRequired && user.mfa?.enabled !== true) {
    const err = new Error('MFA required by your organization — enable 2FA in Settings');
    err.status = 403;
    err.code = 'MFA_SETUP_REQUIRED';
    throw err;
  }

  return tenant;
}

function verifyScimBearer(tenant, bearer) {
  if (!bearer || !tenant?.sso?.scimBearerHash) return false;
  return tenant.sso.scimBearerHash === hashSecret(bearer);
}

function issueScimBearer() {
  const raw = `scim_${require('crypto').randomBytes(24).toString('base64url')}`;
  return { token: raw, prefix: raw.slice(0, 12), hash: hashSecret(raw) };
}

module.exports = {
  clientIp,
  assertLoginAllowed,
  verifyScimBearer,
  issueScimBearer,
  resolvePrimaryTenantForUser,
};
