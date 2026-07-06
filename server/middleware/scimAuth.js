const Tenant = require('../models/Tenant');
const { verifyScimBearer } = require('../services/tenantSecurityService');
const { runWithContext } = require('../utils/tenantContext');
const asyncHandler = require('./asyncHandler');

const scimAuth = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!bearer) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'SCIM bearer token required',
      status: '401',
    });
  }
  const tenants = await Tenant.find({ 'sso.scimBearerHash': { $exists: true, $ne: null } })
    .setOptions({ bypassTenant: true })
    .select('+sso.scimBearerHash');
  const tenant = tenants.find((t) => verifyScimBearer(t, bearer));
  if (!tenant) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid SCIM token',
      status: '401',
    });
  }
  req.tenantId = tenant._id;
  req.scimTenant = tenant;
  return runWithContext({ tenantId: String(tenant._id) }, () => next());
});

module.exports = { scimAuth };
