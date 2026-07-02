const SENSITIVE_KEY_RE = /password|token|secret|authorization|cookie|card|cvv|ssn/i;

const redactValue = (value, depth = 0) => {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      out[key] = redactValue(val, depth + 1);
    } else {
      out[key] = val;
    }
  }
  return out;
};

const summarizeBody = (body) => {
  if (body == null) return null;
  if (Buffer.isBuffer(body)) return { _type: 'buffer', length: body.length };
  if (typeof body !== 'object') return { value: String(body).slice(0, 500) };
  return redactValue(body);
};

const inferAction = (method, path = '') => {
  const m = String(method || 'GET').toUpperCase();
  const p = String(path || '');
  if (p.includes('/approve')) return 'APPROVE';
  if (p.includes('/reject')) return 'REJECT';
  if (p.includes('/reconcile')) return 'RECONCILE';
  if (p.includes('/backup')) return 'BACKUP';
  if (p.includes('/sessions/revoke')) return 'REVOKE_SESSIONS';
  if (m === 'POST') return 'CREATE';
  if (m === 'PUT' || m === 'PATCH') return 'UPDATE';
  if (m === 'DELETE') return 'DELETE';
  return m;
};

const inferResourceType = (path = '') => {
  const p = String(path || '');
  if (p.includes('/finance')) return 'Finance';
  if (p.includes('/users')) return 'User';
  if (p.includes('/platform-settings')) return 'PlatformSettings';
  if (p.includes('/data-hub')) return 'DataHub';
  if (p.includes('/tenants')) return 'Tenant';
  return 'Resource';
};

module.exports = {
  redactValue,
  summarizeBody,
  inferAction,
  inferResourceType,
  SENSITIVE_KEY_RE,
};
