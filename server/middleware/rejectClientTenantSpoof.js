const SPOOF_KEYS = ['tenantId', 'organizationId', 'orgId'];

function collectSuppliedTenantIds(req) {
  const values = [];
  for (const key of SPOOF_KEYS) {
    const bodyVal = req.body?.[key];
    const queryVal = req.query?.[key];
    if (bodyVal !== undefined && bodyVal !== null && bodyVal !== '') values.push(bodyVal);
    if (queryVal !== undefined && queryVal !== null && queryVal !== '') values.push(queryVal);
  }
  return values;
}

/**
 * Reject client-supplied tenantId/orgId that does not match session tenant.
 * Mount globally on /api after auth resolves req.tenantId where present.
 */
function rejectClientTenantSpoof(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

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
