/**
 * Reject client-supplied tenantId that does not match the authenticated user's tenant.
 */
function rejectClientTenantSpoof(req, res, next) {
  const supplied = req.body?.tenantId;
  if (supplied === undefined || supplied === null || supplied === '') {
    return next();
  }

  const userTenant = req.user?.tenantId || req.tenantId;
  if (!userTenant || String(supplied) !== String(userTenant)) {
    return res.status(403).json({
      success: false,
      message: 'Cross-tenant request rejected',
    });
  }

  return next();
}

module.exports = { rejectClientTenantSpoof };
