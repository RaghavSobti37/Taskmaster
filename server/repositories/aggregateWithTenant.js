const { getTenantId } = require('../utils/tenantContext');
const { tenantIdFilter } = require('../utils/mongoId');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

/**
 * Run aggregation with tenant $match injected unless bypassed.
 */
async function aggregateWithTenant(Model, pipeline, options = {}) {
  const { bypass = false, reason, tenantId, matchAtStart = true } = options;
  let pipe = [...pipeline];

  if (!bypass) {
    const tid = tenantId || getTenantId();
    if (tid) {
      const tenantMatch = { $match: tenantIdFilter(tid) };
      pipe = matchAtStart ? [tenantMatch, ...pipe] : [...pipe, tenantMatch];
    }
  }

  const agg = Model.aggregate(pipe);
  if (bypass) agg.option(bypassOptions(reason || 'aggregate'));
  return agg;
}

module.exports = { aggregateWithTenant };
