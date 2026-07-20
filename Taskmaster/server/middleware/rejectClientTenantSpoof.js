const SPOOF_KEYS = ['tenantId', 'organizationId', 'orgId'];

/** Routes that intentionally accept a different tenant than the current session. */
const SPOOF_EXEMPT = (path) => /\/api\/tenants\/select\b/.test(path);

function collectSuppliedTenantIds(req) {
  const values = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (SPOOF_KEYS.includes(key) && child !== undefined && child !== null && child !== '') {
        values.push(child);
      }
      visit(child);
    }
  };
  visit(req.body);
  visit(req.query);
  return values;
}

/**
 * Reject client-supplied tenantId/orgId that does not match session tenant.
 * Mount globally on /api after auth resolves req.tenantId where present.
 */
function rejectClientTenantSpoof(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const path = req.originalUrl || req.url || '';
  if (SPOOF_EXEMPT(path)) return next();

  const supplied = collectSuppliedTenantIds(req);
  if (!supplied.length) return next();

  const sessionTenant = req.tenantId || req.user?.tenantId;
  if (!sessionTenant) return next();

  const mismatch = supplied.some((v) => String(v) !== String(sessionTenant));
  if (mismatch) {
    return res.status(403).json({
      success: false,
      message: 'Cross-tenant request rejected',
      code: 'TENANT_SPOOF_REJECTED',
    });
  }

  return next();
}

module.exports = { rejectClientTenantSpoof };
