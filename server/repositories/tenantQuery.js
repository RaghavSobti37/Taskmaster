const { getTenantId } = require('../utils/tenantContext');
const { tenantIdFilter } = require('../utils/mongoId');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

/**
 * Build mongoose query options with tenant scope or explicit bypass.
 */
function tenantQueryOptions({ bypass = false, reason, tenantId } = {}) {
  if (bypass) return bypassOptions(reason || 'explicit');
  const tid = tenantId || getTenantId();
  if (tid) return { tenantId: tid };
  return {};
}

/**
 * Merge tenant filter into a query object when not bypassing.
 */
function withTenantFilter(filter = {}, { bypass = false, tenantId } = {}) {
  if (bypass) return { ...filter };
  const tid = tenantId || getTenantId();
  if (!tid) return { ...filter };
  return { ...filter, ...tenantIdFilter(tid) };
}

function applyToQuery(query, options = {}) {
  return query.setOptions(tenantQueryOptions(options));
}

module.exports = {
  tenantQueryOptions,
  withTenantFilter,
  applyToQuery,
};
